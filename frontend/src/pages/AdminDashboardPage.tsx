import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { Navigate } from 'react-router-dom';
import axios from 'axios';
import { API_ENDPOINTS, getAdminUserBlockEndpoint, getAdminRegistrationDeleteEndpoint } from '../config/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { 
  Shield, 
  Users, 
  Activity, 
  TrendingUp, 
  Search, 
  Plus, 
  Trash2, 
  Play, 
  Settings,
  LogOut,
  User,
  Clock,
  Database,
  FileText,
  Filter,
  Monitor,
  RefreshCw,
  CheckCircle,
  XCircle,
  Server,
  Cpu,
  HardDrive,
  Wifi,
  AlertTriangle,
  RotateCcw,
  Camera,
  Terminal,
  HelpCircle,
  Send
} from 'lucide-react';
import ClaimProgressTracker from '../components/ClaimProgressTracker';
import VPSAuthModal from '../components/VPSAuthModal';
import ResetLeaderboardAuthModal from '../components/ResetLeaderboardAuthModal';
import { toast } from 'react-hot-toast';

interface AdminOverview {
  registrations: {
    total: number;
    recent: number;
    period: string;
  };
  claims: Array<{
    _id: string;
    count: number;
    totalItems: number;
  }>;
  logs: Array<{
    _id: string;
    count: number;
    latest: string;
  }>;
  recentClaims: Array<{
    eightBallPoolId: string;
    status: string;
    itemsClaimed: string[];
    claimedAt: string;
  }>;
}

interface Registration {
  _id: string;
  eightBallPoolId: string;
  username: string;
  createdAt: string;
  updatedAt: string;
}

interface VPSStats {
  timestamp: string;
  system: {
    hostname: string;
    uptime: number;
    platform: string;
    arch: string;
    nodeVersion: string;
  };
  cpu: {
    usage: number;
    cores: number;
    loadAverage: number[];
    temperature?: number;
  };
  memory: {
    total: number;
    free: number;
    used: number;
    available: number;
    usagePercent: number;
    swap: {
      total: number;
      free: number;
      used: number;
    };
  };
  disk: {
    total: number;
    free: number;
    used: number;
    usagePercent: number;
    inodes: {
      total: number;
      free: number;
      used: number;
    };
  };
  network: {
    interfaces: Array<{
      name: string;
      bytesReceived: number;
      bytesSent: number;
      packetsReceived: number;
      packetsSent: number;
    }>;
    connections: number;
  };
  processes: {
    total: number;
    running: number;
    sleeping: number;
    zombie: number;
  };
  services: Array<{
    name: string;
    status: string;
    uptime: string;
    memory: string;
    cpu: string;
  }>;
  ping: {
    google: number;
    cloudflare: number;
    localhost: number;
  };
  uptime: string;
}

