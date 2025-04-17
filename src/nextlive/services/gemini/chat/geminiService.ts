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

export class GeminiService extends EventEmitter {
  private chatHistory: any[] = [];
  private model = 'gemini-2.0-flash';

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
    let funcCall: any = null;

    this.emit('status', 'Generating response...');
    for await (const chunk of responseStream) {
      if (chunk.functionCalls && chunk.functionCalls.length) {
        funcCall = chunk.functionCalls[0];
        if (funcCall.name === 'editFile') {
          this.emit('status', `Preparing to edit file: ${funcCall.args?.fileName || 'unknown'}`);
        } else {
          this.emit('status', `Preparing to read file: ${funcCall.args?.fileName || 'unknown'}`);
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
        const args: EditFileParams = funcCall.args;
        
        try {
          const res = await fetch('/api/code-edit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filepath: args.fileName,
              lineNumbers: args.lineStart && args.lineEnd ? `${args.lineStart}-${args.lineEnd}` : undefined,
              operation: 'write',
              content: args.code
            }),
          });

          const data = await res.json();
          if (!data.success) {
            throw new Error(data.error || 'Failed to edit file');
          }

          this.chatHistory.push({ role: 'model', parts: [{ functionCall: funcCall }] });
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
        // Existing read file logic
        this.emit('status', `Reading file: ${funcCall.args?.fileName || 'unknown'}`);
        const args: GetFileParams = funcCall.args || funcCall;
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

        this.chatHistory.push({ role: 'model', parts: [{ functionCall: funcCall }] });
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

    this.emit('status', 'Done');
    return fullReply;
  }

  reset() {
    this.chatHistory = [];
    this.emit('status', 'Chat history cleared');
  }

  private async findFilePath(fileName: string): Promise<string> {
    this.emit('status', `Searching for file: ${fileName}`);
    const res = await fetch('/api/project-structure?baseDir=src&depth=10');
    const { structure } = await res.json();
    function recurse(node: Record<string, any>, current: string): string | null {
      for (const [name, info] of Object.entries(node)) {
        const nextPath = `${current}/${name}`;
        if (info.type === 'file' && name === fileName) return nextPath;
        if (info.type === 'directory' && info.children) {
          const found = recurse(info.children, nextPath);
          if (found) return found;
        }
      }
      return null;
    }
    const result = recurse(structure, 'src') || '';
    this.emit('status', result ? `File found: ${result}` : `File not found: ${fileName}`);
    return result;
  }
}

export const geminiService = new GeminiService();
