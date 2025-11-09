import React, { useState } from 'react';
import CodeEditor from './components/CodeEditor';
import Console from './components/Console';
import RunButton from './components/RunButton';
import './App.css';

function App() {
  const [code, setCode] = useState('// Your banana code goes here 🍌');
  const [output, setOutput] = useState('');

  const handleRun = () => {
    // This is a mock runner.
    // Replace this with your actual backend call.
    console.log('Running code:', code);
    setOutput(`Executing...\n🍌🍌🍌\nSuccess! Output below:\n> Mock output for your awesome banana code!`);
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>🍌 Banana IDE 🍌</h1>
      </header>
      <main className="ide-container">
        <CodeEditor code={code} setCode={setCode} />
        <RunButton onRun={handleRun} />
        <Console output={output} />
      </main>
      <footer className="emoji-key-container">
        <h2>Emoji Language Key</h2>
        <ul className="emoji-key-list">
          <li><code>🍌</code> - Statement Terminator</li>
          <li><code>🐵</code> - Print to console</li>
          <li><code>🌴</code> - Declare a variable</li>
          <li><code>🥥</code> - String literal wrapper</li>
          <li><code>➡️</code> - Assignment operator</li>
          <li><code>➕</code> - Addition</li>
          <li><code>➖</code> - Subtraction</li>
          <li><code>🔁</code> - Loop construct</li>
          <li><code>❓</code> - Conditional (if) statement</li>
        </ul>
      </footer>
    </div>
  );
}

export default App;