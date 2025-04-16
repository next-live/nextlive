import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const baseDir = searchParams.get('baseDir') || 'src/nextlive';
    const depth = parseInt(searchParams.get('depth') || '2');

    const structure = await getDirectoryStructure(baseDir, depth);
    
    return NextResponse.json({ 
      success: true, 
      structure 
    });
  } catch (error) {
    console.error('Error getting project structure:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to get project structure' 
    }, { status: 500 });
  }
}

async function getDirectoryStructure(dir: string, maxDepth: number, currentDepth: number = 0): Promise<Record<string, any>> {
  if (currentDepth > maxDepth) {
    return {};
  }

  const structure: Record<string, any> = {};
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