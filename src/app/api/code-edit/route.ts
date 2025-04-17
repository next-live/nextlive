import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
}

function buildFileTree(dir: string, basePath: string = ''): FileNode[] {
  const files = fs.readdirSync(dir);
  const tree: FileNode[] = [];

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const relativePath = path.join(basePath, file);
    const stats = fs.statSync(fullPath);

    if (stats.isDirectory()) {
      // Skip node_modules and other common directories
      if (['node_modules', '.next', '.git'].includes(file)) {
        continue;
      }

      const node: FileNode = {
        name: file,
        path: relativePath,
        type: 'directory',
        children: buildFileTree(fullPath, relativePath)
      };
      tree.push(node);
    } else {
      // Only include certain file types
      const ext = path.extname(file).toLowerCase();
      if (['.ts', '.tsx', '.js', '.jsx', '.css', '.html', '.json', '.md'].includes(ext)) {
        tree.push({
          name: file,
          path: relativePath,
          type: 'file'
        });
      }
    }
  }

  return tree;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    let { filepath, operation, lineNumbers, code, path: listPath } = body;
    filepath = filepath.replace('@','')

    if (operation === 'list') {
      const basePath = path.join(process.cwd(), listPath || 'src');
      const tree = buildFileTree(basePath);
      return NextResponse.json({ tree });
    }

    if (!filepath) {
      return NextResponse.json(
        { error: 'File path is required' },
        { status: 400 }
      );
    }

    let absolutePath = path.join(process.cwd(), "src/", filepath);

    // Security check: ensure the path is within the project directory
    if (!absolutePath.startsWith(process.cwd())) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    switch (operation) {
      case 'read':
        absolutePath = path.join(process.cwd(), "src/", filepath);
        if (!fs.existsSync(absolutePath)) {
          return NextResponse.json(
            { error: 'File not found' },
            { status: 404 }
          );
        }

        const content = fs.readFileSync(absolutePath, 'utf-8');
        return NextResponse.json({ content });

      case 'write':
      case 'edit':
        // Create directory if it doesn't exist
        fs.mkdirSync(path.dirname(absolutePath), { recursive: true });

        // If file doesn't exist, create it
        if (!fs.existsSync(absolutePath)) {
          fs.writeFileSync(absolutePath, code || '');
          return NextResponse.json({ success: true });
        }

        // Read the existing file
        const fileContent = fs.readFileSync(absolutePath, 'utf-8');
        const lines = fileContent.split('\n');

        // Parse line numbers if provided
        if (lineNumbers) {
          const [start, end] = lineNumbers.split('-').map((n: string) => parseInt(n));
          if (!isNaN(start) && !isNaN(end)) {
            // Replace the lines in the specified range
            const newLines = [
              ...lines.slice(0, start - 1),
              code,
              ...lines.slice(end)
            ];
            fs.writeFileSync(absolutePath, newLines.join('\n'));
            return NextResponse.json({ success: true });
          }
        }

        // If no line numbers provided, replace the entire file content
        fs.writeFileSync(absolutePath, code || '');
        return NextResponse.json({ success: true });

      case 'create':
        // Check if file exists
        if (fs.existsSync(absolutePath)) {
          return NextResponse.json({ error: 'File already exists' }, { status: 409 });
        }

        // Create directory if it doesn't exist
        fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
        
        // Write the file
        fs.writeFileSync(absolutePath, code || '');
        return NextResponse.json({ success: true });

      default:
        return NextResponse.json(
          { error: 'Invalid operation' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error in code-edit API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 