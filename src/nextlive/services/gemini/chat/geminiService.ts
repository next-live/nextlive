import { GoogleGenAI, Type, FunctionCallingConfigMode } from '@google/genai';
import { EventEmitter } from 'events';

// Initialize Gemini AI client
const ai = new GoogleGenAI({
  apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY || '',
});

// Function declaration for getFile
const getFileDeclaration = {
  name: 'getFile',
  description: 'Reads file content from project by filename and optional line range',
  parameters: {
    type: Type.OBJECT,
    properties: {
      fileName: { type: Type.STRING, description: 'Filename to read, e.g. page.tsx' },
      lineStart: { type: Type.NUMBER, description: 'Starting line number' },
      lineEnd: { type: Type.NUMBER, description: 'Ending line number' },
    },
    required: ['fileName'],
  },
};

const editFileDeclaration = {
  name: 'editFile',
  description: 'Edits the file with the given code',
  parameters: {
    type: Type.OBJECT,
    properties: {
      fileName: { type: Type.STRING, description: 'Filename to edit, e.g. page.tsx' },
      lineStart: { type: Type.NUMBER, description: 'Starting line number' },
      lineEnd: { type: Type.NUMBER, description: 'Ending line number' },
      code: { type: Type.STRING, description: 'Code to be edited within the specified line number in the given file' }
    },
    required: ['fileName', 'code'],
  },
};

const functionDeclarations = [getFileDeclaration, editFileDeclaration];

type GetFileParams = { fileName: string; lineStart?: number; lineEnd?: number };
type EditFileParams = { fileName: string; lineStart?: number; lineEnd?: number; code?: string };

// Define interfaces for chat messages
interface ChatMessagePart {
  text?: string;
  functionCall?: FunctionCall;
}

interface FunctionCall {
  name: string;
  args: GetFileParams | EditFileParams;
}

interface ChatMessage {
  role: 'user' | 'model';
  name?: string;
  parts: ChatMessagePart[];
}

export class GeminiService extends EventEmitter {
  private chatHistory: ChatMessage[] = [];
  private model = 'gemini-2.0-flash';
  private chatId: string;

  constructor() {
    super();
    this.chatId = this.generateChatId();
  }

  private generateChatId(): string {
    return `chat_${new Date().toISOString().replace(/[:.]/g, '-')}`;
  }

  private async saveChatHistory() {
    try {
      const chatData = {
        id: this.chatId,
        model: this.model,
        messages: this.chatHistory
      };

      const response = await fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chatData)
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to save chat');
      }

