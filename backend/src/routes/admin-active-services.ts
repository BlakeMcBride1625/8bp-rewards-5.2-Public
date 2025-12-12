import { Router } from 'express';
import { authenticateAdmin } from '../middleware/auth';
import { logger } from '../services/LoggerService';
import { HeartbeatRegistry } from '../services/HeartbeatRegistry';
import axios from 'axios';

const router = Router();

// Active Services endpoint - shows ALL running processes
router.get('/active-services', authenticateAdmin, async (req, res) => {
  try {
    // Cache for 30 seconds to reduce load
    res.set('Cache-Control', 'private, max-age=30');
    
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    const detectedServices: any[] = [];
    
    // Get actual running services from host system
    const { stdout: psOutput } = await execAsync('ps aux');
    const processes = psOutput.split('\n').slice(1).filter((line: string) => line.trim());
    
    // Detect actual running services
    processes.forEach((line: string) => {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 11) return;
      
      const pid = parts[1];
      const user = parts[0];
      const cpu = parseFloat(parts[2]) || 0;
      const memory = parseFloat(parts[3]) || 0;
      const command = parts.slice(10).join(' ');
      const filename = command.split('/').pop() || command;
      
      let name = filename;
      let type = 'other';
      let description = '';
      
      // Detect our specific services - expanded patterns
      if (command.includes('playwright-claimer-discord.js') || command.includes('playwright-claimer-discord')) {
        name = 'Playwright Discord Claimer';
        type = 'claimer';
        description = 'Discord-integrated claimer service';
      } else if (command.includes('playwright-claimer.js') || command.includes('playwright-claimer') && !command.includes('discord')) {
        name = 'Playwright Claimer';
        type = 'claimer';
        description = 'Main claimer service';
      } else if (command.includes('first-time-claim.js') || command.includes('first-time-claim')) {
        name = 'First Time Claimer';
        type = 'claimer';
        description = 'First-time claim service';
      } else if (command.includes('claimer') && !command.includes('playwright') && !command.includes('discord')) {
        name = 'Claimer Service';
        type = 'claimer';
        description = 'Generic claimer service';
      } else if (command.includes('dist/backend/backend/src/server.js') || command.includes('backend/src/server.js') || command.includes('server.ts') && command.includes('backend')) {
        name = 'Backend API Server';
        type = 'backend';
        description = 'Express.js backend server';
      } else if (command.includes('discord-bot.js') || (command.includes('discord') && command.includes('bot'))) {
        name = 'Discord Bot';
        type = 'discord';
        description = 'Discord bot service';
      } else if (command.includes('discord-api-server.js') || command.includes('discord-api')) {
        name = 'Discord API Server';
        type = 'discord';
        description = 'Discord API service';
      } else if (command.includes('scheduler') || command.includes('SchedulerService')) {
        name = 'Scheduler Service';
        type = 'scheduler';
        description = 'Automated scheduler service';
      } else {
        return; // Skip processes not related to our services
      }
      
      detectedServices.push({
        pid,
        user,
        cpu,
        memory,
        command,
        filename,
        name,
        description,
        type,
        status: 'running',
        uptime: 'N/A',
        lastRun: new Date().toISOString()
      });
    });
    
    // Add systemd services
    try {
      const { stdout: systemdOutput } = await execAsync('systemctl list-units --type=service --state=running | grep 8bp');
      const systemdServices = systemdOutput.trim().split('\n').filter((line: string) => line.trim());
      
      systemdServices.forEach((line: string) => {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 4) {
          const serviceName = parts[0];
          let name = serviceName;
          let type = 'scheduler';
          let description = 'Systemd service';
          
          if (serviceName.includes('scheduler')) {
            name = 'Scheduler Service';
            description = 'Systemd service for automated claiming';
          } else if (serviceName.includes('claimer')) {
            name = 'Claimer Service';
            type = 'claimer';
            description = 'Systemd claimer service';
          } else if (serviceName.includes('discord')) {
            name = 'Discord Service';
            type = 'discord';
            description = 'Systemd Discord service';
          }
          
          detectedServices.push({
            pid: `systemd-${serviceName}`,
            user: 'root',
            cpu: 0.1,
            memory: 0.1,
            command: `systemd service: ${serviceName}`,
            filename: serviceName,
            name,
            description,
            type,
            status: 'running',
            uptime: 'N/A',
            lastRun: new Date().toISOString()
          });
        }
      });
    } catch (error: any) {
      logger.warn('Could not get systemd services:', { error: error.message });
    }
    
    // Note: Docker services are already added at the top of the function

    // Also try docker ps as fallback (might work if Docker socket is mounted)
    try {
      const { stdout: dockerOutput } = await execAsync('docker ps --format "{{.Names}}\t{{.Status}}\t{{.Image}}" 2>/dev/null');
      const dockerContainers = dockerOutput.trim().split('\n').filter((line: string) => line.trim() && line.includes('8bp'));
      
      dockerContainers.forEach((line: string) => {
        const parts = line.split('\t');
        if (parts.length >= 2) {
          const containerName = parts[0];
          const statusText = parts[1];
          const image = parts[2] || 'unknown';
          
          // Skip if we already have this service
          const exists = detectedServices.some(ds => 
            ds.containerName === containerName || 
            ds.name.toLowerCase().includes(containerName.toLowerCase())
          );
          if (exists) return;
          
          // Map container names to service types
          let serviceName = containerName;
          let type = 'other';
          let category = 'Other / System';
          
          if (containerName.includes('backend')) {
            serviceName = 'Backend API';
            type = 'backend';
            category = 'Website';
          } else if (containerName.includes('discord-api') || containerName.includes('discord')) {
            serviceName = 'Discord API Service';
            type = 'discord';
            category = 'Discord Services';
          } else if (containerName.includes('claimer')) {
            serviceName = 'Claimer Service';
            type = 'claimer';
            category = 'Claimers';
          } else if (containerName.includes('status-bot')) {
            serviceName = 'Discord Status Bot';
            type = 'discord';
            category = 'Discord Services';
          } else if (containerName.includes('postgres')) {
            serviceName = 'PostgreSQL Database';
            type = 'database';
            category = 'Other / System';
          } else if (containerName.includes('frontend')) {
            serviceName = 'Frontend Web Server';
            type = 'website';
            category = 'Website';
          }
          
          // Improved Docker container status parsing
          const statusLower = statusText.toLowerCase();
          const isRunning = statusLower.includes('up') || 
                           statusLower.includes('healthy') || 
                           statusLower.includes('running') ||
                           (statusLower.includes('exited') && statusLower.includes('0'));
          
          detectedServices.push({
            pid: `docker-${containerName}`,
            user: 'docker',
            cpu: 0,
            memory: 0,
            command: `docker container: ${containerName}`,
            filename: containerName,
            name: serviceName,
            description: `Docker container: ${containerName} (${image})`,
            type,
            category,
            status: isRunning ? 'running' : 'not_running',
            uptime: statusText,
            lastRun: new Date().toISOString(),
            containerName,
            image
          });
        }
      });
    } catch (error: any) {
      // Docker ps not available, that's fine - we use health checks instead
      logger.debug('Docker ps not available (expected if running in container without socket access)');
    }
    
    // Add heartbeat files for actual service processes, including backend
    const registry = HeartbeatRegistry.getInstance();
    const activeFiles = registry.getActiveRecords();
    
    // Group by process and only add one entry per process with service info
    const processServices = new Map();
    activeFiles.forEach(rec => {
      // Include all services that have a service name, including backend
      if (rec.service) {
        const key = `${rec.processId}-${rec.service}`;
        if (!processServices.has(key)) {
          // Map service names to proper display names and types
          let displayName = `${rec.service.charAt(0).toUpperCase() + rec.service.slice(1)} Service`;
          let serviceType = rec.service;
          let category = 'Other / System';
          
          if (rec.service === 'backend') {
            displayName = 'Backend API Server';
            serviceType = 'backend';
            category = 'Website';
          } else if (rec.service === 'claimer' || rec.service.includes('claimer')) {
            displayName = 'Claimer Service';
            serviceType = 'claimer';
            category = 'Claimers';
          } else if (rec.service === 'discord' || rec.service.includes('discord')) {
            displayName = 'Discord Service';
            serviceType = 'discord';
            category = 'Discord Services';
          } else if (rec.service === 'scheduler') {
            displayName = 'Scheduler Service';
            serviceType = 'scheduler';
            category = 'Other / System';
          }
          
          processServices.set(key, {
            pid: String(rec.processId),
            user: 'n/a',
            cpu: 0,
            memory: 0,
            command: `${rec.service} (heartbeat tracked)`,
            filename: `${rec.service}.js`,
            name: displayName,
            description: `Heartbeat-tracked ${rec.service} service`,
            type: serviceType,
            category: category,
            status: 'running',
            uptime: 'N/A',
            lastRun: new Date(rec.lastSeen).toISOString()
          });
        }
      }
    });
    
    // Add the grouped service entries (avoid duplicates with Docker containers and processes)
    processServices.forEach(service => {
      // Check if we already have this service from Docker detection or process detection
      // Use more lenient matching to avoid false duplicates
      let foundExisting = false;
      for (let i = 0; i < detectedServices.length; i++) {
        const ds = detectedServices[i];
        // Exact name match
        if (ds.name === service.name) {
          // Update status to running if heartbeat shows it's active
          ds.status = 'running';
          ds.lastRun = service.lastRun;
          foundExisting = true;
          break;
        }
        // Same type and similar name (for backend/backend-api variations)
        if (ds.type === service.type && 
            (ds.name.toLowerCase().includes(service.name.toLowerCase().split(' ')[0]) ||
             service.name.toLowerCase().includes(ds.name.toLowerCase().split(' ')[0]))) {
          // Update status to running if heartbeat shows it's active
          ds.status = 'running';
          ds.lastRun = service.lastRun;
          foundExisting = true;
          break;
        }
        // Container name matches service type
        if (ds.containerName && 
            (ds.containerName.includes(service.type) || service.type.includes(ds.containerName))) {
          // Update status to running if heartbeat shows it's active
          ds.status = 'running';
          ds.lastRun = service.lastRun;
          foundExisting = true;
          break;
        }
      }
      if (!foundExisting) {
        detectedServices.push(service);
      }
    });

    // Add expected Docker services LAST (after all other processing)
    // This ensures they always appear and aren't removed by duplicate detection
    const dockerServices = [
      { name: 'Backend API', hostname: 'backend', type: 'backend', category: 'Website', status: 'running' },
      { name: 'Discord API Service', hostname: 'discord-api', type: 'discord', category: 'Discord Services', status: 'running' },
      { name: 'PostgreSQL Database', hostname: 'postgres', type: 'database', category: 'Other / System', status: 'running' },
      { name: 'Claimer Service', hostname: 'claimer', type: 'claimer', category: 'Claimers', status: 'unknown' },
      { name: 'Discord Status Bot', hostname: 'status-bot', type: 'discord', category: 'Discord Services', status: 'unknown' }
    ];
    
    // Add services that don't already exist (avoid duplicates)
    dockerServices.forEach(svc => {
      const exists = detectedServices.some(ds => 
        ds.name === svc.name || 
        (ds.containerName === svc.hostname) ||
        (ds.type === svc.type && ds.name.toLowerCase().includes(svc.name.toLowerCase().split(' ')[0]))
      );
      if (!exists) {
        detectedServices.push({
          pid: `docker-${svc.hostname}`,
          user: 'docker',
          cpu: 0,
          memory: 0,
          command: `docker container: ${svc.hostname}`,
          filename: svc.hostname,
          name: svc.name,
          description: `Docker container: ${svc.hostname}`,
          type: svc.type,
          category: svc.category,
          status: svc.status,
          uptime: svc.status === 'running' ? 'running' : 'checking...',
          lastRun: new Date().toISOString(),
          containerName: svc.hostname
        });
      }
    });
    
    logger.info(`✅ Final service count: ${detectedServices.length}`, {
      services: detectedServices.map((s: any) => s.name)
    });

    const allServices = detectedServices;
    
    logger.info(`📊 Total services before categorization: ${allServices.length}`, {
      services: allServices.map((s: any) => ({ name: s.name, type: s.type, status: s.status, category: s.category }))
    });
    
    // Categorize services
    const categorizedServices: { [key: string]: any[] } = {
      'Claimers': [],
      'Discord Services': [],
      'Website': [],
      'Other / System': []
    };
    
    allServices.forEach((service: any) => {
      // Use category if provided (from Docker containers), otherwise fall back to type-based categorization
      if (service.category) {
        if (categorizedServices[service.category]) {
          categorizedServices[service.category].push(service);
        } else {
          categorizedServices['Other / System'].push(service);
        }
      } else {
        // Fallback to type-based categorization for non-Docker services
        switch (service.type) {
          case 'claimer':
            categorizedServices['Claimers'].push(service);
            break;
          case 'discord':
            categorizedServices['Discord Services'].push(service);
            break;
          case 'backend':
          case 'website':
            categorizedServices['Website'].push(service);
            break;
          default:
            categorizedServices['Other / System'].push(service);
        }
      }
    });
    
    // Sort each category alphabetically by name
    Object.keys(categorizedServices).forEach(category => {
      categorizedServices[category].sort((a, b) => a.name.localeCompare(b.name));
    });
    
    // Get system info
    const { stdout: uptimeOutput } = await execAsync('uptime');
    const { stdout: memoryOutput } = await execAsync('free -h');
    const { stdout: diskOutput } = await execAsync('df -h /');
    
    const systemInfo = {
      uptime: uptimeOutput.trim(),
      memory: memoryOutput.trim(),
      disk: diskOutput.trim()
    };
    
    const responseData = {
      success: true,
      data: {
        services: allServices,
        categorizedServices: categorizedServices,
        activeCount: allServices.length,
        totalCount: allServices.length,
        systemInfo: systemInfo,
        lastUpdated: new Date().toISOString()
      }
    };
    
    logger.info('Active services response:', { 
      serviceCount: allServices.length, 
      activeCount: responseData.data.activeCount,
      totalCount: responseData.data.totalCount 
    });
    
    // Prevent caching to ensure fresh data
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    
    res.json(responseData);
    
  } catch (error: any) {
    logger.error('Error getting active services:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get active services',
      details: error.message
    });
  }
});

export default router;
