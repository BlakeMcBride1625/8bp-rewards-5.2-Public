import React from 'react';
import { motion } from 'framer-motion';

const AnimatedBackground: React.FC = () => {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      {/* Gradient Background */}
      <div className="absolute inset-0 bg-gradient-subtle dark:bg-gradient-to-br dark:from-background-dark-primary dark:via-background-dark-secondary dark:to-background-dark-tertiary" />
      
      {/* Enhanced Particles - More of them! */}
      <div className="absolute inset-0">
        {Array.from({ length: 50 }).map((_, i) => (
          <motion.div
            key={i}
            className={`particle particle-${(i % 3) + 1}`}
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, -30, 0],
              x: [0, Math.random() * 20 - 10, 0],
              opacity: [0.2, 0.8, 0.2],
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: 6 + Math.random() * 6,
              repeat: Infinity,
              delay: Math.random() * 3,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      {/* Large 3D Orbs - More dramatic! */}
      <div className="absolute inset-0">
        {/* Orb 1 - Top Left */}
        <motion.div
          className="orb orb-1"
          style={{
            left: '5%',
            top: '10%',
            width: '400px',
            height: '400px',
          }}
          animate={{
            x: [0, 80, 0],
            y: [0, -50, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        
        {/* Orb 2 - Top Right */}
        <motion.div
          className="orb orb-2"
          style={{
            right: '10%',
            top: '15%',
            width: '350px',
            height: '350px',
          }}
          animate={{
            x: [0, -60, 0],
            y: [0, 40, 0],
            scale: [1, 1.15, 1],
          }}
          transition={{
            duration: 18,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 2,
          }}
        />
        
        {/* Orb 3 - Middle */}
        <motion.div
          className="orb orb-3"
          style={{
            left: '50%',
            top: '50%',
            width: '300px',
            height: '300px',
          }}
          animate={{
            x: [0, 50, 0],
            y: [0, -40, 0],
            scale: [1, 1.2, 1],
            rotate: [0, 180, 360],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 4,
          }}
        />
        
        {/* Orb 4 - Bottom Left */}
        <motion.div
          className="orb orb-1"
          style={{
            left: '15%',
            bottom: '10%',
            width: '320px',
            height: '320px',
          }}
          animate={{
            x: [0, -45, 0],
            y: [0, -35, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 22,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 6,
          }}
        />
        
        {/* Orb 5 - Bottom Right */}
        <motion.div
          className="orb orb-2"
          style={{
            right: '5%',
            bottom: '15%',
            width: '380px',
            height: '380px',
          }}
          animate={{
            x: [0, 70, 0],
            y: [0, -45, 0],
            scale: [1, 1.12, 1],
          }}
          transition={{
            duration: 19,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 8,
          }}
        />
        
        {/* Small accent orbs */}
        {Array.from({ length: 8 }).map((_, i) => (
          <motion.div
            key={`accent-${i}`}
            className="orb orb-3"
            style={{
              left: `${15 + i * 12}%`,
              top: `${20 + (i % 3) * 25}%`,
              width: '150px',
              height: '150px',
            }}
            animate={{
              x: [0, Math.random() * 40 - 20, 0],
              y: [0, Math.random() * 40 - 20, 0],
              scale: [1, 1.3, 1],
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{
              duration: 12 + Math.random() * 8,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: i * 1.5,
            }}
          />
        ))}
      </div>

      {/* Floating Lines/Connections - Removed to prevent visible lines */}

      {/* Grid Pattern - Removed to eliminate visible lines */}

      {/* Radial gradient overlays - Removed to prevent lines */}
    </div>
  );
};

export default AnimatedBackground;