      this.emit('status', 'Chat history saved');
    } catch (error) {
      console.error('Error saving chat history:', error);
      this.emit('status', 'Error saving chat history');
    }
  }

  async setModel(model: string) {
    this.model = model;
  }

  async sendMessage(message: string) {
    this.chatHistory.push({ role: 'user', parts: [{ text: message }] });
    this.emit('status', 'Initializing AI model...');

    const responseStream = await ai.models.generateContentStream({
      model: this.model,
      config: {
        temperature: 0.7,
        tools: [{ functionDeclarations: functionDeclarations }],
        toolConfig: {
          functionCallingConfig: {
            mode: FunctionCallingConfigMode.AUTO,
          },
        },
      },
      contents: this.chatHistory,
    });

    let fullReply = '';
    let funcCall: FunctionCall | null = null;

    this.emit('status', 'Generating response...');
    for await (const chunk of responseStream) {
      if (chunk.functionCalls && chunk.functionCalls.length) {
        const call = chunk.functionCalls[0];
        if (call.name) {
          funcCall = {
            name: call.name,
            args: call.args as GetFileParams | EditFileParams
          };
          if (funcCall.name === 'editFile') {
            this.emit('status', `Preparing to edit file: ${funcCall.args?.fileName || 'unknown'}`);
          } else {
            this.emit('status', `Preparing to read file: ${funcCall.args?.fileName || 'unknown'}`);
          }
        }
      }
      if (chunk.text) {
        fullReply += chunk.text;
        this.emit('status', 'Processing response...');
      }
    }

    if (funcCall) {
      console.log('Function call detected:', funcCall);

      if (funcCall.name === 'editFile') {
        this.emit('status', `Editing file: ${funcCall.args?.fileName || 'unknown'}`);
        const args: EditFileParams = funcCall.args as EditFileParams;
        
        try {
          const res = await fetch('/api/code-edit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filepath: args.fileName,
              lineNumbers: args.lineStart && args.lineEnd ? `${args.lineStart}-${args.lineEnd}` : undefined,
              operation: 'write',
              code: args.code
            }),
          });

          const data = await res.json();
          if (!data.success) {
            throw new Error(data.error || 'Failed to edit file');
          }

          this.chatHistory.push({ role: 'model', parts: [{ text: '', functionCall: funcCall }] });
          this.chatHistory.push({ 
            role: 'user', 
            name: funcCall.name, 
            parts: [{ text: `Successfully edited file: ${args.fileName}` }] 
          });

          this.emit('status', 'File edited successfully');
        } catch (error: unknown) {
          console.error('Error editing file:', error);
          this.emit('status', 'Error editing file');
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          return `Error editing file: ${errorMessage}`;
        }
      } else {
        this.emit('status', `Reading file: ${funcCall.args?.fileName || 'unknown'}`);
        const args: GetFileParams = funcCall.args as GetFileParams;
        const fileName = args.fileName;
        console.log('File name:', fileName);
        
        this.emit('status', 'Fetching file contents...');
        const res = await fetch('/api/code-edit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filepath: funcCall.args.fileName || funcCall,
            lineNumbers:
              args.lineStart && args.lineEnd
                ? `${args.lineStart}-${args.lineEnd}`
                : undefined,
            operation: 'read',
          }),
        });
        
        const data = await res.json();
        const content = data.content || data.error || '';
        console.log('File content:', content);

        this.chatHistory.push({ role: 'model', parts: [{ text: '', functionCall: funcCall }] });
        this.chatHistory.push({ role: 'user', name: funcCall.name, parts: [{ text: content }] });
      }

      this.emit('status', 'Analyzing response...');
      const followUp = await ai.models.generateContent({
        model: this.model,
        contents: this.chatHistory,
        config: { tools: [{ functionDeclarations: [getFileDeclaration, editFileDeclaration] }] },
      });
      
      fullReply = followUp.text || '';
      console.log('Follow-up response:', fullReply);
    } else {
      this.chatHistory.push({ role: 'model', parts: [{ text: fullReply }] });
    }

    // Save chat history after each message
    await this.saveChatHistory();

    this.emit('status', 'Done');
    return fullReply;
  }

  reset() {
    // Save the current chat before resetting
    if (this.chatHistory.length > 0) {
      this.saveChatHistory();
    }
    
    this.chatHistory = [];
    this.chatId = this.generateChatId();
    this.emit('status', 'Chat history cleared');
  }

  getChatHistory() {
    return this.chatHistory;
  }

  async loadChatHistory(chatId: string) {
    try {
      const response = await fetch(`/api/chats/${chatId}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to load chat');
      }

      this.chatHistory = data.chat.messages;
      this.model = data.chat.model;
      this.chatId = data.chat.id;
      this.emit('status', 'Chat history loaded');
      return true;
    } catch (error) {
      console.error('Error loading chat history:', error);
      this.emit('status', 'Error loading chat history');
      return false;
    }
  }

  async listSavedChats() {
    try {
      const response = await fetch('/api/chats');
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to list chats');
      }

      return data.chats;
    } catch (error) {
      console.error('Error listing saved chats:', error);
      this.emit('status', 'Error listing saved chats');
      return [];
    }
  }

  async deleteChat(chatId: string) {
    try {
      const response = await fetch(`/api/chats/${chatId}`, {
        method: 'DELETE',
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to delete chat');
      }

      this.emit('status', 'Chat deleted');
      return true;
    } catch (error) {
      console.error('Error deleting chat:', error);
      this.emit('status', 'Error deleting chat');
      return false;
    }
  }

  private async findFilePath(fileName: string): Promise<string> {
    try {
      const response = await fetch('/api/project-structure');
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to get project structure');
      }

      function recurse(node: Record<string, FileStructure>, current: string): string | null {
        for (const [key, value] of Object.entries(node)) {
          const path = current ? `${current}/${key}` : key;
          
          if (value.type === 'file' && key === fileName) {
            return path;
          }
          
          if (value.type === 'directory' && value.children) {
            const result = recurse(value.children, path);
            if (result) return result;
          }
        }
        
        return null;
      }

      const filePath = recurse(data.structure, '');
      return filePath || fileName;
    } catch (error) {
      console.error('Error finding file path:', error);
      return fileName;
    }
  }
}

interface FileStructure {
  type: 'file' | 'directory';
  children?: Record<string, FileStructure>;
}

export const geminiService = new GeminiService();
