import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { API_ENDPOINTS } from '../config/api';

interface User {
  id: string;
  username: string;
  discriminator: string;
  avatar: string;
  email?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  login: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      // Check if user manually logged out (development mode)
      const devLoggedOut = localStorage.getItem('dev_logged_out');
      if (devLoggedOut === 'true') {
        setIsAuthenticated(false);
        setIsAdmin(false);
        setUser(null);
        setIsLoading(false);
        return;
      }
      
      // Call backend auth status endpoint
      const response = await axios.get(API_ENDPOINTS.AUTH_STATUS, {
        withCredentials: true
      });
      const { authenticated, isAdmin: adminStatus, user: userData } = response.data;
      
      setIsAuthenticated(authenticated);
      setIsAdmin(adminStatus);
      setUser(authenticated ? userData : null);
    } catch (error) {
      console.error('Auth status check failed:', error);
      setIsAuthenticated(false);
      setIsAdmin(false);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = () => {
    // Clear dev logout flag
    localStorage.removeItem('dev_logged_out');
    // Redirect directly to backend for Discord OAuth
    window.location.href = API_ENDPOINTS.AUTH_DISCORD;
  };

  const logout = async () => {
    try {
      // Set flag for development mode to prevent auto re-login
      localStorage.setItem('dev_logged_out', 'true');
      
      await axios.post(API_ENDPOINTS.AUTH_LOGOUT, {}, { withCredentials: true });
      setIsAuthenticated(false);
      setIsAdmin(false);
      setUser(null);
      
      // Redirect to home after logout
      window.location.href = '/home';
    } catch (error) {
      console.error('Logout failed:', error);
      // Still log out locally even if backend fails
      setIsAuthenticated(false);
      setIsAdmin(false);
      setUser(null);
      window.location.href = '/home';
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated,
    isAdmin,
    isLoading,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};


