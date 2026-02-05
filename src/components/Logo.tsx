import React from 'react';

interface LogoProps {
  collapsed?: boolean;
  theme?: 'light' | 'dark';
}

const Logo: React.FC<LogoProps> = ({ collapsed, theme = 'dark' }) => {
  const textColor = theme === 'light' ? '#000000' : '#ffffff';
  
  return (
    <div style={{ 
      height: 32, 
      margin: 16,
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', // Center when collapsed
      overflow: 'hidden'
    }}>
      {collapsed ? (
         // Collapsed Logo (Icon only)
         <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
            <rect width="32" height="32" rx="6" fill="#1677ff" />
            <text x="16" y="22" textAnchor="middle" fill="white" fontFamily="sans-serif" fontWeight="bold" fontSize="20">V</text>
         </svg>
      ) : (
         // Full Logo (Text Only as requested)
         <svg width="100%" height="32" viewBox="0 0 140 32" xmlns="http://www.w3.org/2000/svg">
            <text x="0" y="23" fill={textColor} fontFamily="sans-serif" fontWeight="bold" fontSize="20" letterSpacing="0.5">OpenVizUI</text>
         </svg>
      )}
    </div>
  );
};

export default Logo;
