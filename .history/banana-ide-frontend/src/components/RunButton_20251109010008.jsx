import React from 'react';
import './RunButton.css';

const RunButton = ({ onRun }) => {
  return (
    <button className="run-button" onClick={onRun}>
      ▶ Run
    </button>
  );
};

export default RunButton;