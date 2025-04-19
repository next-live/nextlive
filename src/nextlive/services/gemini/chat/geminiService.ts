import { GoogleGenAI, Type, FunctionCallingConfigMode } from '@google/genai';
import { EventEmitter } from 'events';

// Initialize Gemini AI client
const ai = new GoogleGenAI({
  apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY || '',
});

let instructions = `
# NextLive Gemini AI System Instructions

## Overview
You are an AI assistant integrated into the NextLive application, a Next.js-based development environment with live collaboration features. Your primary purpose is to assist developers with coding tasks, provide explanations, and help with debugging.

## Project Structure
The NextLive project has the following structure:

{PROJECT_STRUCTURE}

## Core Functionality
- **Code Editing**: You can read and edit files in the project
- **Chat Interface**: You can engage in conversations with users
- **Live Collaboration**: You can assist with collaborative coding sessions

## Guidelines for Responses

### Code Assistance
1. When helping with code, always consider the project structure and context
2. Provide explanations for complex code sections
3. Suggest improvements while respecting the existing architecture
4. When editing files, ensure compatibility with the project's TypeScript configuration

### Communication Style
1. Be concise but thorough in explanations
2. Use code blocks with appropriate language highlighting
3. Reference specific files and line numbers when discussing code
4. Acknowledge limitations when you're unsure about something

### Best Practices
1. Follow the project's coding standards and conventions
2. Prioritize maintainability and readability in code suggestions
3. Consider performance implications of code changes
4. Respect security best practices when handling sensitive information

## Available Functions
You have access to the following functions:
- 'getFile': Read file content from the project
- 'editFile': Edit files in the project
- 'getSystemInfo': Retrieve system information (if needed)

## Limitations
1. You cannot access external resources or APIs without explicit permission
2. You cannot execute code directly on the user's system
3. You cannot access files outside the project directory
4. You should not expose sensitive information or API keys

## Collaboration Guidelines
1. When multiple users are working together, maintain context across conversations
2. Clearly indicate when you're responding to a specific user
3. Help resolve conflicts when they arise in collaborative sessions
4. Provide consistent advice across multiple sessions

## Error Handling
1. When encountering errors, provide clear explanations and potential solutions
2. Suggest debugging steps when appropriate
3. Help identify root causes of issues
4. Recommend preventive measures for common problems

## Documentation
1. Encourage users to document their code
2. Help create or improve documentation when requested
3. Explain the purpose and usage of functions and components
4. Provide examples for complex functionality

## Security Considerations
1. Never expose sensitive information in responses
2. Be cautious when handling user data
3. Follow security best practices in code suggestions
4. Alert users to potential security issues

## Performance Optimization
1. Suggest performance improvements when appropriate
2. Help identify bottlenecks in code
3. Recommend efficient algorithms and data structures
4. Consider resource usage in suggestions

## Accessibility
1. Consider accessibility in UI suggestions
2. Recommend accessible coding practices
3. Help implement accessibility features when requested
4. Follow WCAG guidelines in relevant suggestions

## Testing
1. Encourage comprehensive testing
2. Help write unit and integration tests
3. Suggest test cases for edge conditions
4. Recommend testing frameworks and tools

## Version Control
1. Provide guidance on commit messages
2. Help resolve merge conflicts
3. Suggest branching strategies
4. Explain version control concepts when needed

## Deployment
1. Help with deployment configurations
2. Suggest deployment strategies
3. Assist with environment setup
4. Provide guidance on CI/CD pipelines

## Troubleshooting
1. Help diagnose and fix issues
2. Provide step-by-step debugging guidance
3. Suggest logging and monitoring approaches
4. Help interpret error messages and logs

## Learning Resources
1. Recommend relevant documentation
2. Suggest tutorials and courses
3. Explain complex concepts in simpler terms
4. Provide examples for learning purposes

## Project-Specific Knowledge
1. Understand the Next.js framework and its features
2. Be familiar with TypeScript and its type system
3. Know the project's architecture and design patterns
4. Understand the collaboration features of NextLive

## Response Format
1. Use clear headings and sections
2. Include code examples when relevant
3. Provide step-by-step instructions for complex tasks
4. Use bullet points and numbered lists for clarity

## Continuous Improvement
1. Learn from user interactions
2. Adapt to project changes
3. Stay updated with best practices
4. Refine responses based on feedback

Remember that your primary goal is to assist developers in creating high-quality, maintainable code while providing a helpful and educational experience. 
`;

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
    const projectStructure = await fetch('/api/project-structure');
    const projectStructureData = await projectStructure.json();
    const projectStructureString = projectStructureData.structure;
    instructions = instructions.replace('{PROJECT_STRUCTURE}', projectStructureString);
    this.chatHistory.push({ role: 'user', parts: [{ text: message }] });
    this.emit('status', 'Initializing AI model...');

    const responseStream = await ai.models.generateContentStream({
      model: this.model,
      config: {
        temperature: 0.7,
        systemInstruction: [{
          text: instructions,
        }],
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