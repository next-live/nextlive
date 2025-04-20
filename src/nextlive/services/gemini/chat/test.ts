// To run this code you need to install the following dependencies:
// npm install @google/genai mime
// npm install -D @types/node

import {
    GoogleGenAI,
  } from '@google/genai';
  import mime from 'mime';
  import { writeFile } from 'fs';
  
  function saveBinaryFile(fileName: string, content: Buffer) {
    writeFile(fileName, content, 'utf8', (err) => {
      if (err) {
        console.error(`Error writing file ${fileName}:`, err);
        return;
      }
      console.log(`File ${fileName} saved to file system.`);
    });
  }
  
async function main() {
    
    
    const contents = [
      {
        role: 'user',
        parts: [
          {
            text: `a cute dog
  `,
          },
        ],
      },
      {
        role: 'model',
        parts: [
          {
           
          },
        ],
      },
      {
        role: 'user',
        parts: [
          {
            text: `INSERT_INPUT_HERE`,
          },
        ],
      },
    ];
  
    
    
  }
  
  main();
  