import React, { useState } from 'react';
import { Box, Button, IconButton } from '@mui/material';
import { codeEditService } from '../services/codeEdit/codeEditService';
import Editor from '@monaco-editor/react';

// Add the EditorIcon component
const EditorIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
  </svg>
);

interface CodeBlockProps {
  language?: string;
  value: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ language, value }) => {
  const [showEditor, setShowEditor] = useState(false);
  
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

  return (
    <Box sx={{ 
      position: 'relative',
      border: '1px solid rgba(0,0,0,0.1)',
      borderRadius: '4px',
      overflow: 'hidden'
    }}>
      <Box sx={{ 
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 12px',
        backgroundColor: '#f8f9fa',
        borderBottom: '1px solid rgba(0,0,0,0.1)'
      }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton
            size="small"
            onClick={() => setShowEditor(prev => !prev)}
            sx={{
              padding: '4px',
              color: '#5f6368',
              '&:hover': {
                backgroundColor: 'rgba(0,0,0,0.04)'
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
                backgroundColor: '#1a73e8',
                color: 'white',
                '&:hover': {
                  backgroundColor: '#1557b0',
                }
              }}
            >
              Apply
            </Button>
          )}
        </Box>
      </Box>
      
      {showEditor ? (
        <Box sx={{ height: '200px' }}>
          <Editor
            height="100%"
            defaultLanguage={getLanguage()}
            defaultValue={value}
            options={{
              readOnly: true,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              lineNumbers: 'on',
              renderLineHighlight: 'none',
              contextmenu: false,
              folding: false,
              fontSize: 14,
              theme: 'vs-dark'
            }}
          />
        </Box>
      ) : (
        <pre style={{ 
          backgroundColor: '#f8f9fa',
          padding: '12px',
          margin: 0,
          overflowX: 'auto'
        }}>
          <code>{value}</code>
        </pre>
      )}
    </Box>
  );
}; 