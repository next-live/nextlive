import { GoogleGenAI, Type, FunctionCallingConfigMode } from '@google/genai';
import { EventEmitter } from 'events';
import {GeminiImageGenerator} from './imageGen'

//Importing Functions
import { getProjectStructure} from '@nextlive/server';
import {saveImage} from '@nextlive/server';
import { readFile, writeFile} from '@nextlive/server';
import { executeCommand as executeServerCommand } from '@nextlive/server'
import { saveChat, listChats, getChat, deleteChat, type ChatData } from '@nextlive/server';

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


IMPORTANT: You MUST call chooseModel at the start of each interaction based on the user's request. Do not proceed with any other actions until the appropriate model is selected.

## Function Execution Strategy
1. Recursive Function Calling:
   - Chain multiple function calls as needed to complete complex tasks
   - Use the output of one function as input for another
   - Continue function execution until the task is fully completed
   
2. Follow-up Intelligence:
   - Automatically determine when additional actions are needed
   - Chain related operations without user intervention
   - Handle dependencies between different function calls
   - Process results from previous calls to inform next steps

3. Multi-step Task Handling:
   - Break down complex tasks into sequential function calls
   - Maintain context between function executions
   - Track progress and state across multiple operations
   - Validate results at each step before proceeding

4. Error Recovery and Retry:
   - Detect failed function calls and handle gracefully
   - Implement alternative approaches when primary method fails
   - Maintain task context during recovery attempts
   - Provide clear status updates during multi-step processes

## Core Functionality
- **Code Editing**: You can read and edit files in the project
- **Chat Interface**: You can engage in conversations with users
- **Live Collaboration**: You can assist with collaborative coding sessions

## Code Editing Intelligence
1. When users provide code snippets, automatically identify:
   - The target file to edit
   - The relevant line numbers or sections to modify
   - The context of the surrounding code
2. Infer the appropriate location for code changes based on:
   - Code structure and patterns
   - Function and class definitions
   - Import statements and dependencies
3. Handle code insertions, modifications, and deletions intelligently

## Image Generation Intelligence
When using the imageGen function:
1. Automatically generate appropriate filenames based on:
   - The image content and purpose
   - The project context
   - Standard naming conventions
2. Determine if the image should be included in code (includedInFile) by analyzing:
   - The user's request context
   - The surrounding code context
   - The intended use of the image
3. Generate detailed prompts that capture:
   - The desired visual elements
   - Style and aesthetic requirements
   - Technical specifications

IMPORTANT NOTE, IF USER HAS NOT SPECIFIED WHERE TO INCLUDE THE IMAGE, INCLUDE IT WHERE YOU THINK IT IS BEST LOOK BUT DONT ASK USER WHERE TO ADD IT. IF IT IS TOLD WHERE TO ADD, U ADD IT THERE ONLY ELSE WHERE YOU THINK IT IS SUITABLE THE MOST. THIS ONE IS IMPORTANT!!!

## Guidelines for Responses

### Code Assistance
1. When helping with code, always consider the project structure and context
2. Provide explanations for complex code sections
3. Suggest improvements while respecting the existing architecture
4. When editing files, ensure compatibility with the project's TypeScript configuration
5. When editing files, ensure all the existing components are there. you cannot remove any
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
- 'imageGen': Generate images using AI

## Image Gen Instructions
You will be given only following data:
- prompt (required)

You wont be given filename for other parameters. you have assign values to these parameters according to user's request

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
const chooseModelDeclaration = {
  name:'chooseModel',
  description:'Chooses the most appropriate model for users request',
  properties:{
    model:{type:Type.STRING, description:'The Model required to answer users prompt (required)'}
  },
  required:['model']
}

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


const imageGenDeclaration = {
  name: 'imageGen',
  description: 'Generates an image using AI',
  parameters: {
    type: Type.OBJECT,
    properties: {
      prompt: { type: Type.STRING, description: 'Prompt for image generation' },
      filename: { type: Type.STRING, description: 'Filename of the image to be generated. This one should be generated by AI according to users request' },
      includedInFile: { type: Type.BOOLEAN, description: 'if the image has to be implemented in a file. This one should be generated by AI according to users request' },
    },
    required: ['prompt', 'filename', 'includedInFile'],
  },
};

