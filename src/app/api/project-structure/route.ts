import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Define interfaces for the directory structure
interface FileInfo {
  type: 'file';
  size: number;
  modified: Date;
}

interface DirectoryInfo {
  type: 'directory';
  children: Record<string, FileInfo | DirectoryInfo>;
}

type FileSystemNode = FileInfo | DirectoryInfo;

function formatTreeStructure(structure: Record<string, FileSystemNode>, prefix = '', isLast = true): string {
  let output = '';
  const entries = Object.entries(structure);
  
  entries.forEach(([name, info], index) => {
    const isLastEntry = index === entries.length - 1;
    const currentPrefix = prefix + (isLast ? '└── ' : '├── ');
    const childPrefix = prefix + (isLast ? '    ' : '│   ');
    
    if (info.type === 'directory') {
      output += currentPrefix + name + '/\n';
      if (info.children) {
        output += formatTreeStructure(info.children, childPrefix, isLastEntry);
      }
    } else {
      output += currentPrefix + name + '\n';
    }
  });
  
  return output;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const baseDir = searchParams.get('baseDir') || './src';
    const depth = parseInt(searchParams.get('depth') || '2');

    const structure = await getDirectoryStructure(baseDir, depth);
    const formattedStructure = formatTreeStructure(structure);
    
    return NextResponse.json({ 
      success: true, 
      structure: `${formattedStructure}`
    });
  } catch (error) {
    console.error('Error getting project structure:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to get project structure' 
    }, { status: 500 });
  }
}

async function getDirectoryStructure(dir: string, maxDepth: number, currentDepth: number = 0): Promise<Record<string, FileSystemNode>> {
  if (currentDepth > maxDepth) {
    return {};
  }

  const structure: Record<string, FileSystemNode> = {};
  const items = await fs.promises.readdir(dir, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    
    if (item.isDirectory()) {
      structure[item.name] = {
        type: 'directory',
        children: await getDirectoryStructure(fullPath, maxDepth, currentDepth + 1)
      };
    } else {
      const stats = await fs.promises.stat(fullPath);
      structure[item.name] = {
        type: 'file',
        size: stats.size,
        modified: stats.mtime
      };
    }
  }

  return structure;
} 