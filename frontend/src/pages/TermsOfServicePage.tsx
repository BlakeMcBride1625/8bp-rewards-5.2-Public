import React from 'react';
import { motion } from 'framer-motion';
import { Shield, FileText } from 'lucide-react';

const TermsOfServicePage: React.FC = () => {
  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-12"
        >
          <div className="w-16 h-16 bg-primary-100 dark:bg-gradient-to-br dark:from-blue-500 dark:to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg dark:shadow-blue-500/40">
            <FileText className="w-8 h-8 text-primary-600 dark:text-text-dark-highlight" />
          </div>
          <h1 className="text-4xl font-bold text-text-primary dark:text-text-dark-primary mb-4">
            Terms of Service
          </h1>
          <p className="text-text-secondary dark:text-text-dark-secondary">
            Last Updated: September 30, 2025
          </p>
        </motion.div>

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="card space-y-6"
        >
          <section>
            <h2 className="text-2xl font-bold text-text-primary dark:text-text-dark-primary mb-4">
              1. Acceptance of Terms
            </h2>
            <p className="text-text-secondary dark:text-text-dark-secondary leading-relaxed">
              By accessing and using the 8 Ball Pool Rewards System ("the Service"), you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to these Terms of Service, please do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-text-primary dark:text-text-dark-primary mb-4">
              2. Description of Service
            </h2>
            <p className="text-text-secondary dark:text-text-dark-secondary leading-relaxed mb-3">
              The 8 Ball Pool Rewards System is an automated service that helps users claim daily rewards from 8 Ball Pool. The Service includes:
            </p>
            <ul className="list-disc list-inside text-text-secondary dark:text-text-dark-secondary space-y-2 ml-4">
              <li>Automated reward claiming at scheduled intervals (every 6 hours)</li>
              <li>User registration and account management</li>
              <li>Discord bot integration for notifications and commands</li>
              <li>Web-based admin dashboard for monitoring and management</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-text-primary dark:text-text-dark-primary mb-4">
              3. User Responsibilities
            </h2>
            <p className="text-text-secondary dark:text-text-dark-secondary leading-relaxed mb-3">
              By using this Service, you agree to:
            </p>
            <ul className="list-disc list-inside text-text-secondary dark:text-text-dark-secondary space-y-2 ml-4">
              <li>Provide accurate and truthful information during registration</li>
              <li>Keep your 8 Ball Pool User ID secure and confidential</li>
              <li>Use the Service only for your own personal 8 Ball Pool accounts</li>
              <li>Not abuse, exploit, or attempt to disrupt the Service</li>
              <li>Comply with all applicable 8 Ball Pool terms of service</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-text-primary dark:text-text-dark-primary mb-4">
              4. Service Availability
            </h2>
            <p className="text-text-secondary dark:text-text-dark-secondary leading-relaxed">
              We strive to maintain high availability of the Service, but we do not guarantee uninterrupted access. The Service may be temporarily unavailable due to maintenance, updates, or factors beyond our control. We are not liable for any missed reward claims due to service interruptions.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-text-primary dark:text-text-dark-primary mb-4">
              5. Disclaimer of Warranties
            </h2>
            <p className="text-text-secondary dark:text-text-dark-secondary leading-relaxed">
              THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. We do not guarantee that rewards will always be successfully claimed, and we are not responsible for any issues arising from the use of this Service with your 8 Ball Pool account.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-text-primary dark:text-text-dark-primary mb-4">
              6. Limitation of Liability
            </h2>
            <p className="text-text-secondary dark:text-text-dark-secondary leading-relaxed">
              In no event shall EpilDevConnect or its operators be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use or inability to use the Service. This includes, but is not limited to, loss of game progress, account suspension, or any other damages.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-text-primary dark:text-text-dark-primary mb-4">
              7. Third-Party Services
            </h2>
            <p className="text-text-secondary dark:text-text-dark-secondary leading-relaxed">
              This Service interacts with 8 Ball Pool, which is owned and operated by Miniclip. We are not affiliated with, endorsed by, or sponsored by Miniclip. Use of this Service is at your own risk, and you acknowledge that it may violate 8 Ball Pool's terms of service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-text-primary dark:text-text-dark-primary mb-4">
              8. Data and Privacy
            </h2>
            <p className="text-text-secondary dark:text-text-dark-secondary leading-relaxed">
              We collect and store your 8 Ball Pool User ID and username to provide the Service. We do not collect passwords or other sensitive account information. For more details, please see our Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-text-primary dark:text-text-dark-primary mb-4">
              9. Account Termination
            </h2>
            <p className="text-text-secondary dark:text-text-dark-secondary leading-relaxed">
              We reserve the right to suspend or terminate your access to the Service at any time, with or without notice, for conduct that we believe violates these Terms of Service or is harmful to other users, us, or third parties.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-text-primary dark:text-text-dark-primary mb-4">
              10. Changes to Terms
            </h2>
            <p className="text-text-secondary dark:text-text-dark-secondary leading-relaxed">
              We reserve the right to modify these Terms of Service at any time. Changes will be effective immediately upon posting. Your continued use of the Service after changes constitutes acceptance of the modified terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-text-primary dark:text-text-dark-primary mb-4">
              11. Contact Information
            </h2>
            <p className="text-text-secondary dark:text-text-dark-secondary leading-relaxed">
              If you have any questions about these Terms of Service, please contact us through our Contact page or email us at connectwithme@epildevconnect.uk
            </p>
          </section>

          <div className="mt-8 p-4 bg-blue-50 dark:bg-background-dark-tertiary border border-blue-200 dark:border-dark-accent-navy rounded-lg">
            <div className="flex items-start space-x-3">
              <Shield className="w-5 h-5 text-blue-600 dark:text-dark-accent-ocean mt-0.5" />
              <div>
                <h3 className="font-semibold text-blue-900 dark:text-text-dark-primary mb-1">
                  Important Notice
                </h3>
                <p className="text-sm text-blue-700 dark:text-text-dark-secondary">
                  This Service is provided for convenience and entertainment purposes. Use at your own discretion and ensure compliance with all applicable 8 Ball Pool terms and conditions.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default TermsOfServicePage;
