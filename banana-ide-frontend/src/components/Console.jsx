import React from 'react';

const Console = ({ output }) => {
    return (
        <div style={{ border: '1px solid #ccc', padding: '10px', height: '200px', overflowY: 'scroll', backgroundColor: '#f9f9f9' }}>
            <h3>Console Output</h3>
            <pre>{output}</pre>
        </div>
    );
};

export default Console;