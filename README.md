# NextLive React Component

A powerful React component for live code editing and AI assistance.

## Installation

```bash
npm install @nextlive/react
# or
yarn add @nextlive/react
```

## Usage

```jsx
import { NextLive } from '@nextlive/react';

function App() {
  return (
    <NextLive>
      {/* Your app content */}
      <div>Your app content goes here</div>
    </NextLive>
  );
}

export default App;
```

## Features

- Live code editing with AI assistance
- Voice chat integration with Gemini AI
- Code block rendering with syntax highlighting
- File explorer for navigating your codebase
- Mobile-friendly UI with glassmorphism design

## Components

### NextLive

The main component that provides the live editing experience.

```jsx
<NextLive skipDevelopmentCheck={false} skipPaths={[]}>
  {children}
</NextLive>
```

### GeminiMobileThemeChat

A chat component with a mobile-friendly UI and glassmorphism design.

```jsx
import { GeminiMobileThemeChat } from '@nextlive/react';

<GeminiMobileThemeChat
  onClose={() => {}}
  onSendMessage={(message) => {}}
  messages={[]}
  isVisible={true}
  setIsVisible={() => {}}
  isTakingScreenshot={false}
  setIsTakingScreenshot={() => {}}
  isSidePanel={false}
  width={350}
  theme="dark"
  themeStyle="glassmorphism"
  onWidthChange={() => {}}
  initialPosition={{ x: 0, y: 0 }}
/>
```

### GeminiVoiceChat

A voice chat component that integrates with Gemini AI.

```jsx
import { GeminiVoiceChat } from '@nextlive/react';

<GeminiVoiceChat apiKey="your-api-key" />
```

### CodeBlock

A component for rendering code blocks with syntax highlighting.

```jsx
import { CodeBlock } from '@nextlive/react';

<CodeBlock
  data={{
    filepath: 'example.ts',
    lineNumbers: '1-10',
    code: 'console.log("Hello, world!");',
    language: 'typescript'
  }}
  onCopy={() => {}}
  onPlay={() => {}}
/>
```

### FileExplorer

A component for navigating your codebase.

```jsx
import { FileExplorer } from '@nextlive/react';

<FileExplorer onFileSelect={(filePath) => {}} />
```

## Services

### codeEditService

A service for editing code files.

```jsx
import { codeEditService } from '@nextlive/react';

// Apply a code edit
await codeEditService.applyEdit({
  filepath: 'example.ts',
  lineNumbers: '1-10',
  code: 'console.log("Hello, world!");'
});

// Read a file
const code = await codeEditService.readFile('example.ts');
```

### geminiChatService

A service for interacting with Gemini AI chat.

```jsx
import { geminiChatService } from '@nextlive/react';

// Send a message to Gemini AI
const response = await geminiChatService.sendMessage('Hello, Gemini!');
```

### geminiLiveService

A service for live interactions with Gemini AI.

```jsx
import { geminiLiveService } from '@nextlive/react';

// Start a live session with Gemini AI
const session = await geminiLiveService.startSession();
```

## License

MIT
