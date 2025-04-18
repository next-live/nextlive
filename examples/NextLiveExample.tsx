import React from 'react';
import { NextLive } from '@next-live/nextlive';

const NextLiveExample: React.FC = () => {
  return (
    <div className="app-container">
      <header className="app-header">
        <h1>NextLive Example</h1>
        <p>This is an example of using the NextLive component</p>
      </header>
      
      <NextLive>
        <main className="app-content">
          <h2>Your Application Content</h2>
          <p>
            This content will be wrapped by the NextLive component, which provides
            live code editing and AI assistance features.
          </p>
          
          <div className="code-example">
            <pre>
              <code>
                {`// Example code
function helloWorld() {
  console.log("Hello, NextLive!");
}`}
              </code>
            </pre>
          </div>
        </main>
      </NextLive>
    </div>
  );
};

export default NextLiveExample; 