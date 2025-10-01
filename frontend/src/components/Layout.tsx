import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Menu, X, Settings, Home, UserPlus, Shield, Mail, Activity, Trophy, LogIn, LogOut, User, Users } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import AnimatedBackground from './AnimatedBackground';
import Footer from './Footer';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { user, isAuthenticated, isAdmin, login, logout } = useAuth();

  const navigation = [
    { name: 'Home', href: '/home', icon: Home },
    { name: 'Register', href: '/register', icon: UserPlus },
    { name: 'Contact', href: '/contact', icon: Mail },
    { name: 'Leaderboard', href: '/leaderboard', icon: Trophy },
    { name: 'My Socials', href: '/socials', icon: Users },
    { name: 'System Status', href: '/system-status', icon: Activity },
    { name: 'Admin Dashboard', href: '/admin-dashboard', icon: Shield },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="relative min-h-screen">
      <AnimatedBackground />
      
      {/* Navigation */}
      <nav className="relative z-10 bg-white/80 dark:bg-background-dark-secondary/90 backdrop-blur-subtle border-b border-gray-200 dark:border-dark-accent-navy shadow-lg dark:shadow-dark-accent-navy/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link to="/home" className="flex items-center space-x-2">
              <img 
                src="/assets/logos/8logo.png" 
                alt="8BP Rewards Logo" 
                className="w-8 h-8 rounded-lg object-cover"
              />
              <span className="text-xl font-semibold text-text-primary dark:text-text-dark-primary">Rewards</span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center space-x-1">
              {navigation.map((item) => {
                // Hide Admin Dashboard if not admin
                if (item.name === 'Admin Dashboard' && !isAdmin) return null;
                
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                            className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                              isActive(item.href)
                                ? 'bg-primary-100 dark:bg-dark-accent-navy/30 text-primary-700 dark:text-text-dark-highlight shadow-lg dark:shadow-dark-accent-navy/20'
                                : 'text-text-secondary dark:text-text-dark-secondary hover:text-text-primary dark:hover:text-text-dark-accent hover:bg-gray-100 dark:hover:bg-background-dark-tertiary dark:hover:shadow-dark-accent-ocean/10'
                            }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
              
              {/* Auth Button */}
              {isAuthenticated ? (
                <div className="flex items-center space-x-2 border-l border-gray-200 dark:border-dark-accent-navy pl-3 ml-3">
                  <div className="flex items-center space-x-2">
                    <User className="w-4 h-4 text-text-secondary dark:text-text-dark-secondary" />
                    <span className="text-sm text-text-secondary dark:text-text-dark-secondary">{user?.username}</span>
                  </div>
                  <button
                    onClick={logout}
                    className="flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium text-text-secondary dark:text-text-dark-secondary hover:text-text-primary dark:hover:text-text-dark-accent hover:bg-gray-100 dark:hover:bg-background-dark-tertiary transition-all duration-200"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Logout</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={login}
                  className="flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-blue-600 dark:bg-dark-accent-navy text-white hover:bg-blue-700 dark:hover:bg-dark-accent-blue transition-all duration-200 shadow-lg ml-3"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Login</span>
                </button>
              )}
            </div>

            {/* Mobile menu button */}
            <div className="lg:hidden">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 rounded-lg text-text-secondary dark:text-text-dark-secondary hover:text-text-primary dark:hover:text-text-dark-primary hover:bg-gray-100 dark:hover:bg-background-dark-tertiary transition-colors"
              >
                {isMobileMenuOpen ? (
                  <X className="w-6 h-6" />
                ) : (
                  <Menu className="w-6 h-6" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
                    className="lg:hidden bg-white/95 dark:bg-background-dark-secondary/95 backdrop-blur-subtle border-t border-gray-200 dark:border-dark-accent-navy shadow-lg dark:shadow-dark-accent-navy/20"
          >
            <div className="px-4 py-2 space-y-1">
              {navigation.map((item) => {
                // Hide Admin Dashboard if not admin
                if (item.name === 'Admin Dashboard' && !isAdmin) return null;
                
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                            className={`flex items-center space-x-3 px-3 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                              isActive(item.href)
                                ? 'bg-primary-100 dark:bg-dark-accent-navy/30 text-primary-700 dark:text-text-dark-highlight shadow-lg dark:shadow-dark-accent-navy/20'
                                : 'text-text-secondary dark:text-text-dark-secondary hover:text-text-primary dark:hover:text-text-dark-accent hover:bg-gray-100 dark:hover:bg-background-dark-tertiary dark:hover:shadow-dark-accent-ocean/10'
                            }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
              
              {/* Mobile Auth Button */}
              <div className="pt-2 mt-2 border-t border-gray-200 dark:border-dark-accent-navy">
                {isAuthenticated ? (
                  <>
                    <div className="flex items-center space-x-2 px-3 py-2 mb-2">
                      <User className="w-5 h-5 text-text-secondary dark:text-text-dark-secondary" />
                      <span className="text-sm text-text-secondary dark:text-text-dark-secondary">{user?.username}</span>
                    </div>
                    <button
                      onClick={() => {
                        logout();
                        setIsMobileMenuOpen(false);
                      }}
                      className="w-full flex items-center space-x-3 px-3 py-3 rounded-lg text-sm font-medium text-text-secondary dark:text-text-dark-secondary hover:text-text-primary dark:hover:text-text-dark-accent hover:bg-gray-100 dark:hover:bg-background-dark-tertiary transition-all duration-200"
                    >
                      <LogOut className="w-5 h-5" />
                      <span>Logout</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      login();
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium bg-blue-600 dark:bg-dark-accent-navy text-white hover:bg-blue-700 dark:hover:bg-dark-accent-blue transition-all duration-200 shadow-lg"
                  >
                    <LogIn className="w-5 h-5" />
                    <span>Login with Discord</span>
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </nav>

      {/* Main Content */}
      <main className="relative z-10">
        {children}
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default Layout;


