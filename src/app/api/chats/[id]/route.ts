import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const CHATS_DIR = path.join(process.cwd(), 'nextlive', 'chats');

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  try {
    const filePath = path.join(CHATS_DIR, `${id}.json`);

    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { success: false, error: 'Chat not found' },
        { status: 404 }
      );
    }

    const content = await fs.promises.readFile(filePath, 'utf-8');
    const chat = JSON.parse(content);

    return NextResponse.json({ success: true, chat });
  } catch (error) {
    console.error('Error loading chat:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load chat' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  try {
    const filePath = path.join(CHATS_DIR, `${id}.json`);

    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { success: false, error: 'Chat not found' },
        { status: 404 }
      );
    }

    await fs.promises.unlink(filePath);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting chat:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete chat' },
      { status: 500 }
    );
  }
} 