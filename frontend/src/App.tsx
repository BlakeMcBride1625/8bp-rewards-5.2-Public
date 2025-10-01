import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './hooks/useAuth';
import Layout from './components/Layout';
import DarkModeToggle from './components/DarkModeToggle';
import HomePage from './pages/HomePage';
import RegisterPage from './pages/RegisterPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import ContactPage from './pages/ContactPage';
import SystemStatusPage from './pages/SystemStatusPage';
import LeaderboardPage from './pages/LeaderboardPage';
import TermsOfServicePage from './pages/TermsOfServicePage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import SocialsPage from './pages/SocialsPage';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-gradient-subtle dark:bg-background-dark-primary">
          <DarkModeToggle />
          <Layout>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/home" element={<HomePage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/admin-dashboard" element={<AdminDashboardPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/system-status" element={<SystemStatusPage />} />
              <Route path="/leaderboard" element={<LeaderboardPage />} />
              <Route path="/socials" element={<SocialsPage />} />
              <Route path="/terms" element={<TermsOfServicePage />} />
              <Route path="/privacy" element={<PrivacyPolicyPage />} />
            </Routes>
          </Layout>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#fff',
                color: '#334155',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
              },
              className: 'dark:bg-background-dark-secondary dark:text-text-dark-primary dark:border-background-dark-quaternary',
            }}
          />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;


