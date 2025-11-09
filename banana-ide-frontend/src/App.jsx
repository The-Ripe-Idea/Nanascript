import React, { useState } from 'react';
import CodeEditor from './components/CodeEditor';
import Console from './components/Console';
import RunButton from './components/RunButton';

const App = () => {
    const [code, setCode] = useState('');
    const [output, setOutput] = useState('');

    const runCode = () => {
        // Here you would typically call the backend to execute the banana code
        // For demonstration, we'll just echo the code as output
        setOutput(`Output:\n${code}`);
    };

    return (
        <div style={{ padding: '20px' }}>
            <h1>Banana IDE</h1>
            <CodeEditor code={code} setCode={setCode} />
            <RunButton runCode={runCode} />
            <Console output={output} />
        </div>
    );
};

export default App;