import React from 'react';
import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs/components/prism-core';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript'; // for syntax highlighting
import 'prismjs/themes/prism-tomorrow.css';
import './CodeEditor.css';

const CodeEditor = ({ code, setCode }) => {
  return (
    <div className="editor-container">
      <Editor
        value={code}
        onValueChange={code => setCode(code)}
        highlight={code => highlight(code, languages.js, 'js')}
        padding={10}
        className="editor"
        style={{
          fontFamily: '"Fira code", "Fira Mono", monospace',
          fontSize: 16,
        }}
      />
    </div>
  );
};

export default CodeEditor;