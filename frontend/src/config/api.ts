/**
 * API Configuration
 * Automatically uses the correct API URL based on environment
 */

// In production build, use production API URL
// In development, use localhost
export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:2600/api';

export const API_ENDPOINTS = {
  // Auth
  AUTH_STATUS: `${API_BASE_URL}/auth/status`,
  AUTH_DISCORD: `${API_BASE_URL}/auth/discord`,
  AUTH_LOGOUT: `${API_BASE_URL}/auth/logout`,
  
  // Registration
  REGISTRATION: `${API_BASE_URL}/registration`,
  
  // Admin
  ADMIN_OVERVIEW: `${API_BASE_URL}/admin/overview`,
  ADMIN_REGISTRATIONS: `${API_BASE_URL}/admin/registrations`,
  ADMIN_CLAIM_ALL: `${API_BASE_URL}/admin/claim-all`,
  ADMIN_USERS: `${API_BASE_URL}/admin/users`,
  
  // System Status
  STATUS: `${API_BASE_URL}/status`,
  STATUS_SCHEDULER: `${API_BASE_URL}/status/scheduler`,
  
  // Leaderboard
  LEADERBOARD: `${API_BASE_URL}/leaderboard`,
  
  // Contact
  CONTACT: `${API_BASE_URL}/contact`,
};

// Helper function to build admin user block endpoint
export const getAdminUserBlockEndpoint = (eightBallPoolId: string): string => {
  return `${API_BASE_URL}/admin/users/${eightBallPoolId}/block`;
};

// Helper function to build admin registration delete endpoint  
export const getAdminRegistrationDeleteEndpoint = (eightBallPoolId: string): string => {
  return `${API_BASE_URL}/admin/registrations/${eightBallPoolId}`;
};

console.log('🌐 API Base URL:', API_BASE_URL);

