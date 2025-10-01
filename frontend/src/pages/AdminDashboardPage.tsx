import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { Navigate } from 'react-router-dom';
import axios from 'axios';
import { API_ENDPOINTS, getAdminUserBlockEndpoint, getAdminRegistrationDeleteEndpoint } from '../config/api';
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
  Mail,
  Clock,
  Database
} from 'lucide-react';
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

  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      fetchAdminData();
      fetchUserIp();
    }
  }, [isAuthenticated, isAdmin]);

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
      await axios.post(API_ENDPOINTS.ADMIN_CLAIM_ALL, {}, { withCredentials: true });
      toast.success('Manual claim triggered successfully');
    } catch (error: any) {
      toast.error('Failed to trigger manual claim');
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
              { id: 'tools', label: 'Tools', icon: Settings },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
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
                    <div key={reg._id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-text-primary">
                          {reg.username}
                        </p>
                        <p className="text-sm text-text-secondary">
                          ID: {reg.eightBallPoolId}
                        </p>
                        <p className="text-sm text-text-secondary">
                          Registered: {new Date(reg.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRemoveRegistration(reg.eightBallPoolId)}
                        className="btn-outline text-red-600 hover:bg-red-50 inline-flex items-center space-x-2"
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
                    <div key={reg._id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-background-dark-tertiary rounded-lg border border-gray-200 dark:border-dark-accent-navy">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
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
                          className={`btn ${reg.isBlocked ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'} text-sm inline-flex items-center space-x-2`}
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
      </div>
    </div>
  );
};

export default AdminDashboardPage;


