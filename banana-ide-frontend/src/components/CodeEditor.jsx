import React, { useState } from 'react';

const CodeEditor = ({ code, setCode }) => {
    return (
        <div>
            <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                rows="10"
                cols="50"
                placeholder="Write your banana code here..."
            />
        </div>
    );
};

export default CodeEditor;