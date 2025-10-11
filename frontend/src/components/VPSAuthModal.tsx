import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, X, Clock, CheckCircle, AlertTriangle, Mail } from 'lucide-react';
import axios from 'axios';
import { API_ENDPOINTS } from '../config/api';
import { toast } from 'react-hot-toast';

interface VPSAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface VPSAccessStatus {
  isAllowed: boolean;
  hasActiveCode: boolean;
  dualChannelAuth?: boolean;
}

const VPSAuthModal: React.FC<VPSAuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [step, setStep] = useState<'check' | 'request' | 'verify' | 'success'>('check');
  const [discordCode, setDiscordCode] = useState('');
  const [telegramCode, setTelegramCode] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [accessStatus, setAccessStatus] = useState<VPSAccessStatus | null>(null);
  const [codesSent, setCodesSent] = useState<{discord: boolean; telegram: boolean; email: boolean}>({discord: false, telegram: false, email: false});
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Check access status when modal opens
  useEffect(() => {
    if (isOpen) {
      checkAccessStatus();
    }
  }, [isOpen]);

  // Timer for code expiration
  useEffect(() => {
    if (step === 'verify' && timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [step, timeLeft]);

  const checkAccessStatus = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(API_ENDPOINTS.ADMIN_VPS_ACCESS_STATUS, {
        withCredentials: true
      });
      setAccessStatus(response.data);
      
      if (!response.data.isAllowed) {
        toast.error('Access denied. You are not authorized to access VPS Monitor.');
        onClose();
        return;
      }
      
      setStep('request');
    } catch (error: any) {
      console.error('Failed to check access status:', error);
      toast.error('Failed to check access status');
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  const requestDiscordCode = async () => {
    try {
      setIsLoading(true);
      const response = await axios.post(API_ENDPOINTS.ADMIN_VPS_REQUEST_ACCESS, { channel: 'discord' }, {
        withCredentials: true
      });
      
      if (response.data.discordSent) {
        setCodesSent(prev => ({ ...prev, discord: true }));
        toast.success('Discord access code sent!');
        setTimeLeft(5 * 60); // 5 minutes
      } else {
        toast.error('Failed to send Discord access code.');
      }
    } catch (error: any) {
      console.error('Failed to request Discord code:', error);
      if (error.response?.status === 403) {
        toast.error('Access denied. You are not authorized to access VPS Monitor.');
      } else {
        toast.error('Failed to send Discord code. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const requestTelegramCode = async () => {
    try {
      setIsLoading(true);
      const response = await axios.post(API_ENDPOINTS.ADMIN_VPS_REQUEST_ACCESS, { channel: 'telegram' }, {
        withCredentials: true
      });
      
      if (response.data.telegramSent) {
        setCodesSent(prev => ({ ...prev, telegram: true }));
        toast.success('Telegram access code sent!');
        setTimeLeft(5 * 60); // 5 minutes
      } else {
        toast.error('Failed to send Telegram access code.');
      }
    } catch (error: any) {
      console.error('Failed to request Telegram code:', error);
      if (error.response?.status === 403) {
        toast.error('Access denied. You are not authorized to access VPS Monitor.');
      } else {
        toast.error('Failed to send Telegram code. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const requestEmailCode = async () => {
    try {
      setIsLoading(true);
      const response = await axios.post(API_ENDPOINTS.ADMIN_VPS_REQUEST_ACCESS, { channel: 'email' }, {
        withCredentials: true
      });
      
      if (response.data.emailSent) {
        setCodesSent(prev => ({ ...prev, email: true }));
        setUserEmail(response.data.userEmail);
        toast.success(`Email access code sent to ${response.data.userEmail}!`);
        setTimeLeft(5 * 60); // 5 minutes
      } else {
        toast.error('Failed to send email access code. Please check your email configuration.');
      }
    } catch (error: any) {
      console.error('Failed to request email code:', error);
      if (error.response?.status === 403) {
        toast.error('Access denied. You are not authorized to access VPS Monitor.');
      } else {
        toast.error('Failed to send email code. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const verifyAccessCode = async () => {
    // Check if user is using email or Discord/Telegram
    const usingEmail = codesSent.email && emailCode.trim();
    const usingDiscord = codesSent.discord && discordCode.trim();
    const needsTelegramCode = codesSent.telegram;
    
    // Validate based on method chosen
    if (usingEmail) {
      if (!emailCode.trim()) {
        toast.error('Please enter the email access code');
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
      setIsLoading(true);
      const response = await axios.post(API_ENDPOINTS.ADMIN_VPS_VERIFY_ACCESS, {
        discordCode: usingDiscord ? discordCode.trim() : undefined,
        telegramCode: needsTelegramCode ? telegramCode.trim() : undefined,
        emailCode: usingEmail ? emailCode.trim() : undefined
      }, {
        withCredentials: true
      });
      
      const successMessage = usingEmail 
        ? 'Access granted! Email code verified successfully.'
        : needsTelegramCode 
          ? 'Access granted! Both codes verified successfully.'
          : 'Access granted! Discord code verified successfully.';
      
      toast.success(successMessage);
      setStep('success');
      
      // Wait a moment then close and call success
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (error: any) {
      console.error('Failed to verify access codes:', error);
      if (error.response?.data?.error) {
        toast.error(error.response.data.error);
      } else {
        toast.error('Invalid access codes');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white dark:bg-background-dark-secondary rounded-lg shadow-xl max-w-md w-full p-6"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <Shield className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-text-primary dark:text-text-dark-primary">
                  VPS Monitor Access
                </h2>
                <p className="text-sm text-text-secondary dark:text-text-dark-secondary">
                  Dual-channel authentication required
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-background-dark-tertiary rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-text-secondary dark:text-text-dark-secondary" />
            </button>
          </div>

          {/* Content */}
          <div className="space-y-6">
            {/* Step 1: Request Code */}
            {step === 'request' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="text-center">
                  <Mail className="w-12 h-12 text-blue-500 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-text-primary dark:text-text-dark-primary mb-2">
                    Request Access Codes
                  </h3>
                  <p className="text-text-secondary dark:text-text-dark-secondary">
                    Request access codes via Discord{accessStatus?.dualChannelAuth ? ', Telegram, or Email' : ' or Email'}.
                    You'll need the provided code to access the VPS Monitor.
                  </p>
                </div>
                
                <div className="space-y-4">
                  {/* Discord Section */}
                  <div className="space-y-2">
                    <button
                      onClick={requestDiscordCode}
                      disabled={isLoading || codesSent.discord}
                      className="w-full btn-primary flex items-center justify-center space-x-2"
                    >
                      {isLoading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>Sending...</span>
                        </>
                      ) : codesSent.discord ? (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          <span>Discord Code Sent ✓</span>
                        </>
                      ) : (
                        <>
                          <Mail className="w-4 h-4" />
                          <span>Send Discord Code</span>
                        </>
                      )}
                    </button>
                    
                    {codesSent.discord && (
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-text-primary dark:text-text-dark-primary">
                          Discord Access Code
                        </label>
                        <input
                          type="text"
                          value={discordCode}
                          onChange={(e) => setDiscordCode(e.target.value.toUpperCase())}
                          placeholder="Enter Discord code"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-background-dark-tertiary text-text-primary dark:text-text-dark-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                          maxLength={16}
                        />
                      </div>
                    )}
                  </div>
                  
                  {/* Telegram Section */}
                  {accessStatus?.dualChannelAuth && (
                    <div className="space-y-2">
                      <button
                        onClick={requestTelegramCode}
                        disabled={isLoading || codesSent.telegram}
                        className="w-full btn-secondary flex items-center justify-center space-x-2"
                      >
                        {isLoading ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                            <span>Sending...</span>
                          </>
                        ) : codesSent.telegram ? (
                          <>
                            <CheckCircle className="w-4 h-4" />
                            <span>Telegram Code Sent ✓</span>
                          </>
                        ) : (
                          <>
                            <Mail className="w-4 h-4" />
                            <span>Send Telegram Code</span>
                          </>
                        )}
                      </button>
                      
                      {codesSent.telegram && (
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-text-primary dark:text-text-dark-primary">
                            Telegram Access Code
                          </label>
                          <input
                            type="text"
                            value={telegramCode}
                            onChange={(e) => setTelegramCode(e.target.value.toUpperCase())}
                            placeholder="Enter Telegram code"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-background-dark-tertiary text-text-primary dark:text-text-dark-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                            maxLength={16}
                          />
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Email Section */}
                  <div className="space-y-2">
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
                    
                    <button
                      onClick={requestEmailCode}
                      disabled={isLoading || codesSent.email}
                      className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center space-x-2"
                    >
                      {isLoading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>Sending...</span>
                        </>
                      ) : codesSent.email ? (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          <span>Email Code Sent ✓</span>
                        </>
                      ) : (
                        <>
                          <Mail className="w-4 h-4" />
                          <span>Send Email Code (6-Digit PIN)</span>
                        </>
                      )}
                    </button>
                    
                    {codesSent.email && userEmail && (
                      <div className="space-y-2">
                        <div className="text-xs text-text-secondary dark:text-text-dark-secondary text-center">
                          📧 Code sent to: <span className="font-medium">{userEmail}</span>
                        </div>
                        <label className="block text-sm font-medium text-text-primary dark:text-text-dark-primary">
                          Email Access Code (6 digits)
                        </label>
                        <input
                          type="text"
                          value={emailCode}
                          onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, ''))}
                          placeholder="Enter 6-digit code"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-background-dark-tertiary text-text-primary dark:text-text-dark-primary focus:outline-none focus:ring-2 focus:ring-purple-500 text-center text-2xl tracking-widest font-mono"
                          maxLength={6}
                        />
                      </div>
                    )}
                  </div>
                  
                  {/* Verify Button */}
                  {(codesSent.discord || codesSent.telegram || codesSent.email) && (
                    <div className="pt-2">
                      {timeLeft > 0 && (
                        <div className="flex items-center justify-center space-x-2 text-sm text-orange-600 dark:text-orange-400 mb-3">
                          <Clock className="w-4 h-4" />
                          <span>Codes expire in {formatTime(timeLeft)}</span>
                        </div>
                      )}
                      
                      <button
                        onClick={verifyAccessCode}
                        disabled={
                          isLoading || 
                          timeLeft === 0 || 
                          (codesSent.email && emailCode.trim().length !== 6) ||
                          (!codesSent.email && (!discordCode.trim() || (codesSent.telegram && !telegramCode.trim())))
                        }
                        className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center space-x-2"
                      >
                        {isLoading ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            <span>Verifying...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4" />
                            <span>Verify Access</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}


            {/* Step 3: Success */}
            {step === 'success' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center space-y-4"
              >
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
                <h3 className="text-lg font-medium text-text-primary dark:text-text-dark-primary">
                  Access Granted!
                </h3>
                <p className="text-text-secondary dark:text-text-dark-secondary">
                  You now have access to the VPS Monitor. Opening...
                </p>
              </motion.div>
            )}

            {/* Loading State */}
            {step === 'check' && isLoading && (
              <div className="text-center space-y-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                <p className="text-text-secondary dark:text-text-dark-secondary">
                  Checking access permissions...
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-text-secondary dark:text-text-dark-secondary text-center">
              🔒 Secure authentication via Discord, Telegram, or Email • Codes expire in 5 minutes
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default VPSAuthModal;
