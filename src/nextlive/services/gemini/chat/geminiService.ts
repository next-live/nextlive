import { GoogleGenAI, Type } from "@google/genai";
import fs from 'fs';
import path from 'path';

// Initialize the Gemini AI client
const ai = new GoogleGenAI({
  apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY || '',
});

const tools = [
  {
    functionDeclarations: [
      {
        name: 'getFile',
        description: 'gets the file content',
        parameters: {
          type: Type.OBJECT,
          required: ["fileName"],
          properties: {
            fileName: {
              type: Type.STRING,
            },
            lineStart: {
              type: Type.NUMBER,
            },
            lineEnd: {
              type: Type.NUMBER,
            },
          },
        },
        implementation: async (params: { fileName: string; lineStart?: number; lineEnd?: number }) => {
          return await getFileContent(params.fileName, params.lineStart, params.lineEnd);
        }
      },
    ],
  }
];

const config = {
  temperature: 2,
  tools,
  responseMimeType: 'text/plain',
};

// Convert file to base64
async function fileToGenerativePart(file: File) {
  const base64EncodedDataPromise = new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });

  const base64EncodedData = await base64EncodedDataPromise;
  const base64String = (base64EncodedData as string).split(',')[1];

  return {
    inlineData: {
      data: base64String,
      mimeType: file.type
    }
  };
}

// Function to get project structure
async function getProjectStructure(baseDir: string = 'src/', depth: number = 2): Promise<string> {
  try {
    const response = await fetch(`/api/project-structure?baseDir=${encodeURIComponent(baseDir)}&depth=${depth}`);
    const data = await response.json();
    console.log('data', data);
    
    if (!data.success) {
      throw new Error('Failed to get project structure');
    }

    const formatStructure = (structure: Record<string, any>, indent: number = 0): string => {
      let result = '';
      for (const [name, info] of Object.entries(structure)) {
        const padding = '  '.repeat(indent);
        if (info.type === 'directory') {
          result += `${padding}- ${name}/\n`;
          if (info.children) {
            result += formatStructure(info.children, indent + 1);
          }
        } else {
          result += `${padding}- ${name}\n`;
        }
      }
      return result;
    };

    return formatStructure(data.structure);
  } catch (error) {
    console.error('Error getting project structure:', error);
    return '';
  }
}

// Function to find file path by name
async function findFilePath(fileName: string): Promise<string | null> {
  try {
    const response = await fetch(`/api/project-structure?baseDir=src/&depth=10`);
    const data = await response.json();
    
    if (!data.success) {
      throw new Error('Failed to get project structure');
    }

    const findFile = (structure: Record<string, any>, currentPath: string = ''): string | null => {
      for (const [name, info] of Object.entries(structure)) {
        const newPath = currentPath ? `${currentPath}/${name}` : name;
        
        if (info.type === 'file' && name === fileName) {
          return newPath;
        }
        
        if (info.type === 'directory' && info.children) {
          const found = findFile(info.children, newPath);
          if (found) return found;
        }
      }
      return null;
    };

    return findFile(data.structure);
  } catch (error) {
    console.error('Error finding file path:', error);
    return null;
  }
}

// Function to get file content
async function getFileContent(fileName: string, lineStart?: number, lineEnd?: number): Promise<string> {
  try {
    const filePath = await findFilePath(fileName);
    if (!filePath) {
      throw new Error(`File ${fileName} not found in project`);
    }

    const response = await fetch(`/api/code-edit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filepath: filePath,
        lineNumbers: lineStart && lineEnd ? `${lineStart}-${lineEnd}` : undefined,
        operation: 'read'
      })
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to read file');
    }

    return data.content;
  } catch (error) {
    console.error('Error getting file content:', error);
    throw error;
  }
}

class GeminiService {
  private model = 'gemini-2.0-flash';
  private chatHistory: { role: string; parts: any[] }[] = [];

  constructor() {
    this.chatHistory = [];
  }

  async sendMessage(message: string, imageFile?: File) {
    try {
      const parts = [];

      // If there's an image, add it to the message parts
      if (imageFile) {
        const imagePart = await fileToGenerativePart(imageFile);
        parts.push(imagePart);
      }

      // Add text message if present
      if (message.trim()) {
        // Add system prompt for code editing capabilities
        if (message.toLowerCase().includes('/edit') || message.toLowerCase().includes('edit the code') || message.toLowerCase().includes('modify the code')) {
          const projectStructure = await getProjectStructure();
          const systemPrompt = `You are a code editing assistant. You can help modify code in the current project. 
          When editing code:
          1. First analyze the request carefully
          2. Explain what changes you'll make
          3. Use markdown code blocks with the file path and line numbers for context
          4. Provide the exact code changes needed
          5. Include any necessary imports or dependencies
          6. Just give modified code only not original code. Must include line numbers
          7. Consider the project's folder structure:
${projectStructure}
          
          Example response format:
          I'll help you modify the code. Here's what I'll do:
          1. [Explanation of changes]
          2. [File path and changes needed]
          
          \`\`\`filepath:line-numbers [Eg: src/nextlive/pages/NextLive.tsx:60-76]
          // Original code:
          {process.env.NODE_ENV === 'production' && (
              <GeminiMobileThemeChat
                  apiKey={apiKey}
                  messages={messages}
                  setMessages={setMessages}
                  setCode={code}
                  setCode={(code) => {
                      setCode(code);
                      if (editorRef.current) {
                          editorRef.current.setValue(code);
                      }
                  }}
              />
          )}
          <CodeEditor code={code} setCode={setCode} editorRef={editorRef} />
          \`\`\`

          \`\`\`filepath:line-numbers [Eg: src/nextlive/pages/NextLive.tsx:60-76]
          // Modified code:
          {process.env.NODE_ENV === 'production' && (
              <GeminiMobileThemeChat
                  apiKey={apiKey}
                  messages={messages}
                  setMessages={setMessages}
                  setCode={code}
                  setCode={(code) => {
                      setCode(code);
                      if (editorRef.current) {
                          editorRef.current.setValue(code);
                      }
                  }}
              />
          )}
          <CodeEditor code={code} setCode={setCode} editorRef={editorRef} />
          \`\`\``;
          
          parts.push({ text: systemPrompt });
        }
        
        parts.push({ text: message });
      }

      // Add message to chat history
      this.chatHistory.push({
        role: 'user',
        parts
      });

      // Generate content stream
      const response = await ai.models.generateContentStream({
        model: this.model,
        config,
        contents: this.chatHistory
      });

      let fullResponse = '';
      for await (const chunk of response) {
        if (chunk.functionCalls) {
          // Handle function calls if needed
          console.log('Function call:', chunk.functionCalls[0]);
        } else {
          fullResponse += chunk.text;
        }
      }
      console.log('fullResponse', fullResponse);

      // Add assistant response to chat history
      this.chatHistory.push({
        role: 'assistant',
        parts: [{ text: fullResponse }]
      });

      return fullResponse;
    } catch (error) {
      console.error('Error sending message to Gemini:', error);
      throw error;
    }
  }

  // Reset the chat session
  resetChat() {
    this.chatHistory = [];
  }
}

// Export a singleton instance
export const geminiService = new GeminiService(); 