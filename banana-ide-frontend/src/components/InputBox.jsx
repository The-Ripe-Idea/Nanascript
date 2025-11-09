import React from 'react';
import './InputBox.css';

const InputBox = ({ inputValue, setInputValue, onSendInput, isWaiting, prompt }) => {
  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputValue.trim() && isWaiting) {
      // Split by whitespace to get tokens
      const tokens = inputValue.trim().split(/\s+/);
      onSendInput(tokens);
      setInputValue(''); // Clear after sending
    }
  };

  return (
    <div className="input-box-container">
      {isWaiting && (
        <div className="input-prompt">
          {prompt || 'Waiting for input...'}
        </div>
      )}
      <form onSubmit={handleSubmit} className="input-form">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={isWaiting ? "Enter input (tokens separated by whitespace)" : "Input will appear here when needed"}
          disabled={!isWaiting}
          className="input-field"
        />
        <button 
          type="submit" 
          disabled={!isWaiting || !inputValue.trim()}
          className="send-input-button"
        >
          Send
        </button>
      </form>
      {isWaiting && (
        <div className="input-hint">
          Enter tokens separated by whitespace. They will be used in order as the program needs them.
        </div>
      )}
    </div>
  );
};

export default InputBox;

