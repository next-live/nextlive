'use client';

import React, { useState, useEffect } from 'react';
import GeminiMobileThemeChat, { Message } from './components/GeminiMobileThemeChat'; 
import GeminiVoiceChat from './components/GeminiVoiceChat';
import { usePathname } from 'next/navigation';

interface NextLiveProps {
  children?: React.ReactNode;
  skipDevelopmentCheck?: boolean;
  skipPaths?: string[];
}

const GeminiIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28" fill="none">
    <path d="M14 28C14 26.0633 13.6267 24.2433 12.88 22.54C12.1567 20.8367 11.165 19.355 9.905 18.095C8.645 16.835 7.16333 15.8433 5.46 15.12C3.75667 14.3733 1.93667 14 0 14C1.93667 14 3.75667 13.6383 5.46 12.915C7.16333 12.1683 8.645 11.165 9.905 9.905C11.165 8.645 12.1567 7.16333 12.88 5.46C13.6267 3.75667 14 1.93667 14 0C14 1.93667 14.3617 3.75667 15.085 5.46C15.8317 7.16333 16.835 8.645 18.095 9.905C19.355 11.165 20.8367 12.1683 22.54 12.915C24.2433 13.6383 26.0633 14 28 14C26.0633 14 24.2433 14.3733 22.54 15.12C20.8367 15.8433 19.355 16.835 18.095 18.095C16.835 19.355 15.8317 20.8367 15.085 22.54C14.3617 24.2433 14 26.0633 14 28Z" fill="url(#paint0_radial_16771_53212)"/>
    <defs>
    <radialGradient id="paint0_radial_16771_53212" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(2.77876 11.3795) rotate(18.6832) scale(29.8025 238.737)">
    <stop offset="0.0671246" stop-color="#9168C0"/>
    <stop offset="0.342551" stop-color="#5684D1"/>
    <stop offset="0.672076" stop-color="#1BA1E3"/>
    </radialGradient>
    </defs>
    </svg>
);

const isPathMatching = (currentPath: string, skipPath: string): boolean => {
  // Convert wildcard pattern to regex
  const pattern = skipPath.replace(/\*/g, '.*');
  const regex = new RegExp(`^${pattern}$`);
  return regex.test(currentPath);
};

const NextLive: React.FC<NextLiveProps> = ({ children, skipDevelopmentCheck = false, skipPaths = [] }) => {
  // Return children directly if in development and not in development mode or if the path is in the skipPaths array
  const pathname = usePathname();
  const shouldSkip = skipPaths.some(skipPath => isPathMatching(pathname, skipPath));
  
  if (process.env.NODE_ENV === 'development' && !skipDevelopmentCheck && !shouldSkip) {
    return <>{children}</>;
  }
  const [isVisible, setIsVisible] = useState(false);  // Start hidden
  const [isTakingScreenshot, setIsTakingScreenshot] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSidePanel, setIsSidePanel] = useState(false);
  const [panelWidth, setPanelWidth] = useState(350);

  const toggleChat = () => {
    setIsVisible(prev => !prev);
    if (!isVisible) {
      setIsSidePanel(messages.length > 0);
    }
  };

  // Add keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key.toLowerCase() === 'g') {
        event.preventDefault();
        toggleChat();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVisible]);

  const handleSendMessage = (content: string) => {
    const messageType = content.startsWith('data:image') ? 'image' : 'text';
    setMessages(prev => [...prev, { type: messageType, content }]);
    setIsSidePanel(true);
  };

  const handleClose = () => {
    setIsVisible(false);
    setIsSidePanel(false);
    setMessages([]);
  };

  // Automatically switch to small box if no messages
  useEffect(() => {
    if (messages.length === 0) {
      setIsSidePanel(false);
    }
  }, [messages]);

  return (
    <div className="next-live flex w-full h-screen">
      <div className={`transition-all duration-300 ease-in-out ${isSidePanel ? `w-[calc(100%-${panelWidth}px)]` : 'w-full'}`}>
        {children}
      </div>
      <button
        className="fixed bottom-8 cursor-pointer right-8 bg-white hover:bg-gray-50 rounded-full p-4 shadow-lg transition-all duration-200 hover:scale-110 hover:shadow-xl"
        onClick={toggleChat}
        style={{
          opacity: isVisible && !isSidePanel ? 0 : 1,
          pointerEvents: isVisible && !isSidePanel ? 'none' : 'auto'
        }}
      >
        <GeminiIcon />
      </button>
      {isTakingScreenshot && (
        <div className="fixed inset-0 pointer-events-none z-50">
          <div className="absolute inset-0 border-[3px] border-transparent animate-[screenshot-border_3s_ease-in-out_forwards]"></div>
        </div>
      )}
      <GeminiMobileThemeChat
        onClose={handleClose}
        onSendMessage={handleSendMessage}
        messages={messages}
        isVisible={isVisible}
        setIsVisible={setIsVisible}
        isTakingScreenshot={isTakingScreenshot}
        setIsTakingScreenshot={setIsTakingScreenshot}
        isSidePanel={isSidePanel}
        width={panelWidth}
        onWidthChange={setPanelWidth}
      />
      <GeminiVoiceChat apiKey={process.env.NEXT_PUBLIC_GEMINI_API_KEY || ''} />
    </div>
  );
};

export default NextLive;
