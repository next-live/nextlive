import React, { useState, useEffect, useRef, FC, ReactNode } from 'react';
import { Box, Typography, IconButton, Paper, InputBase, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material';
import { 
  Close as CloseIcon,  
  PhotoCamera as CameraIcon,
  Send as SendIcon,
  Image as ImageIcon,
  Code as CodeIcon,
  Javascript as JavaScriptIcon,
  Html as HtmlIcon,
  Css as CssIcon,
  Description as TextIcon,
  DataObject as JsonIcon,
  Terminal as ShellIcon,
  Language as MarkdownIcon,
  Style as StyleIcon,
  Settings as ConfigIcon,
  Search,
  Article as YamlIcon,
  SmartToy as ModelIcon,
  History as HistoryIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import ReactMarkdown, { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { geminiService } from '@/nextlive/services/gemini/chat/geminiService';
import Image from 'next/image';
import { CodeBlock } from './CodeBlock';
import Editor from '@monaco-editor/react';
// Add this import at the top with other imports
import { Menu, MenuItem, ListItemIcon, ListItemText, TextField, Autocomplete } from '@mui/material';
import { MoreVert as MoreIcon, InsertDriveFile as FileIcon } from '@mui/icons-material';
import config from '../../../nextlive.config.json';

export interface Message {
  type: 'text' | 'image' | 'ai';
  content: string;
  isLoading?: boolean;
  status?: string;
}

type ThemeType = 'light' | 'dark';
type ThemeStyle = 'default' | 'glassmorphism' | 'grassmorphism';

interface GeminiMobileThemeChatProps {
  onClose: () => void;
  onSendMessage: (message: Message) => void;
  messages: Message[];
  isVisible: boolean;
  setIsVisible: (visible: boolean) => void;
  isTakingScreenshot: boolean;
  setIsTakingScreenshot: (taking: boolean) => void;
  isSidePanel: boolean;
  width?: number;
  onWidthChange?: (width: number) => void;
  theme?: ThemeType;
  themeStyle?: ThemeStyle;
  initialPosition?: { x: number; y: number };
  isMovable?: boolean;
  defaultModel?: string;
}

// Add interface for file structure
interface FileStructure {
  type: 'file' | 'directory';
  children?: Record<string, FileStructure>;
}

// Add interface for saved chat
interface SavedChat {
  id: string;
  model: string;
  messages: any[];
  timestamp: string;
}

interface ChatMessage {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

// Add EditorIcon component
const EditorIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
  </svg>
);

// Add this after your existing interfaces
interface Model {
  id: string;
  name: string;
  description: string;
}

const AVAILABLE_MODELS: Model[] = [
  {
    id: 'gemini-2.5-flash-preview-04-17',
    name: 'Gemini 2.5 Flash Preview',
    description: 'Adaptive thinking, cost efficiency'
  },
  {
    id: 'gemini-2.5-pro-preview-03-25',
    name: 'Gemini 2.5 Pro Preview',
    description: 'Enhanced thinking and reasoning, multimodal understanding, advanced coding'
  },
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    description: 'Next generation features, speed, thinking, realtime streaming, and multimodal generation'
  },
  {
    id: 'gemini-2.0-flash-lite',
    name: 'Gemini 2.0 Flash-Lite',
    description: 'Cost efficiency and low latency'
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    description: 'Fast and versatile performance across diverse tasks'
  },
  {
    id: 'gemini-1.5-flash-8b',
    name: 'Gemini 1.5 Flash-8B',
    description: 'High volume and lower intelligence tasks'
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    description: 'Complex reasoning tasks requiring more intelligence'
  },
  {
    id: 'gemini-embedding-exp',
    name: 'Gemini Embedding',
    description: 'Measuring the relatedness of text strings'
  },
  {
    id: 'imagen-3.0-generate-002',
    name: 'Imagen 3',
    description: 'Most advanced image generation model'
  },
  {
    id: 'veo-2.0-generate-001',
    name: 'Veo 2',
    description: 'High quality video generation'
  },
  {
    id: 'gemini-2.0-flash-live-001',
    name: 'Gemini 2.0 Flash Live',
    description: 'Low-latency bidirectional voice and video interactions'
  }
];

const GeminiMobileThemeChat: FC<GeminiMobileThemeChatProps> = ({ 
  onClose, 
  onSendMessage: parentOnSendMessage,
  messages: parentMessages,
  isVisible,
  setIsVisible,
  setIsTakingScreenshot,
  isSidePanel,
  width = 350,
  onWidthChange,
  theme = 'light',
  themeStyle = 'default',
  initialPosition = { x: 0, y: 0 },
  isMovable = false,
  defaultModel = 'gemini-pro'
}): React.ReactElement => {
  const [message, setMessage] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>(parentMessages);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [files, setFiles] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [screenshotData, setScreenshotData] = useState<string | null>(null);
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [position, setPosition] = useState(initialPosition);
  const dragRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editorLanguage, setEditorLanguage] = useState('typescript');
  const [editorContent, setEditorContent] = useState('');
  // Add to your state variables
  const [showFileDropdown, setShowFileDropdown] = useState(false);
  const [filteredFiles, setFilteredFiles] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [cursorPosition, setCursorPosition] = useState<number>(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [currentStatus, setCurrentStatus] = useState<string>('');
  const [showFileSuggestions, setShowFileSuggestions] = useState(false);
  const [suggestedFiles, setSuggestedFiles] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [selectedModel, setSelectedModel] = useState<string>(defaultModel);
  const [showModelSelector, setShowModelSelector] = useState<boolean>(false);
  const [fileMentions, setFileMentions] = useState<Array<{start: number; end: number; file: string}>>([]);
  // Add ref for messages container
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Add state for chat history
  const [savedChats, setSavedChats] = useState<SavedChat[]>([]);
  const [showChatHistory, setShowChatHistory] = useState<boolean>(false);
  const [isLoadingChats, setIsLoadingChats] = useState<boolean>(false);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);

  const isDark = theme === 'dark';
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setMessage(value);
    setCursorPosition(e.target.selectionStart || 0);

    // Track file mentions
    const mentions: Array<{start: number; end: number; file: string}> = [];
    const regex = /@([^\s]+)/g;
    let match;
    while ((match = regex.exec(value)) !== null) {
      mentions.push({
        start: match.index,
        end: match.index + match[0].length,
        file: match[1]
      });
    }
    setFileMentions(mentions);

    // Check for file suggestions
    const textBeforeCursor = value.substring(0, e.target.selectionStart || 0);
    const lastAtSymbol = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtSymbol !== -1 && (lastAtSymbol === 0 || value[lastAtSymbol - 1] === ' ')) {
      const searchTerm = textBeforeCursor.substring(lastAtSymbol + 1).toLowerCase();
      const filteredFiles = files.filter(file => 
        file.toLowerCase().includes(searchTerm) || 
        file.split('/').pop()?.toLowerCase().includes(searchTerm)
      );
      setSuggestedFiles(filteredFiles.slice(0, 5));
      setShowFileSuggestions(true);
    } else {
      setShowFileSuggestions(false);
    }

    // Adjust textarea height if needed
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  const handleFileSelect = (file: string) => {
    const textBeforeCursor = message.substring(0, cursorPosition);
    const lastAtSymbol = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtSymbol !== -1) {
      const newMessage = 
        message.substring(0, lastAtSymbol) + 
        '@' + file + 
        message.substring(cursorPosition);
      setMessage(newMessage);
      setShowFileSuggestions(false);
    }
  };

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
  const fetchFiles = async () => {
    try {
      setIsLoadingFiles(true);
      // Use the project structure API endpoint
      const baseDir = 'src/'; // Can be configured to start from a specific directory
      const depth = 10; // How deep to traverse the directory structure
      const filesEndpoint =`/api/project-structure?baseDir=${encodeURIComponent(baseDir)}&depth=${depth}`;
      
      const response = await fetch(filesEndpoint);
      
      if (!response.ok) {
        throw new Error('Failed to fetch files');
      }
      
      const data = await response.json();
      
      if (data.success && data.structure) {
        // Convert the structure to a flat array of file paths
        const flattenStructure = (obj: Record<string, FileStructure>, path = ''): string[] => {
          let results: string[] = [];
          
          for (const [key, value] of Object.entries(obj)) {
            const currentPath = path ? `${path}/${key}` : key;
            const fileValue = value as FileStructure; // Type assertion since we know the structure
            
            if (fileValue.type === 'file') {
              results.push(currentPath);
            } else if (fileValue.type === 'directory' && fileValue.children) {
              results = [...results, ...flattenStructure(fileValue.children, currentPath)];
            }
          }
          
          return results;
        };
        
        const fileList = flattenStructure(data.structure);
        setFiles(fileList);
        // Initialize suggested files with all files
        setSuggestedFiles(fileList.slice(0, 5));
        setShowFileSuggestions(true);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.error('Error fetching files:', error);
      // Fallback to some dummy files for demo
      const fallbackFiles = [
        'src/pages/index.tsx',
        'src/components/Header.tsx',
        'src/styles/globals.css',
        'package.json',
        'next.config.js'
      ];
      setFiles(fallbackFiles);
      setSuggestedFiles(fallbackFiles);
      setShowFileSuggestions(true);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  // Update useEffect to fetch files immediately
  useEffect(() => {
    fetchFiles();
  }, []);

  const handleFileSelectFromDropdown = (file: string) => {
    const textBeforeCursor = message.substring(0, cursorPosition);
    const lastAtSymbol = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtSymbol !== -1) {
      // Replace @search_term with @file_path
      const textBeforeAt = message.substring(0, lastAtSymbol);
      const textAfterCursor = message.substring(cursorPosition);
      
      const newMessage = textBeforeAt + '@' + file + ' ' + textAfterCursor;
      setMessage(newMessage);
      
      // Set cursor after the inserted file path
      setTimeout(() => {
        if (inputRef.current) {
          const newCursorPos = lastAtSymbol + file.length + 2; // +2 for @ and space
          inputRef.current.focus();
          inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
      }, 0);
    }
    
    setShowFileDropdown(false);
  };
  // Handle drag and drop
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('.drag-handle')) {
        setIsDragging(true);
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if(!isMovable) return;
      if (isDragging) {
        setPosition({
          x: e.clientX - (dragRef.current?.offsetWidth || 0) / 2,
          y: e.clientY - (dragRef.current?.offsetHeight || 0) / 2,
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousedown', handleMouseDown);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const handleSendMessage = async (text: string, imageFile?: File) => {
    if (!text.trim() && !imageFile && !screenshotData) return;

    const userContent = imageFile ? URL.createObjectURL(imageFile) : screenshotData || text;
    
    // Add user message
    const userMessage: Message = {
      type: imageFile ? 'image' : 'text',
      content: userContent
    };
    if (typeof parentOnSendMessage === 'function') {
      parentOnSendMessage(userMessage);
    }

    try {
      setIsProcessing(true);
      
      // Add AI loading message
      const loadingMessage: Message = {
        type: 'ai',
        content: '',
        isLoading: true,
        status: 'Thinking...'
      };
      if (typeof parentOnSendMessage === 'function') {
        parentOnSendMessage(loadingMessage);
      }

      const response = await geminiService.sendMessage(text);
      
      // Add AI response message and remove loading state
      const aiMessage: Message = {
        type: 'ai',
        content: response,
        isLoading: false
      };
      if (typeof parentOnSendMessage === 'function') {
        parentOnSendMessage(aiMessage);
      }
    } catch (error) {
      console.error('Error getting AI response:', error);
      // Add error message
      const errorMessage: Message = {
        type: 'ai',
        content: 'Sorry, I encountered an error. Please try again.',
        isLoading: false
      };
      if (typeof parentOnSendMessage === 'function') {
        parentOnSendMessage(errorMessage);
      }
    } finally {
      setIsProcessing(false);
      setMessage('');
      setScreenshotData(null);
    }
  };

  const handleCodeEditMode = () => {
    setMessage(prev => {
      const prefix = '/edit ';
      if (prev.startsWith(prefix)) {
        return prev.substring(prefix.length);
      } else {
        return prefix + prev;
      }
    });
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

  const handleEditorClose = () => {
    setShowEditor(false);
  };

  const handleEditorSave = () => {
    setMessage(editorContent);
    setShowEditor(false);
  };

  const getThemeStyles = () => {
    const baseStyles = {
      backgroundColor: isDark ? '#1a1a1a' : 'white',
      color: isDark ? '#ffffff' : '#000000',
      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
      backdropFilter: 'none',
      boxShadow: 'none',
      border: 'none',
    } as const;

    switch (themeStyle) {
      case 'glassmorphism':
        return {
          ...baseStyles,
          backgroundColor: isDark ? 'rgba(26, 26, 26, 0.7)' : 'rgba(255, 255, 255, 0.7)',
          backdropFilter: 'blur(10px)',
          boxShadow: isDark 
            ? '0 4px 6px -1px rgba(0, 0, 0, 0.2), 0 2px 4px -1px rgba(0, 0, 0, 0.1)'
            : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        } as const;
      case 'grassmorphism':
        return {
          ...baseStyles,
          backgroundColor: isDark ? 'rgba(26, 26, 26, 0.8)' : 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(8px)',
          boxShadow: isDark
            ? '0 4px 6px -1px rgba(0, 0, 0, 0.2), 0 2px 4px -1px rgba(0, 0, 0, 0.1), inset 0 0 0 1px rgba(255, 255, 255, 0.1)'
            : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06), inset 0 0 0 1px rgba(0, 0, 0, 0.05)',
          border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.05)',
        } as const;
      default:
        return baseStyles;
    }
  };

  const themeStyles = getThemeStyles();

  const grassmorphismStyles = {
    backgroundColor: isDark ? 'rgba(26, 26, 26, 0.8)' : 'rgba(255, 255, 255, 0.8)',
    backdropFilter: 'blur(8px)',
    boxShadow: isDark
      ? '0 4px 6px -1px rgba(0, 0, 0, 0.2), 0 2px 4px -1px rgba(0, 0, 0, 0.1), inset 0 0 0 1px rgba(255, 255, 255, 0.1)'
      : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06), inset 0 0 0 1px rgba(0, 0, 0, 0.05)',
    border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.05)',
  };

  const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase() || '';
    
    switch (extension) {
      case 'js':
      case 'jsx':
      case 'ts':
      case 'tsx':
        return <JavaScriptIcon sx={{ color: '#F7DF1E' }} />;
      case 'html':
      case 'htm':
        return <HtmlIcon sx={{ color: '#E34F26' }} />;
      case 'css':
        return <CssIcon sx={{ color: '#1572B6' }} />;
      case 'scss':
        return <CssIcon sx={{ color: '#1572B6' }} />;
      case 'sass':
        return <CssIcon sx={{ color: '#1572B6' }} />;
      case 'less':
        return <CssIcon sx={{ color: '#1572B6' }} />;
      case 'png':
        return <ImageIcon sx={{ color: '#FF4081' }} />;
      case 'jpg':
        return <ImageIcon sx={{ color: '#FF4081' }} />;
      case 'jpeg':
        return <ImageIcon sx={{ color: '#FF4081' }} />;
      case 'gif':
        return <ImageIcon sx={{ color: '#FF4081' }} />;
      case 'svg':
        return <ImageIcon sx={{ color: '#FF4081' }} />;
      case 'webp':
        return <ImageIcon sx={{ color: '#FF4081' }} />;
      case 'json':
        return <JsonIcon sx={{ color: '#40C4FF' }} />;
      case 'md':
        return <MarkdownIcon sx={{ color: '#42A5F5' }} />;
      case 'markdown':
        return <MarkdownIcon sx={{ color: '#42A5F5' }} />;
      case 'sh':
        return <ShellIcon sx={{ color: '#76FF03' }} />;
      case 'bash':
        return <ShellIcon sx={{ color: '#76FF03' }} />;
      case 'zsh':
        return <ShellIcon sx={{ color: '#76FF03' }} />;
      case 'ico':
        return <ImageIcon sx={{ color: '#FF4081' }} />;
      case 'yml':
      case 'yaml':
        return <YamlIcon sx={{ color: '#FF9100' }} />;
      case 'conf':
        return <ConfigIcon sx={{ color: '#FF9100' }} />;
      case 'config':
        return <ConfigIcon sx={{ color: '#FF9100' }} />;
      case 'py':
        return <CodeIcon sx={{ color: '#3776AB' }} />;
      case 'txt':
        return <TextIcon sx={{ color: '#78909C' }} />;
      default:
        return <FileIcon sx={{ color: isDark ? 'rgba(255,255,255,0.7)' : '#5f6368' }} />;
    }
  };

  const handleModelSelect = (modelId: string) => {
    setSelectedModel(modelId);
    setShowModelSelector(false);
    geminiService.setModel(modelId);
  };

  const renderModelSelector = () => (
    <Paper
      elevation={0}
      sx={{
        position: 'absolute',
        bottom: '100%',
        right: 0,
        width: '280px',
        marginBottom: '8px',
        ...grassmorphismStyles,
        borderRadius: '12px',
        zIndex: 1000,
        backgroundColor: isDark ? 'rgb(30, 30, 30)' : 'rgb(255, 255, 255)',
        overflow: 'hidden'
      }}
    >
      <Box sx={{ p: 2, borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}` }}>
        <Typography
          sx={{
            fontSize: '14px',
            fontWeight: 500,
            color: isDark ? '#e1e1e1' : '#333',
          }}
        >
          Select Model
        </Typography>
      </Box>
      <Box sx={{
        maxHeight: '300px',
        overflowY: 'auto',
        '&::-webkit-scrollbar': {
          width: '4px',
          background: 'transparent'
        },
        '&::-webkit-scrollbar-track': {
          background: 'transparent'
        },
        '&::-webkit-scrollbar-thumb': {
          background: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
          borderRadius: '4px',
          '&:hover': {
            background: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'
          }
        }
      }}>
        {AVAILABLE_MODELS.map((model) => (
          <MenuItem
            key={model.id}
            onClick={() => handleModelSelect(model.id)}
            selected={selectedModel === model.id}
            sx={{
              py: 1.5,
              px: 2,
              '&:hover': {
                backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
              },
              '&.Mui-selected': {
                backgroundColor: isDark ? 'rgba(78, 205, 196, 0.15)' : 'rgba(26, 115, 232, 0.08)',
                '&:hover': {
                  backgroundColor: isDark ? 'rgba(78, 205, 196, 0.25)' : 'rgba(26, 115, 232, 0.12)',
                }
              }
            }}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              <Typography
                sx={{
                  fontSize: '14px',
                  fontWeight: 500,
                  color: isDark ? '#e1e1e1' : '#333',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1
                }}
              >
                <ModelIcon sx={{ 
                  fontSize: '16px',
                  color: selectedModel === model.id 
                    ? (isDark ? '#4ECDC4' : '#1a73e8')
                    : (isDark ? 'rgba(255,255,255,0.7)' : '#5f6368')
                }} />
                {model.name}
              </Typography>
              <Typography
                sx={{
                  fontSize: '12px',
                  color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
                  mt: 0.5
                }}
              >
                {model.description}
              </Typography>
            </Box>
          </MenuItem>
        ))}
      </Box>
    </Paper>
  );

  const renderStyledMessage = (): ReactNode => {
    if (fileMentions.length === 0) return message;

    let lastIndex = 0;
    const parts: ReactNode[] = [];

    fileMentions.forEach(({start, end, file}, index) => {
      // Add text before the mention
      if (start > lastIndex) {
        parts.push(
          <span key={`text-${index}`}>
            {message.slice(lastIndex, start)}
          </span>
        );
      }

      // Add the styled mention
      parts.push(
        <span
          key={`mention-${index}`}
          style={{
            backgroundColor: isDark ? 'rgba(26, 115, 232, 0.3)' : 'rgba(26, 115, 232, 0.1)',
            color: isDark ? '#4ECDC4' : '#1a73e8',
            padding: '2px 4px',
            borderRadius: '4px',
            margin: '0 1px',
          }}
        >
          @{file}
        </span>
      );

      lastIndex = end;
    });

    // Add any remaining text
    if (lastIndex < message.length) {
      parts.push(
        <span key="text-end">
          {message.slice(lastIndex)}
        </span>
      );
    }

    return <>{parts}</>;
  };

  // Add function to load saved chats
  const loadSavedChats = async () => {
    try {
      setIsLoadingChats(true);
      const chats = await geminiService.listSavedChats();
      setSavedChats(chats);
    } catch (error) {
      console.error('Error loading saved chats:', error);
    } finally {
      setIsLoadingChats(false);
    }
  };

  // Add function to load a specific chat
  const loadChat = async (chatId: string) => {
    try {
      const success = await geminiService.loadChatHistory(chatId);
      if (success) {
        setCurrentChatId(chatId);
        setShowChatHistory(false);
        // Convert the chat history to the format expected by the component
        const formattedMessages = geminiService.getChatHistory().map((msg: ChatMessage) => {
          if (msg.role === 'user') {
            return {
              type: 'text',
              content: msg.parts[0].text
            };
          } else if (msg.role === 'model') {
            return {
              type: 'ai',
              content: msg.parts[0].text
            };
          }
          return null;
        }).filter(Boolean) as Message[];
        
        // Set messages and update panel state
        setMessages(formattedMessages);
        setIsVisible(true);
        
        // If not already in side panel mode, convert to side panel
        if (!isSidePanel) {
          onWidthChange?.(350); // Set default width for side panel
        }
      }
    } catch (error) {
      console.error('Error loading chat:', error);
    }
  };

  // Add function to delete a chat
  const deleteChat = async (chatId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      const success = await geminiService.deleteChat(chatId);
      if (success) {
        setSavedChats(prevChats => prevChats.filter(chat => chat.id !== chatId));
        if (currentChatId === chatId) {
          setCurrentChatId(null);
          setMessages([]);
        }
      }
    } catch (error) {
      console.error('Error deleting chat:', error);
    }
  };

  // Add function to start a new chat
  const startNewChat = () => {
    geminiService.reset();
    setCurrentChatId(null);
    setMessages([]);
    setShowChatHistory(false);
    
    // Ensure the chat is visible when starting a new one
    setIsVisible(true);
    
    // If not already in side panel mode, convert to side panel
    if (!isSidePanel) {
      onWidthChange?.(350); // Set default width for side panel
    }
  };

  // Load saved chats when component mounts
  useEffect(() => {
    loadSavedChats();
  }, []);

  const renderChatHistory = () => (
    <Paper
      elevation={0}
      sx={{
        position: 'absolute',
        bottom: '100%',
        right: 0,
        width: '280px',
        marginBottom: '8px',
        ...grassmorphismStyles,
        borderRadius: '12px',
        zIndex: 1000,
        backgroundColor: isDark ? 'rgb(30, 30, 30)' : 'rgb(255, 255, 255)',
        overflow: 'hidden'
      }}
    >
      <Box sx={{ p: 2, borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}` }}>
        <Typography
          sx={{
            fontSize: '14px',
            fontWeight: 500,
            color: isDark ? '#e1e1e1' : '#333',
          }}
        >
          Chat History
        </Typography>
      </Box>
      <Box sx={{
        maxHeight: '300px',
        overflowY: 'auto',
        '&::-webkit-scrollbar': {
          width: '4px',
          background: 'transparent'
        },
        '&::-webkit-scrollbar-track': {
          background: 'transparent'
        },
        '&::-webkit-scrollbar-thumb': {
          background: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
          borderRadius: '4px',
          '&:hover': {
            background: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'
          }
        }
      }}>
        <MenuItem
          onClick={startNewChat}
          sx={{
            py: 1.5,
            px: 2,
            '&:hover': {
              backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
            },
            '&.Mui-selected': {
              backgroundColor: isDark ? 'rgba(78, 205, 196, 0.15)' : 'rgba(26, 115, 232, 0.08)',
              '&:hover': {
                backgroundColor: isDark ? 'rgba(78, 205, 196, 0.25)' : 'rgba(26, 115, 232, 0.12)',
              }
            }
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            <Typography
              sx={{
                fontSize: '14px',
                fontWeight: 500,
                color: isDark ? '#4ECDC4' : '#1a73e8',
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}
            >
              <HistoryIcon sx={{ fontSize: '16px' }} />
              New Chat
            </Typography>
          </Box>
        </MenuItem>
        
        {isLoadingChats ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
            <CircularProgress size={24} />
          </Box>
        ) : savedChats.length === 0 ? (
          <Box sx={{ p: 2, textAlign: 'center' }}>
            <Typography
              sx={{
                fontSize: '14px',
                color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
              }}
            >
              No saved chats
            </Typography>
          </Box>
        ) : (
          savedChats.map((chat) => (
            <MenuItem
              key={chat.id}
              onClick={() => loadChat(chat.id)}
              selected={currentChatId === chat.id}
              sx={{
                py: 1.5,
                px: 2,
                '&:hover': {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                },
                '&.Mui-selected': {
                  backgroundColor: isDark ? 'rgba(78, 205, 196, 0.15)' : 'rgba(26, 115, 232, 0.08)',
                  '&:hover': {
                    backgroundColor: isDark ? 'rgba(78, 205, 196, 0.25)' : 'rgba(26, 115, 232, 0.12)',
                  }
                }
              }}
            >
              <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography
                    sx={{
                      fontSize: '14px',
                      fontWeight: 500,
                      color: isDark ? '#e1e1e1' : '#333',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1
                    }}
                  >
                    <HistoryIcon sx={{ 
                      fontSize: '16px',
                      color: currentChatId === chat.id 
                        ? (isDark ? '#4ECDC4' : '#1a73e8')
                        : (isDark ? 'rgba(255,255,255,0.7)' : '#5f6368')
                    }} />
                    {new Date(chat.timestamp).toLocaleString()}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={(e) => deleteChat(chat.id, e)}
                    sx={{
                      color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
                      '&:hover': {
                        color: isDark ? '#ff6b6b' : '#d32f2f',
                      }
                    }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
                <Typography
                  sx={{
                    fontSize: '12px',
                    color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
                    mt: 0.5,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {chat.messages.length > 0 
                    ? chat.messages[0].parts[0].text.substring(0, 50) + (chat.messages[0].parts[0].text.length > 50 ? '...' : '')
                    : 'Empty chat'}
                </Typography>
                <Typography
                  sx={{
                    fontSize: '11px',
                    color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
                    mt: 0.5
                  }}
                >
                  Model: {chat.model}
                </Typography>
              </Box>
            </MenuItem>
          ))
        )}
      </Box>
    </Paper>
  );

  const renderInputArea = (): React.ReactElement => {
    const preserveSpaces = (text: string): string => {
      return text.replace(/ /g, '\u00A0');
    };

    return (
      <Box sx={{ 
        p: 2, 
        borderTop: `1px solid ${themeStyles.borderColor}`,
        backgroundColor: themeStyles.backgroundColor,
        position: 'relative',
      }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Box sx={{ position: 'relative', width: '100%' }}>
            {/* Main input container */}
            <Box
              sx={{
                position: 'relative',
                backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.04)',
                borderRadius: '8px',
                minHeight: '40px',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              {/* Hidden mirror div for measuring text */}
              <Box
                sx={{
                  visibility: 'hidden',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  padding: '8px 12px',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  overflowWrap: 'break-word',
                  fontFamily: 'inherit',
                  fontSize: '16px',
                  lineHeight: '1.5',
                  minHeight: '40px',
                }}
                ref={textareaRef}
              >
                {preserveSpaces(message + ' ')}
              </Box>

              {/* Highlighting layer */}
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  padding: '8px 12px',
                  pointerEvents: 'none',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  overflowWrap: 'break-word',
                  fontFamily: 'inherit',
                  fontSize: '16px',
                  lineHeight: '1.5',
                  color: 'transparent',
                  minHeight: '40px',
                  '& .mention': {
                    backgroundColor: isDark ? 'rgba(26, 115, 232, 0.3)' : 'rgba(26, 115, 232, 0.1)',
                    color: isDark ? '#4ECDC4' : '#1a73e8',
                    padding: '2px 4px',
                    borderRadius: '4px',
                    margin: '0 1px',
                  }
                }}
              >
                {message.split(/(@\S+)/).map((part, index) => {
                  if (part.startsWith('@')) {
                    return <span key={index} className="mention">{preserveSpaces(part)}</span>;
                  }
                  return <span key={index}>{preserveSpaces(part)}</span>;
                })}
              </Box>

              {/* Actual input */}
              <InputBase
                fullWidth
                multiline
                placeholder="Type a message... (Type @ to mention files)"
                value={message}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                disabled={isProcessing}
                sx={{ 
                  padding: '8px 12px',
                  fontSize: '16px',
                  lineHeight: '1.5',
                  color: isDark ? '#ffffff' : '#333',
                  backgroundColor: 'transparent',
                  position: 'relative',
                  flex: 1,
                  '& .MuiInputBase-input': {
                    padding: 0,
                    fontFamily: 'inherit',
                    fontSize: '16px',
                    lineHeight: '1.5',
                    color: 'inherit',
                    caretColor: isDark ? '#ffffff' : '#333',
                  },
                  '&::placeholder': {
                    color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
                    opacity: 1,
                  },
                  '& textarea': {
                    resize: 'none',
                  }
                }}
              />
            </Box>

            {/* Dropdowns */}
            {showModelSelector && renderModelSelector()}
            {showFileSuggestions && suggestedFiles.length > 0 && (
              <Paper
                elevation={0}
                sx={{
                  position: 'absolute',
                  bottom: '100%',
                  left: 0,
                  width: '100%',
                  maxHeight: '200px',
                  marginBottom: '8px',
                  ...grassmorphismStyles,
                  borderRadius: '12px',
                  zIndex: 1000,
                  display: 'flex',
                  flexDirection: 'column',
                  backgroundColor: isDark ? 'rgb(30, 30, 30)' : 'rgb(255, 255, 255)',
                }}
              >
                <Box
                  sx={{
                    flex: 1,
                    overflowY: 'auto',
                    '&::-webkit-scrollbar': {
                      width: '4px',
                      background: 'transparent'
                    },
                    '&::-webkit-scrollbar-track': {
                      background: 'transparent'
                    },
                    '&::-webkit-scrollbar-thumb': {
                      background: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
                      borderRadius: '4px',
                      '&:hover': {
                        background: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'
                      }
                    }
                  }}
                >
                  {suggestedFiles.map((file, index) => {
                    const fileName = file.split('/').pop() || file;
                    const filePath = file.split('/').slice(0, -1).join('/');
                    
                    return (
                      <MenuItem
                        key={file}
                        onClick={() => handleFileSelect(file)}
                        sx={{
                          py: 0.75,
                          px: 1,
                          minHeight: '32px',
                          '&:hover': {
                            backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                          },
                          '&.Mui-focused': {
                            backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
                          }
                        }}
                      >
                        <Box sx={{ 
                          display: 'flex', 
                          alignItems: 'center',
                          width: '100%',
                          gap: 1
                        }}>
                          <Box sx={{ 
                            display: 'flex',
                            alignItems: 'center',
                            minWidth: '20px'
                          }}>
                            {getFileIcon(fileName)}
                          </Box>
                          <Box sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            flex: 1,
                            overflow: 'hidden'
                          }}>
                            <Typography
                              sx={{
                                fontSize: '13px',
                                fontWeight: 500,
                                color: isDark ? '#e1e1e1' : '#333',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}
                            >
                              {fileName}
                            </Typography>
                            {filePath && (
                              <Typography
                                sx={{
                                  fontSize: '11px',
                                  color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  fontFamily: 'monospace'
                                }}
                              >
                                {filePath}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      </MenuItem>
                    );
                  })}
                </Box>
              </Paper>
            )}
          </Box>
        </Box>
        
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
          <Paper
            elevation={0}
            sx={{
              display: 'flex',
              backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#f0f3f4',
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
                  color: isDark ? '#4ECDC4' : '#1a73e8',
                  '&:hover': {
                    color: isDark ? '#3DBDB4' : '#1557b0'
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
                    color: screenshotData 
                      ? (isDark ? 'rgba(255,255,255,0.3)' : 'rgba(95, 99, 104, 0.3)')
                      : (isDark ? 'rgba(255,255,255,0.7)' : '#5f6368')
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessing || screenshotData !== null}
                >
                  <ImageIcon />
                </IconButton>
                <IconButton 
                  size="small" 
                  sx={{ 
                    color: screenshotData 
                      ? (isDark ? 'rgba(255,255,255,0.3)' : 'rgba(95, 99, 104, 0.3)')
                      : (isDark ? 'rgba(255,255,255,0.7)' : '#5f6368'),
                    ml: 1 
                  }} 
                  onClick={handleCaptureScreenshot}
                  disabled={isProcessing || screenshotData !== null}
                >
                  <CameraIcon />
                </IconButton>
                <IconButton 
                  size="small" 
                  sx={{ 
                    color: isDark ? 'rgba(255,255,255,0.7)' : '#5f6368',
                    ml: 1,
                    backgroundColor: showEditor ? (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.04)') : 'transparent'
                  }} 
                  onClick={() => {
                    setEditorContent(message);
                    setShowEditor(true);
                  }}
                >
                  <EditorIcon />
                </IconButton>
                <IconButton 
                  size="small" 
                  sx={{ 
                    color: isDark ? 'rgba(255,255,255,0.7)' : '#5f6368',
                    ml: 1,
                    backgroundColor: showModelSelector ? (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.04)') : 'transparent'
                  }} 
                  onClick={() => setShowModelSelector(!showModelSelector)}
                >
                  <ModelIcon />
                </IconButton>
                <IconButton 
                  size="small" 
                  sx={{ 
                    color: isDark ? 'rgba(255,255,255,0.7)' : '#5f6368',
                    ml: 1,
                    backgroundColor: showChatHistory ? (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.04)') : 'transparent'
                  }} 
                  onClick={() => {
                    setShowChatHistory(!showChatHistory);
                    if (!showChatHistory) {
                      loadSavedChats();
                    }
                  }}
                >
                  <HistoryIcon />
                </IconButton>
              </>
            )}
          </Paper>
        </Box>
        
        {showChatHistory && renderChatHistory()}
      </Box>
    );
  };

  const renderEditorDialog = () => (
    <Dialog 
      open={showEditor} 
      onClose={handleEditorClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          backgroundImage: 'none',
          borderRadius: '12px',
          overflow: 'hidden',
          ...(themeStyle === 'default' 
            ? { backgroundColor: isDark ? 'rgb(30, 30, 30)' : 'rgb(255, 255, 255)' }
            : {
              backdropFilter: 'blur(8px)',
              boxShadow: isDark
                ? '0 4px 6px -1px rgba(0, 0, 0, 0.2), 0 2px 4px -1px rgba(0, 0, 0, 0.1), inset 0 0 0 1px rgba(255, 255, 255, 0.1)'
                : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06), inset 0 0 0 1px rgba(0, 0, 0, 0.05)',
              border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.05)',
              backgroundColor: isDark ? 'rgba(26, 26, 26, 0.8)' : 'rgba(255, 255, 255, 0.8)',
            }),
        }
      }}
    >
      <DialogTitle sx={{ 
        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
        padding: '16px 24px',
        backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.04)',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography sx={{ 
            color: isDark ? '#e1e1e1' : '#333',
            fontSize: '16px',
            fontWeight: 500,
          }}>
            Code Editor
          </Typography>
          <IconButton
            size="small"
            onClick={handleEditorClose}
            sx={{
              color: isDark ? 'rgba(255,255,255,0.7)' : '#5f6368',
            }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ 
        padding: 0,
        height: '60vh',
        backgroundColor: isDark ? 'rgb(30, 30, 30)' : 'rgb(255, 255, 255)',
      }}>
        <Editor
          height="100%"
          defaultLanguage={editorLanguage}
          defaultValue={editorContent}
          onChange={(value) => setEditorContent(value || '')}
          theme={isDark ? 'vs-dark' : 'light'}
          options={{
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 14,
            lineNumbers: 'on',
            renderLineHighlight: 'all',
            contextmenu: true,
            folding: true,
            lineHeight: 1.5,
            padding: { top: 16, bottom: 16 },
          }}
        />
      </DialogContent>
      <DialogActions sx={{ 
        padding: '16px 24px',
        borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
        backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.04)',
      }}>
        <Button 
          onClick={handleEditorClose}
          sx={{
            color: isDark ? 'rgba(255,255,255,0.7)' : '#5f6368',
            '&:hover': {
              backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.04)',
            }
          }}
        >
          Cancel
        </Button>
        <Button 
          onClick={handleEditorSave}
          variant="contained"
          sx={{
            backgroundColor: isDark ? '#4ECDC4' : '#1a73e8',
            color: 'white',
            '&:hover': {
              backgroundColor: isDark ? '#3DBDB4' : '#1557b0',
            }
          }}
        >
          Insert Code
        </Button>
      </DialogActions>
    </Dialog>
  );

  useEffect(() => {
    // Listen for status updates from GeminiService
    geminiService.on('status', (status: string) => {
      setCurrentStatus(status);
      // Update the last AI message with the new status if it exists
      setMessages(prevMessages => {
        const lastMessage = prevMessages[prevMessages.length - 1];
        if (lastMessage && lastMessage.type === 'ai' && lastMessage.isLoading) {
          const updatedMessages = [...prevMessages];
          updatedMessages[updatedMessages.length - 1] = {
            ...lastMessage,
            status: status
          };
          return updatedMessages;
        }
        return prevMessages;
      });
    });

    return () => {
      geminiService.removeAllListeners('status');
    };
  }, []);

  // Add auto-scroll effect
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages, isProcessing]);

  if (!isVisible) return <></>;

  // if (!messages || messages.length === 0) {
  //   return <></>;
  // }

  return (
    <Box
      ref={dragRef}
      sx={{
        position: 'fixed',
        ...(isSidePanel ? {
          right: 0,
          top: 0,
          bottom: 0,
          width: `${width}px`,
          transform: 'none',
        } : {
          left: position.x,
          top: position.y,
          width: '80%',
          maxWidth: '450px',
          ...(isMovable && { cursor: isDragging ? 'grabbing' : 'grab' }),
          transform: 'none',
        }),
        transition: isResizing || isDragging ? 'none' : 'all 0.3s ease-in-out',
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
          backgroundColor: themeStyles.backgroundColor,
          borderRadius: isSidePanel ? '0' : 3,
          overflow: 'hidden',
          position: 'relative',
          height: isSidePanel ? '100%' : 'auto',
          display: 'flex',
          flexDirection: 'column',
          ...(themeStyle !== 'default' && {
            backdropFilter: themeStyles.backdropFilter,
            boxShadow: themeStyles.boxShadow,
            border: themeStyles.border,
          }),
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            padding: '1px',
            borderRadius: isSidePanel ? '0' : '24px',
            background: isDark 
              ? 'linear-gradient(60deg, rgba(76, 175, 80, 0.2), rgba(33, 150, 243, 0.2), rgba(156, 39, 176, 0.2))'
              : 'linear-gradient(60deg, rgba(76, 175, 80, 0.3), rgba(33, 150, 243, 0.3), rgba(156, 39, 176, 0.3))',
            WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
            pointerEvents: 'none',
          },
        }}
      >
        <Box sx={{ 
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
        }}>
          {/* Header */}
          <Box 
            className="drag-handle"
            sx={{ 
              p: 2, 
              borderBottom: `1px solid ${themeStyles.borderColor}`,
              cursor: isSidePanel ? 'default' : 'grab',
              '&:active': {
                cursor: isSidePanel ? 'default' : 'grabbing',
              },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Typography
                sx={{
                  color: isDark ? '#4ECDC4' : '#1a73e8',
                  fontSize: '14px',
                  fontWeight: 500,
                  '&::before': {
                    content: '"★"',
                    color: isDark ? '#4ECDC4' : '#1a73e8',
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
                  color: isDark ? 'rgba(255,255,255,0.7)' : '#5f6368',
                }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>

          {/* Messages container */}
          <Box 
            ref={messagesContainerRef}
            sx={{ 
              flex: 1,
              overflowY: 'auto',
              p: 2,
              '&::-webkit-scrollbar': {
                width: '6px',
              },
              '&::-webkit-scrollbar-thumb': {
                backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
                borderRadius: '3px',
              },
            }}
          >
            {messages.map((msg, index) => (
              <Box 
                key={index} 
                sx={{ 
                  mb: 2,
                  display: 'flex',
                  justifyContent: msg.type !== 'ai' ? 'flex-end' : 'flex-start',
                }}
              >
                <Box
                  sx={{
                    maxWidth: '85%',
                    backgroundColor: msg.type === 'ai' 
                      ? (themeStyle === 'default'
                          ? (isDark ? 'rgba(255,255,255,0.1)' : '#f8f9fa')
                          : (isDark ? 'rgba(26, 26, 26, 0.8)' : 'rgba(255, 255, 255, 0.8)'))
                      : (themeStyle === 'default'
                          ? (isDark ? '#4ECDC4' : '#1a73e8')
                          : 'transparent'),
                    color: msg.type === 'ai' 
                      ? (isDark ? '#ffffff' : '#000000')
                      : '#ffffff',
                    borderRadius: msg.type === 'ai' 
                      ? '16px 16px 4px 16px'
                      : '16px 16px 16px 4px',
                    padding: '12px 16px',
                    position: 'relative',
                    ...(themeStyle !== 'default' && {
                      background: isDark 
                        ? (msg.type === 'ai'
                            ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)'
                            : 'linear-gradient(135deg, rgba(78, 205, 196, 0.2) 0%, rgba(78, 205, 196, 0.1) 100%)')
                        : (msg.type === 'ai'
                            ? 'linear-gradient(135deg, rgba(0, 0, 0, 0.1) 0%, rgba(0, 0, 0, 0.05) 100%)'
                            : 'linear-gradient(135deg, rgba(26, 115, 232, 0.2) 0%, rgba(26, 115, 232, 0.1) 100%)'),
                      backdropFilter: 'blur(8px)',
                      border: isDark 
                        ? (msg.type === 'ai'
                            ? '1px solid rgba(255, 255, 255, 0.1)'
                            : '1px solid rgba(78, 205, 196, 0.2)')
                        : (msg.type === 'ai'
                            ? '1px solid rgba(0, 0, 0, 0.1)'
                            : '1px solid rgba(26, 115, 232, 0.2)'),
                      boxShadow: isDark
                        ? (msg.type === 'ai'
                            ? '0 4px 6px -1px rgba(255, 255, 255, 0.1), 0 2px 4px -1px rgba(255, 255, 255, 0.06)'
                            : '0 4px 6px -1px rgba(78, 205, 196, 0.1), 0 2px 4px -1px rgba(78, 205, 196, 0.06)')
                        : (msg.type === 'ai'
                            ? '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                            : '0 4px 6px -1px rgba(26, 115, 232, 0.1), 0 2px 4px -1px rgba(26, 115, 232, 0.06)'),
                    }),
                    '&::before': msg.type === 'ai' ? {
                      content: '""',
                      position: 'absolute',
                      bottom: 0,
                      right: '-8px',
                      width: '20px',
                      height: '20px',
                      backgroundColor: themeStyle === 'default'
                        ? (isDark ? 'rgba(255,255,255,0.1)' : '#f8f9fa')
                        : 'transparent',
                      clipPath: 'polygon(0 0, 0% 100%, 100% 100%)',
                      borderBottomRightRadius: '16px',
                      ...(themeStyle !== 'default' && {
                        background: isDark 
                          ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)'
                          : 'linear-gradient(135deg, rgba(0, 0, 0, 0.1) 0%, rgba(0, 0, 0, 0.05) 100%)',
                        backdropFilter: 'blur(8px)',
                        border: isDark 
                          ? '1px solid rgba(255, 255, 255, 0.1)'
                          : '1px solid rgba(0, 0, 0, 0.1)',
                      }),
                    } : {
                      content: '""',
                      position: 'absolute',
                      bottom: 0,
                      left: '-8px',
                      width: '20px',
                      height: '20px',
                      backgroundColor: themeStyle === 'default'
                        ? (isDark ? '#4ECDC4' : '#1a73e8')
                        : 'transparent',
                      clipPath: 'polygon(0 100%, 100% 100%, 100% 0)',
                      borderBottomLeftRadius: '16px',
                      ...(themeStyle !== 'default' && {
                        background: isDark 
                          ? 'linear-gradient(135deg, rgba(78, 205, 196, 0.2) 0%, rgba(78, 205, 196, 0.1) 100%)'
                          : 'linear-gradient(135deg, rgba(26, 115, 232, 0.2) 0%, rgba(26, 115, 232, 0.1) 100%)',
                        backdropFilter: 'blur(8px)',
                        border: isDark 
                          ? '1px solid rgba(78, 205, 196, 0.2)'
                          : '1px solid rgba(26, 115, 232, 0.2)',
                      }),
                    }
                  }}
                >
                  {msg.isLoading ? (
                    <Box sx={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center', 
                      gap: 1, 
                      p: 2,
                      minWidth: '120px',
                      backgroundColor: 'transparent'
                    }}>
                      <CircularProgress 
                        size={24} 
                        thickness={4}
                        sx={{
                          color: isDark ? '#4ECDC4' : '#1a73e8',
                        }} 
                      />
                      {msg.status && (
                        <Typography 
                          variant="caption" 
                          sx={{ 
                            color: isDark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.8)',
                            fontStyle: 'italic',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            fontSize: '0.85rem',
                            fontWeight: 500,
                            mt: 1,
                            textAlign: 'center'
                          }}
                        >
                          <span className="typing-animation">•••</span>
                          {msg.status}
                        </Typography>
                      )}
                    </Box>
                  ) : msg.type === 'image' ? (
                    <Box sx={{ 
                      position: 'relative',
                      maxWidth: '100%',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      ...(themeStyle !== 'default' && {
                        border: isDark 
                          ? '1px solid rgba(255,255,255,0.1)' 
                          : '1px solid rgba(0,0,0,0.05)',
                      })
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
                          border: themeStyle !== 'default' 
                            ? 'none'
                            : '1px solid rgba(255,255,255,0.2)'
                        }}
                      />
                    </Box>
                  ) : (
                    <Box sx={{
                      backgroundColor: msg.type === 'ai' 
                        ? (themeStyle === 'default'
                            ? 'rgba(0,0,0,0.04)'
                            : (isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.2)'))
                        : 'transparent',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      ...(msg.type !== 'ai' && {
                        '& code': {
                          backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.3)',
                        },
                        '& pre': {
                          backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.3) !important',
                        }
                      })
                    }}>
                      {typeof msg.content === 'string' && msg.content.startsWith('data:image') ? (
                        <Box sx={{ 
                          position: 'relative',
                          maxWidth: '100%',
                          borderRadius: '8px',
                          overflow: 'hidden'
                        }}>
                          <img 
                            src={msg.content}
                            alt="Generated image"
                            style={{ 
                              maxWidth: '100%',
                              height: 'auto',
                              borderRadius: '8px'
                            }}
                          />
                        </Box>
                      ) : (
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm]}
                          components={{
                            code: ({ node, className, children, ...props }) => {
                              const match = /language-(\w+)/.exec(className || '');
                              return match ? (
                                <CodeBlock language={match[1]} value={String(children).replace(/\n$/, '')} />
                              ) : (
                                <code className={className} {...props}
                                  style={{
                                    backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.3)',
                                    padding: '2px 4px',
                                    borderRadius: '4px',
                                  }}
                                >
                                  {children}
                                </code>
                              );
                            }
                          }}
                        >
                          {typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)}
                        </ReactMarkdown>
                      )}
                    </Box>
                  )}
                </Box>
              </Box>
            ))}
          </Box>

          {renderInputArea()}
        </Box>
      </Paper>
      {renderEditorDialog()}
    </Box>
  );
};

// Add typing animation styles at the end of the file
const styles = `
  @keyframes typing {
    0% { content: ''; }
    25% { content: '.'; }
    50% { content: '..'; }
    75% { content: '...'; }
    100% { content: ''; }
  }

  .typing-animation::after {
    content: '';
    animation: typing 1.5s infinite;
  }
`;

// Add style tag to head
if (typeof document !== 'undefined') {
  const styleTag = document.createElement('style');
  styleTag.textContent = styles;
  document.head.appendChild(styleTag);
}

export { GeminiMobileThemeChat };