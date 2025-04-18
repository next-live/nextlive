import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Define the settings interface
interface Settings {
  theme?: 'light' | 'dark';
  themeStyle?: 'default' | 'glassmorphism' | 'grassmorphism';
  geminiApiKey?: string;
  [key: string]: any;
}

// Helper function to read the config file
const readConfigFile = (): Settings => {
  try {
    const configPath = path.join(process.cwd(), 'nextlive.config.json');
    if (fs.existsSync(configPath)) {
      const fileContent = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(fileContent);
    }
    return {};
  } catch (error) {
    console.error('Error reading config file:', error);
    return {};
  }
};

// Helper function to write to the config file
const writeConfigFile = (data: Settings): boolean => {
  try {
    const configPath = path.join(process.cwd(), 'nextlive.config.json');
    fs.writeFileSync(configPath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error writing to config file:', error);
    return false;
  }
};

// GET handler to retrieve settings
export async function GET() {
  try {
    const settings = readConfigFile();
    return NextResponse.json({ success: true, settings });
  } catch (error) {
    console.error('Error in GET /api/settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve settings' },
      { status: 500 }
    );
  }
}

// POST handler to update settings
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { settings } = body;

    if (!settings || typeof settings !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Invalid settings data' },
        { status: 400 }
      );
    }

    // Read existing config
    const existingConfig = readConfigFile();
    
    // Merge new settings with existing config
    const updatedConfig = {
      ...existingConfig,
      ...settings
    };

    // Write updated config to file
    const success = writeConfigFile(updatedConfig);

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Failed to save settings' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, settings: updatedConfig });
  } catch (error) {
    console.error('Error in POST /api/settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
