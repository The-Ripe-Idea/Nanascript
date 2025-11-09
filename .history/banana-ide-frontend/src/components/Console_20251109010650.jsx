import React from 'react';
import './Console.css';

const Console = ({ output }) => {
  return (
    <div className="console-container">
      <div className="console-header">Console</div>
      <pre className="console-output">{output || 'Output will appear here...'}</pre>
    </div>
  );
};

export default Console;