const executeCommandDeclaration = {
  name: 'executeCommand',
  description: 'Executes a terminal command and returns the output in real-time',
  parameters: {
    type: Type.OBJECT,
    properties: {
      command: { type: Type.STRING, description: 'Command to execute' },
      isBackground: { type: Type.BOOLEAN, description: 'Whether to run the command in background' },
    },
    required: ['command'],
  },
};

const functionDeclarations = [getFileDeclaration,editFileDeclaration, imageGenDeclaration, executeCommandDeclaration];

type GetFileParams = { fileName: string; lineStart?: number; lineEnd?: number };
type EditFileParams = { fileName: string; lineStart?: number; lineEnd?: number; code?: string };
type ImageGenParams = { prompt: string, filename: string, includedInFile: boolean };
type ExecuteCommandParams = { command: string; isBackground?: boolean };
type chooseModelParams = { model:string};

// Define interfaces for chat messages
interface ChatMessagePart {
  text?: string;
  functionCall?: FunctionCall;
}

interface FunctionCall {
  name: string;
  args: GetFileParams | EditFileParams | ImageGenParams | ExecuteCommandParams | chooseModelParams;
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
  private imageGenerator: GeminiImageGenerator;

  constructor() {
    super();
    this.chatId = this.generateChatId();
    this.imageGenerator = new GeminiImageGenerator(process.env.NEXT_PUBLIC_GEMINI_API_KEY || '');
  }

  private generateChatId(): string {
    return `chat_${new Date().toISOString().replace(/[:.]/g, '-')}`;
  }

