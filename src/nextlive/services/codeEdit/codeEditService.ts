export interface CodeEditRequest {
  filepath: string;
  lineNumbers?: string;
  code: string;
}

export class CodeEditService {
  private apiUrl: string;

  constructor() {
    this.apiUrl = '/api/code-edit';
  }

  async readFile(filepath: string): Promise<string> {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filepath,
          operation: 'read'
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to read file');
      }

      const data = await response.json();
      return data.content;
    } catch (error) {
      console.error('Error reading file:', error);
      throw error;
    }
  }

  async applyEdit(request: CodeEditRequest): Promise<void> {
    const { filepath, lineNumbers, code } = request;

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filepath,
          lineNumbers,
          code,
          operation: 'edit'
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to apply edit');
      }
    } catch (error) {
      console.error('Error applying code edit:', error);
      throw error;
    }
  }

  async createFile(filepath: string, content: string): Promise<void> {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filepath,
          code: content,
          operation: 'create'
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create file');
      }
    } catch (error) {
      console.error('Error creating file:', error);
      throw error;
    }
  }
}

// Export a singleton instance
export const codeEditService = new CodeEditService(); 