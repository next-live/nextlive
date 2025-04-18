import React, { useState } from 'react';
import { Box, Button, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Typography } from '@mui/material';
import { codeEditService } from '../services/codeEdit/codeEditService';
import Editor from '@monaco-editor/react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import {
  oneDark,
  oneLight,
} from 'react-syntax-highlighter/dist/esm/styles/prism';

// Add the EditorIcon and CloseIcon components
const EditorIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
  </svg>
);

const CloseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

interface CodeBlockProps {
  language?: string;
  value: string;
  theme?: 'light' | 'dark';
  themeStyle?: 'default' | 'glassmorphism' | 'grassmorphism';
}

// Custom theme colors
const customTheme = {
  dark: {
    ...oneDark,
    'pre[class*="language-"]': {
      ...oneDark['pre[class*="language-"]'],
      background: 'transparent',
    },
    'code[class*="language-"]': {
      ...oneDark['code[class*="language-"]'],
      background: 'transparent',
    },
    comment: { color: '#6c7a89' },
    keyword: { color: '#c792ea' },
    string: { color: '#89ca78' },
    function: { color: '#61afef' },
    number: { color: '#f78c6c' },
    operator: { color: '#89ddff' },
    class: { color: '#ffcb6b' },
    variable: { color: '#e06c75' },
    property: { color: '#e06c75' },
  },
  light: {
    ...oneLight,
    'pre[class*="language-"]': {
      ...oneLight['pre[class*="language-"]'],
      background: 'transparent',
    },
    'code[class*="language-"]': {
      ...oneLight['code[class*="language-"]'],
      background: 'transparent',
    },
    comment: { color: '#637777' },
    keyword: { color: '#7c3aed' },
    string: { color: '#16a34a' },
    function: { color: '#2563eb' },
    number: { color: '#e11d48' },
    operator: { color: '#0284c7' },
    class: { color: '#ca8a04' },
    variable: { color: '#dc2626' },
    property: { color: '#dc2626' },
  }
};

export const CodeBlock: React.FC<CodeBlockProps> = ({ 
  language, 
  value,
  theme = 'light',
  themeStyle = 'default'
}) => {
  const [showEditor, setShowEditor] = useState(false);
  const [editorContent, setEditorContent] = useState(value);
  const isDark = theme === 'dark';
  
  const handleApply = async () => {
    if (!language) return;

    try {
      const [filepath, lineNumbers] = language.split(':');
      if (!filepath) return;

      await codeEditService.applyEdit({
        filepath: filepath.trim(),
        lineNumbers: lineNumbers?.trim(),
        code: value
      });
    } catch (error) {
      console.error('Error applying code changes:', error);
    }
  };

  const handleEditorClose = () => {
    setShowEditor(false);
    setEditorContent(value); // Reset content on close
  };


  // Get the actual language from the filepath
  const getLanguage = () => {
    if (!language) return 'plaintext';
    const ext = language.split('.').pop()?.split(':')[0];
    switch (ext) {
      case 'ts':
      case 'tsx':
        return 'typescript';
      case 'js':
      case 'jsx':
        return 'javascript';
      case 'py':
        return 'python';
      case 'html':
        return 'html';
      case 'css':
        return 'css';
      case 'json':
        return 'json';
      default:
        return 'plaintext';
    }
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
          ...(themeStyle !== 'default' && {
            backdropFilter: 'blur(8px)',
            boxShadow: isDark
              ? '0 4px 6px -1px rgba(0, 0, 0, 0.2), 0 2px 4px -1px rgba(0, 0, 0, 0.1), inset 0 0 0 1px rgba(255, 255, 255, 0.1)'
              : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06), inset 0 0 0 1px rgba(0, 0, 0, 0.05)',
            border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.05)',
            backgroundColor: isDark ? 'rgba(26, 26, 26, 0.8)' : 'rgba(255, 255, 255, 0.8)',
          }),
          backgroundColor: isDark ? 'rgb(30, 30, 30)' : 'rgb(255, 255, 255)',
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
            <CloseIcon />
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
          defaultLanguage={getLanguage()}
          value={editorContent}
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
            readOnly: true
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
          Close
        </Button>
        {language?.includes(':') && (
          <Button
            onClick={handleApply}
            variant="contained"
            sx={{
              backgroundColor: isDark ? '#4ECDC4' : '#1a73e8',
              color: 'white',
              '&:hover': {
                backgroundColor: isDark ? '#3DBDB4' : '#1557b0',
              }
            }}
          >
            Apply Changes
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );

  const themeStyles = getThemeStyles();

  return (
    <Box sx={{ 
      position: 'relative',
      border: themeStyle === 'default' ? '1px solid rgba(0,0,0,0.1)' : 'none',
      borderRadius: '8px',
      overflow: 'hidden',
      ...(themeStyle !== 'default' && {
        backdropFilter: themeStyles.backdropFilter,
        boxShadow: themeStyles.boxShadow,
        border: themeStyles.border,
      }),
      '&::before': themeStyle !== 'default' ? {
        content: '""',
        position: 'absolute',
        inset: 0,
        padding: '1px',
        borderRadius: '8px',
        background: isDark 
          ? 'linear-gradient(60deg, rgba(76, 175, 80, 0.2), rgba(33, 150, 243, 0.2), rgba(156, 39, 176, 0.2))'
          : 'linear-gradient(60deg, rgba(76, 175, 80, 0.3), rgba(33, 150, 243, 0.3), rgba(156, 39, 176, 0.3))',
        WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
        WebkitMaskComposite: 'xor',
        maskComposite: 'exclude',
        pointerEvents: 'none',
      } : undefined,
    }}>
      <Box sx={{ 
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 12px',
        backgroundColor: themeStyle === 'default' 
          ? (isDark ? 'rgba(255,255,255,0.1)' : '#f8f9fa')
          : (isDark ? 'rgba(26, 26, 26, 0.8)' : 'rgba(255, 255, 255, 0.8)'),
        borderBottom: `1px solid ${themeStyles.borderColor}`,
        backdropFilter: themeStyle !== 'default' ? 'blur(8px)' : 'none',
      }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton
            size="small"
            onClick={() => setShowEditor(true)}
            sx={{
              padding: '4px',
              color: isDark ? 'rgba(255,255,255,0.7)' : '#5f6368',
              '&:hover': {
                backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.04)'
              }
            }}
          >
            <EditorIcon />
          </IconButton>
          {language?.includes(':') && (
            <Button
              variant="contained"
              size="small"
              onClick={handleApply}
              sx={{
                backgroundColor: isDark ? '#4ECDC4' : '#1a73e8',
                color: 'white',
                '&:hover': {
                  backgroundColor: isDark ? '#3DBDB4' : '#1557b0',
                }
              }}
            >
              Apply
            </Button>
          )}
        </Box>
      </Box>
      
      <Box sx={{
        backgroundColor: themeStyle === 'default'
          ? (isDark ? 'rgba(255,255,255,0.05)' : '#f8f9fa')
          : (isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.2)'),
      }}>
        <SyntaxHighlighter
          language={getLanguage()}
          style={isDark ? customTheme.dark : customTheme.light}
          customStyle={{
            margin: 0,
            padding: '16px',
            backgroundColor: 'transparent',
            fontSize: '14px',
            lineHeight: '1.5',
          }}
        >
          {value}
        </SyntaxHighlighter>
      </Box>
      {renderEditorDialog()}
    </Box>
  );
}; 