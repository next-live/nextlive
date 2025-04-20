import { GoogleGenAI } from '@google/genai';
import mime from 'mime';
import dotenv from 'dotenv';

dotenv.config();

interface GeneratedContent {
  type: 'image' | 'text';
  data: Buffer | string;
  extension?: string;
}

export class GeminiImageGenerator {
  private ai: GoogleGenAI;
  private model: string = 'gemini-2.0-flash-exp-image-generation';
  private config = {
    responseModalities: ['image', 'text'],
    responseMimeType: 'text/plain',
  };

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  public async generateImage(prompt: string): Promise<GeneratedContent[]> {
    const contents = [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ];

    const response = await this.ai.models.generateContentStream({
      model: this.model,
      config: this.config,
      contents,
    });

    const results: GeneratedContent[] = [];

    for await (const chunk of response) {
      const parts = chunk?.candidates?.[0]?.content?.parts;
      if (!parts) continue;

      const part = parts[0];
      if (part.inlineData) {
        const inlineData = part.inlineData;
        const extension = mime.getExtension(inlineData.mimeType || '') || 'bin';
        const buffer = Buffer.from(inlineData.data || '', 'base64');

        results.push({
          type: 'image',
          data: buffer,
          extension,
        });
      } else if (chunk.text) {
        results.push({
          type: 'text',
          data: chunk.text,
        });
      }
    }

    return results;
  }
}