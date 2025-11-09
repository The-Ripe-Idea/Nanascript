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

// (No changes to compileJava)
async function compileJava() {
  try {
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

    // let stdout = ''; // Redundant, we'll use processInfo.outputBuffer
    let stderr = '';
    let lastOutputTime = Date.now();
    let checkInterval = null;
    let processEnded = false; // Flag to stop interval

    // Store process info for input
    const processInfo = {
      process: javaProcess,
      stdin: javaProcess.stdin,
      outputBuffer: '',
      waitingForInput: false,
      lastPrompt: null,
      inputRequested: false, // Flag to ensure we only ask for input once
    };
    activeProcesses.set(sessionId, processInfo);

    javaProcess.stdout.on('data', (data) => {
      const text = data.toString();
      processInfo.outputBuffer += text;
      lastOutputTime = Date.now(); // Reset timer on any output
      
      if (onOutput) {
        onOutput(text);
      }
    });

    javaProcess.stderr.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      processInfo.outputBuffer += text; // Add stderr to the buffer too
      lastOutputTime = Date.now(); // Reset timer on any output
      
      if (onOutput) {
        onOutput(text);
      }
    });

    javaProcess.stdin.setEncoding('utf8');

    // Monitor for when process is waiting for input
    checkInterval = setInterval(() => {
      if (processEnded) {
        clearInterval(checkInterval);
        return;
      }
      
      const now = Date.now();
      const processInfo = activeProcesses.get(sessionId);
      
      if (!processInfo) {
        clearInterval(checkInterval);
        return;
      }
      
      // *** ROBUSTNESS FIX ***
      // If no output for 300ms and we haven't already requested input,
      // assume the process is waiting.
      if (now - lastOutputTime > 300 && !processInfo.inputRequested) {
        processInfo.inputRequested = true;
        processInfo.waitingForInput = true;
        // We can't reliably get the prompt, so use a generic one
        processInfo.lastPrompt = 'Input needed'; 
        
        if (onInputNeeded) {
          onInputNeeded(processInfo.lastPrompt);
        }
      }
    }, 100); // Check every 100ms

    javaProcess.on('close', (code) => {
      processEnded = true; // Stop the interval
      clearInterval(checkInterval);
      activeProcesses.delete(sessionId);
      
      resolve({ 
        stdout: processInfo.outputBuffer, // Use the full buffer
        stderr: stderr, // Stderr is already in outputBuffer, but we keep this for consistency
        code,
        complete: true
      });
    });

    javaProcess.on('error', (error) => {
      processEnded = true;
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

// (No changes to provideInputToProcess)
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
      processInfo.inputRequested = false; // Re-arm the detector
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
    
    // --- This is a new run ---
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

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
      
      // *** RACE CONDITION FIX ***
      // We will race the process completion against a promise
      // that resolves when onInputNeeded is called.
      
      let inputNeededResolver;
      const inputNeededPromise = new Promise(resolve => {
        inputNeededResolver = resolve;
      });
      
      // Start the process with interactive input support
      const processPromise = runJavaWithInteractiveInput(
        classpath, 
        tempFile, 
        sessionId,
        (outputChunk) => {
          // Don't need to do anything here, buffer is handled
        },
        (prompt) => {
          // Called when input is needed
          // Resolve the inputNeededPromise
          inputNeededResolver({ needsInput: true, prompt: prompt });
        }
      );

      // Wait for EITHER the process to end OR for input to be needed
      const raceResult = await Promise.race([processPromise, inputNeededPromise]);

      if (raceResult.needsInput) {
        // Input is needed. The process is still running.
        // Don't delete the temp file.
        const processInfo = activeProcesses.get(sessionId);
        return res.json({
          output: processInfo ? processInfo.outputBuffer : '',
          needsInput: true,
          prompt: raceResult.prompt || 'Input needed',
          sessionId: sessionId
        });
      }
      
      // Otherwise, the process finished (raceResult is the result from processPromise)
      const result = raceResult; // for clarity

      // Clean up temp file
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
        tempFile = null;
      }

      // Combine stdout and stderr (already in result.stdout)
      let output = result.stdout || '';
      
      res.json({ output: output || '', complete: true });

    } catch (execError) {
      if (tempFile && fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
        tempFile = null;
      }
      let errorOutput = '';
      if (execError.stdout) errorOutput += execError.stdout;
      if (execError.stderr) errorOutput += (errorOutput ? '\n' : '') + execError.stderr;
      if (!errorOutput) errorOutput = execError.message;
      console.error('Execution error:', errorOutput);
      res.status(500).json({ 
        error: 'Execution error', 
        output: errorOutput || 'Unknown error occurred'
      });
    }
  } catch (error) {
    if (tempFile && fs.existsSync(tempFile)) {
      try { fs.unlinkSync(tempFile); } catch (e) { /* ignore */ }
    }
    console.error('Server error:', error);
    res.status(500).json({ 
      error: 'Server error', 
      output: error.message || 'Unknown server error'
    });
  }
});

// (No changes to /api/status/:sessionId)
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

