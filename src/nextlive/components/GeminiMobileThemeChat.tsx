import React, { useState, useEffect, useRef, FC } from 'react';
import { Box, Typography, IconButton, Paper, InputBase, CircularProgress } from '@mui/material';
import { 
  Close as CloseIcon,  
  PhotoCamera as CameraIcon,
  Send as SendIcon,
  Image as ImageIcon
} from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { geminiService } from '@/nextlive/services/gemini/chat/geminiService';
import Image from 'next/image';


export interface Message {
  type: 'text' | 'image' | 'ai';
  content: string;
  isLoading?: boolean;
}

interface GeminiMobileThemeChatProps {
  onClose: () => void;
  onSendMessage: (message: string) => void;
  messages: Message[];
  isVisible: boolean;
  setIsVisible: (visible: boolean) => void;
  isTakingScreenshot: boolean;
  setIsTakingScreenshot: (taking: boolean) => void;
  isSidePanel: boolean;
  width?: number;
  onWidthChange?: (width: number) => void;
}

const GeminiMobileThemeChat: FC<GeminiMobileThemeChatProps> = ({ 
  onClose, 
  onSendMessage: parentOnSendMessage,
  messages: parentMessages,
  isVisible,
  setIsVisible,
  setIsTakingScreenshot,
  isSidePanel,
  width = 350,
  onWidthChange
}) => {
  const [message, setMessage] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>(parentMessages);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [screenshotData, setScreenshotData] = useState<string | null>(null);
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update local messages when parent messages change
  useEffect(() => {
    setMessages(parentMessages);
  }, [parentMessages]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent): void => {
      if (!isResizing) return;
      
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth >= 200 && newWidth <= window.innerWidth * 0.8) {
        onWidthChange?.(newWidth);
      }
    };

    const handleMouseUp = (): void => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, onWidthChange]);

  const handleSendMessage = async (text: string, imageFile?: File) => {
    if (!text.trim() && !imageFile && !screenshotData) return;

    // Switch to side panel mode
    if (typeof parentOnSendMessage === 'function') {
      parentOnSendMessage(imageFile ? URL.createObjectURL(imageFile) : screenshotData || text);
    }

    // Add user message to chat
    const userMessage: Message = {
      type: imageFile || screenshotData ? 'image' : 'text',
      content: imageFile ? URL.createObjectURL(imageFile) : screenshotData || text
    };
    setMessages(prev => [...prev, userMessage]);
    //set is side panel to false
    // Add AI message with loading state
    const loadingMessage: Message = {
      type: 'ai',
      content: '',
      isLoading: true
    };
    setMessages(prev => [...prev, loadingMessage]);

    try {
      setIsProcessing(true);
      const response = await geminiService.sendMessage(text, imageFile || (screenshotData ? new File([await fetch(screenshotData).then(r => r.blob())], 'screenshot.png', { type: 'image/png' }) : undefined));
      
      // Update AI message with response
      setMessages(prev => {
        const newMessages = [...prev];
        const loadingIndex = newMessages.findIndex(m => m.isLoading);
        if (loadingIndex !== -1) {
          newMessages[loadingIndex] = {
            type: 'ai',
            content: response
          };
        }
        return newMessages;
      });
    } catch (error) {
      console.error('Error getting AI response:', error);
      setMessages(prev => {
        const newMessages = [...prev];
        const loadingIndex = newMessages.findIndex(m => m.isLoading);
        if (loadingIndex !== -1) {
          newMessages[loadingIndex] = {
            type: 'ai',
            content: 'Sorry, I encountered an error. Please try again.'
          };
        }
        return newMessages;
      });
    } finally {
      setIsProcessing(false);
      setMessage('');
      setScreenshotData(null);
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleSendMessage('Analyze this image:', file);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && message.trim()) {
      e.preventDefault();
      handleSendMessage(message);
    }
  };

  useEffect(() => {
    // Expose the screenshot function globally
    const windowWithScreenshot = window as unknown as Window & { captureScreenshot: () => Promise<string> };
    windowWithScreenshot.captureScreenshot = async () => {
      try {
        // Request screen capture
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 }
          }
        });

        // Create video element to capture the stream
        const video = document.createElement('video');
        video.srcObject = stream;
        await video.play();

        // Create canvas to capture the frame
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        if (!context) {
          throw new Error('Could not get canvas context');
        }

        // Set canvas size to match video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Draw the current frame
        context.drawImage(video, 0, 0);

        // Stop the stream
        stream.getTracks().forEach(track => track.stop());

        // Convert to image
        const imageData = canvas.toDataURL('image/png');
        
        // Create download link
        const link = document.createElement('a');
        link.download = 'screenshot.png';
        link.href = imageData;
        link.click();
        
        return imageData;
      } catch (error) {
        console.error('Error capturing screenshot:', error);
        throw error;
      }
    };
  }, []);

  const handleCaptureScreenshot = async () => {
    try {
      // If there's already a screenshot, don't take another one
      if (screenshotData) {
        return;
      }

      // Initial delay after clicking share
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Hide components before screenshot
      setIsVisible(false);
      setIsTakingScreenshot(true);
      
      // Request screen capture
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        }
      });

      // Wait for the share dialog to disappear
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Wait for the animation to complete (3 seconds)
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Wait a bit more for the border to fade out
      await new Promise(resolve => setTimeout(resolve, 500));

      // Create video element to capture the stream
      const video = document.createElement('video');
      video.srcObject = stream;
      await video.play();

      // Create canvas to capture the frame
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      if (!context) {
        throw new Error('Could not get canvas context');
      }

      // Set canvas size to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Draw the current frame
      context.drawImage(video, 0, 0);

      // Stop the stream
      stream.getTracks().forEach(track => track.stop());

      // Convert to image
      const imageData = canvas.toDataURL('image/png');
      
      // Store the screenshot
      setScreenshotData(imageData);
    } catch (error) {
      console.error('Error capturing screenshot:', error);
    } finally {
      // Show components again after screenshot
      setIsVisible(true);
      setIsTakingScreenshot(false);
    }
  };

  // Add the animation keyframes to the document
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes screenshot-border {
        0% {
          clip-path: polygon(0% 100%, 0% 100%, 0% 100%, 0% 100%);
          border-color: #FF6B6B;
        }
        25% {
          clip-path: polygon(0% 100%, 0% 0%, 0% 0%, 0% 100%);
          border-color: #4ECDC4;
        }
        50% {
          clip-path: polygon(0% 100%, 0% 0%, 100% 0%, 100% 100%);
          border-color: #45B7D1;
        }
        75% {
          clip-path: polygon(0% 100%, 0% 0%, 100% 0%, 100% 100%, 0% 100%);
          border-color: #96CEB4;
        }
        100% {
          clip-path: polygon(0% 100%, 0% 0%, 100% 0%, 100% 100%, 0% 100%);
          border-color: transparent;
        }
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  if (!isVisible) return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        ...(isSidePanel ? {
          right: 0,
          top: 0,
          bottom: 0,
          width: `${width}px`,
          transform: 'none',
        } : {
          bottom: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '80%',
          maxWidth: '400px',
        }),
        transition: isResizing ? 'none' : 'all 0.3s ease-in-out',
        zIndex: 1300,
      }}
    >
      {isSidePanel && (
        <Box
          sx={{
            position: 'absolute',
            left: -4,
            top: 0,
            bottom: 0,
            width: 8,
            cursor: 'col-resize',
            '&:hover': {
              '&::after': {
                opacity: 0.1,
              },
            },
            '&::after': {
              content: '""',
              position: 'absolute',
              left: 4,
              top: 0,
              bottom: 0,
              width: 1,
              backgroundColor: 'black',
              opacity: 0,
              transition: 'opacity 0.2s',
            },
            ...(isResizing && {
              '&::after': {
                opacity: 0.2,
              },
            }),
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            setIsResizing(true);
          }}
        />
      )}
      <Paper
        elevation={0}
        sx={{
          backgroundColor: 'white',
          borderRadius: isSidePanel ? '0' : 3,
          overflow: 'hidden',
          position: 'relative',
          height: isSidePanel ? '100%' : 'auto',
          display: 'flex',
          flexDirection: 'column',
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            padding: '1px',
            borderRadius: isSidePanel ? '0' : '24px',
            background: 'linear-gradient(60deg, rgba(76, 175, 80, 0.3), rgba(33, 150, 243, 0.3), rgba(156, 39, 176, 0.3))',
            WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
            pointerEvents: 'none',
          },
          boxShadow: isSidePanel 
            ? 'none'
            : `
            0 4px 6px -1px rgba(0, 0, 0, 0.1),
            0 2px 4px -1px rgba(0, 0, 0, 0.06),
            0 0 0 1px rgba(0, 0, 0, 0.05),
            0 1px 20px 10px rgba(76, 175, 80, 0.05),
            0 1px 30px 15px rgba(33, 150, 243, 0.03)
          `,
        }}
      >
        <Box sx={{ 
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
        }}>
          {/* Header */}
          <Box sx={{ p: 2, borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Typography
                sx={{
                  color: '#1a73e8',
                  fontSize: '14px',
                  fontWeight: 500,
                  '&::before': {
                    content: '"★"',
                    color: '#1a73e8',
                    marginRight: '8px',
                  },
                }}
              >
                Gemini AI Chat
              </Typography>
              <IconButton 
                size="small" 
                onClick={onClose}
                sx={{ 
                  marginLeft: 'auto',
                  color: '#5f6368',
                }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>

          {/* Messages container */}
          <Box sx={{ 
            flex: 1,
            overflowY: 'auto',
            p: 2,
            '&::-webkit-scrollbar': {
              width: '6px',
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: 'rgba(0,0,0,0.2)',
              borderRadius: '3px',
            },
          }}>
            {messages.map((msg, index) => (
              <Box 
                key={index} 
                sx={{ 
                  mb: 2,
                  display: 'flex',
                  justifyContent: msg.type === 'ai' ? 'flex-start' : 'flex-end',
                }}
              >
                <Box
                  sx={{
                    maxWidth: '85%',
                    backgroundColor: msg.type === 'ai' ? '#f8f9fa' : '#1a73e8',
                    borderRadius: msg.type === 'ai' 
                      ? '16px 16px 16px 4px'
                      : '16px 16px 4px 16px',
                    padding: '12px 16px',
                    position: 'relative',
                    '&::before': msg.type !== 'ai' ? {
                      content: '""',
                      position: 'absolute',
                      bottom: 0,
                      right: '-8px',
                      width: '20px',
                      height: '20px',
                      backgroundColor: '#1a73e8',
                      clipPath: 'polygon(0 0, 0% 100%, 100% 100%)',
                      borderBottomRightRadius: '16px',
                    } : {
                      content: '""',
                      position: 'absolute',
                      bottom: 0,
                      left: '-8px',
                      width: '20px',
                      height: '20px',
                      backgroundColor: '#f8f9fa',
                      clipPath: 'polygon(0 100%, 100% 100%, 100% 0)',
                      borderBottomLeftRadius: '16px',
                    }
                  }}
                >
                  {msg.isLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 1 }}>
                      <CircularProgress size={20} />
                    </Box>
                  ) : msg.type === 'image' ? (
                    <Box sx={{ 
                      position: 'relative',
                      maxWidth: '100%',
                      borderRadius: '8px',
                      overflow: 'hidden'
                    }}>
                      <Image
                        src={msg.content}
                        alt="User upload"
                        width={300}
                        height={200}
                        style={{ 
                          width: '100%',
                          height: 'auto',
                          borderRadius: '8px',
                          border: '1px solid rgba(255,255,255,0.2)'
                        }}
                      />
                    </Box>
                  ) : (
                    <Box sx={{ 
                      color: msg.type === 'ai' ? '#202124' : 'white',
                      wordBreak: 'break-word',
                      '& p': {
                        margin: '0.5em 0',
                        '&:first-of-type': {
                          marginTop: 0,
                        },
                        '&:last-of-type': {
                          marginBottom: 0,
                        }
                      },
                      '& pre': {
                        backgroundColor: msg.type === 'ai' ? 'rgba(0,0,0,0.04)' : 'rgba(0,0,0,0.2)',
                        padding: '8px 12px',
                        borderRadius: '4px',
                        overflowX: 'auto',
                        margin: '0.5em 0',
                      },
                      '& code': {
                        backgroundColor: msg.type === 'ai' ? 'rgba(0,0,0,0.04)' : 'rgba(0,0,0,0.2)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '0.9em',
                      },
                      '& a': {
                        color: msg.type === 'ai' ? '#1a73e8' : 'white',
                        textDecoration: 'underline',
                      },
                      '& ul, & ol': {
                        margin: '0.5em 0',
                        paddingLeft: '1.5em',
                      },
                      '& li': {
                        margin: '0.25em 0',
                      },
                      '& hr': {
                        margin: '1em 0',
                        border: 'none',
                        borderTop: `1px solid ${msg.type === 'ai' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.2)'}`,
                      },
                      '& blockquote': {
                        margin: '0.5em 0',
                        paddingLeft: '1em',
                        borderLeft: `3px solid ${msg.type === 'ai' ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.3)'}`,
                        color: msg.type === 'ai' ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.9)',
                      },
                      '& table': {
                        borderCollapse: 'collapse',
                        width: '100%',
                        margin: '0.5em 0',
                      },
                      '& th, & td': {
                        border: `1px solid ${msg.type === 'ai' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.2)'}`,
                        padding: '4px 8px',
                        textAlign: 'left',
                      },
                      '& th': {
                        backgroundColor: msg.type === 'ai' ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.1)',
                      }
                    }}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                    </Box>
                  )}
                </Box>
              </Box>
            ))}
          </Box>

          {/* Input area */}
          <Box sx={{ 
            p: 2, 
            borderTop: '1px solid rgba(0,0,0,0.1)',
            backgroundColor: 'white',
          }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {screenshotData && (
                <Box sx={{ 
                  position: 'relative',
                  maxWidth: '200px',
                  borderRadius: 1,
                  overflow: 'hidden'
                }}>
                  <Image
                    src={screenshotData}
                    alt="Screenshot preview"
                    width={300}
                    height={200}
                    style={{ 
                      width: '100%',
                      height: 'auto',
                      display: 'block'
                    }}
                  />
                  <IconButton
                    size="small"
                    onClick={() => setScreenshotData(null)}
                    sx={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      backgroundColor: 'rgba(0,0,0,0.5)',
                      color: 'white',
                      '&:hover': {
                        backgroundColor: 'rgba(0,0,0,0.7)'
                      }
                    }}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Box>
              )}
              <InputBase
                fullWidth
                multiline
                placeholder="Type a message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isProcessing}
                sx={{ 
                  fontSize: '16px',
                }}
              />
            </Box>
            
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
              <Paper
                elevation={0}
                sx={{
                  display: 'flex',
                  backgroundColor: '#f0f3f4',
                  borderRadius: 5,
                  padding: '4px 8px',
                  position: 'relative',
                  minWidth: '88px',
                  height: '40px',
                  overflow: 'hidden',
                }}
              >
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                />
                {message.trim() ? (
                  <IconButton 
                    size="small" 
                    sx={{ 
                      color: '#1a73e8',
                      '&:hover': {
                        color: '#1557b0'
                      }
                    }}
                    onClick={() => handleSendMessage(message)}
                    disabled={isProcessing}
                  >
                    <SendIcon />
                  </IconButton>
                ) : (
                  <>
                    <IconButton 
                      size="small" 
                      sx={{ 
                        color: screenshotData ? 'rgba(95, 99, 104, 0.3)' : '#5f6368'
                      }}
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isProcessing || screenshotData !== null}
                    >
                      <ImageIcon />
                    </IconButton>
                    <IconButton 
                      size="small" 
                      sx={{ 
                        color: screenshotData ? 'rgba(95, 99, 104, 0.3)' : '#5f6368',
                        ml: 1 
                      }} 
                      onClick={handleCaptureScreenshot}
                      disabled={isProcessing || screenshotData !== null}
                    >
                      <CameraIcon />
                    </IconButton>
                  </>
                )}
              </Paper>
            </Box>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default GeminiMobileThemeChat;
