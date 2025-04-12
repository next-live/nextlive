import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize the Gemini AI client
const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY || '');

// Get the model
const model = genAI.getGenerativeModel({
  model: "gemini-2.0-flash",
});

const generationConfig = {
  temperature: 1,
  topP: 0.95,
  topK: 64,
  maxOutputTokens: 65536,
  responseModalities: [],
  responseMimeType: "text/plain",
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

class GeminiService {
  private chatSession;

  constructor() {
    this.chatSession = model.startChat({
      generationConfig,
      history: []
    });
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
        parts.push({ text: message });
      }

      // Send message to Gemini
      const result = await this.chatSession.sendMessage(parts);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Error sending message to Gemini:', error);
      throw error;
    }
  }

  // Reset the chat session
  resetChat() {
    this.chatSession = model.startChat({
      generationConfig,
      history: []
    });
  }
}

// Export a singleton instance
export const geminiService = new GeminiService(); 