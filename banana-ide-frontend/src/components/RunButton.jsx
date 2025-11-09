import React from 'react';

const RunButton = ({ onRun }) => {
    return (
        <button onClick={onRun} style={{ backgroundColor: 'green', color: 'white', padding: '10px', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
            Run
        </button>
    );
};

export default RunButton;