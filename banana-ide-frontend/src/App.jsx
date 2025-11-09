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
  
  const inputTokensRef = useRef([]);
  const currentTokenIndexRef = useRef(0);
  const pollingIntervalRef = useRef(null);

  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  // --- FIX: Wrapped sendToken in useCallback ---
  const sendToken = useCallback(async (token, sessionIdToSend) => {
    if (!sessionIdToSend) return { success: false, error: 'No Session ID' };
    
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
        return { success: false, error: data.error };
      }
      
      // Success!
      setIsWaitingForInput(false);
      setInputValue(''); // Clear input
      return { success: true };
      
    } catch (error) {
      setOutput((prev) => prev + `\n🚫 Error: Failed to send input: ${error.message}`);
      return { success: false, error: error.message };
    }
  }, []); // No dependencies, safe to use

  // --- FIX: Wrapped pollForStatus in useCallback ---
  const pollForStatus = useCallback(async (sessionIdToPoll) => {
    try {
      const response = await fetch(`http://localhost:3001/api/status/${sessionIdToPoll}`);
      const data = await response.json();
      
      // --- CRITICAL FIX 1: THE "FREEZE" BUG ---
      // ALWAYS set the output to the backend's state.
      // Check for `undefined` because an empty string `""` is valid output!
      if (data.output !== undefined) {
        setOutput(data.output);
      }

      if (data.complete) {
        stopPolling();
        setIsWaitingForInput(false);
        setSessionId(null);
        inputTokensRef.current = [];
        currentTokenIndexRef.current = 0;
        // Set final output
        if (data.output !== undefined) {
          const trimmedOutput = data.output.trim();
          setOutput(trimmedOutput || '(No output - program executed successfully)');
        }
      } else if (data.needsInput) {
        // Backend needs a token
        const nextIndex = currentTokenIndexRef.current;
        
        if (inputTokensRef.current.length > nextIndex) {
          // We have a token to send
          currentTokenIndexRef.current = nextIndex + 1;
          
          const { success } = await sendToken(inputTokensRef.current[nextIndex], sessionIdToPoll);
          if (!success) {
             stopPolling(); // Stop if sending failed
          }
          // The poll loop will continue and catch the next state
        } else {
          // No more tokens, wait for user input
          stopPolling();
          setIsWaitingForInput(true);
          setCurrentPrompt(data.prompt || 'Input needed');
        }
      } else {
        // Not complete, not needsInput. Just keep polling.
        // The setOutput(data.output) at the top already handled this.
      }
    } catch (error) {
      console.error('Polling error:', error);
      stopPolling();
      setOutput((prev) => prev + '\n🚫 Polling error: ' + error.message);
    }
  }, [sendToken]); // Dependency is stable

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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setSessionId(data.sessionId);
        setOutput(data.output || '');
        
        if (data.needsInput) {
          // Program needs input
          setIsWaitingForInput(true);
          setCurrentPrompt(data.prompt || 'Input needed');
          // Don't start polling. We are waiting for the user.
        } else if (!data.complete) {
          // Program is running, start polling
          startPolling(data.sessionId);
        } else {
          // Program completed immediately
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
    
    // --- CRITICAL FIX 2: THE "OVERWRITE" BUG ---
    // REMOVED local echo. The backend is the single source of truth.
    // The Java interpreter MUST echo its stdin to stdout if you
    // want the user's input to appear in the console.
    
    // Store tokens and set index
    inputTokensRef.current = tokens;
    currentTokenIndexRef.current = 0;
    
    // Send first token
    const firstToken = inputTokensRef.current[0];
    currentTokenIndexRef.current = 1; // Move index to the *next* token
    
    const { success } = await sendToken(firstToken, sessionId);
    
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
          {/* ... (emoji key) ... */}
        </ul>
      </footer>
    </div>
  );
}

export default App;