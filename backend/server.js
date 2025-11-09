const express = require('express');
const cors = require('cors');
const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const execAsync = promisify(exec);
const app = express();
const PORT = 3001;

// Store active processes for interactive input
const activeProcesses = new Map();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Path to the Java source directory
const JAVA_SRC_DIR = path.join(__dirname, '../CornHacks2025/src');
const JAVA_CLASS_DIR = path.join(__dirname, '../CornHacks2025');

// Compile Java files if needed
async function compileJava() {
  try {
    // Compile all Java files in the src directory
    const bananalangFiles = [
      path.join(JAVA_SRC_DIR, 'bananalang', 'BananaInterpreter.java'),
      path.join(JAVA_SRC_DIR, 'bananalang', 'BananaParser.java'),
      path.join(JAVA_SRC_DIR, 'bananalang', 'BananaPreprocessor.java'),
      path.join(JAVA_SRC_DIR, 'bananalang', 'BananaLang.java')
    ].join(' ');
    
    const compileCommand = `javac -d ${JAVA_CLASS_DIR} -encoding UTF-8 ${path.join(JAVA_SRC_DIR, 'BananaAPI.java')} ${bananalangFiles}`;
    
    const { stdout, stderr } = await execAsync(compileCommand, {
      cwd: JAVA_SRC_DIR,
      maxBuffer: 1024 * 1024 * 10
    });
    
    if (stderr && !stderr.includes('warning') && !stderr.includes('Note:')) {
      console.warn('Compilation warnings:', stderr);
    }
  } catch (error) {
    console.error('Compilation error:', error.message);
    if (error.stderr) console.error('Compilation stderr:', error.stderr);
    if (error.stdout) console.error('Compilation stdout:', error.stdout);
    // Continue anyway - might already be compiled
  }
}

// Helper function to run Java with interactive input support
function runJavaWithInteractiveInput(classpath, tempFile, sessionId, onOutput, onInputNeeded) {
  return new Promise((resolve, reject) => {
    const javaProcess = spawn('java', [
      '-Dfile.encoding=UTF-8',
      '-cp', classpath,
      'BananaAPI',
      tempFile
    ], {
      cwd: JAVA_CLASS_DIR,
      encoding: 'utf8'
    });

    let stdout = '';
    let stderr = '';
    let outputBuffer = '';
    let lastOutputTime = Date.now();
    let checkInterval = null;

    // Store process info for input
    const processInfo = {
      process: javaProcess,
      stdin: javaProcess.stdin,
      outputBuffer: '',
      waitingForInput: false,
      lastPrompt: null,
      inputRequested: false,
      inputQueue: [] // Queue of inputs to send
    };
    activeProcesses.set(sessionId, processInfo);

    javaProcess.stdout.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      outputBuffer += text;
      processInfo.outputBuffer += text;
      lastOutputTime = Date.now();
      
      // Check for prompt patterns - prompts typically end with ": " or ":"
      const lines = outputBuffer.split('\n');
      outputBuffer = lines.pop() || '';
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        // Detect prompts like "1st number: ", "2nd number: ", "op: "
        if (line.endsWith(':') || line.endsWith(': ')) {
          // Found a prompt - the next PUSH_INPUT will need input
          processInfo.waitingForInput = true;
          processInfo.lastPrompt = line;
          processInfo.inputRequested = false; // Reset for new prompt
        }
      }
      
      // Call output callback if provided
      if (onOutput) {
        onOutput(text);
      }
    });

    javaProcess.stderr.on('data', (data) => {
      stderr += data.toString();
      if (onOutput) {
        onOutput(data.toString());
      }
    });

    javaProcess.stdin.setEncoding('utf8');

    // Monitor for when process is waiting for input
    checkInterval = setInterval(() => {
      const now = Date.now();
      const processInfo = activeProcesses.get(sessionId);
      
      if (!processInfo) {
        clearInterval(checkInterval);
        return;
      }
      
      // If no output for 300ms and we detected a prompt, request input (only once per prompt)
      if (now - lastOutputTime > 300 && processInfo.waitingForInput && !processInfo.inputRequested) {
        processInfo.inputRequested = true;
        if (onInputNeeded) {
          onInputNeeded(processInfo.lastPrompt || 'Input needed');
        }
      }
    }, 100);

    javaProcess.on('close', (code) => {
      clearInterval(checkInterval);
      activeProcesses.delete(sessionId);
      
      resolve({ 
        stdout, 
        stderr, 
        code,
        complete: true
      });
    });

    javaProcess.on('error', (error) => {
      clearInterval(checkInterval);
      activeProcesses.delete(sessionId);
      reject(error);
    });

    // Set timeout
    const timeout = setTimeout(() => {
      clearInterval(checkInterval);
      if (!javaProcess.killed) {
        javaProcess.kill('SIGTERM');
        setTimeout(() => {
          if (!javaProcess.killed) {
            javaProcess.kill('SIGKILL');
          }
        }, 1000);
      }
      activeProcesses.delete(sessionId);
      reject(new Error('Process timed out'));
    }, 30000);

    javaProcess.on('close', () => {
      clearTimeout(timeout);
    });
  });
}

