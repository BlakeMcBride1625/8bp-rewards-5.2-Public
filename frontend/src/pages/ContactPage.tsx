import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import { Mail, Send, CheckCircle, AlertCircle } from 'lucide-react';
import { API_ENDPOINTS } from '../config/api';

interface ContactForm {
  name: string;
  email: string;
  subject: string;
  message: string;
}

const ContactPage: React.FC = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ContactForm>();

  const onSubmit = async (data: ContactForm) => {
    setIsSubmitting(true);
    
    try {
      const response = await axios.post(API_ENDPOINTS.CONTACT, data, { withCredentials: true });
      
      if (response.status === 200) {
        setIsSuccess(true);
        toast.success('Message sent successfully! We\'ll get back to you soon.');
        reset();
      }
    } catch (error: any) {
      toast.error('Failed to send message. Please try again.');
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
              Message Sent!
            </h2>
            <p className="text-text-secondary mb-6">
              Thank you for contacting us. We'll get back to you as soon as possible.
            </p>
            <button
              onClick={() => setIsSuccess(false)}
              className="btn-primary"
            >
              Send Another Message
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-12"
        >
          <div className="w-16 h-16 bg-primary-100 dark:bg-gradient-to-br dark:from-blue-500 dark:to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg dark:shadow-blue-500/40">
            <Mail className="w-8 h-8 text-primary-600 dark:text-text-dark-highlight" />
          </div>
          <h1 className="text-3xl font-bold text-text-primary mb-4">
            Contact Us
          </h1>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto">
            Have questions about the 8 Ball Pool Rewards system? 
            We're here to help! Send us a message and we'll get back to you.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-12">
          {/* Contact Form */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="card"
          >
            <h2 className="text-xl font-semibold text-text-primary mb-6">
              Send us a Message
            </h2>
            
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div>
                <label htmlFor="name" className="label">
                  Your Name
                </label>
                <input
                  {...register('name', {
                    required: 'Name is required',
                    minLength: {
                      value: 2,
                      message: 'Name must be at least 2 characters',
                    },
                  })}
                  type="text"
                  id="name"
                  className={`input ${errors.name ? 'border-red-500' : ''}`}
                  placeholder="Enter your name"
                />
                {errors.name && (
                  <div className="flex items-center space-x-1 mt-1 text-red-600 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    <span>{errors.name.message}</span>
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="email" className="label">
                  Email Address
                </label>
                <input
                  {...register('email', {
                    required: 'Email is required',
                    pattern: {
                      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                      message: 'Please enter a valid email address',
                    },
                  })}
                  type="email"
                  id="email"
                  className={`input ${errors.email ? 'border-red-500' : ''}`}
                  placeholder="your.email@example.com"
                />
                {errors.email && (
                  <div className="flex items-center space-x-1 mt-1 text-red-600 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    <span>{errors.email.message}</span>
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="subject" className="label">
                  Subject
                </label>
                <input
                  {...register('subject', {
                    required: 'Subject is required',
                    minLength: {
                      value: 3,
                      message: 'Subject must be at least 3 characters',
                    },
                    maxLength: {
                      value: 100,
                      message: 'Subject must be less than 100 characters',
                    },
                  })}
                  type="text"
                  id="subject"
                  className={`input ${errors.subject ? 'border-red-500' : ''}`}
                  placeholder="What is this regarding?"
                />
                {errors.subject && (
                  <div className="flex items-center space-x-1 mt-1 text-red-600 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    <span>{errors.subject.message}</span>
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="message" className="label">
                  Message
                </label>
                <textarea
                  {...register('message', {
                    required: 'Message is required',
                    minLength: {
                      value: 10,
                      message: 'Message must be at least 10 characters',
                    },
                    maxLength: {
                      value: 1000,
                      message: 'Message must be less than 1000 characters',
                    },
                  })}
                  id="message"
                  rows={6}
                  className={`input resize-none ${errors.message ? 'border-red-500' : ''}`}
                  placeholder="Tell us how we can help you..."
                />
                {errors.message && (
                  <div className="flex items-center space-x-1 mt-1 text-red-600 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    <span>{errors.message.message}</span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary w-full inline-flex items-center justify-center space-x-2"
              >
                <Send className="w-4 h-4" />
                <span>{isSubmitting ? 'Sending...' : 'Send Message'}</span>
              </button>
            </form>
          </motion.div>

          {/* Contact Information */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="space-y-8"
          >
            <div className="card">
              <h3 className="text-lg font-semibold text-text-primary mb-4">
                Get in Touch
              </h3>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <Mail className="w-5 h-5 text-primary-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-text-primary">Email Support</p>
                    <p className="text-text-secondary text-sm">
                      We typically respond within 24 hours
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <h3 className="text-lg font-semibold text-text-primary mb-4">
                Frequently Asked Questions
              </h3>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-text-primary mb-1">
                    How often are rewards claimed?
                  </h4>
                  <p className="text-text-secondary text-sm">
                    Our system automatically claims rewards every 6 hours at 00:00, 06:00, 12:00, and 18:00 UTC.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium text-text-primary mb-1">
                    Is my account information safe?
                  </h4>
                  <p className="text-text-secondary text-sm">
                    Yes, we use secure MongoDB Atlas database and only store your 8BP ID and username.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium text-text-primary mb-1">
                    Can I register multiple accounts?
                  </h4>
                  <p className="text-text-secondary text-sm">
                    Yes, you can register multiple 8 Ball Pool accounts for automated reward claiming.
                  </p>
                </div>
              </div>
            </div>

            <div className="card">
              <h3 className="text-lg font-semibold text-text-primary mb-4">
                System Status
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Backend API</span>
                  <span className="text-green-600 text-sm font-medium">Online</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Database</span>
                  <span className="text-green-600 text-sm font-medium">Connected</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Scheduler</span>
                  <span className="text-green-600 text-sm font-medium">Active</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default ContactPage;


