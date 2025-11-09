import React, { useEffect, useRef } from 'react';
import './Console.css';

const Console = ({ output, isWaitingForInput, prompt, onInputSubmit, inputValue, setInputValue }) => {
  const inputRef = useRef(null);
  const outputRef = useRef(null);

  // Auto-focus input when waiting for input
  useEffect(() => {
    if (isWaitingForInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isWaitingForInput]);

  // Auto-scroll to bottom when output changes
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (inputValue.trim() && isWaitingForInput) {
        // Split by whitespace to get tokens
        const tokens = inputValue.trim().split(/\s+/);
        onInputSubmit(tokens);
        setInputValue('');
      }
    }
  };

  return (
    <div className="console-container">
      <div className="console-header">Console</div>
      <div className="console-content">
        <pre ref={outputRef} className="console-output">
          {output || 'Output will appear here...'}
          {isWaitingForInput && (
            <span className="console-prompt">
              {prompt || '> '}
            </span>
          )}
        </pre>
        {isWaitingForInput && (
          <div className="console-input-wrapper">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="console-input"
              placeholder="Enter input (tokens separated by whitespace)"
              autoFocus
            />
            <button
              onClick={() => {
                if (inputValue.trim()) {
                  const tokens = inputValue.trim().split(/\s+/);
                  onInputSubmit(tokens);
                  setInputValue('');
                }
              }}
              className="console-input-button"
              disabled={!inputValue.trim()}
            >
              Send
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Console;