// Helper to provide input to an active process
function provideInputToProcess(sessionId, inputToken) {
  const processInfo = activeProcesses.get(sessionId);
  if (!processInfo || !processInfo.process || processInfo.process.killed) {
    return { success: false, error: 'Process not found or terminated' };
  }

  try {
    if (processInfo.stdin.writable) {
      processInfo.stdin.write(inputToken + '\n');
      // Reset waiting flags - input has been provided
      processInfo.waitingForInput = false;
      processInfo.inputRequested = false;
      processInfo.lastPrompt = null;
      return { success: true };
    } else {
      return { success: false, error: 'Stdin not writable' };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// API endpoint to process Banana code with interactive input
app.post('/api/run', async (req, res) => {
  let tempFile = null;
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    const { code, sessionId: existingSessionId, inputToken } = req.body;
    
    // If this is a continuation with input, provide it to the existing process
    if (existingSessionId && inputToken !== undefined) {
      const result = provideInputToProcess(existingSessionId, inputToken);
      if (!result.success) {
        return res.status(400).json({ 
          error: result.error || 'Failed to provide input',
          output: result.error || 'Failed to provide input'
        });
      }
      // Return success - the process will continue and output will come via polling
      return res.json({ 
        success: true, 
        message: 'Input provided, continue polling for output',
        sessionId: existingSessionId
      });
    }
    
    if (!code) {
      return res.status(400).json({ error: 'No code provided', output: 'No code provided' });
    }

    // Create a temporary file to store the code
    tempFile = path.join(__dirname, 'temp_banana_code_' + Date.now() + '.txt');
    fs.writeFileSync(tempFile, code, 'utf8');

    try {
      // Compile Java files first
      await compileJava();

      // Run the Java program with the temp file path
      const classpath = `${JAVA_CLASS_DIR}:${path.join(JAVA_CLASS_DIR, 'bananalang')}`;
      
      let accumulatedOutput = '';
      let needsInput = false;
      let promptText = '';
      
      // Start the process with interactive input support
      const processPromise = runJavaWithInteractiveInput(
        classpath, 
        tempFile, 
        sessionId,
        (outputChunk) => {
          // Accumulate output as it comes
          accumulatedOutput += outputChunk;
        },
        (prompt) => {
          // Called when input is needed
          needsInput = true;
          promptText = prompt;
        }
      );

      // Wait a bit to see if we get output or need input
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Check if we need input
      const processInfo = activeProcesses.get(sessionId);
      if (processInfo && processInfo.waitingForInput) {
        // Return early asking for input
        return res.json({
          output: accumulatedOutput,
          needsInput: true,
          prompt: processInfo.lastPrompt || 'Input needed',
          sessionId: sessionId
        });
      }

      // Otherwise, wait for completion
      const result = await processPromise;
      
      // Clean up temp file
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
        tempFile = null;
      }

      // Combine stdout and stderr
      let output = accumulatedOutput || result.stdout || '';
      if (result.stderr && result.stderr.trim()) {
        if (!result.stderr.includes('warning') && !result.stderr.includes('Note:')) {
          output += (output ? '\n' : '') + result.stderr;
        }
      }

      res.json({ output: output || '', complete: true });
    } catch (execError) {
      // Clean up temp file
      if (tempFile && fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
        tempFile = null;
      }

      // Extract error message
      let errorOutput = '';
      if (execError.stdout) errorOutput += execError.stdout;
      if (execError.stderr) errorOutput += (errorOutput ? '\n' : '') + execError.stderr;
      if (!errorOutput) errorOutput = execError.message;

      console.error('Execution error:', errorOutput);

      // Return error with output
      res.status(500).json({ 
        error: 'Execution error', 
        output: errorOutput || 'Unknown error occurred'
      });
    }
  } catch (error) {
    // Clean up temp file if it exists
    if (tempFile && fs.existsSync(tempFile)) {
      try {
        fs.unlinkSync(tempFile);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    
    console.error('Server error:', error);
    res.status(500).json({ 
      error: 'Server error', 
      output: error.message || 'Unknown server error'
    });
  }
});

// API endpoint to get current output from a running process
app.get('/api/status/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const processInfo = activeProcesses.get(sessionId);
  
  if (!processInfo) {
    return res.json({ 
      complete: true, 
      output: '',
      message: 'Process not found or completed'
    });
  }
  
  if (processInfo.process.killed) {
    activeProcesses.delete(sessionId);
    return res.json({ 
      complete: true, 
      output: processInfo.outputBuffer || '',
      message: 'Process completed'
    });
  }
  
  res.json({
    complete: false,
    output: processInfo.outputBuffer || '',
    needsInput: processInfo.waitingForInput || false,
    prompt: processInfo.lastPrompt || null,
    sessionId: sessionId
  });
});

app.listen(PORT, () => {
  console.log(`🍌 Banana IDE Backend running on http://localhost:${PORT}`);
});

