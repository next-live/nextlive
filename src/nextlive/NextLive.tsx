'use client';

import React, { useState, useEffect, useRef } from 'react';
import { GeminiMobileThemeChat, Message } from './components/GeminiMobileThemeChat'; 
import GeminiVoiceChat from './components/GeminiVoiceChat';
import { usePathname } from 'next/navigation';
import { codeEditService, CodeEditRequest } from './services/codeEdit/codeEditService';
import ReactDOM from 'react-dom/client';
import { Editor } from '@monaco-editor/react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material';
import { IconButton, Box } from '@mui/material';
import { Close } from '@mui/icons-material';
import FileExplorer from './components/FileExplorer';
import EditorOptions from '@monaco-editor/react';
import config from '../../nextlive.config.json'

interface NextLiveProps {
  children?: React.ReactNode;
  skipDevelopmentCheck?: boolean;
  skipPaths?: string[];
}

interface VersionInfo {
  currentVersion: string;
  latestVersion: string | null;
  needsUpdate: boolean;
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

const ClipboardIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
  </svg>
);

const PlayIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
  </svg>
);

const EditorIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
  </svg>
);

const isPathMatching = (currentPath: string, skipPath: string): boolean => {
  // Convert wildcard pattern to regex
  const pattern = skipPath.replace(/\*/g, '.*');
  const regex = new RegExp(`^${pattern}$`);
  return regex.test(currentPath);
};

interface CodeBlockData {
  filepath: string;
  lineNumbers: string;
  code: string;
  language?: string;
}

const CodeBlockHeader: React.FC<{
  filepath: string;
  onCopy: () => void;
  onPlay: () => void;
}> = ({ filepath, onCopy, onPlay }) => (
  <div className="flex items-center justify-between px-4 py-2 bg-gray-800 text-gray-200 rounded-t-md">
    <span className="font-mono text-sm">{filepath}</span>
    <div className="flex gap-2">
      <button
        onClick={onCopy}
        className="p-1 hover:bg-gray-700 rounded transition-colors"
        title="Copy code"
      >
        <ClipboardIcon />
      </button>
      <button
        onClick={onPlay}
        className="p-1 hover:bg-gray-700 rounded transition-colors"
        title="Apply changes"
      >
        <PlayIcon />
      </button>
    </div>
  </div>
);

const getInitialPosition = () => {
  if (typeof window === "undefined") return { x: 0, y: 0 }; // SSR safety
  const width = window.innerWidth;
  const height = window.innerHeight;
  console.log(config);

  console.log('Width:', width, 'Height:', height);
  // Adjust the initial position based on the screen size


  return {
    x: width / 2, // center horizontally
    y: height - 300, // 50px from the bottom
  };

};

const CodeBlock: React.FC<{
  data: CodeBlockData;
  onCopy: () => void;
  onPlay: () => void;
}> = ({ data, onCopy, onPlay }) => {
  const [showEditor, setShowEditor] = useState(false);
  const language = data.filepath.split('.').pop() || 'plaintext';
  
  return (
    <div className="rounded-md overflow-hidden border border-gray-700 mb-4">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 text-gray-200">
        <span className="font-mono text-sm">{data.filepath}</span>
        <div className="flex gap-2">
          <button
            onClick={() => setShowEditor(prev => !prev)}
            className="p-1 hover:bg-gray-700 rounded transition-colors"
            title={showEditor ? "Show simple view" : "Show Monaco editor"}
          >
            <EditorIcon />
          </button>
          <button
            onClick={onCopy}
            className="p-1 hover:bg-gray-700 rounded transition-colors"
            title="Copy code"
          >
            <ClipboardIcon />
          </button>
          <button
            onClick={onPlay}
            className="p-1 hover:bg-gray-700 rounded transition-colors"
            title="Apply changes"
          >
            <PlayIcon />
          </button>
        </div>
      </div>
      {showEditor ? (
        <div className="h-[200px]">
          <Editor
            height="100%"
            defaultLanguage={language}
            defaultValue={data.code}
            options={{
              readOnly: true,
              minimap: { enabled: false },
              lineNumbers: 'on',
              folding: false,
              fontSize: 14,
              theme: 'vs-dark'
            }}
          />
        </div>
      ) : (
        <pre className="p-4 bg-gray-900 text-gray-100 overflow-x-auto">
          <code>{data.code}</code>
        </pre>
      )}
    </div>
  );
};

