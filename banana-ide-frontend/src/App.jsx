import React, { useState, useRef } from 'react';
import CodeEditor from './components/CodeEditor';
import Console from './components/Console';
import RunButton from './components/RunButton';
import './App.css';

function App() {
  const [code, setCode] = useState('// Your banana code goes here 🍌');
  const [output, setOutput] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [isWaitingForInput, setIsWaitingForInput] = useState(false);
  const [currentPrompt, setCurrentPrompt] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [inputTokens, setInputTokens] = useState([]);
  const [currentTokenIndex, setCurrentTokenIndex] = useState(0);
  const pollingIntervalRef = useRef(null);
  const inputTokensRef = useRef([]);
  const currentTokenIndexRef = useRef(0);

  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  const pollForStatus = async (sessionIdToPoll) => {
    try {
      const response = await fetch(`http://localhost:3001/api/status/${sessionIdToPoll}`);
      const data = await response.json();
      
      if (data.complete) {
        stopPolling();
        setIsWaitingForInput(false);
        setOutput(data.output || output);
        setSessionId(null);
        setInputTokens([]);
        setCurrentTokenIndex(0);
        inputTokensRef.current = [];
        currentTokenIndexRef.current = 0;
      } else if (data.needsInput) {
        // Check if we have more tokens to send
        if (inputTokensRef.current.length > currentTokenIndexRef.current + 1) {
          // We have more tokens, send the next one automatically
          const nextIndex = currentTokenIndexRef.current + 1;
          currentTokenIndexRef.current = nextIndex;
          setCurrentTokenIndex(nextIndex);
          await sendNextToken(inputTokensRef.current[nextIndex], nextIndex, inputTokensRef.current);
        } else {
          // No more tokens, wait for user input
          stopPolling();
          setIsWaitingForInput(true);
          setCurrentPrompt(data.prompt || 'Input needed');
          setOutput(data.output || output);
        }
      } else {
        // Update output but keep polling
        if (data.output) {
          setOutput(data.output);
        }
      }
    } catch (error) {
      console.error('Polling error:', error);
      stopPolling();
    }
  };

  const handleRun = async () => {
    setOutput('Executing...');
    setIsWaitingForInput(false);
    setSessionId(null);
    setInputTokens([]);
    setCurrentTokenIndex(0);
    inputTokensRef.current = [];
    currentTokenIndexRef.current = 0;
    stopPolling();
    
    try {
      const response = await fetch('http://localhost:3001/api/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      });

      const data = await response.json();
      
      if (response.ok) {
        if (data.needsInput) {
          // Program needs input
          setIsWaitingForInput(true);
          setCurrentPrompt(data.prompt || 'Input needed');
          setSessionId(data.sessionId);
          setOutput(data.output || '');
        } else {
          // Program completed
          const outputText = (data.output || '').trim();
          setOutput(outputText || '(No output - program executed successfully)');
        }
      } else {
        const errorMsg = data.error || 'Unknown error';
        const outputText = data.output || '';
        setOutput(`🚫 Error: ${errorMsg}${outputText ? '\n\n' + outputText : ''}`);
      }
    } catch (error) {
      setOutput(`🚫 Error: Failed to connect to backend.\nMake sure the backend server is running on http://localhost:3001\n\nError details: ${error.message}`);
    }
  };

  const handleSendInput = async (tokens) => {
    if (!sessionId || tokens.length === 0) return;
    
    // Display the input in the console output
    const inputDisplay = `${currentPrompt || '> '}${inputValue}\n`;
    setOutput(prevOutput => prevOutput + inputDisplay);
    
    // Store tokens and send them one at a time
    setInputTokens(tokens);
    inputTokensRef.current = tokens;
    setCurrentTokenIndex(0);
    currentTokenIndexRef.current = 0;
    
    // Send first token
    await sendNextToken(tokens[0], 0, tokens);
  };

  const sendNextToken = async (token, index, allTokens) => {
    if (!sessionId) return;
    
    try {
      // Send the token to the backend
      const response = await fetch('http://localhost:3001/api/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          sessionId: sessionId,
          inputToken: token
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        // Start polling for status updates
        setIsWaitingForInput(false);
        setInputValue('');
        
        // Poll for status updates
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
        }
        
        pollingIntervalRef.current = setInterval(() => {
          pollForStatus(sessionId);
        }, 300); // Poll every 300ms
        
        // Also poll immediately
        setTimeout(() => pollForStatus(sessionId), 100);
      } else {
        setOutput(`🚫 Error: ${data.error || 'Failed to send input'}`);
        setIsWaitingForInput(false);
      }
    } catch (error) {
      setOutput(`🚫 Error: Failed to send input: ${error.message}`);
      setIsWaitingForInput(false);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>🍌 Banana IDE 🍌</h1>
      </header>
      <main className="ide-container">
        <CodeEditor code={code} setCode={setCode} />
        <RunButton onRun={handleRun} />
        <Console 
          output={output}
          isWaitingForInput={isWaitingForInput}
          prompt={currentPrompt}
          onInputSubmit={handleSendInput}
          inputValue={inputValue}
          setInputValue={setInputValue}
        />
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