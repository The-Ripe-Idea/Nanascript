import React, { useState, useRef, useCallback } from 'react';
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
  
  // No longer need inputTokens state, refs are sufficient
  const inputTokensRef = useRef([]);
  const currentTokenIndexRef = useRef(0);
  const pollingIntervalRef = useRef(null);

  // Centralized polling function
  const pollForStatus = useCallback(async (sessionIdToPoll) => {
    try {
      const response = await fetch(`http://localhost:3001/api/status/${sessionIdToPoll}`);
      const data = await response.json();
      
      if (data.complete) {
        stopPolling();
        setIsWaitingForInput(false);
        setOutput(data.output || '(No output)');
        setSessionId(null);
        inputTokensRef.current = [];
        currentTokenIndexRef.current = 0;
      } else if (data.needsInput) {
        // Backend needs a token
        const nextIndex = currentTokenIndexRef.current; // Check current index
        
        if (inputTokensRef.current.length > nextIndex) {
          // We have a token to send
          currentTokenIndexRef.current = nextIndex + 1; // Increment *before* sending
          
          // Send the token, but don't start a new poll
          // The current poll loop will continue
          await sendToken(inputTokensRef.current[nextIndex], sessionIdToPoll);
          
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
      setOutput((prev) => prev + '\n🚫 Polling error: ' + error.message);
    }
  }, [output]); // Include output to prevent stale closures

  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };
  
  const startPolling = (sessionIdToPoll) => {
    stopPolling(); // Clear any existing interval
    
    pollingIntervalRef.current = setInterval(() => {
      pollForStatus(sessionIdToPoll);
    }, 300); // Poll every 300ms
    
    // Also poll immediately
    setTimeout(() => pollForStatus(sessionIdToPoll), 100);
  };

  const handleRun = async () => {
    setOutput('Executing...');
    setIsWaitingForInput(false);
    setSessionId(null);
    inputTokensRef.current = [];
    currentTokenIndexRef.current = 0;
    stopPolling();
    
    try {
      const response = await fetch('http://localhost:3001/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setSessionId(data.sessionId); // Always set session ID
        setOutput(data.output || '');
        
        if (data.needsInput) {
          // Program needs input immediately
          setIsWaitingForInput(true);
          setCurrentPrompt(data.prompt || 'Input needed');
          // Start polling to check for status
          startPolling(data.sessionId);
        } else if (data.complete) {
          // Program completed immediately
          const outputText = (data.output || '').trim();
          setOutput(outputText || '(No output - program executed successfully)');
        } else {
          // Program is running but doesn't need input yet
          startPolling(data.sessionId);
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

  // Simplified token sending function
  const sendToken = async (token, sessionIdToSend) => {
    if (!sessionIdToSend) return false;
    
    try {
      const response = await fetch('http://localhost:3001/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sessionId: sessionIdToSend,
          inputToken: token
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        setOutput((prev) => prev + `\n🚫 Error: ${data.error || 'Failed to send input'}`);
        stopPolling(); // Stop if sending failed
        return false;
      }
      
      // Success!
      setIsWaitingForInput(false); // We've sent it, now we're waiting
      setInputValue(''); // Clear input
      return true;
      
    } catch (error) {
      setOutput((prev) => prev + `\n🚫 Error: Failed to send input: ${error.message}`);
      stopPolling();
      return false;
    }
  };

  const handleSendInput = async (tokens) => {
    if (!sessionId || tokens.length === 0) return;
    
    // Display the input in the console output
    const inputDisplay = `${currentPrompt || '> '}${inputValue}\n`;
    setOutput(prevOutput => prevOutput + inputDisplay);
    
    // Store tokens and send them one at a time
    inputTokensRef.current = tokens;
    currentTokenIndexRef.current = 0;
    
    // Send first token
    // We update the index *after* sending
    const firstToken = inputTokensRef.current[0];
    currentTokenIndexRef.current = 1;
    
    const success = await sendToken(firstToken, sessionId);
    
    if (success) {
      // Input was sent, restart polling to see what happens next
      startPolling(sessionId);
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