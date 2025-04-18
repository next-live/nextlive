import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const CHATS_DIR = path.join(process.cwd(), 'nextlive', 'chats');

// Ensure chats directory exists
if (!fs.existsSync(CHATS_DIR)) {
  fs.mkdirSync(CHATS_DIR, { recursive: true });
}

export async function GET() {
  try {
    const files = await fs.promises.readdir(CHATS_DIR);
    const chats = await Promise.all(
      files
        .filter(file => file.endsWith('.json'))
        .map(async file => {
          const filePath = path.join(CHATS_DIR, file);
          const content = await fs.promises.readFile(filePath, 'utf-8');
          return JSON.parse(content);
        })
    );

    // Sort chats by timestamp in descending order
    const sortedChats = chats.sort((a, b) => 
      new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
    );

    return NextResponse.json({ success: true, chats: sortedChats });
  } catch (error) {
    console.error('Error listing chats:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list chats' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { id, model, messages } = await request.json();

    if (!id || !model || !messages) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: id, model, messages' },
        { status: 400 }
      );
    }

    const chatData = {
      id,
      model,
      messages,
      timestamp: new Date().toISOString()
    };

    const filePath = path.join(CHATS_DIR, `${id}.json`);
    await fs.promises.writeFile(filePath, JSON.stringify(chatData, null, 2));

    return NextResponse.json({ success: true, chat: chatData });
  } catch (error) {
    console.error('Error creating chat:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create chat' },
      { status: 500 }
    );
  }
} 