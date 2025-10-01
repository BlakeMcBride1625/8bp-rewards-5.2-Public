import React from 'react';
import { Link } from 'react-router-dom';

const Footer: React.FC = () => {
  return (
    <footer className="relative z-10 bg-white dark:bg-gradient-to-r dark:from-background-dark-secondary dark:via-background-dark-tertiary dark:to-background-dark-quaternary backdrop-blur-subtle border-t border-gray-200 dark:border-dark-accent-navy mt-auto shadow-lg dark:shadow-dark-accent-navy/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          {/* Copyright */}
          <div className="text-sm text-text-secondary dark:text-text-dark-primary">
            © 2025 EpilDevConnect. All rights reserved.
          </div>
          
          {/* Links */}
          <div className="flex items-center space-x-6">
            <Link
              to="/terms"
                      className="text-sm text-text-secondary dark:text-text-dark-primary hover:text-text-primary dark:hover:text-text-dark-accent transition-colors hover:shadow-lg dark:hover:shadow-dark-accent-navy/20 px-2 py-1 rounded"
            >
              Terms of Service
            </Link>
            <Link
              to="/privacy"
                      className="text-sm text-text-secondary dark:text-text-dark-primary hover:text-text-primary dark:hover:text-text-dark-accent transition-colors hover:shadow-lg dark:hover:shadow-dark-accent-navy/20 px-2 py-1 rounded"
            >
              Privacy Policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;


