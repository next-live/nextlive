import { GoogleGenAI, Type, FunctionCallingConfigMode } from '@google/genai';

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

type GetFileParams = { fileName: string; lineStart?: number; lineEnd?: number };

export class GeminiService {
  private chatHistory: any[] = [];
  private model = 'gemini-2.0-flash';

  async sendMessage(message: string) {
    this.chatHistory.push({ role: 'user', parts: [{ text: message }] });

    const responseStream = await ai.models.generateContentStream({
      model: this.model,
      config: {
        temperature: 0.7,
        tools: [{ functionDeclarations: [getFileDeclaration] }],
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

    for await (const chunk of responseStream) {
      if (chunk.functionCalls && chunk.functionCalls.length) {
        funcCall = chunk.functionCalls[0];
      }
      if (chunk.text) fullReply += chunk.text;
    }

    if (funcCall) {
      console.log('Function call detected:', funcCall);

      const args: GetFileParams = funcCall.args || funcCall;
      const fileName = args.fileName;
      console.log('File name:', fileName);
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

      const followUp = await ai.models.generateContent({
        model: this.model,
        contents: this.chatHistory,
        config: { tools: [{ functionDeclarations: [getFileDeclaration] }] },
      });
      fullReply = followUp.text;
      console.log('Follow-up response:', fullReply);
    } else {
      this.chatHistory.push({ role: 'model', parts: [{ text: fullReply }] });
    }

    return fullReply;
  }

  reset() {
    this.chatHistory = [];
  }

  private async findFilePath(fileName: string): Promise<string> {
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
    return recurse(structure, 'src') || '';
  }
}

export const geminiService = new GeminiService();