const AdminDashboardPage: React.FC = () => {
  const { user, isAuthenticated, isAdmin, isLoading, logout } = useAuth();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [userIp, setUserIp] = useState<string>('Loading...');
  const [newRegistration, setNewRegistration] = useState({
    eightBallPoolId: '',
    username: ''
  });
  const [logs, setLogs] = useState<any[]>([]);
  const [logFilters, setLogFilters] = useState({
    level: '',
    action: '',
    search: ''
  });
  const [showProgressTracker, setShowProgressTracker] = useState(false);
  const [currentProcessId, setCurrentProcessId] = useState<string | null>(null);
  const [activeProcesses, setActiveProcesses] = useState<any[]>([]);
  const [isLoadingProcesses, setIsLoadingProcesses] = useState(false);
  const [vpsStats, setVpsStats] = useState<VPSStats | null>(null);
  const [isLoadingVpsStats, setIsLoadingVpsStats] = useState(false);
  const [autoRefreshVps, setAutoRefreshVps] = useState(true);
  const [screenshotUserQuery, setScreenshotUserQuery] = useState('');
  const [isClearingScreenshots, setIsClearingScreenshots] = useState(false);
  const [screenshotFolders, setScreenshotFolders] = useState<any[]>([]);
  const [allScreenshotFolders, setAllScreenshotFolders] = useState<any[]>([]);
  const [isLoadingScreenshots, setIsLoadingScreenshots] = useState(false);
  const [screenshotSearchQuery, setScreenshotSearchQuery] = useState('');
  const [terminalAccess, setTerminalAccess] = useState<boolean | null>(null);
  const [terminalCommand, setTerminalCommand] = useState('');
  const [terminalOutput, setTerminalOutput] = useState('');
  const [isExecutingCommand, setIsExecutingCommand] = useState(false);
  const [mfaVerified, setMfaVerified] = useState(false);
  const [discordCode, setDiscordCode] = useState('');
  const [telegramCode, setTelegramCode] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [codesSent, setCodesSent] = useState<{discord: boolean; telegram: boolean; email: boolean}>({discord: false, telegram: false, email: false});
  const [showCommandHelp, setShowCommandHelp] = useState(false);
  const [isRequestingCodes, setIsRequestingCodes] = useState(false);
  const [chartData, setChartData] = useState<Array<{
    time: string;
    cpu: number;
    memory: number;
    timestamp: number;
  }>>([
    // Sample data for testing
    { time: "00:00:01", cpu: 10, memory: 30, timestamp: Date.now() },
    { time: "00:00:02", cpu: 15, memory: 35, timestamp: Date.now() },
    { time: "00:00:03", cpu: 20, memory: 40, timestamp: Date.now() }
  ]);
  const [showVPSAuthModal, setShowVPSAuthModal] = useState(false);
  const [vpsAccessGranted, setVpsAccessGranted] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [isResettingLeaderboard, setIsResettingLeaderboard] = useState(false);
  const [showResetAuthModal, setShowResetAuthModal] = useState(false);
  const [resetAccessGranted, setResetAccessGranted] = useState(false);

  const fetchVpsStats = useCallback(async () => {
    setIsLoadingVpsStats(true);
    try {
      const response = await axios.get(API_ENDPOINTS.VPS_MONITOR_STATS, { withCredentials: true });
      const stats = response.data;
      setVpsStats(stats);
      
      // Update chart data with new reading
      const now = new Date();
      const timeString = now.toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
      });
      const newDataPoint = {
        time: timeString,
        cpu: stats.cpu.usage,
        memory: stats.memory.usagePercent,
        timestamp: now.getTime()
      };
      
      setChartData(prevData => {
        const updatedData = [...prevData, newDataPoint];
        // Keep only last 60 data points (1 minute of data at 1-second intervals)
        const finalData = updatedData.slice(-60);
        console.log('Chart data updated:', finalData.length, 'points, latest:', newDataPoint);
        return finalData;
      });
    } catch (error: any) {
      toast.error('Failed to fetch VPS statistics');
      console.error('Error fetching VPS stats:', error);
    } finally {
      setIsLoadingVpsStats(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      fetchAdminData();
      fetchUserIp();
      if (activeTab === 'logs') {
        fetchLogs();
      }
      if (activeTab === 'vps') {
        fetchVpsStats();
      }
      if (activeTab === 'screenshots') {
        fetchScreenshotFolders();
      }
      if (activeTab === 'terminal') {
        checkTerminalAccess();
      }
    }
  }, [isAuthenticated, isAdmin, activeTab, fetchVpsStats]);

  // Auto-refresh VPS stats when on VPS tab
  useEffect(() => {
    if (activeTab === 'vps' && autoRefreshVps) {
      const interval = setInterval(() => {
        fetchVpsStats();
      }, 1000); // Refresh every 1 second for real-time graphs
      
      return () => clearInterval(interval);
    }
  }, [activeTab, autoRefreshVps, fetchVpsStats]);

  const fetchUserIp = async () => {
    try {
      // Get user's public IP address
      const response = await axios.get('https://api.ipify.org?format=json');
      setUserIp(response.data.ip);
    } catch (error) {
      setUserIp('Unable to fetch IP');
    }
  };

  const fetchAdminData = async () => {
    setIsLoadingData(true);
    try {
      const [overviewResponse, registrationsResponse] = await Promise.all([
        axios.get(API_ENDPOINTS.ADMIN_OVERVIEW, { withCredentials: true }),
        axios.get(API_ENDPOINTS.ADMIN_REGISTRATIONS, { withCredentials: true })
      ]);

      setOverview(overviewResponse.data);
      setRegistrations(registrationsResponse.data.registrations);
    } catch (error: any) {
      toast.error('Failed to fetch admin data');
      console.error('Error fetching admin data:', error);
    } finally {
      setIsLoadingData(false);
    }
  };

  const fetchLogs = async () => {
    try {
      const params = new URLSearchParams();
      if (logFilters.level) params.append('level', logFilters.level);
      if (logFilters.action) params.append('action', logFilters.action);
      
      const response = await axios.get(`${API_ENDPOINTS.ADMIN_OVERVIEW.replace('/overview', '/logs')}?${params.toString()}`, { 
        withCredentials: true 
      });
      setLogs(response.data.logs);
    } catch (error: any) {
      toast.error('Failed to fetch logs');
      console.error('Error fetching logs:', error);
    }
  };

  const handleAddRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post(API_ENDPOINTS.ADMIN_REGISTRATIONS, newRegistration, { withCredentials: true });
      toast.success('Registration added successfully');
      setShowAddForm(false);
      setNewRegistration({ eightBallPoolId: '', username: '' });
      fetchAdminData();
    } catch (error: any) {
      toast.error('Failed to add registration');
    }
  };

  const handleRemoveRegistration = async (eightBallPoolId: string) => {
    if (!window.confirm('Are you sure you want to remove this registration?')) {
      return;
    }

    try {
      await axios.delete(getAdminRegistrationDeleteEndpoint(eightBallPoolId), { withCredentials: true });
      toast.success('Registration removed successfully');
      fetchAdminData();
    } catch (error: any) {
      toast.error('Failed to remove registration');
    }
  };

  const handleManualClaim = async () => {
    try {
      const response = await axios.post(API_ENDPOINTS.ADMIN_CLAIM_ALL, {}, { withCredentials: true });
      const { processId } = response.data;
      setCurrentProcessId(processId);
      setShowProgressTracker(true);
      toast.success('Manual claim triggered successfully - Opening progress tracker');
    } catch (error: any) {
      toast.error('Failed to trigger manual claim');
    }
  };

  const handleResetLeaderboard = async () => {
    setIsResettingLeaderboard(true);
    try {
      const response = await axios.post(API_ENDPOINTS.ADMIN_RESET_LEADERBOARD, {}, { withCredentials: true });
      const { stats } = response.data;
      
      toast.success(
        `Leaderboard reset successfully! Deleted ${stats.claimRecordsDeleted} claim records, preserved ${stats.usersPreserved} users.`,
        { duration: 6000 }
      );
      
      setShowResetModal(false);
      setResetAccessGranted(false); // Reset access after use
      
      // Refresh the overview data to show updated statistics
      fetchAdminData();
      
    } catch (error: any) {
      toast.error('Failed to reset leaderboard');
      console.error('Reset leaderboard error:', error);
    } finally {
      setIsResettingLeaderboard(false);
    }
  };

  const fetchActiveProcesses = async () => {
    setIsLoadingProcesses(true);
    try {
      const response = await axios.get(API_ENDPOINTS.ADMIN_CLAIM_PROGRESS, { withCredentials: true });
      setActiveProcesses(response.data);
      if (response.data.length > 0) {
        toast.success(`Found ${response.data.length} active claim process(es)`);
      } else {
        toast('No active claim processes found', { icon: 'ℹ️' });
      }
    } catch (error: any) {
      toast.error('Failed to fetch active processes');
      console.error('Error fetching active processes:', error);
    } finally {
      setIsLoadingProcesses(false);
    }
  };

  const connectToProcess = (processId: string) => {
    setCurrentProcessId(processId);
    setShowProgressTracker(true);
    toast.success(`Connected to process ${processId}`);
  };

  const clearUserScreenshots = async () => {
    if (!screenshotUserQuery.trim()) {
      toast.error('Please enter a user ID or username');
      return;
    }

    setIsClearingScreenshots(true);
    try {
      const response = await axios.post('/api/admin/screenshots/clear-user', {
        userQuery: screenshotUserQuery.trim()
      }, { withCredentials: true });
      
      toast.success(response.data.message || 'User screenshots cleared successfully');
      setScreenshotUserQuery('');
      // Refresh the screenshot list after clearing
      fetchScreenshotFolders();
      // Clear search if it was for the same user
      if (screenshotSearchQuery && screenshotSearchQuery === screenshotUserQuery.trim()) {
        setScreenshotSearchQuery('');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to clear user screenshots');
      console.error('Error clearing user screenshots:', error);
    } finally {
      setIsClearingScreenshots(false);
    }
  };

  const clearAllScreenshots = async () => {
    if (!window.confirm('Are you sure you want to clear ALL screenshots? This action cannot be undone.')) {
      return;
    }

    setIsClearingScreenshots(true);
    try {
      const response = await axios.post('/api/admin/screenshots/clear-all', {}, { withCredentials: true });
      
      toast.success(response.data.message || 'All screenshots cleared successfully');
      // Refresh the screenshot list after clearing
      fetchScreenshotFolders();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to clear all screenshots');
      console.error('Error clearing all screenshots:', error);
    } finally {
      setIsClearingScreenshots(false);
    }
  };

  const fetchScreenshotFolders = async () => {
    setIsLoadingScreenshots(true);
    try {
      const response = await axios.get('/api/admin/screenshots/folders', { withCredentials: true });
      setAllScreenshotFolders(response.data.folders);
      // Apply current search filter if any
      filterScreenshotsByUser(response.data.folders, screenshotSearchQuery);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch screenshot folders');
      console.error('Error fetching screenshot folders:', error);
    } finally {
      setIsLoadingScreenshots(false);
    }
  };

  const filterScreenshotsByUser = (folders: any[], searchQuery: string) => {
    if (!searchQuery.trim()) {
      setScreenshotFolders(folders);
      return;
    }

    const filteredFolders = folders.map(folder => ({
      ...folder,
      files: folder.files.filter((file: any) => 
        file.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    })).filter(folder => folder.files.length > 0);

    setScreenshotFolders(filteredFolders);
  };

  const handleScreenshotSearch = (query: string) => {
    setScreenshotSearchQuery(query);
    filterScreenshotsByUser(allScreenshotFolders, query);
  };

  // Terminal functions
  const checkTerminalAccess = async () => {
    try {
      const response = await axios.get('/api/admin/terminal/check-access', { withCredentials: true });
      const hasAccess = response.data.hasAccess;
      setTerminalAccess(hasAccess);
      
      // If user doesn't have access, redirect to admin dashboard
      if (!hasAccess) {
        toast.error('Access denied. You are not authorized to access the Terminal.');
        setActiveTab('overview');
        return;
      }
      
      // If user has access, allow them to access the terminal tab
      setActiveTab('terminal');
    } catch (error: any) {
      toast.error('Failed to check terminal access');
      console.error('Error checking terminal access:', error);
      setTerminalAccess(false);
      setActiveTab('overview');
    }
  };

  const verifyMFA = async () => {
    // Check if user is using email or Discord/Telegram
    const usingEmail = codesSent.email && emailCode.trim();
    const usingDiscord = codesSent.discord && discordCode.trim();
    const needsTelegramCode = codesSent.telegram;
    
    // Validate based on method chosen
    if (usingEmail) {
      if (!emailCode.trim() || emailCode.trim().length !== 6) {
        toast.error('Please enter a valid 6-digit email access code');
        return;
      }
    } else {
      if (!discordCode.trim()) {
        toast.error('Please enter the Discord access code');
        return;
      }
      
      if (needsTelegramCode && !telegramCode.trim()) {
        toast.error('Please enter the Telegram access code');
        return;
      }
    }

    try {
      const response = await axios.post('/api/admin/terminal/verify-mfa', {
        discordCode: usingDiscord ? discordCode.trim() : undefined,
        telegramCode: needsTelegramCode ? telegramCode.trim() : undefined,
        emailCode: usingEmail ? emailCode.trim() : undefined
      }, { withCredentials: true });
      
      if (response.data.success) {
        setMfaVerified(true);
        const successMessage = usingEmail 
          ? 'Email code verified successfully. MFA verification complete.'
          : needsTelegramCode 
            ? 'Discord and Telegram codes verified successfully. MFA verification complete.'
            : 'Discord code verified successfully. MFA verification complete.';
        toast.success(successMessage);
      } else {
        toast.error('Invalid MFA codes');
      }
    } catch (error: any) {
      if (error.response?.data?.message) {
        toast.error(error.response.data.message);
      } else {
        toast.error(error.response?.data?.message || 'MFA verification failed');
      }
      console.error('Error verifying MFA:', error);
    }
  };

  const executeTerminalCommand = async () => {
    if (!terminalCommand.trim()) {
      toast.error('Please enter a command');
      return;
    }

    setIsExecutingCommand(true);
    try {
      const response = await axios.post('/api/admin/terminal/execute', {
        command: terminalCommand.trim()
      }, { withCredentials: true });
      
      if (response.data.success) {
        setTerminalOutput(response.data.output);
        setTerminalCommand('');
      } else {
        setTerminalOutput(`Error: ${response.data.error || 'Command failed'}`);
      }
    } catch (error: any) {
      setTerminalOutput(`Error: ${error.response?.data?.message || 'Failed to execute command'}`);
      console.error('Error executing command:', error);
    } finally {
      setIsExecutingCommand(false);
    }
  };

  const clearMFA = async () => {
    try {
      await axios.post('/api/admin/terminal/clear-mfa', {}, { withCredentials: true });
      setMfaVerified(false);
      setDiscordCode('');
      setTelegramCode('');
      setEmailCode('');
      setUserEmail(null);
      setCodesSent({discord: false, telegram: false, email: false});
      toast.success('MFA verification cleared');
    } catch (error: any) {
      toast.error('Failed to clear MFA verification');
      console.error('Error clearing MFA:', error);
    }
  };

  const requestMFACodes = async (channel?: string) => {
    setIsRequestingCodes(true);
    try {
      const response = await axios.post('/api/admin/terminal/request-codes', { 
        channel: channel || undefined
      }, { withCredentials: true });
      
      if (response.data.success) {
        if (channel === 'discord') {
          if (response.data.discordSent) {
            setCodesSent(prev => ({ ...prev, discord: true }));
            toast.success('Discord access code sent!');
          } else {
            toast.error('Failed to send Discord code');
          }
        } else if (channel === 'telegram') {
          if (response.data.telegramSent) {
            setCodesSent(prev => ({ ...prev, telegram: true }));
            toast.success('Telegram access code sent!');
          } else {
            toast.error('Failed to send Telegram code');
          }
        } else {
          // Fallback to sending all codes
          let codesSentCount = 0;
          let message = 'MFA codes sent: ';
          const sentMethods = [];
          
          if (response.data.discordSent) {
            setCodesSent(prev => ({ ...prev, discord: true }));
            sentMethods.push('Discord');
            codesSentCount++;
          }
          
          if (response.data.telegramSent) {
            setCodesSent(prev => ({ ...prev, telegram: true }));
            sentMethods.push('Telegram');
            codesSentCount++;
          }
          
          if (response.data.emailSent) {
            setCodesSent(prev => ({ ...prev, email: true }));
            setUserEmail(response.data.userEmail);
            sentMethods.push('Email');
            codesSentCount++;
          }
          
          if (codesSentCount > 0) {
            message += sentMethods.join(', ');
            message += '. Please check your messages and enter the codes below.';
            toast.success(message);
          } else {
            toast.success('MFA codes generated. Please use the codes provided.');
          }
        }
      } else {
        toast.error('Failed to request MFA codes');
      }
    } catch (error: any) {
      if (error.response?.status === 403) {
        toast.error('Your email is not authorized for email authentication. Please use Discord/Telegram authentication.');
      } else {
        toast.error(error.response?.data?.message || 'Failed to request MFA codes');
      }
      console.error('Error requesting MFA codes:', error);
    } finally {
      setIsRequestingCodes(false);
    }
  };

  const requestEmailCode = async () => {
    const email = prompt('Enter your email address for authentication:');
    if (email && email.trim()) {
      await requestMFACodes('email');
    }
  };

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out successfully');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-text-secondary">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return <Navigate to="/home" replace />;
  }

  const filteredRegistrations = registrations.filter(reg =>
    reg.eightBallPoolId.includes(searchQuery) ||
    reg.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredUsers = registrations.filter((reg: any) =>
    reg.eightBallPoolId.includes(userSearchQuery) ||
    reg.username.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
    (reg.registrationIp && reg.registrationIp.includes(userSearchQuery))
  );

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8"
        >
          <div>
            <h1 className="text-3xl font-bold text-text-primary mb-2">
              Admin Dashboard
            </h1>
            <p className="text-text-secondary">
              Welcome back, {user?.username}! Manage the 8BP Rewards system.
            </p>
          </div>
          
          <div className="flex items-center space-x-4 mt-4 sm:mt-0">
            <div className="flex items-center space-x-2 text-sm text-text-secondary">
              <User className="w-4 h-4" />
              <span>{user?.username}#{user?.discriminator}</span>
            </div>
            <button
              onClick={handleLogout}
              className="btn-outline text-sm inline-flex items-center space-x-2"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </motion.div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="card mb-8"
        >
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'overview', label: 'Overview', icon: Activity },
              { id: 'registrations', label: 'Registrations', icon: Users },
              { id: 'users', label: 'User Management', icon: Shield },
              { id: 'logs', label: 'Logs', icon: FileText },
              { id: 'tools', label: 'Tools', icon: Settings },
              { id: 'progress', label: 'Progress', icon: Monitor },
              { id: 'screenshots', label: 'Screenshots', icon: Camera },
              { id: 'terminal', label: 'Terminal', icon: Terminal },
              { id: 'vps', label: 'VPS Monitor', icon: Server },
            ].map((tab) => {
              const Icon = tab.icon;
              const handleTabClick = () => {
                if (tab.id === 'vps' && !vpsAccessGranted) {
                  setShowVPSAuthModal(true);
                } else if (tab.id === 'terminal') {
                  // Check terminal access before allowing access
                  checkTerminalAccess();
                } else {
                  setActiveTab(tab.id);
                }
              };
              
              return (
                <button
                  key={tab.id}
                  onClick={handleTabClick}
                  className={`btn ${
                    activeTab === tab.id
                      ? 'btn-primary'
                      : 'btn-outline'
                  } inline-flex items-center space-x-2`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="space-y-8"
          >
            {isLoadingData ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
                <p className="text-text-secondary">Loading admin data...</p>
              </div>
            ) : overview ? (
              <>
                {/* Stats Cards */}
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="card text-center">
                    <Users className="w-8 h-8 text-primary-600 mx-auto mb-2" />
                    <h3 className="text-lg font-semibold text-text-primary mb-1">
                      Total Registrations
                    </h3>
                    <p className="text-2xl font-bold text-primary-600">
                      {overview.registrations.total}
                    </p>
                    <p className="text-sm text-text-secondary">
                      {overview.registrations.recent} this week
                    </p>
                  </div>
                  
                  <div className="card text-center">
                    <TrendingUp className="w-8 h-8 text-primary-600 mx-auto mb-2" />
                    <h3 className="text-lg font-semibold text-text-primary mb-1">
                      Successful Claims
                    </h3>
                    <p className="text-2xl font-bold text-green-600">
                      {overview.claims.find(c => c._id === 'success')?.count || 0}
                    </p>
                    <p className="text-sm text-text-secondary">
                      {overview.claims.find(c => c._id === 'success')?.totalItems || 0} items
                    </p>
                  </div>
                  
                  <div className="card text-center">
                    <Activity className="w-8 h-8 text-primary-600 mx-auto mb-2" />
                    <h3 className="text-lg font-semibold text-text-primary mb-1">
                      Failed Claims
                    </h3>
                    <p className="text-2xl font-bold text-red-600">
                      {overview.claims.find(c => c._id === 'failed')?.count || 0}
                    </p>
                    <p className="text-sm text-text-secondary">
                      This week
                    </p>
                  </div>
                  
                  <div className="card text-center">
                    <Database className="w-8 h-8 text-primary-600 mx-auto mb-2" />
                    <h3 className="text-lg font-semibold text-text-primary mb-1">
                      Log Entries
                    </h3>
                    <p className="text-2xl font-bold text-primary-600">
                      {overview.logs.reduce((sum, log) => sum + log.count, 0)}
                    </p>
                    <p className="text-sm text-text-secondary">
                      This week
                    </p>
                  </div>
                </div>

                {/* Recent Claims */}
                <div className="card">
                  <h2 className="text-xl font-semibold text-text-primary mb-6">
                    Recent Claims
                  </h2>
                  {overview.recentClaims.length === 0 ? (
                    <p className="text-text-secondary text-center py-8">
                      No recent claims found.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {overview.recentClaims.map((claim, index) => (
                        <div key={index} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-background-dark-tertiary rounded-lg border border-transparent dark:border-dark-accent-navy">
                          <div>
                            <p className="font-medium text-text-primary dark:text-text-dark-primary">
                              {claim.eightBallPoolId}
                            </p>
                            <p className="text-sm text-text-secondary dark:text-text-dark-secondary">
                              {claim.itemsClaimed.length > 0 
                                ? claim.itemsClaimed.join(', ')
                                : 'No items claimed'
                              }
                            </p>
                          </div>
                          <div className="text-right">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              claim.status === 'success' 
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
                                : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400'
                            }`}>
                              {claim.status}
                            </span>
                            <p className="text-sm text-text-secondary dark:text-text-dark-secondary mt-1">
                              {new Date(claim.claimedAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <p className="text-text-secondary">Failed to load admin data.</p>
              </div>
            )}
          </motion.div>
        )}

        {/* Registrations Tab */}
        {activeTab === 'registrations' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="space-y-6"
          >
            {/* Search and Add */}
            <div className="card">
              <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="flex items-center space-x-2 flex-1">
                  <Search className="w-5 h-5 text-text-secondary" />
                  <input
                    type="text"
                    placeholder="Search registrations..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="input flex-1"
                  />
                </div>
                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="btn-primary inline-flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Registration</span>
                </button>
              </div>
            </div>

            {/* Add Form */}
            {showAddForm && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="card"
              >
                <h3 className="text-lg font-semibold text-text-primary mb-4">
                  Add New Registration
                </h3>
                <form onSubmit={handleAddRegistration} className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="label">8 Ball Pool ID</label>
                      <input
                        type="text"
                        value={newRegistration.eightBallPoolId}
                        onChange={(e) => {
                          // Auto-clean: remove all non-numeric characters
                          const cleaned = e.target.value.replace(/[^0-9]/g, '');
                          setNewRegistration({
                            ...newRegistration,
                            eightBallPoolId: cleaned
                          });
                        }}
                        className="input"
                        placeholder="e.g., 1826254746"
                        required
                      />
                    </div>
                    <div>
                      <label className="label">Username</label>
                      <input
                        type="text"
                        value={newRegistration.username}
                        onChange={(e) => setNewRegistration({
                          ...newRegistration,
                          username: e.target.value
                        })}
                        className="input"
                        placeholder="Username"
                        required
                      />
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button type="submit" className="btn-primary">
                      Add Registration
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="btn-outline"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </motion.div>
            )}

            {/* Registrations List */}
            <div className="card">
              <h2 className="text-xl font-semibold text-text-primary mb-6">
                All Registrations ({filteredRegistrations.length})
              </h2>
              {filteredRegistrations.length === 0 ? (
                <p className="text-text-secondary text-center py-8">
                  No registrations found.
                </p>
              ) : (
                <div className="space-y-4">
                  {filteredRegistrations.map((reg) => (
                    <div key={reg._id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-background-dark-tertiary rounded-lg border border-transparent dark:border-dark-accent-navy">
                      <div>
                        <p className="font-medium text-text-primary dark:text-text-dark-primary">
                          {reg.username}
                        </p>
                        <p className="text-sm text-text-secondary dark:text-text-dark-secondary">
                          ID: {reg.eightBallPoolId}
                        </p>
                        <p className="text-sm text-text-secondary dark:text-text-dark-secondary">
                          Registered: {new Date(reg.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRemoveRegistration(reg.eightBallPoolId)}
                        className="btn-outline text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 inline-flex items-center space-x-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Remove</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* User Management Tab */}
        {activeTab === 'users' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="space-y-6"
          >
            <div className="card">
              <h2 className="text-xl font-semibold text-text-primary dark:text-text-dark-primary mb-6">
                User Management & Security
              </h2>
              <p className="text-text-secondary dark:text-text-dark-secondary mb-4">
                Monitor and manage user access. Block users who misuse the system.
              </p>

              {/* Search Bar */}
              <div className="mb-6">
                <div className="flex items-center space-x-2">
                  <Search className="w-5 h-5 text-text-secondary dark:text-text-dark-secondary" />
                  <input
                    type="text"
                    placeholder="Search by username, 8BP ID, or IP address..."
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    className="input flex-1"
                  />
                </div>
                {userSearchQuery && (
                  <p className="text-sm text-text-secondary dark:text-text-dark-secondary mt-2">
                    Found {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}
                  </p>
                )}
              </div>

              {isLoadingData ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
                  <p className="text-text-secondary dark:text-text-dark-secondary">Loading users...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredUsers.map((reg: any) => (
                    <div key={reg._id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 bg-gray-50 dark:bg-background-dark-tertiary rounded-lg border border-gray-200 dark:border-dark-accent-navy space-y-3 sm:space-y-0">
                      <div className="flex-1">
                        <div>
                          <p className="font-medium text-text-primary dark:text-text-dark-primary">
                            {reg.username}
                          </p>
                          <p className="text-sm text-text-secondary dark:text-text-dark-secondary">
                            8BP ID: {reg.eightBallPoolId}
                          </p>
                          <p className="text-xs text-text-muted dark:text-text-dark-muted font-mono">
                            IP: {reg.registrationIp || 'Unknown'}
                          </p>
                          {reg.isBlocked && (
                            <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                              🚫 Blocked: {reg.blockedReason || 'No reason provided'}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={async () => {
                            const reason = reg.isBlocked ? '' : prompt('Reason for blocking this user?');
                            if (reg.isBlocked || (reason !== null && reason.trim())) {
                              try {
                                await axios.post(getAdminUserBlockEndpoint(reg.eightBallPoolId), {
                                  isBlocked: !reg.isBlocked,
                                  reason: reason?.trim()
                                }, { withCredentials: true });
                                toast.success(reg.isBlocked ? 'User unblocked' : 'User blocked');
                                fetchAdminData();
                              } catch (error) {
                                toast.error('Failed to update block status');
                              }
                            }
                          }}
                          className={`btn ${reg.isBlocked ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'} text-sm inline-flex items-center space-x-2 w-full sm:w-auto`}
                        >
                          <Shield className="w-4 h-4" />
                          <span>{reg.isBlocked ? 'Unblock' : 'Block'}</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Logs Tab */}
        {activeTab === 'logs' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="space-y-6"
          >
            {/* Filters */}
            <div className="card">
              <h3 className="text-lg font-semibold text-text-primary dark:text-text-dark-primary mb-4">
                Filter Logs
              </h3>
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="label">Level</label>
                  <select
                    value={logFilters.level}
                    onChange={(e) => {
                      setLogFilters({...logFilters, level: e.target.value});
                      fetchLogs();
                    }}
                    className="input"
                  >
                    <option value="">All Levels</option>
                    <option value="info">Info</option>
                    <option value="warn">Warning</option>
                    <option value="error">Error</option>
                  </select>
                </div>
                <div>
                  <label className="label">Action</label>
                  <input
                    type="text"
                    placeholder="e.g. admin_access, oauth_success"
                    value={logFilters.action}
                    onChange={(e) => setLogFilters({...logFilters, action: e.target.value})}
                    className="input"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={fetchLogs}
                    className="btn-primary w-full inline-flex items-center justify-center space-x-2"
                  >
                    <Filter className="w-4 h-4" />
                    <span>Apply Filters</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Logs List */}
            <div className="card">
              <h2 className="text-xl font-semibold text-text-primary dark:text-text-dark-primary mb-6">
                System Logs ({logs.length})
              </h2>
              {logs.length === 0 ? (
                <p className="text-text-secondary dark:text-text-dark-secondary text-center py-8">
                  No logs found.
                </p>
              ) : (
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {logs.map((log, index) => (
                    <div key={index} className="p-3 bg-gray-50 dark:bg-background-dark-tertiary rounded-lg border border-transparent dark:border-dark-accent-navy">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              log.level === 'error' ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400' :
                              log.level === 'warn' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400' :
                              'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400'
                            }`}>
                              {log.level || 'info'}
                            </span>
                            {log.action && (
                              <span className="text-xs text-text-secondary dark:text-text-dark-secondary font-mono">
                                {log.action}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-text-primary dark:text-text-dark-primary font-mono">
                            {log.message}
                          </p>
                          {log.userId && (
                            <p className="text-xs text-text-secondary dark:text-text-dark-secondary mt-1">
                              User: {log.userId}
                            </p>
                          )}
                        </div>
                        <span className="text-xs text-text-secondary dark:text-text-dark-secondary whitespace-nowrap ml-4">
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Tools Tab */}
        {activeTab === 'tools' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="space-y-6"
          >
            <div className="grid md:grid-cols-2 gap-6">
              <div className="card">
                <h3 className="text-lg font-semibold text-text-primary mb-4">
                  Manual Actions
                </h3>
                <div className="space-y-4">
                  <button
                    onClick={handleManualClaim}
                    className="btn-primary w-full inline-flex items-center justify-center space-x-2"
                  >
                    <Play className="w-4 h-4" />
                    <span>Trigger Manual Claim</span>
                  </button>
                  
                  <button
                    onClick={() => {
                      if (resetAccessGranted) {
                        setShowResetModal(true);
                      } else {
                        setShowResetAuthModal(true);
                      }
                    }}
                    className="btn-primary w-full inline-flex items-center justify-center space-x-2"
                    style={{ marginTop: '8px' }}
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Reset Leaderboard</span>
                  </button>
                  
                </div>
              </div>

              <div className="card">
                <h3 className="text-lg font-semibold text-text-primary dark:text-text-dark-primary mb-4">
                  System Information
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-text-secondary dark:text-text-dark-secondary">Admin User:</span>
                    <span className="text-text-primary dark:text-text-dark-primary">{user?.username}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary dark:text-text-dark-secondary">Discord ID:</span>
                    <span className="text-text-primary dark:text-text-dark-primary">{user?.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary dark:text-text-dark-secondary">Your IP Address:</span>
                    <span className="text-text-primary dark:text-text-dark-primary font-mono">{userIp}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary dark:text-text-dark-secondary">Last Login:</span>
                    <span className="text-text-primary dark:text-text-dark-primary">Now</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Progress Tab */}
        {activeTab === 'progress' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="space-y-6"
          >
            <div className="card">
              <h2 className="text-xl font-semibold text-text-primary dark:text-text-dark-primary mb-6">
                Claim Progress Tracker
              </h2>
              
              <div className="space-y-4">
                <p className="text-text-secondary dark:text-text-dark-secondary">
                  Monitor real-time progress of manual claim processes. Click the button below to start tracking a claim process.
                </p>
                
                <div className="flex flex-col sm:flex-row gap-4">
                  <button
                    onClick={handleManualClaim}
                    className="btn-primary inline-flex items-center justify-center space-x-2"
                  >
                    <Play className="w-4 h-4" />
                    <span>Trigger Manual Claim</span>
                  </button>
                  
                  <button
                    onClick={fetchActiveProcesses}
                    disabled={isLoadingProcesses}
                    className="btn-secondary inline-flex items-center justify-center space-x-2"
                  >
                    {isLoadingProcesses ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Activity className="w-4 h-4" />
                    )}
                    <span>View Active Progress</span>
                  </button>
                  
                  {currentProcessId && (
                    <button
                      onClick={() => setShowProgressTracker(true)}
                      className="btn-secondary inline-flex items-center justify-center space-x-2"
                    >
                      <Monitor className="w-4 h-4" />
                      <span>View Progress Tracker</span>
                    </button>
                  )}
                </div>
                
                {currentProcessId && (
                  <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <Activity className="w-5 h-5 text-green-600" />
                      <span className="text-sm font-medium text-green-800 dark:text-green-200">
                        Active Process ID: {currentProcessId}
                      </span>
                    </div>
                    <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                      Click "View Progress Tracker" to monitor the claim process in real-time
                    </p>
                  </div>
                )}

                {activeProcesses.length > 0 && (
                  <div className="mt-6">
                    <h4 className="text-lg font-semibold text-text-primary dark:text-text-dark-primary mb-4">
                      Active Claim Processes ({activeProcesses.length})
                    </h4>
                    <div className="space-y-3">
                      {activeProcesses.map((process) => (
                        <div key={process.processId} className="card p-4">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
                            <div className="flex items-center space-x-3">
                              <div className="flex items-center space-x-2">
                                {process.status === 'running' ? (
                                  <Activity className="w-5 h-5 text-blue-500" />
                                ) : process.status === 'completed' ? (
                                  <CheckCircle className="w-5 h-5 text-green-500" />
                                ) : (
                                  <XCircle className="w-5 h-5 text-red-500" />
                                )}
                                <span className="font-medium text-text-primary dark:text-text-dark-primary">
                                  Process ID: {process.processId}
                                </span>
                              </div>
                              <span className={`text-xs px-2 py-1 rounded-full ${
                                process.status === 'running' ? 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100' :
                                process.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100' :
                                'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100'
                              }`}>
                                {process.status}
                              </span>
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
                              <div className="text-sm text-text-secondary dark:text-text-dark-secondary">
                                <div className="flex justify-between sm:block sm:text-right">
                                  <span>Total: {process.totalUsers || 0}</span>
                                  <span className="sm:block">Completed: {process.completedUsers || 0}</span>
                                  <span className="sm:block">Failed: {process.failedUsers || 0}</span>
                                </div>
                              </div>
                              <button
                                onClick={() => connectToProcess(process.processId)}
                                className="btn-primary text-sm px-3 py-1 w-full sm:w-auto"
                              >
                                Connect
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Screenshots Tab */}
        {activeTab === 'screenshots' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="space-y-6"
          >
            <div className="card">
              <h2 className="text-xl font-semibold text-text-primary dark:text-text-dark-primary mb-6">
                Screenshot Management
              </h2>
              <p className="text-text-secondary dark:text-text-dark-secondary mb-6">
                Manage screenshots taken during the claiming process. Clear specific user screenshots or all screenshots at once.
              </p>

              {/* Clear Specific User Screenshots */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-text-primary dark:text-text-dark-primary mb-4">
                  Clear Specific User Screenshots
                </h3>
                <p className="text-text-secondary dark:text-text-dark-secondary mb-4">
                  Enter a user ID or username to clear all screenshots for that specific user.
                </p>
                
                <div className="flex gap-4 items-end">
                  <div className="flex-1">
                    <label className="label">User ID or Username</label>
                    <input
                      type="text"
                      value={screenshotUserQuery}
                      onChange={(e) => setScreenshotUserQuery(e.target.value)}
                      placeholder="Enter user ID or username..."
                      className="input"
                      disabled={isClearingScreenshots}
                    />
                  </div>
                  <button
                    onClick={clearUserScreenshots}
                    disabled={isClearingScreenshots || !screenshotUserQuery.trim()}
                    className="btn btn-primary inline-flex items-center space-x-2"
                  >
                    <Camera className="w-4 h-4" />
                    <span>{isClearingScreenshots ? 'Clearing...' : 'Clear User Screenshots'}</span>
                  </button>
                </div>
              </div>

              {/* Clear All Screenshots */}
              <div className="border-t border-gray-200 dark:border-dark-accent-navy pt-6">
                <h3 className="text-lg font-semibold text-text-primary dark:text-text-dark-primary mb-4">
                  Clear All Screenshots
                </h3>
                <p className="text-text-secondary dark:text-text-dark-secondary mb-4">
                  <span className="text-red-500 font-medium">Warning:</span> This will delete ALL screenshots from all users. This action cannot be undone.
                </p>
                
                <button
                  onClick={clearAllScreenshots}
                  disabled={isClearingScreenshots}
                  className="btn btn-outline border-red-500 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 inline-flex items-center space-x-2"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{isClearingScreenshots ? 'Clearing All...' : 'Clear All Screenshots'}</span>
                </button>
              </div>
            </div>

            {/* Screenshot Folders Display */}
            <div className="card">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-text-primary dark:text-text-dark-primary">
                  Screenshot Folders
                </h2>
                <div className="flex items-center space-x-3">
                  {/* Search by User ID */}
                  <div className="relative">
                    <input
                      type="text"
                      value={screenshotSearchQuery}
                      onChange={(e) => handleScreenshotSearch(e.target.value)}
                      placeholder="Search by user ID..."
                      className="input pr-10 w-48"
                      disabled={isLoadingScreenshots}
                    />
                    {screenshotSearchQuery && (
                      <button
                        onClick={() => handleScreenshotSearch('')}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-text-secondary hover:text-text-primary"
                        title="Clear search"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <button
                    onClick={fetchScreenshotFolders}
                    disabled={isLoadingScreenshots}
                    className="btn btn-outline inline-flex items-center space-x-2"
                  >
                    <RefreshCw className={`w-4 h-4 ${isLoadingScreenshots ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>

              {/* Search Results Info */}
              {screenshotSearchQuery && (
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    <Search className="w-4 h-4 inline mr-1" />
                    Showing screenshots for user ID: <span className="font-medium">{screenshotSearchQuery}</span>
                    <button
                      onClick={() => handleScreenshotSearch('')}
                      className="ml-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 underline"
                    >
                      Clear filter
                    </button>
                  </p>
                </div>
              )}

              {isLoadingScreenshots ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto"></div>
                  <p className="text-text-secondary dark:text-text-dark-secondary mt-2">Loading screenshots...</p>
                </div>
              ) : screenshotFolders.length === 0 ? (
                <div className="text-center py-8">
                  <Camera className="w-12 h-12 text-text-secondary dark:text-text-dark-secondary mx-auto mb-4" />
                  <p className="text-text-secondary dark:text-text-dark-secondary">
                    {screenshotSearchQuery ? `No screenshots found for user ID: ${screenshotSearchQuery}` : 'No screenshots found'}
                  </p>
                  {screenshotSearchQuery && (
                    <button
                      onClick={() => handleScreenshotSearch('')}
                      className="mt-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 underline text-sm"
                    >
                      View all screenshots
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  {screenshotFolders.map((folder) => (
                    <div key={folder.name} className="border border-gray-200 dark:border-dark-accent-navy rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg font-semibold text-text-primary dark:text-text-dark-primary">
                          {folder.displayName}
                        </h3>
                        <span className="text-sm text-text-secondary dark:text-text-dark-secondary">
                          {folder.files.length} files
                        </span>
                      </div>
                      
                      {folder.files.length === 0 ? (
                        <p className="text-text-secondary dark:text-text-dark-secondary text-sm">No screenshots in this folder</p>
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                          {folder.files.map((file: any) => (
                            <div key={file.name} className="group relative">
                              <div className="aspect-video bg-gray-100 dark:bg-background-dark-tertiary rounded-lg overflow-hidden border border-gray-200 dark:border-dark-accent-navy">
                                {file.base64Data ? (
                                  <img
                                    src={file.base64Data}
                                    alt={file.name}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-background-dark-tertiary">
                                    <div className="text-center text-gray-500 dark:text-gray-400">
                                      <Camera className="w-8 h-8 mx-auto mb-2" />
                                      <p className="text-sm">Image not found</p>
                                    </div>
                                  </div>
                                )}
                              </div>
                              <div className="mt-2">
                                <p className="text-xs text-text-secondary dark:text-text-dark-secondary truncate">
                                  {file.name}
                                </p>
                                <p className="text-xs text-text-secondary dark:text-text-dark-secondary">
                                  {file.size}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Terminal Tab */}
        {activeTab === 'terminal' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="space-y-6"
          >
            {terminalAccess === null ? (
              <div className="card text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto mb-4"></div>
                <p className="text-text-secondary dark:text-text-dark-secondary">Checking terminal access...</p>
              </div>
            ) : !terminalAccess ? (
              <div className="card text-center py-8">
                <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">Access Denied</h2>
                <p className="text-text-secondary dark:text-text-dark-secondary mb-4">
                  You do not have permission to access the Terminal.
                </p>
                <p className="text-sm text-text-secondary dark:text-text-dark-secondary">
                  Only users listed in VPS_OWNERS environment variable can access this feature.
                </p>
              </div>
            ) : !mfaVerified ? (
              <div className="max-w-md mx-auto">
                <div className="card text-center">
                  <h2 className="text-xl font-semibold text-text-primary dark:text-text-dark-primary mb-6">
                    Multi-Factor Authentication Required
                  </h2>
                  <p className="text-text-secondary dark:text-text-dark-secondary mb-6">
                    Please verify your codes to access the Terminal. You can use either Discord/Telegram codes OR email code.
                  </p>
                  
                  {/* Request Access Codes Section */}
                  <div className="mb-6">
                    <div className="flex items-center justify-center mb-4">
                      <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                        <Send className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                      </div>
                    </div>
                    <h3 className="text-lg font-medium text-text-primary dark:text-text-dark-primary mb-2">
                      Request Access Codes
                    </h3>
                    <p className="text-text-secondary dark:text-text-dark-secondary mb-6">
                      Request access codes via Discord, Telegram, or Email. You'll need the provided code to access the Terminal.
                    </p>
                  </div>
                  
                  {/* Authentication Buttons */}
                  <div className="space-y-4 mb-6">
                    {/* Discord Button */}
                    <button
                      onClick={() => requestMFACodes('discord')}
                      disabled={isRequestingCodes || codesSent.discord}
                      className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center space-x-2"
                    >
                      <Send className="w-4 h-4" />
                      <span>{codesSent.discord ? 'Discord Code Sent ✓' : 'Send Discord Code'}</span>
                    </button>
                    
                    {/* Telegram Button */}
                    <button
                      onClick={() => requestMFACodes('telegram')}
                      disabled={isRequestingCodes || codesSent.telegram}
                      className="w-full bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center space-x-2"
                    >
                      <Send className="w-4 h-4" />
                      <span>{codesSent.telegram ? 'Telegram Code Sent ✓' : 'Send Telegram Code'}</span>
                    </button>
                    
                    {/* Divider */}
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
                      </div>
                      <div className="relative flex justify-center text-sm">
                        <span className="px-2 bg-white dark:bg-background-dark-secondary text-text-secondary dark:text-text-dark-secondary">
                          or
                        </span>
                      </div>
                    </div>
                    
                    {/* Email Button */}
                    <button
                      onClick={requestEmailCode}
                      disabled={isRequestingCodes || codesSent.email}
                      className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center space-x-2"
                    >
                      <Send className="w-4 h-4" />
                      <span>{codesSent.email ? 'Email Code Sent ✓' : 'Send Email Code (6-Digit PIN)'}</span>
                    </button>
                  </div>
                  
                  {/* Input Fields - Only show when codes are sent */}
                  {(codesSent.discord || codesSent.telegram || codesSent.email) && (
                    <div className="space-y-4">
                      {/* Discord Code Input */}
                      {codesSent.discord && (
                        <div>
                          <label className="label">Discord Code (16 digits)</label>
                          <input
                            type="text"
                            value={discordCode}
                            onChange={(e) => setDiscordCode(e.target.value)}
                            placeholder="Enter 16-digit Discord code..."
                            className="input"
                            maxLength={16}
                          />
                        </div>
                      )}
                      
                      {/* Telegram Code Input */}
                      {codesSent.telegram && (
                        <div>
                          <label className="label">Telegram Code (16 digits)</label>
                          <input
                            type="text"
                            value={telegramCode}
                            onChange={(e) => setTelegramCode(e.target.value)}
                            placeholder="Enter 16-digit Telegram code..."
                            className="input"
                            maxLength={16}
                          />
                        </div>
                      )}
                      
                      {/* Email Code Input */}
                      {codesSent.email && userEmail && (
                        <div>
                          <div className="text-xs text-text-secondary dark:text-text-dark-secondary text-center mb-2">
                            📧 Code sent to: <span className="font-medium">{userEmail}</span>
                          </div>
                          <label className="label">Email Access Code (6 digits)</label>
                          <input
                            type="text"
                            value={emailCode}
                            onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, ''))}
                            placeholder="Enter 6-digit code"
                            className="input text-center text-2xl tracking-widest font-mono"
                            maxLength={6}
                          />
                        </div>
                      )}
                      
                      {/* Verify Button */}
                      <button
                        onClick={verifyMFA}
                        disabled={
                          isRequestingCodes || 
                          (codesSent.email && emailCode.trim().length !== 6) ||
                          (!codesSent.email && (!discordCode.trim() || (codesSent.telegram && !telegramCode.trim())))
                        }
                        className="btn btn-primary inline-flex items-center space-x-2"
                      >
                        <Shield className="w-4 h-4" />
                        <span>Verify MFA</span>
                      </button>
                      
                      {/* Error Messages */}
                      {(discordCode.length > 0 && discordCode.length !== 16) || (telegramCode.length > 0 && telegramCode.length !== 16) || (emailCode.length > 0 && emailCode.length !== 6) ? (
                        <div className="text-sm text-red-600 dark:text-red-400">
                          ⚠️ {codesSent.email ? 'Email code must be exactly 6 digits' : 'Discord and Telegram codes must be exactly 16 digits'}
                        </div>
                      ) : null}
                    </div>
                  )}
                  
                  {/* Footer */}
                  <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-text-secondary dark:text-text-dark-secondary text-center">
                      🔒 Secure authentication via Discord, Telegram, or Email • Codes expire in 5 minutes
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Terminal Header */}
                <div className="card">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-text-primary dark:text-text-dark-primary">
                      Terminal
                    </h2>
                    <div className="flex items-center space-x-2">
                      <div className="flex items-center space-x-1 text-green-600 dark:text-green-400">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-sm">MFA Verified</span>
                      </div>
                      <button
                        onClick={clearMFA}
                        className="btn btn-outline text-sm"
                      >
                        Clear MFA
                      </button>
                    </div>
                  </div>
                  
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
                    <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">What This Terminal Can Do:</h3>
                    <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                      <li>• Monitor system status (CPU, memory, disk usage)</li>
                      <li>• Check running processes and services</li>
                      <li>• Manage Docker containers and images</li>
                      <li>• View logs and system information</li>
                      <li>• Navigate directories and view files</li>
                      <li>• Monitor application status (Node.js, databases)</li>
                      <li>• Check network connections and ports</li>
                    </ul>
                  </div>
                  
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
                    <h3 className="font-semibold text-red-800 dark:text-red-200 mb-2">⚠️ Important Risks & Limitations:</h3>
                    <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
                      <li>• <strong>Commands execute on the live VPS server</strong> - any mistakes can affect the entire system</li>
                      <li>• <strong>Only safe commands are allowed</strong> - dangerous commands like rm, sudo, shutdown are blocked</li>
                      <li>• <strong>30-second timeout</strong> - long-running commands will be terminated</li>
                      <li>• <strong>All commands are logged</strong> - your actions are recorded for security</li>
                      <li>• <strong>MFA expires after 1 hour</strong> - you'll need to re-verify periodically</li>
                      <li>• <strong>No file modification</strong> - commands are read-only for safety</li>
                    </ul>
                  </div>
                  
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">
                      <strong>Security Note:</strong> This terminal is restricted to Discord user IDs listed in VPS_OWNERS environment variable and requires multi-factor authentication.
                    </p>
                  </div>
                </div>

                {/* Real Terminal Interface */}
                <div className="card p-0 overflow-hidden">
                  {/* Terminal Header */}
                  <div className="bg-gray-900 text-green-400 font-mono p-4 rounded-t-lg">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center">
                        <div className="flex space-x-2">
                          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                          <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        </div>
                        <span className="ml-4 text-sm text-gray-300">Terminal - 8BP VPS</span>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-xs text-gray-400">
                          {new Date().toLocaleTimeString()}
                        </div>
                        <button
                          onClick={() => setShowCommandHelp(true)}
                          className="text-xs text-blue-400 hover:text-blue-300"
                        >
                          help
                        </button>
                      </div>
                    </div>
                    
                    {/* Terminal Content */}
                    <div className="space-y-1 min-h-80 max-h-96 overflow-y-auto">
                      {/* Welcome message */}
                      <div className="text-blue-400 mb-2">
                        Welcome to 8BP VPS Terminal
                      </div>
                      <div className="text-gray-400 text-sm mb-4">
                        Type 'help' for available commands. Use 'clear' to clear the terminal.
                      </div>
                      
                      {/* Command history and output */}
                      {terminalOutput && (
                        <div className="whitespace-pre-wrap text-sm">
                          {terminalOutput}
                        </div>
                      )}
                      
                      {/* Current command line */}
                      <div className="flex items-center mt-2">
                        <span className="text-blue-400">blake@8bp-vps</span>
                        <span className="text-white mx-1">:</span>
                        <span className="text-yellow-400">~</span>
                        <span className="text-white mx-1">$</span>
                        <span className="text-white">{terminalCommand}</span>
                        <span className="animate-pulse bg-green-400 w-2 h-4 ml-1"></span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Command input */}
                  <div className="bg-gray-800 p-4 rounded-b-lg">
                    <div className="flex items-center space-x-2">
                      <span className="text-green-400 font-mono">$</span>
                      <input
                        type="text"
                        value={terminalCommand}
                        onChange={(e) => setTerminalCommand(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            executeTerminalCommand();
                          }
                        }}
                        placeholder="Enter command..."
                        className="flex-1 bg-transparent text-green-400 font-mono outline-none placeholder-gray-500"
                        disabled={isExecutingCommand}
                        autoFocus
                      />
                      {isExecutingCommand && (
                        <span className="text-yellow-400 text-sm">Executing...</span>
                      )}
                    </div>
                    
                    <div className="mt-3 text-xs text-gray-400">
                      <p><strong>Allowed commands:</strong> ls, pwd, whoami, date, uptime, df, free, ps, top, htop, systemctl, docker, git, npm, node, pm2, nginx, apache2, tail, head, grep, find, cat, less, more</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Command Help Modal */}
        {showCommandHelp && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-background-dark-primary rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-dark-accent-navy">
                <h2 className="text-2xl font-bold text-text-primary dark:text-text-dark-primary">
                  Command Help Reference
                </h2>
                <button
                  onClick={() => setShowCommandHelp(false)}
                  className="text-text-secondary dark:text-text-dark-secondary hover:text-text-primary dark:hover:text-text-dark-primary"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                <div className="space-y-6">
                  {/* System Information */}
                  <div>
                    <h3 className="text-lg font-semibold text-text-primary dark:text-text-dark-primary mb-3 flex items-center">
                      <Server className="w-5 h-5 mr-2" />
                      System Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="bg-gray-50 dark:bg-background-dark-secondary p-3 rounded-lg">
                        <code className="text-sm font-mono text-blue-600 dark:text-blue-400">whoami</code>
                        <p className="text-xs text-text-secondary dark:text-text-dark-secondary mt-1">Show current user</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-background-dark-secondary p-3 rounded-lg">
                        <code className="text-sm font-mono text-blue-600 dark:text-blue-400">pwd</code>
                        <p className="text-xs text-text-secondary dark:text-text-dark-secondary mt-1">Show current directory</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-background-dark-secondary p-3 rounded-lg">
                        <code className="text-sm font-mono text-blue-600 dark:text-blue-400">date</code>
                        <p className="text-xs text-text-secondary dark:text-text-dark-secondary mt-1">Show current date/time</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-background-dark-secondary p-3 rounded-lg">
                        <code className="text-sm font-mono text-blue-600 dark:text-blue-400">uptime</code>
                        <p className="text-xs text-text-secondary dark:text-text-dark-secondary mt-1">Show system uptime</p>
                      </div>
                    </div>
                  </div>

                  {/* File System */}
                  <div>
                    <h3 className="text-lg font-semibold text-text-primary dark:text-text-dark-primary mb-3 flex items-center">
                      <HardDrive className="w-5 h-5 mr-2" />
                      File System & Navigation
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="bg-gray-50 dark:bg-background-dark-secondary p-3 rounded-lg">
                        <code className="text-sm font-mono text-blue-600 dark:text-blue-400">ls</code>
                        <p className="text-xs text-text-secondary dark:text-text-dark-secondary mt-1">List directory contents</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-background-dark-secondary p-3 rounded-lg">
                        <code className="text-sm font-mono text-blue-600 dark:text-blue-400">ls -la</code>
                        <p className="text-xs text-text-secondary dark:text-text-dark-secondary mt-1">List with details</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-background-dark-secondary p-3 rounded-lg">
                        <code className="text-sm font-mono text-blue-600 dark:text-blue-400">df -h</code>
                        <p className="text-xs text-text-secondary dark:text-text-dark-secondary mt-1">Show disk usage</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-background-dark-secondary p-3 rounded-lg">
                        <code className="text-sm font-mono text-blue-600 dark:text-blue-400">find . -name "*.log"</code>
                        <p className="text-xs text-text-secondary dark:text-text-dark-secondary mt-1">Find log files</p>
                      </div>
                    </div>
                  </div>

                  {/* System Resources */}
                  <div>
                    <h3 className="text-lg font-semibold text-text-primary dark:text-text-dark-primary mb-3 flex items-center">
                      <Cpu className="w-5 h-5 mr-2" />
                      System Resources
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="bg-gray-50 dark:bg-background-dark-secondary p-3 rounded-lg">
                        <code className="text-sm font-mono text-blue-600 dark:text-blue-400">free -h</code>
                        <p className="text-xs text-text-secondary dark:text-text-dark-secondary mt-1">Show memory usage</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-background-dark-secondary p-3 rounded-lg">
                        <code className="text-sm font-mono text-blue-600 dark:text-blue-400">ps aux</code>
                        <p className="text-xs text-text-secondary dark:text-text-dark-secondary mt-1">Show running processes</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-background-dark-secondary p-3 rounded-lg">
                        <code className="text-sm font-mono text-blue-600 dark:text-blue-400">top</code>
                        <p className="text-xs text-text-secondary dark:text-text-dark-secondary mt-1">Interactive process monitor</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-background-dark-secondary p-3 rounded-lg">
                        <code className="text-sm font-mono text-blue-600 dark:text-blue-400">htop</code>
                        <p className="text-xs text-text-secondary dark:text-text-dark-secondary mt-1">Enhanced process monitor</p>
                      </div>
                    </div>
                  </div>

                  {/* Docker Commands */}
                  <div>
                    <h3 className="text-lg font-semibold text-text-primary dark:text-text-dark-primary mb-3 flex items-center">
                      <Terminal className="w-5 h-5 mr-2" />
                      Docker Management
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="bg-gray-50 dark:bg-background-dark-secondary p-3 rounded-lg">
                        <code className="text-sm font-mono text-blue-600 dark:text-blue-400">docker ps</code>
                        <p className="text-xs text-text-secondary dark:text-text-dark-secondary mt-1">Show running containers</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-background-dark-secondary p-3 rounded-lg">
                        <code className="text-sm font-mono text-blue-600 dark:text-blue-400">docker ps -a</code>
                        <p className="text-xs text-text-secondary dark:text-text-dark-secondary mt-1">Show all containers</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-background-dark-secondary p-3 rounded-lg">
                        <code className="text-sm font-mono text-blue-600 dark:text-blue-400">docker images</code>
                        <p className="text-xs text-text-secondary dark:text-text-dark-secondary mt-1">Show Docker images</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-background-dark-secondary p-3 rounded-lg">
                        <code className="text-sm font-mono text-blue-600 dark:text-blue-400">docker logs [container]</code>
                        <p className="text-xs text-text-secondary dark:text-text-dark-secondary mt-1">Show container logs</p>
                      </div>
                    </div>
                  </div>

                  {/* Service Management */}
                  <div>
                    <h3 className="text-lg font-semibold text-text-primary dark:text-text-dark-primary mb-3 flex items-center">
                      <Settings className="w-5 h-5 mr-2" />
                      Service Management
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="bg-gray-50 dark:bg-background-dark-secondary p-3 rounded-lg">
                        <code className="text-sm font-mono text-blue-600 dark:text-blue-400">systemctl status nginx</code>
                        <p className="text-xs text-text-secondary dark:text-text-dark-secondary mt-1">Check nginx status</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-background-dark-secondary p-3 rounded-lg">
                        <code className="text-sm font-mono text-blue-600 dark:text-blue-400">systemctl status docker</code>
                        <p className="text-xs text-text-secondary dark:text-text-dark-secondary mt-1">Check Docker status</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-background-dark-secondary p-3 rounded-lg">
                        <code className="text-sm font-mono text-blue-600 dark:text-blue-400">pm2 status</code>
                        <p className="text-xs text-text-secondary dark:text-text-dark-secondary mt-1">Check PM2 processes</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-background-dark-secondary p-3 rounded-lg">
                        <code className="text-sm font-mono text-blue-600 dark:text-blue-400">pm2 logs</code>
                        <p className="text-xs text-text-secondary dark:text-text-dark-secondary mt-1">Show PM2 logs</p>
                      </div>
                    </div>
                  </div>

                  {/* Database Management */}
                  <div>
                    <h3 className="text-lg font-semibold text-text-primary dark:text-text-dark-primary mb-3 flex items-center">
                      <Database className="w-5 h-5 mr-2" />
                      Database Management
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="bg-gray-50 dark:bg-background-dark-secondary p-3 rounded-lg">
                        <code className="text-sm font-mono text-blue-600 dark:text-blue-400">clear-failed-claims</code>
                        <p className="text-xs text-text-secondary dark:text-text-dark-secondary mt-1">Remove all failed claim records from database</p>
                      </div>
                    </div>
                  </div>

                  {/* Log Viewing */}
                  <div>
                    <h3 className="text-lg font-semibold text-text-primary dark:text-text-dark-primary mb-3 flex items-center">
                      <FileText className="w-5 h-5 mr-2" />
                      Log Viewing
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="bg-gray-50 dark:bg-background-dark-secondary p-3 rounded-lg">
                        <code className="text-sm font-mono text-blue-600 dark:text-blue-400">tail -f backend.log</code>
                        <p className="text-xs text-text-secondary dark:text-text-dark-secondary mt-1">Follow backend logs</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-background-dark-secondary p-3 rounded-lg">
                        <code className="text-sm font-mono text-blue-600 dark:text-blue-400">tail -n 50 backend.log</code>
                        <p className="text-xs text-text-secondary dark:text-text-dark-secondary mt-1">Last 50 lines</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-background-dark-secondary p-3 rounded-lg">
                        <code className="text-sm font-mono text-blue-600 dark:text-blue-400">grep "ERROR" backend.log</code>
                        <p className="text-xs text-text-secondary dark:text-text-dark-secondary mt-1">Find error messages</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-background-dark-secondary p-3 rounded-lg">
                        <code className="text-sm font-mono text-blue-600 dark:text-blue-400">cat package.json</code>
                        <p className="text-xs text-text-secondary dark:text-text-dark-secondary mt-1">View file contents</p>
                      </div>
                    </div>
                  </div>

                  {/* Network & Ports */}
                  <div>
                    <h3 className="text-lg font-semibold text-text-primary dark:text-text-dark-primary mb-3 flex items-center">
                      <Wifi className="w-5 h-5 mr-2" />
                      Network & Ports
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="bg-gray-50 dark:bg-background-dark-secondary p-3 rounded-lg">
                        <code className="text-sm font-mono text-blue-600 dark:text-blue-400">netstat -tulpn</code>
                        <p className="text-xs text-text-secondary dark:text-text-dark-secondary mt-1">Show listening ports</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-background-dark-secondary p-3 rounded-lg">
                        <code className="text-sm font-mono text-blue-600 dark:text-blue-400">ss -tulpn</code>
                        <p className="text-xs text-text-secondary dark:text-text-dark-secondary mt-1">Modern port listing</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-background-dark-secondary p-3 rounded-lg">
                        <code className="text-sm font-mono text-blue-600 dark:text-blue-400">curl localhost:2600</code>
                        <p className="text-xs text-text-secondary dark:text-text-dark-secondary mt-1">Test backend API</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-background-dark-secondary p-3 rounded-lg">
                        <code className="text-sm font-mono text-blue-600 dark:text-blue-400">ping google.com</code>
                        <p className="text-xs text-text-secondary dark:text-text-dark-secondary mt-1">Test connectivity</p>
                      </div>
                    </div>
                  </div>

                  {/* Quick Tips */}
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">💡 Quick Tips:</h3>
                    <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                      <li>• Use <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">Tab</code> for command completion</li>
                      <li>• Press <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">Ctrl+C</code> to cancel long-running commands</li>
                      <li>• Use <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">|</code> to pipe output between commands</li>
                      <li>• Add <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">-h</code> flag for human-readable output</li>
                      <li>• Use <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">grep</code> to filter command output</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VPS Monitor Tab */}
        {activeTab === 'vps' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="space-y-6"
          >
            <div className="card">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <h2 className="text-xl font-semibold text-text-primary dark:text-text-dark-primary">
                    VPS Monitor
                  </h2>
                  {autoRefreshVps && (
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                        Live
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setAutoRefreshVps(!autoRefreshVps)}
                    className={`btn ${autoRefreshVps ? 'btn-primary' : 'btn-outline'} text-sm px-3 py-1`}
                  >
                    {autoRefreshVps ? 'Auto-Refresh ON' : 'Auto-Refresh OFF'}
                  </button>
                  <button
                    onClick={fetchVpsStats}
                    disabled={isLoadingVpsStats}
                    className="btn-secondary text-sm px-3 py-1 inline-flex items-center space-x-1"
                  >
                    {isLoadingVpsStats ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                    <span>Refresh</span>
                  </button>
                </div>
              </div>

              {isLoadingVpsStats && !vpsStats ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
                  <p className="text-text-secondary">Loading VPS statistics...</p>
                </div>
              ) : vpsStats ? (
                <div className="space-y-6">
                  {/* System Overview */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="card p-4">
                      <div className="flex items-center space-x-3">
                        <Server className="w-8 h-8 text-blue-500" />
                        <div>
                          <h3 className="font-semibold text-text-primary dark:text-text-dark-primary">System</h3>
                          <p className="text-sm text-text-secondary dark:text-text-dark-secondary">{vpsStats.system.hostname}</p>
                          <p className="text-xs text-text-secondary dark:text-text-dark-secondary">{vpsStats.system.platform} {vpsStats.system.arch}</p>
                        </div>
                      </div>
                    </div>

                    <div className="card p-4">
                      <div className="flex items-center space-x-3">
                        <Clock className="w-8 h-8 text-green-500" />
                        <div>
                          <h3 className="font-semibold text-text-primary dark:text-text-dark-primary">Uptime</h3>
                          <p className="text-sm text-text-secondary dark:text-text-dark-secondary">{vpsStats.uptime}</p>
                        </div>
                      </div>
                    </div>

                    <div className="card p-4">
                      <div className="flex items-center space-x-3">
                        <Cpu className="w-8 h-8 text-purple-500" />
                        <div>
                          <h3 className="font-semibold text-text-primary dark:text-text-dark-primary">CPU</h3>
                          <p className="text-sm text-text-secondary dark:text-text-dark-secondary">{vpsStats.cpu.usage.toFixed(1)}%</p>
                          <p className="text-xs text-text-secondary dark:text-text-dark-secondary">{vpsStats.cpu.cores} cores</p>
                        </div>
                      </div>
                    </div>

                    <div className="card p-4">
                      <div className="flex items-center space-x-3">
                        <HardDrive className="w-8 h-8 text-orange-500" />
                        <div>
                          <h3 className="font-semibold text-text-primary dark:text-text-dark-primary">Memory</h3>
                          <p className="text-sm text-text-secondary dark:text-text-dark-secondary">{vpsStats.memory.usagePercent.toFixed(1)}%</p>
                          <p className="text-xs text-text-secondary dark:text-text-dark-secondary">
                            {(vpsStats.memory.used / 1024 / 1024 / 1024).toFixed(1)}GB / {(vpsStats.memory.total / 1024 / 1024 / 1024).toFixed(1)}GB
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Real-time Charts */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                    {/* CPU Usage Chart */}
                    <div className="card p-6">
                      <h3 className="text-lg font-semibold text-text-primary dark:text-text-dark-primary mb-4 flex items-center space-x-2">
                        <Cpu className="w-5 h-5" />
                        <span>CPU Usage (Real-time)</span>
                      </h3>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis 
                              dataKey="time" 
                              stroke="#9CA3AF"
                              fontSize={12}
                              interval={0}
                              tick={{ fontSize: 10 }}
                            />
                            <YAxis 
                              domain={[0, 100]}
                              stroke="#9CA3AF"
                              fontSize={12}
                              label={{ value: '%', angle: -90, position: 'insideLeft' }}
                            />
                            <Tooltip 
                              contentStyle={{
                                backgroundColor: '#1F2937',
                                border: '1px solid #374151',
                                borderRadius: '8px',
                                color: '#F9FAFB'
                              }}
                              labelStyle={{ color: '#F9FAFB' }}
                              formatter={(value: number, name: string) => [
                                `${value.toFixed(1)}%`, 
                                name === 'cpu' ? 'CPU' : 'Memory'
                              ]}
                            />
                            <Area
                              type="monotone"
                              dataKey="cpu"
                              stroke="#8B5CF6"
                              fill="#8B5CF6"
                              fillOpacity={0.3}
                              strokeWidth={2}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Memory Usage Chart */}
                    <div className="card p-6">
                      <h3 className="text-lg font-semibold text-text-primary dark:text-text-dark-primary mb-4 flex items-center space-x-2">
                        <HardDrive className="w-5 h-5" />
                        <span>Memory Usage (Real-time)</span>
                      </h3>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis 
                              dataKey="time" 
                              stroke="#9CA3AF"
                              fontSize={12}
                              interval={0}
                              tick={{ fontSize: 10 }}
                            />
                            <YAxis 
                              domain={[0, 100]}
                              stroke="#9CA3AF"
                              fontSize={12}
                              label={{ value: '%', angle: -90, position: 'insideLeft' }}
                            />
                            <Tooltip 
                              contentStyle={{
                                backgroundColor: '#1F2937',
                                border: '1px solid #374151',
                                borderRadius: '8px',
                                color: '#F9FAFB'
                              }}
                              labelStyle={{ color: '#F9FAFB' }}
                              formatter={(value: number, name: string) => [
                                `${value.toFixed(1)}%`, 
                                name === 'memory' ? 'Memory' : 'CPU'
                              ]}
                            />
                            <Area
                              type="monotone"
                              dataKey="memory"
                              stroke="#F59E0B"
                              fill="#F59E0B"
                              fillOpacity={0.3}
                              strokeWidth={2}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* Combined CPU & Memory Chart */}
                  <div className="card p-6 mb-6">
                    <h3 className="text-lg font-semibold text-text-primary dark:text-text-dark-primary mb-4 flex items-center space-x-2">
                      <Activity className="w-5 h-5" />
                      <span>CPU & Memory Usage Comparison</span>
                      <span className="text-xs text-gray-500 ml-2">({chartData.length} points)</span>
                    </h3>
                    <div className="h-80 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                          {console.log('Chart rendering with data:', chartData)}
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="time" 
                            tick={{ fontSize: 12 }}
                            interval="preserveStartEnd"
                          />
                          <YAxis 
                            domain={[0, 100]} 
                            tick={{ fontSize: 12 }}
                          />
                          <Tooltip />
                          <Line type="monotone" dataKey="cpu" stroke="#8B5CF6" strokeWidth={2} />
                          <Line type="monotone" dataKey="memory" stroke="#F59E0B" strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Detailed Stats */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Memory Details */}
                    <div className="card p-6">
                      <h3 className="text-lg font-semibold text-text-primary dark:text-text-dark-primary mb-4 flex items-center space-x-2">
                        <HardDrive className="w-5 h-5" />
                        <span>Memory Usage</span>
                      </h3>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-text-secondary dark:text-text-dark-secondary">Used</span>
                          <span className="font-medium">{(vpsStats.memory.used / 1024 / 1024 / 1024).toFixed(2)} GB</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-text-secondary dark:text-text-dark-secondary">Available</span>
                          <span className="font-medium">{(vpsStats.memory.available / 1024 / 1024 / 1024).toFixed(2)} GB</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-text-secondary dark:text-text-dark-secondary">Swap Used</span>
                          <span className="font-medium">{(vpsStats.memory.swap.used / 1024 / 1024 / 1024).toFixed(2)} GB</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div 
                            className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${vpsStats.memory.usagePercent}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>

                    {/* Disk Details */}
                    <div className="card p-6">
                      <h3 className="text-lg font-semibold text-text-primary dark:text-text-dark-primary mb-4 flex items-center space-x-2">
                        <HardDrive className="w-5 h-5" />
                        <span>Disk Usage</span>
                      </h3>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-text-secondary dark:text-text-dark-secondary">Used</span>
                          <span className="font-medium">{(vpsStats.disk.used / 1024 / 1024 / 1024).toFixed(2)} GB</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-text-secondary dark:text-text-dark-secondary">Free</span>
                          <span className="font-medium">{(vpsStats.disk.free / 1024 / 1024 / 1024).toFixed(2)} GB</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-text-secondary dark:text-text-dark-secondary">Total</span>
                          <span className="font-medium">{(vpsStats.disk.total / 1024 / 1024 / 1024).toFixed(2)} GB</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div 
                            className="bg-orange-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${vpsStats.disk.usagePercent}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>

                    {/* Network & Ping */}
                    <div className="card p-6">
                      <h3 className="text-lg font-semibold text-text-primary dark:text-text-dark-primary mb-4 flex items-center space-x-2">
                        <Wifi className="w-5 h-5" />
                        <span>Network & Ping</span>
                      </h3>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-text-secondary dark:text-text-dark-secondary">Google</span>
                          <span className={`font-medium ${vpsStats.ping.google > 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {vpsStats.ping.google > 0 ? `${vpsStats.ping.google.toFixed(2)}ms` : 'Failed'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-text-secondary dark:text-text-dark-secondary">Cloudflare</span>
                          <span className={`font-medium ${vpsStats.ping.cloudflare > 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {vpsStats.ping.cloudflare > 0 ? `${vpsStats.ping.cloudflare.toFixed(2)}ms` : 'Failed'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-text-secondary dark:text-text-dark-secondary">Localhost</span>
                          <span className={`font-medium ${vpsStats.ping.localhost > 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {vpsStats.ping.localhost > 0 ? `${vpsStats.ping.localhost.toFixed(2)}ms` : 'Failed'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-text-secondary dark:text-text-dark-secondary">Active Connections</span>
                          <span className="font-medium">{vpsStats.network.connections}</span>
                        </div>
                      </div>
                    </div>

                    {/* Processes & Services */}
                    <div className="card p-6">
                      <h3 className="text-lg font-semibold text-text-primary dark:text-text-dark-primary mb-4 flex items-center space-x-2">
                        <Activity className="w-5 h-5" />
                        <span>Processes & Services</span>
                      </h3>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-text-secondary dark:text-text-dark-secondary">Total Processes</span>
                          <span className="font-medium">{vpsStats.processes.total}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-text-secondary dark:text-text-dark-secondary">Running</span>
                          <span className="font-medium text-green-500">{vpsStats.processes.running}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-text-secondary dark:text-text-dark-secondary">Sleeping</span>
                          <span className="font-medium text-blue-500">{vpsStats.processes.sleeping}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-text-secondary dark:text-text-dark-secondary">Services</span>
                          <span className="font-medium">{vpsStats.services.length}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Services Table */}
                  {vpsStats.services.length > 0 && (
                    <div className="card p-6">
                      <h3 className="text-lg font-semibold text-text-primary dark:text-text-dark-primary mb-4 flex items-center space-x-2">
                        <Server className="w-5 h-5" />
                        <span>Running Services</span>
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-gray-200 dark:border-gray-700">
                              <th className="text-left py-2 text-text-secondary dark:text-text-dark-secondary">Service</th>
                              <th className="text-left py-2 text-text-secondary dark:text-text-dark-secondary">Status</th>
                              <th className="text-left py-2 text-text-secondary dark:text-text-dark-secondary">Uptime</th>
                            </tr>
                          </thead>
                          <tbody>
                            {vpsStats.services.slice(0, 10).map((service, index) => (
                              <tr key={index} className="border-b border-gray-100 dark:border-gray-800">
                                <td className="py-2 text-text-primary dark:text-text-dark-primary font-medium">
                                  {service.name}
                                </td>
                                <td className="py-2">
                                  <span className={`px-2 py-1 rounded-full text-xs ${
                                    service.status === 'active' 
                                      ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100'
                                      : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100'
                                  }`}>
                                    {service.status}
                                  </span>
                                </td>
                                <td className="py-2 text-text-secondary dark:text-text-dark-secondary">
                                  {service.uptime}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div className="text-center text-xs text-text-secondary dark:text-text-dark-secondary">
                    Last updated: {new Date(vpsStats.timestamp).toLocaleString()}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                  <p className="text-text-secondary dark:text-text-dark-secondary">Failed to load VPS statistics</p>
                  <button
                    onClick={fetchVpsStats}
                    className="btn-primary mt-4"
                  >
                    Try Again
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>
      
      {/* Progress Tracker Modal */}
      {showProgressTracker && (
        <ClaimProgressTracker
          processId={currentProcessId || undefined}
          onClose={() => setShowProgressTracker(false)}
        />
      )}
      
      {/* VPS Authentication Modal */}
      <VPSAuthModal
        isOpen={showVPSAuthModal}
        onClose={() => setShowVPSAuthModal(false)}
        onSuccess={() => {
          setVpsAccessGranted(true);
          setActiveTab('vps');
        }}
      />

      {/* Reset Leaderboard Authentication Modal */}
      <ResetLeaderboardAuthModal
        isOpen={showResetAuthModal}
        onClose={() => setShowResetAuthModal(false)}
        onSuccess={() => {
          setResetAccessGranted(true);
          setShowResetModal(true);
        }}
      />

      {/* Reset Leaderboard Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl"
          >
            <div className="flex items-center space-x-3 mb-4">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                  <RotateCcw className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-text-primary dark:text-text-dark-primary">
                  Reset Leaderboard
                </h3>
                <p className="text-sm text-text-secondary dark:text-text-dark-secondary">
                  This action cannot be undone
                </p>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-text-primary dark:text-text-dark-primary mb-3">
                Are you sure you want to reset the leaderboard? This will:
              </p>
              <ul className="space-y-2 text-sm text-text-secondary dark:text-text-dark-secondary">
                <li className="flex items-center space-x-2">
                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                  <span>Delete all claim records and statistics</span>
                </li>
                <li className="flex items-center space-x-2">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                  <span>Preserve all user registrations</span>
                </li>
                <li className="flex items-center space-x-2">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                  <span>Create a backup before deletion</span>
                </li>
                <li className="flex items-center space-x-2">
                  <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full"></div>
                  <span>Send Discord notification</span>
                </li>
              </ul>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setShowResetModal(false)}
                disabled={isResettingLeaderboard}
                className="flex-1 px-4 py-2 text-sm font-medium text-text-secondary dark:text-text-dark-secondary bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleResetLeaderboard}
                disabled={isResettingLeaderboard}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center space-x-2"
              >
                {isResettingLeaderboard ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Resetting...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    <span>Reset Leaderboard</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboardPage;




