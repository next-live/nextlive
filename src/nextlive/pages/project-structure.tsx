import { useState, useEffect } from 'react';
import { Tree } from 'antd';
import { FolderOutlined, FileOutlined } from '@ant-design/icons';

interface FileInfo {
  type: 'file';
  size: number;
  modified: Date;
}

interface DirectoryInfo {
  type: 'directory';
  children?: Record<string, FileInfo | DirectoryInfo>;
}

type StructureInfo = Record<string, FileInfo | DirectoryInfo>;



const convertToTreeData = (structure: StructureInfo): any[] => {
  return Object.entries(structure).map(([name, info]) => {
    const isDirectory = info.type === 'directory';
    const title = (
      <div className="flex items-center gap-2">
        {isDirectory ? <FolderOutlined /> : <FileOutlined />}
        <span>{name}</span>
        {!isDirectory && (
          <span className="text-xs text-gray-500 ml-2">
            {(info as FileInfo).size} bytes
          </span>
        )}
      </div>
    );

    return {
      key: name,
      title,
      children: isDirectory && (info as DirectoryInfo).children
        ? convertToTreeData((info as DirectoryInfo).children!)
        : undefined,
    };
  });
};

export default function ProjectStructure() {
  const [treeData, setTreeData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStructure = async () => {
      try {
        const response = await fetch('/api/project-structure');
        const data = await response.json();
        
        if (!data.success) {
          throw new Error('Failed to get project structure');
        }

        const convertedData = convertToTreeData(data.structure);
        setTreeData(convertedData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchStructure();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">Project Structure</h1>
      <div className="bg-white rounded-lg shadow p-4">
        <Tree
          treeData={treeData}
          defaultExpandAll
          showLine
          showIcon
        />
      </div>
    </div>
  );
} 