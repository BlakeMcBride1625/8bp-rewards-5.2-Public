import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import { UserPlus, CheckCircle, AlertCircle } from 'lucide-react';
import { API_ENDPOINTS } from '../config/api';

interface RegistrationForm {
  eightBallPoolId: string;
  username: string;
}

const RegisterPage: React.FC = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<RegistrationForm>();

  const onSubmit = async (data: RegistrationForm) => {
    setIsSubmitting(true);
    
    try {
      const response = await axios.post(API_ENDPOINTS.REGISTRATION, data, { withCredentials: true });
      
      if (response.status === 201) {
        setIsSuccess(true);
        toast.success('Registration successful! Your account is now registered for automated rewards.');
        reset();
      }
    } catch (error: any) {
      if (error.response?.status === 409) {
        toast.error('This 8 Ball Pool ID is already registered.');
      } else {
        toast.error('Registration failed. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="max-w-md w-full"
        >
          <div className="card text-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-gradient-to-br dark:from-green-500 dark:to-green-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg dark:shadow-green-500/40">
              <CheckCircle className="w-8 h-8 text-green-600 dark:text-white" />
            </div>
            <h2 className="text-2xl font-bold text-text-primary mb-2">
              Registration Successful!
            </h2>
            <p className="text-text-secondary mb-6">
              Your account has been registered for automated reward claiming. 
              You'll start receiving rewards automatically every 6 hours.
            </p>
            <button
              onClick={() => setIsSuccess(false)}
              className="btn-primary"
            >
              Register Another Account
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="max-w-md w-full"
      >
        <div className="card">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary-100 dark:bg-gradient-to-br dark:from-blue-500 dark:to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg dark:shadow-blue-500/40">
              <UserPlus className="w-8 h-8 text-primary-600 dark:text-text-dark-highlight" />
            </div>
            <h1 className="text-2xl font-bold text-text-primary mb-2">
              Register Your Account
            </h1>
            <p className="text-text-secondary">
              Enter your 8 Ball Pool details to start receiving automated rewards.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <label htmlFor="eightBallPoolId" className="label">
                8 Ball Pool User ID
              </label>
              <input
                {...register('eightBallPoolId', {
                  required: '8 Ball Pool ID is required',
                  pattern: {
                    value: /^\d+$/,
                    message: '8 Ball Pool ID must be numeric only',
                  },
                })}
                type="text"
                id="eightBallPoolId"
                className={`input ${errors.eightBallPoolId ? 'border-red-500' : ''}`}
                placeholder="e.g., 1826254746"
                onChange={(e) => {
                  // Auto-clean: remove all non-numeric characters (letters, dashes, spaces, etc.)
                  const cleaned = e.target.value.replace(/[^0-9]/g, '');
                  e.target.value = cleaned;
                }}
              />
              {errors.eightBallPoolId && (
                <div className="flex items-center space-x-1 mt-1 text-red-600 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  <span>{errors.eightBallPoolId.message}</span>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="username" className="label">
                Username
              </label>
              <input
                {...register('username', {
                  required: 'Username is required',
                  minLength: {
                    value: 1,
                    message: 'Username must be at least 1 character',
                  },
                  maxLength: {
                    value: 50,
                    message: 'Username must be less than 50 characters',
                  },
                })}
                type="text"
                id="username"
                className={`input ${errors.username ? 'border-red-500' : ''}`}
                placeholder="Your username"
              />
              {errors.username && (
                <div className="flex items-center space-x-1 mt-1 text-red-600 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  <span>{errors.username.message}</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full"
            >
              {isSubmitting ? 'Registering...' : 'Register Account'}
            </button>
          </form>

          <div className="mt-8 p-4 bg-blue-50 dark:bg-gradient-to-br dark:from-background-dark-tertiary dark:to-background-dark-quaternary rounded-lg border border-transparent dark:border-dark-accent-navy shadow-lg dark:shadow-dark-accent-navy/20">
            <h3 className="text-sm font-medium text-blue-800 dark:text-text-dark-primary mb-2">
              How to find your 8 Ball Pool User ID:
            </h3>
            <ol className="text-sm text-blue-700 dark:text-text-dark-secondary space-y-1">
              <li>1. Open 8 Ball Pool game</li>
              <li>2. Go to your profile</li>
              <li>3. Look for your User ID number</li>
              <li>4. Copy and paste it here</li>
            </ol>
          </div>

          <div className="mt-6 text-center">
            <p className="text-sm text-text-secondary">
              Already registered?{' '}
              <a href="/leaderboard" className="text-primary-600 hover:text-primary-700 font-medium">
                Check the leaderboard
              </a>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default RegisterPage;


