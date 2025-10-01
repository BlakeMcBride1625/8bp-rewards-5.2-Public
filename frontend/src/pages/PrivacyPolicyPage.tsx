import React from 'react';
import { motion } from 'framer-motion';
import { Lock, Shield } from 'lucide-react';

const PrivacyPolicyPage: React.FC = () => {
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
            <Lock className="w-8 h-8 text-primary-600 dark:text-text-dark-highlight" />
          </div>
          <h1 className="text-4xl font-bold text-text-primary dark:text-text-dark-primary mb-4">
            Privacy Policy
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
              1. Information We Collect
            </h2>
            <p className="text-text-secondary dark:text-text-dark-secondary leading-relaxed mb-3">
              We collect the following information when you use our Service:
            </p>
            <ul className="list-disc list-inside text-text-secondary dark:text-text-dark-secondary space-y-2 ml-4">
              <li><strong>8 Ball Pool User ID:</strong> Your unique identifier for the 8 Ball Pool game</li>
              <li><strong>Username:</strong> The display name you provide during registration</li>
              <li><strong>Discord Information:</strong> If you use Discord OAuth login, we store your Discord user ID, username, and avatar</li>
              <li><strong>Claim Records:</strong> Information about reward claims including timestamps and claimed items</li>
              <li><strong>System Logs:</strong> Technical logs for system monitoring and troubleshooting</li>
              <li><strong>IP Address:</strong> Temporarily logged for security and abuse prevention</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-text-primary dark:text-text-dark-primary mb-4">
              2. How We Use Your Information
            </h2>
            <p className="text-text-secondary dark:text-text-dark-secondary leading-relaxed mb-3">
              We use the collected information to:
            </p>
            <ul className="list-disc list-inside text-text-secondary dark:text-text-dark-secondary space-y-2 ml-4">
              <li>Automatically claim daily rewards from 8 Ball Pool on your behalf</li>
              <li>Display statistics and claim history in the admin dashboard</li>
              <li>Send Discord notifications about reward claims (if enabled)</li>
              <li>Monitor system performance and troubleshoot issues</li>
              <li>Prevent abuse and maintain service integrity</li>
              <li>Respond to your support requests and inquiries</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-text-primary dark:text-text-dark-primary mb-4">
              3. Data Storage and Security
            </h2>
            <p className="text-text-secondary dark:text-text-dark-secondary leading-relaxed mb-3">
              Your data is stored securely:
            </p>
            <ul className="list-disc list-inside text-text-secondary dark:text-text-dark-secondary space-y-2 ml-4">
              <li><strong>Database:</strong> We use MongoDB Atlas with industry-standard encryption</li>
              <li><strong>Access Control:</strong> Only authorized administrators can access user data</li>
              <li><strong>No Passwords:</strong> We never collect or store your 8 Ball Pool password</li>
              <li><strong>Secure Transmission:</strong> All data is transmitted over HTTPS in production</li>
              <li><strong>Regular Backups:</strong> Data is backed up regularly to prevent loss</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-text-primary dark:text-text-dark-primary mb-4">
              4. Data Sharing and Disclosure
            </h2>
            <p className="text-text-secondary dark:text-text-dark-secondary leading-relaxed">
              We do NOT sell, trade, or rent your personal information to third parties. We may share your information only in the following circumstances:
            </p>
            <ul className="list-disc list-inside text-text-secondary dark:text-text-dark-secondary space-y-2 ml-4 mt-3">
              <li>With Discord (for bot notifications, if you've authorized Discord integration)</li>
              <li>When required by law or to protect our legal rights</li>
              <li>With service providers who assist in operating our Service (e.g., MongoDB hosting)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-text-primary dark:text-text-dark-primary mb-4">
              5. Third-Party Services
            </h2>
            <p className="text-text-secondary dark:text-text-dark-secondary leading-relaxed">
              Our Service interacts with third-party platforms including 8 Ball Pool (Miniclip) and Discord. These services have their own privacy policies, and we encourage you to review them. We are not responsible for the privacy practices of these third-party services.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-text-primary dark:text-text-dark-primary mb-4">
              6. Your Rights
            </h2>
            <p className="text-text-secondary dark:text-text-dark-secondary leading-relaxed mb-3">
              You have the right to:
            </p>
            <ul className="list-disc list-inside text-text-secondary dark:text-text-dark-secondary space-y-2 ml-4">
              <li>Access your personal data stored in our system</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your account and associated data</li>
              <li>Opt-out of Discord notifications</li>
              <li>Withdraw consent for data processing at any time</li>
            </ul>
            <p className="text-text-secondary dark:text-text-dark-secondary leading-relaxed mt-3">
              To exercise these rights, please contact us at connectwithme@epildevconnect.uk or use the Contact page.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-text-primary dark:text-text-dark-primary mb-4">
              7. Data Retention
            </h2>
            <p className="text-text-secondary dark:text-text-dark-secondary leading-relaxed">
              We retain your registration data and claim history for as long as your account is active. If you request account deletion, we will remove your personal information within 30 days, though some data may be retained for legal compliance or dispute resolution purposes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-text-primary dark:text-text-dark-primary mb-4">
              8. Cookies and Tracking
            </h2>
            <p className="text-text-secondary dark:text-text-dark-secondary leading-relaxed">
              Our Service uses minimal cookies for essential functionality such as session management and authentication. We do not use tracking cookies or third-party analytics. Your theme preference (dark/light mode) is stored in your browser's local storage.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-text-primary dark:text-text-dark-primary mb-4">
              9. Children's Privacy
            </h2>
            <p className="text-text-secondary dark:text-text-dark-secondary leading-relaxed">
              Our Service is not intended for children under 13 years of age. We do not knowingly collect personal information from children. If you believe we have collected information from a child, please contact us immediately.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-text-primary dark:text-text-dark-primary mb-4">
              10. Changes to Privacy Policy
            </h2>
            <p className="text-text-secondary dark:text-text-dark-secondary leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify users of any material changes by updating the "Last Updated" date at the top of this policy. Your continued use of the Service after changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-text-primary dark:text-text-dark-primary mb-4">
              11. Contact Us
            </h2>
            <p className="text-text-secondary dark:text-text-dark-secondary leading-relaxed">
              If you have any questions or concerns about this Privacy Policy or our data practices, please contact us:
            </p>
            <div className="mt-3 p-4 bg-gray-50 dark:bg-background-dark-tertiary rounded-lg">
              <p className="text-text-secondary dark:text-text-dark-secondary">
                <strong>Email:</strong> connectwithme@epildevconnect.uk<br />
                <strong>Website:</strong> https://8bp.epildevconnect.uk/8bp-rewards/contact
              </p>
            </div>
          </section>

          <div className="mt-8 p-4 bg-green-50 dark:bg-background-dark-tertiary border border-green-200 dark:border-dark-accent-ocean rounded-lg">
            <div className="flex items-start space-x-3">
              <Shield className="w-5 h-5 text-green-600 dark:text-dark-accent-ocean mt-0.5" />
              <div>
                <h3 className="font-semibold text-green-900 dark:text-text-dark-primary mb-1">
                  Your Privacy Matters
                </h3>
                <p className="text-sm text-green-700 dark:text-text-dark-secondary">
                  We take your privacy seriously and are committed to protecting your personal information. We only collect what's necessary to provide the Service and never share your data with unauthorized parties.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default PrivacyPolicyPage;