const NextLive: React.FC<NextLiveProps> = ({ children, skipDevelopmentCheck = false, skipPaths = [] }) => {
  // Return children directly if in development and not in development mode or if the path is in the skipPaths array
  const pathname = usePathname();
  const shouldSkip = skipPaths.some(skipPath => isPathMatching(pathname, skipPath));
  
  // if (process.env.NODE_ENV === 'development' && !skipDevelopmentCheck && !shouldSkip) {
  //   return <>{children}</>;
  // }
  const [isVisible, setIsVisible] = useState(false);  // Start hidden
  const [isTakingScreenshot, setIsTakingScreenshot] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSidePanel, setIsSidePanel] = useState(false);
  const [panelWidth, setPanelWidth] = useState(350);
  const codeBlocksDataRef = useRef(new Map<string, CodeBlockData>());
  const [showEditor, setShowEditor] = useState(false);
  const [editorContent, setEditorContent] = useState('');
  const [editorLanguage, setEditorLanguage] = useState('typescript');
  const [currentFilePath, setCurrentFilePath] = useState('');
  const [versionInfo, setVersionInfo] = useState<VersionInfo>({
    currentVersion: "1.0-alpha-release-re3sadv",
    latestVersion: null,
    needsUpdate: false
  });

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

  const handleCodeEdit = async (request: CodeEditRequest) => {
    try {
      console.log('Applying code edit:', request);
      await codeEditService.applyEdit(request);
      // Add success message
      setMessages(prev => [...prev, { 
        type: 'ai', 
        content: `✅ Successfully applied changes to ${request.filepath}`,
        isLoading: false
      }]);
    } catch (error: any) {
      console.error('Error applying code edit:', error);
      // Add error message
      setMessages(prev => [...prev, { 
        type: 'ai', 
        content: `❌ Error applying changes to ${request.filepath}: ${error?.message || 'Unknown error'}`,
        isLoading: false
      }]);
    }
  };

  const handleSendMessage = (message: Message) => {
    // Replace the last message if it was a loading message
    setMessages(prev => {
      const lastMessage = prev[prev.length - 1];
      if (lastMessage?.isLoading) {
        return [...prev.slice(0, -1), message];
      }
      return [...prev, message];
    });
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

  // Update the code block rendering effect
  useEffect(() => {
    const handleCopy = async (code: string) => {
      try {
        await navigator.clipboard.writeText(code);
      } catch (err) {
        console.error('Failed to copy code:', err);
      }
    };

    const handlePlay = (blockData: CodeBlockData) => {
      handleCodeEdit({
        filepath: blockData.filepath,
        lineNumbers: blockData.lineNumbers,
        code: blockData.code
      });
    };

    document.querySelectorAll('.code-block').forEach(block => {
      const blockId = block.getAttribute('data-block-id');
      if (!blockId) return;

      const blockData = codeBlocksDataRef.current.get(blockId);
      if (!blockData) return;

      const root = ReactDOM.createRoot(block);
      root.render(
        <CodeBlock
          data={blockData}
          onCopy={() => handleCopy(blockData.code)}
          onPlay={() => handlePlay(blockData)}
        />
      );
    });

    return () => {
      document.querySelectorAll('.code-block').forEach(block => {
        try {
          const root = ReactDOM.createRoot(block);
          root.unmount();
        } catch (err) {
          console.error('Error unmounting code block:', err);
        }
      });
    };
  }, [messages]);

  // Add function to get current file code
  const getCurrentFileCode = async () => {
    try {
      // Get the current file path from the URL
      const pathname = window.location.pathname;
      let filePath = pathname.startsWith('/') ? pathname.slice(1) : pathname;
      
      // If it's a page route, add the page.tsx extension
      if (!filePath.includes('.')) {
        filePath = `${filePath}/page.tsx`;
      }
      
      // Use codeEditService to read the file
      const code = await codeEditService.readFile(filePath);
      setCurrentFilePath(filePath);
      return code;
    } catch (error) {
      console.error('Error reading file:', error);
      return 'Error loading file code';
    }
  };

  // Update function to handle opening editor
  const handleOpenEditor = async () => {
    const code = await getCurrentFileCode();
    setEditorContent(code);
    
    // Set language based on file extension
    const extension = currentFilePath.split('.').pop()?.toLowerCase();
    const languageMap: { [key: string]: string } = {
      'ts': 'typescript',
      'tsx': 'typescript',
      'js': 'javascript',
      'jsx': 'javascript',
      'html': 'html',
      'css': 'css',
      'json': 'json',
      'md': 'markdown',
      'py': 'python',
      'java': 'java',
      'c': 'c',
      'cpp': 'cpp',
      'cs': 'csharp',
      'go': 'go',
      'rs': 'rust',
      'rb': 'ruby',
      'php': 'php',
      'sh': 'shell',
      'yaml': 'yaml',
      'yml': 'yaml',
      'xml': 'xml'
    };
    
    setEditorLanguage(languageMap[extension || ''] || 'plaintext');
    setShowEditor(true);
  };

  const handleFileSelect = async (filePath: string) => {
    try {
      const code = await codeEditService.readFile(filePath);
      setEditorContent(code);
      setCurrentFilePath(filePath);
      
      // Set language based on file extension
      const extension = filePath.split('.').pop()?.toLowerCase();
      const languageMap: { [key: string]: string } = {
        'ts': 'typescript',
        'tsx': 'typescript',
        'js': 'javascript',
        'jsx': 'javascript',
        'html': 'html',
        'css': 'css',
        'json': 'json',
        'md': 'markdown',
        'py': 'python',
        'java': 'java',
        'c': 'c',
        'cpp': 'cpp',
        'cs': 'csharp',
        'go': 'go',
        'rs': 'rust',
        'rb': 'ruby',
        'php': 'php',
        'sh': 'shell',
        'yaml': 'yaml',
        'yml': 'yaml',
        'xml': 'xml'
      };
      
      setEditorLanguage(languageMap[extension || ''] || 'plaintext');
    } catch (error) {
      console.error('Error reading file:', error);
    }
  };
  const editorOptions = {
    folding: true,
    fontSize: 14,
    theme: 'vs-dark',
    readOnly: true,
    // Enable syntax highlighting features
    bracketPairColorization: {
      enabled: true,
    },
    guides: {
      bracketPairs: true,
      bracketPairsHorizontal: true,
      highlightActiveBracketPair: true,
      indentation: true
    },
    // Enable semantic highlighting
    semanticHighlighting: { enabled: true },
    // Enable code lens
    codeLens: true,
    // Enable parameter hints
    parameterHints: {
      enabled: true
    },
    // Enable quick suggestions
    quickSuggestions: {
      other: true,
      comments: true,
      strings: true
    },
    // Enable word based suggestions
    wordBasedSuggestions: true,
    // Enable auto closing brackets
    autoClosingBrackets: 'always',
    autoClosingQuotes: 'always',
    // Enable auto indentation
    autoIndent: 'advanced',
    // Enable format on paste
    formatOnPaste: true,
    // Enable format on type
    formatOnType: true,
    // Enable smooth scrolling
    smoothScrolling: true,
    // Enable mouse wheel zoom
    mouseWheelZoom: true,
    // Enable multi cursor
    multiCursorModifier: 'alt',
    // Enable accessibility support
    accessibilitySupport: 'auto',
    // Enable cursor blinking
    cursorBlinking: 'smooth' as const,
    // Enable cursor style
    cursorStyle: 'line' as const,
    // Enable cursor width
    cursorWidth: 2,
    // Enable font ligatures
    fontLigatures: true,
    // Enable render whitespace
    renderWhitespace: 'selection',
    // Enable scrollbar
    scrollbar: {
      vertical: 'visible' as const,
      horizontal: 'visible' as const,
      useShadows: false,
      verticalHasArrows: false,
      horizontalHasArrows: false,
      verticalScrollbarSize: 10,
      horizontalScrollbarSize: 10,
      arrowSize: 30
    }
  };

  // Add version check effect
  useEffect(() => {
    const checkVersion = async () => {
      try {
        const response = await fetch('https://api.github.com/repos/next-live/nextlive/releases/latest');
        if (response.ok) {
          const data = await response.json();
          const latestVersion = data.tag_name.replace('v', '');
          const needsUpdate = latestVersion !== config.version;
          setVersionInfo({
            currentVersion: config.version,
            latestVersion,
            needsUpdate
          });
        }
      } catch (error) {
        console.error('Error checking version:', error);
      }
    };

    checkVersion();
  }, []);

  return (
    <div className="next-live flex w-full h-screen">
      <div className={`transition-all duration-300 ease-in-out ${isSidePanel ? `w-[calc(100%-${panelWidth}px)]` : 'w-full'}`}>
        {children}
      </div>
      <button
        className={`fixed bottom-8 cursor-pointer right-8 rounded-full p-4 shadow-lg transition-all duration-200 hover:scale-110 hover:shadow-xl ${
          versionInfo.needsUpdate ? 'bg-red-500 hover:bg-red-600 text-white w-48' : ' bg-white hover:bg-gray-50'
        }`}
        onClick={toggleChat}
        style={{
          opacity: isVisible && !isSidePanel ? 0 : 1,
          pointerEvents: isVisible && !isSidePanel ? 'none' : 'auto'
        }}
      >
        <div className="flex items-center justify-center gap-2">
          <img src="/nextlive.ico" className="w-10 h-10" />
          {versionInfo.needsUpdate && (
            <span className="text-sm font-medium">Update Available!</span>
          )}
        </div>
      </button>
      {/* <button
        className="fixed bottom-8 cursor-pointer right-24 bg-white hover:bg-gray-50 rounded-full p-4 shadow-lg transition-all duration-200 hover:scale-110 hover:shadow-xl"
        onClick={handleOpenEditor}
        style={{
          opacity: isVisible && !isSidePanel ? 0 : 1,
          pointerEvents: isVisible && !isSidePanel ? 'none' : 'auto'
        }}
      >
        <EditorIcon />
      </button> */}
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
        theme="dark"
        themeStyle="glassmorphism"
        onWidthChange={setPanelWidth}
        initialPosition={{ x: getInitialPosition().x, y: getInitialPosition().y }}
      />
      {/* <GeminiVoiceChat apiKey={process.env.NEXT_PUBLIC_GEMINI_API_KEY || ''} /> */}

      <Dialog
        open={showEditor}
        onClose={() => setShowEditor(false)}
        maxWidth="xl"
        fullWidth
        PaperProps={{
          sx: {
            height: '90vh',
            maxHeight: '1200px'
          }
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          borderBottom: '1px solid rgba(0,0,0,0.1)',
          pb: 1
        }}>
          <span>File: {currentFilePath}</span>
          <IconButton onClick={() => setShowEditor(false)} size="small">
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0, overflow: 'hidden', display: 'flex' }}>
          <FileExplorer onFileSelect={handleFileSelect} />
          <Box sx={{ flex: 1, height: '100%' }}>
            <Editor
              height="100%"
              defaultLanguage={editorLanguage}
              value={editorContent}
              options={{
                ...editorOptions,
                scrollbar: {
                  ...editorOptions.scrollbar,
                  vertical: 'visible' as const,
                  horizontal: 'visible' as const
                }
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ 
          borderTop: '1px solid rgba(0,0,0,0.1)',
          p: 1
        }}>
          <Button onClick={() => setShowEditor(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default NextLive;