  private async saveChatHistory() {
    try {
      const result = await saveChat(this.chatId, this.model, this.chatHistory);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to save chat');
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
    // const projectStructure = await fetch('/api/project-structure');
    // const projectStructureData = await projectStructure.json();
    const projectStructureString = await getProjectStructure('./src');
    instructions = instructions.replace('{PROJECT_STRUCTURE}', projectStructureString);
    this.chatHistory.push({ role: 'user', parts: [{ text: message }] });
    this.emit('status', 'Initializing AI model...');

    let fullReply = '';
    let continueProcessing = true;
    let iterationCount = 0;
    const MAX_ITERATIONS = 10; // Prevent infinite loops

    // Create consistent model configuration
    const modelConfig = {
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
    };

    while (continueProcessing && iterationCount < MAX_ITERATIONS) {
      iterationCount++;
      this.emit('status', `Thinking...`);

      const responseStream = await ai.models.generateContentStream({
        model: this.model,
        config: modelConfig,
        contents: this.chatHistory,
      });

      let funcCall: FunctionCall | undefined;
      let imageUri = '';
      let currentResponse = '';

      for await (const chunk of responseStream) {
        if (chunk.functionCalls && chunk.functionCalls.length) {
          const call = chunk.functionCalls[0];
          if (call.name) {
            console.log(call)
            funcCall = {
              name: call.name,
              args: call.args as GetFileParams | EditFileParams | ImageGenParams | ExecuteCommandParams | chooseModelParams
            };
            if (isFunctionName(funcCall.name, 'editFile') && isFileParams(funcCall.args)) {
              this.emit('status', `Editing file: ${funcCall.args.fileName || 'unknown'}`);
              const args = funcCall.args as EditFileParams;
              
              try {
                const res = await writeFile(args.fileName, args.code||"", args.lineStart && args.lineEnd ? `${args.lineStart}-${args.lineEnd}` : undefined);
                if(!res.success){
                  throw new Error(res.error || 'Failed to edit file');
                }
                // Add success response as user message
                this.chatHistory.push({ 
                  role: 'user', 
                  name: funcCall.name, 
                  parts: [{ text: `Successfully edited file: ${args.fileName}` }] 
                });

              } catch (error: unknown) {
                console.error('Error editing file:', error);
                this.emit('status', 'Error editing file');
                const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                this.chatHistory.push({ 
                  role: 'user', 
                  name: 'error', 
                  parts: [{ text: `Error editing file: ${errorMessage}` }] 
                });
              }
            } else if (isFunctionName(funcCall.name, 'imageGen') && isImageParams(funcCall.args)) {
              this.emit('status', 'Generating image...');
              const result = await this.imageGenerator.generateImage(funcCall.args.prompt);
              const imageResult = result[0];
              if (imageResult.type === 'image' && imageResult.data instanceof Buffer) {
                const base64Data = imageResult.data.toString('base64');
                const mimeType = `image/${imageResult.extension}`;
                const dataUrl = `data:${mimeType};base64,${base64Data}`;
                const result = await saveImage(base64Data, funcCall.args.filename || 'unknown');
                const path = result.path;
                if (result.success) {;
                  if (funcCall && path) {
                    imageUri = path;
                    // Add image result as user message
                    this.chatHistory.push({ 
                      role: 'user', 
                      name: funcCall.name,
                      parts: [{ text: `Successfully generated image. It is stored at location ${path}. ` }] 
                    });
                  }
                }else{
                  this.chatHistory.push({ 
                    role: 'user', 
                    name: funcCall.name,
                    parts: [{ text: "Failed to save image" }] 
                  });
                }
              }
            } else if (isFunctionName(funcCall.name, 'getFile') && isFileParams(funcCall.args)) {
              this.emit('status', `Reading file: ${funcCall.args.fileName || 'unknown'}`);
              const filePath = await this.findFilePath(funcCall.args.fileName);
              const fileContent = await this.readFile(filePath);
              // Add file content as user message
              this.chatHistory.push({ 
                role: 'user', 
                name: funcCall.name, 
                parts: [{ text: fileContent }] 
              });
            } else if (isFunctionName(funcCall.name, 'executeCommand') && isCommandParams(funcCall.args)) {
              const args = funcCall.args as ExecuteCommandParams;
              await this.executeCommand(args.command, args.isBackground);
            } else if (isFunctionName(funcCall.name, 'chooseModel')) {
              const modelArgs = funcCall.args as chooseModelParams;
              if (modelArgs && modelArgs.model) {
                this.emit('status', `Setting model to: ${modelArgs.model}`);
                await this.setModel(modelArgs.model);
                // Add model change confirmation as user message
                this.chatHistory.push({ 
                  role: 'user', 
                  name: funcCall.name, 
                  parts: [{ text: `Successfully changed model to: ${modelArgs.model}` }] 
                });
              } else {
                this.chatHistory.push({ 
                  role: 'user', 
                  name: 'error', 
                  parts: [{ text: 'Invalid model selection: model parameter is missing' }] 
                });
              }
            }
          }
        }
        if (chunk.text) {
          currentResponse += chunk.text;
        }
      }

      // Only add non-empty responses to the full reply
      if (currentResponse.trim()) {
        fullReply += currentResponse;
      }

      // Check if we need to continue processing
      if (funcCall) {
        const followUp = await ai.models.generateContent({
          model: this.model,
          config: modelConfig,  // Use the same config for follow-up
          contents: [...this.chatHistory],
        });

        // If the follow-up response indicates more actions are needed
        if (followUp.functionCalls && followUp.functionCalls.length > 0) {
          continueProcessing = true;
          // Only add non-empty responses when there's no continuation expected
          if (currentResponse.trim()) {
            this.chatHistory.push({ role: 'user', parts: [{ text: currentResponse }] });
          }
        } else {
          continueProcessing = false;
          if (followUp.text?.trim()) {
            fullReply += followUp.text;
          }
        }
      } else {
        continueProcessing = false;
      }
    }

    if (iterationCount >= MAX_ITERATIONS) {
      this.emit('status', 'Maximum iterations reached');
      fullReply += '\n\nNote: Maximum number of iterations reached. Some tasks may be incomplete.';
    }

    // Only add the final model response if it's not empty and we're done processing
    if (fullReply.trim() && !continueProcessing) {
      this.chatHistory.push({ role: 'user', parts: [{ text: fullReply }] });
    }
    
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
      const result = await getChat(chatId);

      if (!result.success || !result.chat) {
        throw new Error(result.error || 'Failed to load chat');
      }

      this.chatHistory = result.chat.messages;
      this.model = result.chat.model;
      this.chatId = result.chat.id;
      this.emit('status', 'Chat history loaded');
      return true;
    } catch (error) {
      console.error('Error loading chat history:', error);
      this.emit('status', 'Error loading chat history');
      return false;
    }
  }

