import React, { useState, useEffect } from 'react';
import { Box, Typography, IconButton, Collapse } from '@mui/material';
import { Folder, FolderOpen, InsertDriveFile } from '@mui/icons-material';
import { codeEditService } from '../services/codeEdit/codeEditService';

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  expanded?: boolean;
}

interface FileExplorerProps {
  onFileSelect: (path: string) => void;
}

const FileExplorer: React.FC<FileExplorerProps> = ({ onFileSelect }) => {
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFileTree();
  }, []);

  const loadFileTree = async () => {
    try {
      const response = await fetch('/api/code-edit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operation: 'list',
          path: 'src'
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to load file tree');
      }

      const data = await response.json();
      setFileTree(data.tree);
      setLoading(false);
    } catch (error) {
      console.error('Error loading file tree:', error);
      setLoading(false);
    }
  };

  const toggleExpand = (node: FileNode) => {
    if (node.type === 'directory') {
      node.expanded = !node.expanded;
      setFileTree([...fileTree]);
    }
  };

  const renderNode = (node: FileNode, level: number = 0) => {
    const isDirectory = node.type === 'directory';
    const Icon = isDirectory ? (node.expanded ? FolderOpen : Folder) : InsertDriveFile;

    return (
      <Box key={node.path} sx={{ pl: level * 2 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            py: 0.5,
            px: 1,
            cursor: 'pointer',
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
            },
          }}
          onClick={() => {
            if (isDirectory) {
              toggleExpand(node);
            } else {
              onFileSelect(node.path);
            }
          }}
        >
          <Icon sx={{ fontSize: 20, mr: 1, color: isDirectory ? '#90CAF9' : '#B0BEC5' }} />
          <Typography
            sx={{
              fontSize: '14px',
              color: '#E0E0E0',
              userSelect: 'none',
            }}
          >
            {node.name}
          </Typography>
        </Box>
        {isDirectory && node.expanded && node.children && (
          <Collapse in={node.expanded}>
            {node.children.map(child => renderNode(child, level + 1))}
          </Collapse>
        )}
      </Box>
    );
  };

  if (loading) {
    return (
      <Box sx={{ p: 2, color: '#E0E0E0' }}>
        Loading...
      </Box>
    );
  }

  return (
    <Box
      sx={{
        width: '250px',
        height: '100%',
        backgroundColor: '#1E1E1E',
        borderRight: '1px solid #333',
        overflow: 'auto',
      }}
    >
      <Box sx={{ p: 1, borderBottom: '1px solid #333' }}>
        <Typography sx={{ color: '#E0E0E0', fontWeight: 'bold' }}>
          File Explorer
        </Typography>
      </Box>
      <Box sx={{ p: 1 }}>
        {fileTree.map(node => renderNode(node))}
      </Box>
    </Box>
  );
};

export default FileExplorer; 