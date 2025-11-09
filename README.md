# Nanascript
A Banana-based esoteric programming language

## Setup and Running

### Prerequisites
- Node.js and npm
- Java JDK (for compiling and running the Banana interpreter)

### Running the Application

1. **Start the Backend Server:**
   ```bash
   cd backend
   npm install
   npm start
   ```
   The backend will run on `http://localhost:3001`

2. **Start the Frontend:**
   ```bash
   cd banana-ide-frontend
   npm install
   npm start
   ```
   The frontend will run on `http://localhost:3000` (or another port if 3000 is taken)

3. **Use the IDE:**
   - Type your Banana code in the code editor
   - Click the "▶ Run" button
   - View the output in the console window

### How It Works

1. When you click "Run", the frontend sends the code to the backend API
2. The backend writes the code to a temporary file
3. The backend compiles and runs the Java interpreter (`BananaAPI`)
4. The Java interpreter processes the code using the same pipeline as `Main.java`:
   - `BananaPreprocessor.process()` - processes the file
   - `BananaParser.parse()` - parses the code into commands
   - `BananaInterpreter.run()` - executes the commands
5. The output is captured and sent back to the frontend
6. The frontend displays the output in the console window
