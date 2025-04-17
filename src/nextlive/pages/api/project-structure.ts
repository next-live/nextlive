import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const SAFE_ROOT = path.resolve('src/nextlive');
    const baseDirInput = req.query.baseDir as string || '';
    const baseDir = path.resolve(SAFE_ROOT, baseDirInput);
    if (!baseDir.startsWith(SAFE_ROOT)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const depth = parseInt(req.query.depth as string) || 2;

    const getStructure = (dir: string, currentDepth: number): any => {
      if (currentDepth > depth) return null;
      
      try {
        const items = fs.readdirSync(dir);
        const structure: any = {};
        
        items.forEach(item => {
          const fullPath = path.join(dir, item);
          const stats = fs.statSync(fullPath);
          
          if (stats.isDirectory()) {
            structure[item] = {
              type: 'directory',
              children: getStructure(fullPath, currentDepth + 1)
            };
          } else if (stats.isFile()) {
            structure[item] = {
              type: 'file',
              size: stats.size,
              modified: stats.mtime
            };
          }
        });
        
        return structure;
      } catch (error) {
        console.error(`Error reading directory ${dir}:`, error);
        return null;
      }
    };

    const structure = getStructure(baseDir, 0);
    
    return res.status(200).json({
      success: true,
      structure
    });
  } catch (error) {
    console.error('Error getting project structure:', error);
    return res.status(500).json({
      success: false,
      message: 'Error getting project structure'
    });
  }
} 