import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Users, Clock, Shield, Trophy } from 'lucide-react';

const HomePage: React.FC = () => {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            <h1 className="text-4xl md:text-6xl font-bold text-text-primary dark:text-text-dark-primary mb-6">
              Welcome to{' '}
              <span className="bg-gradient-to-r from-primary-500 to-secondary-500 bg-clip-text text-transparent dark:from-dark-accent-navy dark:to-dark-accent-ocean dark:text-text-dark-highlight dark:bg-transparent">
                8 Ball Pool Rewards
              </span>
            </h1>
            <p className="text-xl text-text-secondary dark:text-text-dark-secondary mb-8 max-w-3xl mx-auto">
              Automatically claim your daily rewards from 8 Ball Pool. 
              Our system runs every 6 hours to ensure you never miss out on free items.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/register"
                className="btn-primary text-lg px-8 py-3 inline-flex items-center space-x-2"
              >
                <span>Get Started</span>
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                to="/leaderboard"
                className="btn-outline text-lg px-8 py-3 inline-flex items-center space-x-2"
              >
                <Trophy className="w-5 h-5" />
                <span>View Leaderboard</span>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white/50 dark:bg-gradient-to-br dark:from-background-dark-tertiary dark:to-background-dark-quaternary">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold text-text-primary dark:text-text-dark-primary mb-4">
              Why Choose Our System?
            </h2>
            <p className="text-lg text-text-secondary dark:text-text-dark-secondary max-w-2xl mx-auto">
              Experience the most reliable and efficient 8 Ball Pool reward claiming system.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                icon: Clock,
                title: 'Automated Schedule',
                description: 'Runs every 6 hours at 00:00, 06:00, 12:00, and 18:00 UTC',
              },
              {
                icon: Users,
                title: 'Multi-User Support',
                description: 'Register multiple accounts and manage them all in one place',
              },
              {
                icon: Shield,
                title: 'Secure & Reliable',
                description: 'Your data is safe with our secure MongoDB database',
              },
              {
                icon: Trophy,
                title: 'Track Progress',
                description: 'Monitor your rewards and compete on our leaderboard',
              },
            ].map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.1 * index }}
                  className="card text-center hover:shadow-lg transition-shadow"
                >
                  <div className="w-12 h-12 bg-primary-100 dark:bg-gradient-to-br dark:from-blue-500 dark:to-blue-600 rounded-lg flex items-center justify-center mx-auto mb-4 shadow-lg dark:shadow-blue-500/40">
                    {typeof Icon === 'string' ? (
                      <img 
                        src={`/assets/icons/${Icon}.png`} 
                        alt={feature.title}
                        className="w-6 h-6 object-contain"
                      />
                    ) : (
                      <Icon className="w-6 h-6 text-primary-600 dark:text-text-dark-highlight" />
                    )}
                  </div>
                  <h3 className="text-lg font-semibold text-text-primary dark:text-text-dark-primary mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-text-secondary dark:text-text-dark-secondary">
                    {feature.description}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold text-text-primary dark:text-text-dark-primary mb-4">
              How It Works
            </h2>
            <p className="text-lg text-text-secondary dark:text-text-dark-secondary max-w-2xl mx-auto">
              Getting started is simple. Follow these steps to begin claiming rewards automatically.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '1',
                title: 'Register Your Account',
                description: 'Enter your 8 Ball Pool User ID and username to register for automated rewards.',
              },
              {
                step: '2',
                title: 'Automatic Processing',
                description: 'Our system will automatically claim rewards for your account every 6 hours.',
              },
              {
                step: '3',
                title: 'Track Your Progress',
                description: 'Monitor your claimed rewards and see how you rank on our leaderboard.',
              },
            ].map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.1 * index }}
                className="text-center"
              >
                    <div className="w-16 h-16 bg-gradient-accent dark:bg-gradient-to-br dark:from-blue-500 dark:to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg dark:shadow-blue-500/40">
                  <span className="text-white dark:text-text-dark-highlight font-bold text-xl">{step.step}</span>
                </div>
                <h3 className="text-xl font-semibold text-text-primary dark:text-text-dark-primary mb-2">
                  {step.title}
                </h3>
                <p className="text-text-secondary dark:text-text-dark-secondary">
                  {step.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white/50 dark:bg-gradient-to-br dark:from-background-dark-tertiary dark:to-background-dark-quaternary">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
          >
            <h2 className="text-3xl font-bold text-text-primary dark:text-text-dark-primary mb-4">
              Ready to Start Claiming Rewards?
            </h2>
            <p className="text-lg text-text-secondary dark:text-text-dark-secondary mb-8">
              Join thousands of players who never miss their daily rewards.
            </p>
            <Link
              to="/register"
              className="btn-primary text-lg px-8 py-3 inline-flex items-center space-x-2"
            >
              <span>Register Now</span>
              <ArrowRight className="w-5 h-5" />
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;