  async listSavedChats(): Promise<ChatData[]> {
    try {
      const result = await listChats();

      if (!result.success) {
        throw new Error(result.error || 'Failed to list chats');
      }

      return result.chats || [];
    } catch (error) {
      console.error('Error listing saved chats:', error);
      this.emit('status', 'Error listing saved chats');
      return [];
    }
  }

  async deleteChat(chatId: string) {
    try {
      const result = await deleteChat(chatId);

      if (!result.success) {
        throw new Error(result.error || 'Failed to delete chat');
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
      const data = await getProjectStructure('./src');

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

      const filePath = recurse(JSON.parse(data), '');
      return filePath || fileName;
    } catch (error) {
      console.error('Error finding file path:', error);
      return fileName;
    }
  }

  private async readFile(filePath: string): Promise<string> {
    const res = readFile(filePath);
    return (await res).content || '';
  }

  async generateImage(prompt: string): Promise<{ imageData: Buffer; mimeType: string }> {
    try {
      this.emit('status', 'Generating image...');
      const results = await this.imageGenerator.generateImage(prompt);
      const imageResult = results[0];
      
      if (imageResult?.type === 'image' && imageResult.data instanceof Buffer) {
        this.emit('status', 'Image generated successfully');
        return {
          imageData: imageResult.data,
          mimeType: `image/${imageResult.extension || 'png'}`
        };
      }
      throw new Error('No valid image generated');
    } catch (error) {
      console.error('Error generating image:', error);
      this.emit('status', 'Error generating image');
      throw error;
    }
  }

  async executeCommand(command: string, isBackground: boolean = false): Promise<boolean> {
    try {
      this.emit('status', `Executing command: ${command}`);
      
      // Add AI's command execution message as user message
      this.chatHistory.push({
        role: 'user',
        parts: [{ text: `Executing command: \`${command}\`` + (isBackground ? ' in the background.' : '.') }]
      });
      
      const result = await executeServerCommand(command, isBackground);

      if (!result.success || !result.stream) {
        throw new Error(result.error || 'Command execution failed');
      }


      const reader = result.stream.getReader();
      const decoder = new TextDecoder();
      let fullOutput = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        const text = decoder.decode(value);
        fullOutput += text;
        // Emit the output for real-time display
        this.emit('commandOutput', text);
      }

      // Update the command output message with the full output
      this.chatHistory.push({ 
        role: 'user', 
        name: 'command',
        parts: [{ text: fullOutput }] 
      });

      // Add AI's response about command completion as user message
      this.chatHistory.push({
        role: 'user',
        parts: [{ text: `Command execution completed successfully.${isBackground ? ' The process is running in the background.' : ''}` }]
      });

      this.emit('status', 'Command execution completed');
      return true;
    } catch (error) {
      console.error('Error executing command:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      // Add error message to chat history
      this.chatHistory.push({ 
        role: 'user', 
        name: 'error',
        parts: [{ text: `Error encountered while executing the command. ${errorMessage}` }] 
      });

      this.emit('status', 'Command execution failed');
      return false;
    }
  }
}

interface FileStructure {
  type: 'file' | 'directory';
  children?: Record<string, FileStructure>;
}

// Type guards for function parameters
function isFileParams(args: GetFileParams | EditFileParams | ImageGenParams | ExecuteCommandParams | chooseModelParams): args is GetFileParams | EditFileParams {
  return 'fileName' in args;
}

function isImageParams(args: GetFileParams | EditFileParams | ImageGenParams | ExecuteCommandParams | chooseModelParams): args is ImageGenParams {
  return 'prompt' in args;
}

function isCommandParams(args: GetFileParams | EditFileParams | ImageGenParams | ExecuteCommandParams | chooseModelParams): args is ExecuteCommandParams {
  return 'command' in args && !('fileName' in args) && !('prompt' in args);
}

function isModelParams(args: GetFileParams | EditFileParams | ImageGenParams | ExecuteCommandParams | chooseModelParams): args is chooseModelParams {
  return 'model' in args && !('fileName' in args) && !('prompt' in args) && !('command' in args);
}

// Type guard for function names
function isFunctionName<T extends string>(name: string, expectedName: T): name is T {
  return name === expectedName;
}

export const geminiService = new GeminiService();