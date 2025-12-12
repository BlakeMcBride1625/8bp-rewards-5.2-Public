import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { Navigate } from 'react-router-dom';
import axios from 'axios';
import { API_ENDPOINTS } from '../config/api';
import { 
  Activity, 
  RefreshCw, 
  Filter, 
  Play, 
  Pause, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Clock,
  Server,
  Cpu,
  HardDrive,
  Wifi,
  FileText,
  Bot,
  Settings,
  TestTube,
  Database,
  Loader2,
  Terminal
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface Service {
  fileName: string;
  fullPath: string;
  status: 'running' | 'not_running' | 'failed';
  name: string;
  description: string;
  type: 'backend' | 'bot' | 'claimer' | 'utility' | 'test' | 'unknown' | 'nodejs' | 'typescript' | 'python' | 'php' | 'shell' | 'process' | 'system';
  uptime: string | null;
  lastRun: string | null;
  pid: string | null;
  user?: string | null;
  cpu?: string | null;
  memory?: string | null;
  command?: string | null;
}

interface ActiveServicesData {
  services: Service[];
  activeCount: number;
  totalCount: number;
  systemInfo: {
    uptime: string;
    memory: string;
    disk: string;
  };
  lastUpdated: string;
}

const ActiveServicesPage: React.FC = () => {
  const { isAuthenticated, isAdmin } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [filteredServices, setFilteredServices] = useState<Service[]>([]);
  const [filter, setFilter] = useState<'all' | 'running' | 'not_running' | 'failed'>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [systemInfo, setSystemInfo] = useState<any>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const fetchActiveServices = async () => {
    try {
      const response = await axios.get(API_ENDPOINTS.ADMIN_ACTIVE_SERVICES);
      if (response.data.success) {
        setServices(response.data.data.services);
        setSystemInfo(response.data.data.systemInfo);
        setLastUpdated(response.data.data.lastUpdated);
        applyFilter(response.data.data.services, filter);
      }
    } catch (error) {
      console.error('Error fetching active services:', error);
      toast.error('Failed to fetch active services');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const applyFilter = (servicesList: Service[], filterType: string) => {
    let filtered = servicesList;
    
    switch (filterType) {
      case 'running':
        filtered = servicesList.filter(service => service.status === 'running');
        break;
      case 'not_running':
        filtered = servicesList.filter(service => service.status === 'not_running');
        break;
      case 'failed':
        filtered = servicesList.filter(service => service.status === 'failed');
        break;
      default:
        filtered = servicesList;
    }
    
    setFilteredServices(filtered);
  };

  const handleFilterChange = (newFilter: 'all' | 'running' | 'not_running' | 'failed') => {
    setFilter(newFilter);
    applyFilter(services, newFilter);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchActiveServices();
  };

  useEffect(() => {
    fetchActiveServices();
    
    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchActiveServices, 60000);
    return () => clearInterval(interval);
  }, []);

  if (!isAuthenticated) {
    return <Navigate to="/8bp-rewards/home" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/8bp-rewards/home" replace />;
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'not_running':
        return <XCircle className="w-5 h-5 text-gray-400" />;
      case 'failed':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      default:
        return <XCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'running':
        return '✅ Running';
      case 'not_running':
        return '⚠️ Not Running';
      case 'failed':
        return '❌ Failed/Error';
      default:
        return '⚠️ Unknown';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'backend':
        return <Server className="w-4 h-4 text-blue-500" />;
      case 'bot':
        return <Bot className="w-4 h-4 text-purple-500" />;
      case 'claimer':
        return <Activity className="w-4 h-4 text-green-500" />;
      case 'utility':
        return <Settings className="w-4 h-4 text-orange-500" />;
      case 'test':
        return <TestTube className="w-4 h-4 text-yellow-500" />;
      case 'nodejs':
        return <FileText className="w-4 h-4 text-green-600" />;
      case 'typescript':
        return <FileText className="w-4 h-4 text-blue-600" />;
      case 'python':
        return <FileText className="w-4 h-4 text-yellow-600" />;
      case 'php':
        return <FileText className="w-4 h-4 text-purple-600" />;
      case 'shell':
        return <Terminal className="w-4 h-4 text-gray-600" />;
      case 'process':
        return <Cpu className="w-4 h-4 text-indigo-500" />;
      case 'system':
        return <Server className="w-4 h-4 text-red-500" />;
      case 'unknown':
        return <FileText className="w-4 h-4 text-gray-500" />;
      default:
        return <FileText className="w-4 h-4 text-gray-500" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'backend':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300';
      case 'bot':
        return 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300';
      case 'claimer':
        return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
      case 'utility':
        return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300';
      case 'test':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300';
      case 'nodejs':
        return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
      case 'typescript':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300';
      case 'python':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300';
      case 'php':
        return 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300';
      case 'shell':
        return 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300';
      case 'process':
        return 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300';
      case 'system':
        return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300';
      case 'unknown':
        return 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300';
      default:
        return 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle dark:bg-background-dark-primary flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary-500" />
          <p className="text-text-secondary dark:text-text-dark-secondary">Loading active services...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle dark:bg-background-dark-primary">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-text-primary dark:text-text-dark-primary mb-2">
                Active Services
              </h1>
              <p className="text-text-secondary dark:text-text-dark-secondary">
                Real-time monitoring of all running services and processes
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-text-secondary dark:text-text-dark-secondary">
                Last updated: {new Date(lastUpdated).toLocaleString()}
              </div>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center space-x-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>
        </motion.div>

        {/* System Overview */}
        {systemInfo && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8"
          >
            <div className="bg-white dark:bg-background-dark-secondary rounded-lg p-6 border border-gray-200 dark:border-dark-accent-navy">
              <div className="flex items-center space-x-3 mb-2">
                <Clock className="w-5 h-5 text-blue-500" />
                <h3 className="font-semibold text-text-primary dark:text-text-dark-primary">System Uptime</h3>
              </div>
              <p className="text-sm text-text-secondary dark:text-text-dark-secondary font-mono">
                {systemInfo.uptime}
              </p>
            </div>
            
            <div className="bg-white dark:bg-background-dark-secondary rounded-lg p-6 border border-gray-200 dark:border-dark-accent-navy">
              <div className="flex items-center space-x-3 mb-2">
                <Cpu className="w-5 h-5 text-green-500" />
                <h3 className="font-semibold text-text-primary dark:text-text-dark-primary">Memory Usage</h3>
              </div>
              <p className="text-sm text-text-secondary dark:text-text-dark-secondary font-mono">
                {systemInfo.memory.split('\n')[1]}
              </p>
            </div>
            
            <div className="bg-white dark:bg-background-dark-secondary rounded-lg p-6 border border-gray-200 dark:border-dark-accent-navy">
              <div className="flex items-center space-x-3 mb-2">
                <HardDrive className="w-5 h-5 text-orange-500" />
                <h3 className="font-semibold text-text-primary dark:text-text-dark-primary">Disk Usage</h3>
              </div>
              <p className="text-sm text-text-secondary dark:text-text-dark-secondary font-mono">
                {systemInfo.disk.split('\n')[1]}
              </p>
            </div>
          </motion.div>
        )}

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8"
        >
          <div className="bg-white dark:bg-background-dark-secondary rounded-lg p-6 border border-gray-200 dark:border-dark-accent-navy">
            <div className="flex items-center space-x-3">
              <CheckCircle className="w-8 h-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold text-text-primary dark:text-text-dark-primary">
                  {services.filter(s => s.status === 'running').length}
                </p>
                <p className="text-sm text-text-secondary dark:text-text-dark-secondary">Running</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-background-dark-secondary rounded-lg p-6 border border-gray-200 dark:border-dark-accent-navy">
            <div className="flex items-center space-x-3">
              <XCircle className="w-8 h-8 text-gray-400" />
              <div>
                <p className="text-2xl font-bold text-text-primary dark:text-text-dark-primary">
                  {services.filter(s => s.status === 'not_running').length}
                </p>
                <p className="text-sm text-text-secondary dark:text-text-dark-secondary">Not Running</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-background-dark-secondary rounded-lg p-6 border border-gray-200 dark:border-dark-accent-navy">
            <div className="flex items-center space-x-3">
              <AlertTriangle className="w-8 h-8 text-red-500" />
              <div>
                <p className="text-2xl font-bold text-text-primary dark:text-text-dark-primary">
                  {services.filter(s => s.status === 'failed').length}
                </p>
                <p className="text-sm text-text-secondary dark:text-text-dark-secondary">Failed</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-background-dark-secondary rounded-lg p-6 border border-gray-200 dark:border-dark-accent-navy">
            <div className="flex items-center space-x-3">
              <Server className="w-8 h-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold text-text-primary dark:text-text-dark-primary">
                  {services.length}
                </p>
                <p className="text-sm text-text-secondary dark:text-text-dark-secondary">Total Services</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center space-x-4">
            <Filter className="w-5 h-5 text-text-secondary dark:text-text-dark-secondary" />
            <div className="flex space-x-2">
              {[
                { key: 'all', label: 'Show All', count: services.length },
                { key: 'running', label: 'Running Only', count: services.filter(s => s.status === 'running').length },
                { key: 'not_running', label: 'Not Running', count: services.filter(s => s.status === 'not_running').length },
                { key: 'failed', label: 'Failed Only', count: services.filter(s => s.status === 'failed').length }
              ].map((filterOption) => (
                <button
                  key={filterOption.key}
                  onClick={() => handleFilterChange(filterOption.key as any)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filter === filterOption.key
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-100 dark:bg-background-dark-tertiary text-text-secondary dark:text-text-dark-secondary hover:bg-gray-200 dark:hover:bg-background-dark-quaternary'
                  }`}
                >
                  {filterOption.label} ({filterOption.count})
                </button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Services List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {filteredServices.map((service, index) => (
            <motion.div
              key={service.fileName}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white dark:bg-background-dark-secondary rounded-lg border border-gray-200 dark:border-dark-accent-navy overflow-hidden"
            >
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      {getStatusIcon(service.status)}
                      <h3 className="text-lg font-semibold text-text-primary dark:text-text-dark-primary">
                        {service.name}
                      </h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(service.type)}`}>
                        <div className="flex items-center space-x-1">
                          {getTypeIcon(service.type)}
                          <span className="capitalize">{service.type}</span>
                        </div>
                      </span>
                    </div>
                    
                    <p className="text-text-secondary dark:text-text-dark-secondary mb-3">
                      {service.description}
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="font-medium text-text-primary dark:text-text-dark-primary mb-1">File Name:</p>
                        <p className="text-text-secondary dark:text-text-dark-secondary font-mono bg-gray-100 dark:bg-background-dark-tertiary p-2 rounded">
                          {service.fileName}
                        </p>
                      </div>
                      
                      <div>
                        <p className="font-medium text-text-primary dark:text-text-dark-primary mb-1">Full Path:</p>
                        <p className="text-text-secondary dark:text-text-dark-secondary font-mono bg-gray-100 dark:bg-background-dark-tertiary p-2 rounded break-all">
                          {service.fullPath}
                        </p>
                      </div>
                      
                      <div>
                        <p className="font-medium text-text-primary dark:text-text-dark-primary mb-1">Status:</p>
                        <p className="text-text-secondary dark:text-text-dark-secondary">
                          {getStatusText(service.status)}
                        </p>
                      </div>
                      
                      {service.pid && (
                        <div>
                          <p className="font-medium text-text-primary dark:text-text-dark-primary mb-1">Process ID:</p>
                          <p className="text-text-secondary dark:text-text-dark-secondary font-mono">
                            {service.pid}
                          </p>
                        </div>
                      )}
                      
                      {service.user && (
                        <div>
                          <p className="font-medium text-text-primary dark:text-text-dark-primary mb-1">User:</p>
                          <p className="text-text-secondary dark:text-text-dark-secondary font-mono">
                            {service.user}
                          </p>
                        </div>
                      )}
                      
                      {service.cpu && (
                        <div>
                          <p className="font-medium text-text-primary dark:text-text-dark-primary mb-1">CPU Usage:</p>
                          <p className="text-text-secondary dark:text-text-dark-secondary font-mono">
                            {service.cpu}%
                          </p>
                        </div>
                      )}
                      
                      {service.memory && (
                        <div>
                          <p className="font-medium text-text-primary dark:text-text-dark-primary mb-1">Memory Usage:</p>
                          <p className="text-text-secondary dark:text-text-dark-secondary font-mono">
                            {service.memory}%
                          </p>
                        </div>
                      )}
                      
                      {service.uptime && (
                        <div>
                          <p className="font-medium text-text-primary dark:text-text-dark-primary mb-1">Process Time:</p>
                          <p className="text-text-secondary dark:text-text-dark-secondary font-mono">
                            {service.uptime}
                          </p>
                        </div>
                      )}
                      
                      {service.command && (
                        <div className="md:col-span-2 lg:col-span-3">
                          <p className="font-medium text-text-primary dark:text-text-dark-primary mb-1">Full Command:</p>
                          <p className="text-text-secondary dark:text-text-dark-secondary font-mono bg-gray-100 dark:bg-background-dark-tertiary p-2 rounded break-all text-xs">
                            {service.command}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
          
          {filteredServices.length === 0 && (
            <div className="text-center py-12">
              <Server className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-text-secondary dark:text-text-dark-secondary">
                No services found matching the current filter.
              </p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default ActiveServicesPage;
