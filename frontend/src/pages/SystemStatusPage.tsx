import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { Activity, Database, Clock, Server, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { API_ENDPOINTS } from '../config/api';

interface SystemStatus {
  status: string;
  timestamp: string;
  uptime: {
    seconds: number;
    formatted: string;
  };
  database: {
    connected: boolean;
    readyState: number;
    host: string;
    port: number;
    name: string;
  };
  memory: {
    rss: string;
    heapTotal: string;
    heapUsed: string;
    external: string;
  };
  environment: {
    nodeVersion: string;
    platform: string;
    arch: string;
    env: string;
    pid: number;
  };
  responseTime: string;
}

interface SchedulerStatus {
  status: string;
  lastRun: string;
  nextRun: string;
  schedule: string;
  timezone: string;
}

const SystemStatusPage: React.FC = () => {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [schedulerStatus, setSchedulerStatus] = useState<SchedulerStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSystemStatus();
    const interval = setInterval(fetchSystemStatus, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchSystemStatus = async () => {
    try {
      const [systemResponse, schedulerResponse] = await Promise.all([
        axios.get(API_ENDPOINTS.STATUS, { withCredentials: true }),
        axios.get(API_ENDPOINTS.STATUS_SCHEDULER, { withCredentials: true })
      ]);

      setSystemStatus(systemResponse.data);
      setSchedulerStatus(schedulerResponse.data);
      setError(null);
    } catch (err: any) {
      setError('Failed to fetch system status');
      console.error('Error fetching system status:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'healthy':
      case 'online':
      case 'active':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'error':
      case 'offline':
      case 'inactive':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <AlertCircle className="w-5 h-5 text-yellow-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'healthy':
      case 'online':
      case 'active':
        return 'text-green-600';
      case 'error':
      case 'offline':
      case 'inactive':
        return 'text-red-600';
      default:
        return 'text-yellow-600';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-text-secondary">Loading system status...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <XCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-text-primary mb-2">Error</h2>
          <p className="text-text-secondary mb-4">{error}</p>
          <button onClick={fetchSystemStatus} className="btn-primary">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-12"
        >
          <div className="w-16 h-16 bg-primary-100 dark:bg-gradient-to-br dark:from-blue-500 dark:to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg dark:shadow-blue-500/40">
            <Activity className="w-8 h-8 text-primary-600 dark:text-text-dark-highlight" />
          </div>
          <h1 className="text-3xl font-bold text-text-primary mb-4">
            System Status
          </h1>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto">
            Monitor the health and performance of the 8 Ball Pool Rewards system.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Overall Status */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="card"
          >
            <div className="flex items-center space-x-3 mb-6">
              <Server className="w-6 h-6 text-primary-600" />
              <h2 className="text-xl font-semibold text-text-primary">
                Overall System Status
              </h2>
            </div>
            
            {systemStatus && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Status</span>
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(systemStatus.status)}
                    <span className={`font-medium ${getStatusColor(systemStatus.status)}`}>
                      {systemStatus.status}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Uptime</span>
                  <span className="font-medium text-text-primary">
                    {systemStatus.uptime.formatted}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Response Time</span>
                  <span className="font-medium text-text-primary">
                    {systemStatus.responseTime}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Last Updated</span>
                  <span className="font-medium text-text-primary">
                    {new Date(systemStatus.timestamp).toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </motion.div>

          {/* Database Status */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="card"
          >
            <div className="flex items-center space-x-3 mb-6">
              <Database className="w-6 h-6 text-primary-600" />
              <h2 className="text-xl font-semibold text-text-primary">
                Database Status
              </h2>
            </div>
            
            {systemStatus && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Connection</span>
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(systemStatus.database.connected ? 'connected' : 'disconnected')}
                    <span className={`font-medium ${getStatusColor(systemStatus.database.connected ? 'connected' : 'disconnected')}`}>
                      {systemStatus.database.connected ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Host</span>
                  <span className="font-medium text-text-primary">
                    Classified
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Port</span>
                  <span className="font-medium text-text-primary">
                    Classified
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Database</span>
                  <span className="font-medium text-text-primary">
                    {systemStatus.database.name}
                  </span>
                </div>
              </div>
            )}
          </motion.div>

          {/* Scheduler Status */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="card"
          >
            <div className="flex items-center space-x-3 mb-6">
              <Clock className="w-6 h-6 text-primary-600" />
              <h2 className="text-xl font-semibold text-text-primary">
                Scheduler Status
              </h2>
            </div>
            
            {schedulerStatus && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Status</span>
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(schedulerStatus.status)}
                    <span className={`font-medium ${getStatusColor(schedulerStatus.status)}`}>
                      {schedulerStatus.status}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Schedule</span>
                  <span className="font-medium text-text-primary">
                    {schedulerStatus.schedule}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Timezone</span>
                  <span className="font-medium text-text-primary">
                    {schedulerStatus.timezone}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Last Run</span>
                  <span className="font-medium text-text-primary">
                    {schedulerStatus.lastRun ? new Date(schedulerStatus.lastRun).toLocaleString() : 'Never'}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Next Run</span>
                  <span className="font-medium text-text-primary">
                    {schedulerStatus.nextRun ? new Date(schedulerStatus.nextRun).toLocaleString() : 'Unknown'}
                  </span>
                </div>
              </div>
            )}
          </motion.div>

          {/* Memory Usage */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            className="card"
          >
            <div className="flex items-center space-x-3 mb-6">
              <Activity className="w-6 h-6 text-primary-600" />
              <h2 className="text-xl font-semibold text-text-primary">
                Memory Usage
              </h2>
            </div>
            
            {systemStatus && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">RSS Memory</span>
                  <span className="font-medium text-text-primary">
                    {systemStatus.memory.rss}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Heap Total</span>
                  <span className="font-medium text-text-primary">
                    {systemStatus.memory.heapTotal}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Heap Used</span>
                  <span className="font-medium text-text-primary">
                    {systemStatus.memory.heapUsed}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">External</span>
                  <span className="font-medium text-text-primary">
                    {systemStatus.memory.external}
                  </span>
                </div>
              </div>
            )}
          </motion.div>
        </div>

        {/* Environment Information */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.0 }}
          className="mt-8"
        >
          <div className="card">
            <h2 className="text-xl font-semibold text-text-primary mb-6">
              Environment Information
            </h2>
            
            {systemStatus && (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <span className="text-text-secondary">Node.js Version</span>
                  <p className="font-medium text-text-primary">
                    {systemStatus.environment.nodeVersion}
                  </p>
                </div>
                
                <div>
                  <span className="text-text-secondary">Platform</span>
                  <p className="font-medium text-text-primary">
                    {systemStatus.environment.platform}
                  </p>
                </div>
                
                <div>
                  <span className="text-text-secondary">Architecture</span>
                  <p className="font-medium text-text-primary">
                    {systemStatus.environment.arch}
                  </p>
                </div>
                
                <div>
                  <span className="text-text-secondary">Environment</span>
                  <p className="font-medium text-text-primary">
                    {systemStatus.environment.env}
                  </p>
                </div>
                
                <div>
                  <span className="text-text-secondary">Process ID</span>
                  <p className="font-medium text-text-primary">
                    {systemStatus.environment.pid}
                  </p>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default SystemStatusPage;


