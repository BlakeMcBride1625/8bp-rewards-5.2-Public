import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { Trophy, Medal, TrendingUp, Clock, Filter, Search } from 'lucide-react';
import { API_ENDPOINTS } from '../config/api';

interface LeaderboardEntry {
  rank: number;
  eightBallPoolId: string;
  username: string;
  totalClaims: number;
  successfulClaims: number;
  totalItemsClaimed: number;
  successRate: number;
  lastClaimed: string;
}

interface LeaderboardStats {
  timeframe: string;
  period: string;
  totalUsers: number;
  leaderboard: LeaderboardEntry[];
}

const LeaderboardPage: React.FC = () => {
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState('7d');
  const [limit, setLimit] = useState(50);
  const [searchQuery, setSearchQuery] = useState('');

  const timeframes = [
    { value: '1d', label: 'Last 24 Hours' },
    { value: '7d', label: 'Last 7 Days' },
    { value: '14d', label: 'Last 14 Days' },
    { value: '28d', label: 'Last 28 Days' },
    { value: '30d', label: 'Last 30 Days' },
    { value: '90d', label: 'Last 90 Days' },
    { value: '1y', label: 'Last Year' },
  ];

  useEffect(() => {
    fetchLeaderboard();
  }, [timeframe, limit]);

  const fetchLeaderboard = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API_ENDPOINTS.LEADERBOARD}?timeframe=${timeframe}&limit=${limit}`, { withCredentials: true });
      setLeaderboardData(response.data);
      setError(null);
    } catch (err: any) {
      setError('Failed to fetch leaderboard data');
      console.error('Error fetching leaderboard:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Medal className="w-6 h-6 text-yellow-500" />;
      case 2:
        return <Medal className="w-6 h-6 text-gray-400" />;
      case 3:
        return <Medal className="w-6 h-6 text-orange-600" />;
      default:
        return <span className="w-6 h-6 flex items-center justify-center text-sm font-bold text-text-secondary">#{rank}</span>;
    }
  };

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-gradient-to-r from-yellow-400 to-yellow-600';
      case 2:
        return 'bg-gradient-to-r from-gray-300 to-gray-500';
      case 3:
        return 'bg-gradient-to-r from-orange-400 to-orange-600';
      default:
        return 'bg-white dark:bg-background-dark-tertiary border-gray-200 dark:border-dark-accent-navy';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-text-secondary">Loading leaderboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Trophy className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-text-primary mb-2">Error</h2>
          <p className="text-text-secondary mb-4">{error}</p>
          <button onClick={fetchLeaderboard} className="btn-primary">
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
            <Trophy className="w-8 h-8 text-primary-600 dark:text-text-dark-highlight" />
          </div>
          <h1 className="text-3xl font-bold text-text-primary mb-4">
            Leaderboard
          </h1>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto">
            See who's claiming the most rewards! Rankings are based on total items claimed.
          </p>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="card mb-8"
        >
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="flex items-center space-x-2">
              <Filter className="w-5 h-5 text-text-secondary" />
              <span className="text-text-secondary font-medium">Filters:</span>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <div>
                <label htmlFor="timeframe" className="label text-sm">
                  Time Period
                </label>
                <select
                  id="timeframe"
                  value={timeframe}
                  onChange={(e) => setTimeframe(e.target.value)}
                  className="input text-sm"
                >
                  {timeframes.map((tf) => (
                    <option key={tf.value} value={tf.value}>
                      {tf.label}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label htmlFor="limit" className="label text-sm">
                  Show Top
                </label>
                <select
                  id="limit"
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                  className="input text-sm"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Leaderboard */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="card"
        >
          {leaderboardData && (
            <>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-text-primary">
                  Top {leaderboardData.totalUsers} Players
                </h2>
                <div className="text-sm text-text-secondary">
                  {leaderboardData.period} • {leaderboardData.timeframe}
                </div>
              </div>

              {/* Search Bar */}
              <div className="mb-6">
                <div className="flex items-center space-x-2">
                  <Search className="w-5 h-5 text-text-secondary dark:text-text-dark-secondary" />
                  <input
                    type="text"
                    placeholder="Search by username or 8BP ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="input flex-1"
                  />
                </div>
                {searchQuery && (
                  <p className="text-sm text-text-secondary dark:text-text-dark-secondary mt-2">
                    Showing filtered results
                  </p>
                )}
              </div>

              {leaderboardData.leaderboard.length === 0 ? (
                <div className="text-center py-12">
                  <Trophy className="w-12 h-12 text-text-muted mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-text-primary mb-2">
                    No Data Available
                  </h3>
                  <p className="text-text-secondary">
                    No claims have been recorded for the selected time period.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {leaderboardData.leaderboard
                    .filter(entry => 
                      entry.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      entry.eightBallPoolId.includes(searchQuery)
                    )
                    .map((entry, index) => (
                    <motion.div
                      key={entry.eightBallPoolId}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                      className={`p-4 rounded-lg border transition-all hover:shadow-md ${getRankColor(entry.rank)}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center justify-center w-8 h-8">
                            {getRankIcon(entry.rank)}
                          </div>
                          
                          <div>
                            <h3 className="font-semibold text-text-primary dark:text-text-dark-primary">
                              {entry.username}
                            </h3>
                            <p className="text-sm text-text-secondary dark:text-text-dark-secondary">
                              ID: {entry.eightBallPoolId}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-6 text-sm">
                          <div className="text-center">
                            <div className="font-semibold text-text-primary dark:text-text-dark-primary">
                              {entry.totalItemsClaimed}
                            </div>
                            <div className="text-text-secondary dark:text-text-dark-secondary">Items</div>
                          </div>
                          
                          <div className="text-center">
                            <div className="font-semibold text-text-primary dark:text-text-dark-primary">
                              {entry.successRate}%
                            </div>
                            <div className="text-text-secondary dark:text-text-dark-secondary">Success</div>
                          </div>
                          
                          <div className="text-center">
                            <div className="font-semibold text-text-primary dark:text-text-dark-primary">
                              {entry.totalClaims}
                            </div>
                            <div className="text-text-secondary dark:text-text-dark-secondary">Claims</div>
                          </div>
                          
                          <div className="text-center">
                            <div className="font-semibold text-text-primary dark:text-text-dark-primary">
                              {entry.lastClaimed ? new Date(entry.lastClaimed).toLocaleDateString() : 'Never'}
                            </div>
                            <div className="text-text-secondary dark:text-text-dark-secondary">Last Claim</div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </>
          )}
        </motion.div>

        {/* Statistics */}
        {leaderboardData && leaderboardData.leaderboard.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="mt-8 grid md:grid-cols-3 gap-6"
          >
            <div className="card text-center">
              <TrendingUp className="w-8 h-8 text-primary-600 mx-auto mb-2" />
              <h3 className="text-lg font-semibold text-text-primary mb-1">
                Total Players
              </h3>
              <p className="text-2xl font-bold text-primary-600">
                {leaderboardData.totalUsers}
              </p>
            </div>
            
            <div className="card text-center">
              <Trophy className="w-8 h-8 text-primary-600 mx-auto mb-2" />
              <h3 className="text-lg font-semibold text-text-primary mb-1">
                Top Performer
              </h3>
              <p className="text-lg font-bold text-text-primary">
                {leaderboardData.leaderboard[0]?.username || 'N/A'}
              </p>
              <p className="text-sm text-text-secondary">
                {leaderboardData.leaderboard[0]?.totalItemsClaimed || 0} items
              </p>
            </div>
            
            <div className="card text-center">
              <Clock className="w-8 h-8 text-primary-600 mx-auto mb-2" />
              <h3 className="text-lg font-semibold text-text-primary mb-1">
                Time Period
              </h3>
              <p className="text-lg font-bold text-text-primary">
                {leaderboardData.period}
              </p>
              <p className="text-sm text-text-secondary">
                {leaderboardData.timeframe}
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default LeaderboardPage;


