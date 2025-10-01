import React, { useEffect } from 'react';

const DarkModeToggle: React.FC = () => {
  useEffect(() => {
    // Force dark mode always - no toggle
    document.documentElement.classList.add('dark');
    localStorage.setItem('darkMode', 'true');
  }, []);

  // Return null - no toggle button since dark mode is permanently on
  return null;
};

export default DarkModeToggle;