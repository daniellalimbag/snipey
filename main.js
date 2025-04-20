const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const { PythonShell } = require('python-shell');
const fs = require('fs');
const DiscordNotifier = require('./discord-bot');
const credentials = require('./config/credentials.json');

const isDev = !app.isPackaged;
let mainWindow;
let pythonProcess = null;
let isRunning = false;
let discordBot = null;

function logPaths() {
  console.log('Application paths:');
  console.log('- App path:', app.getAppPath());
  console.log('- __dirname:', __dirname);
  console.log('- Resources path:', process.resourcesPath);
  console.log('- App data path:', app.getPath('userData'));
  console.log('- Executable path:', app.getPath('exe'));
  console.log('- isDev:', isDev);
}

function getPythonPath() {
  if (isDev) {
    return 'python';
  } else {
    const pythonExeName = process.platform === 'win32' ? 'python.exe' : 'python';
    const possiblePaths = [
      path.join(process.resourcesPath, 'python-dist', 'python-venv', 'Scripts', pythonExeName),
      path.join(process.resourcesPath, 'python-dist', 'python-venv', 'bin', pythonExeName),
      path.join(app.getAppPath(), '..', 'python-dist', 'python-venv', 'Scripts', pythonExeName),
      path.join(app.getAppPath(), '..', 'python-dist', 'python-venv', 'bin', pythonExeName)
    ];

    console.log('Possible Python paths:');
    possiblePaths.forEach(p => {
      const exists = fs.existsSync(p);
      console.log(`- ${p} (exists: ${exists})`);
    });

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        console.log('Using Python path:', p);
        return p;
      }
    }

    console.warn('No Python installation found, using default path');
    return process.platform === 'win32' ? 'python.exe' : 'python';
  }
}

function getScriptPath() {
  if (isDev) {
    return path.join(__dirname, 'script');
  } else {
    const possiblePaths = [
      path.join(process.resourcesPath, 'python-dist', 'script'),
      path.join(process.resourcesPath, 'script'),
      path.join(__dirname, 'python-dist', 'script')
    ];
    
    console.log('Checking script paths:');
    for (const p of possiblePaths) {
      const checkerPath = path.join(p, 'checker.py');
      const exists = fs.existsSync(checkerPath);
      console.log(`- ${checkerPath} (exists: ${exists})`);
      
      if (exists) {
        console.log(`Using script path: ${p}`);
        return p;
      }
    }
    
    console.warn('Script not found, using default path');
    return possiblePaths[0];
  }
}

function createWindow() {
  pythonPath = getPythonPath();
  scriptPath = getScriptPath();
  
  console.log('Final paths:');
  console.log('- Python path:', pythonPath);
  console.log('- Script path:', scriptPath);

  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  
  mainWindow.removeMenu();
  
  mainWindow.loadFile('index.html');
  
  // Open DevTools in production to help debug (turned off for packaging purposes)
  //if (isDev) {
  //  mainWindow.webContents.openDevTools();
  //}
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
  // this kills python processes
  if (pythonProcess) {
    pythonProcess.kill();
  }
  // shutdown discord bot
  if (discordBot) {
    discordBot.shutdown();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Setup Discord Bot
async function setupDiscordBot(channelId) {
  if (discordBot) {
    discordBot.shutdown();
  }
  
  discordBot = new DiscordNotifier(channelId);
  const success = await discordBot.initialize();
  
  if (success) {
    return true;
  } else {
    discordBot = null;
    return false;
  }
}

ipcMain.on('setup-discord', async (event, config) => {
  const { channelId, enabled } = config;
  
  if (!enabled) {
    if (discordBot) {
      discordBot.shutdown();
      discordBot = null;
    }
    event.reply('discord-status', { success: true, enabled: false });
    return;
  }
  
  if (!channelId) {
    event.reply('discord-status', { 
      success: false, 
      error: 'Missing Discord channel ID' 
    });
    return;
  }
  
  const success = await setupDiscordBot(channelId);
  
  if (success) {
    event.reply('discord-status', { success: true, enabled: true });
  } else {
    event.reply('discord-status', { 
      success: false, 
      error: 'Failed to initialize Discord bot. Check channel ID.' 
    });
  }
});

// Verify Python environment on startup
function verifyPythonEnvironment() {
  if (!pythonPath || !scriptPath) {
    console.error('Python paths not set correctly');
    return false;
  }
  
  const verifyScript = path.join(scriptPath, 'verify_env.py');
  
  if (!fs.existsSync(verifyScript)) {
    console.error(`Verification script not found at: ${verifyScript}`);
    return false;
  }
  
  try {
    const options = {
      mode: 'text',
      pythonPath: pythonPath,
      scriptPath: path.dirname(verifyScript)
    };
    
    console.log('Verifying Python environment...');
    PythonShell.run('verify_env.py', options).then(results => {
      console.log('Python environment verification:');
      results.forEach(line => console.log(`  ${line}`));
    }).catch(err => {
      console.error('Python verification failed:', err);
    });
    
    return true;
  } catch (error) {
    console.error('Error verifying Python environment:', error);
    return false;
  }
}

// Automatically verify Python on startup
app.whenReady().then(() => {
  setTimeout(() => {
    verifyPythonEnvironment();
  }, 2000); // Delay a bit to let window initialize
});

ipcMain.on('start-check', (event, config) => {
  // validate access key
  if (!config.access_key || config.access_key !== credentials.access_key) {
    event.reply('log-message', 'Invalid access key.');
    event.reply('check-ended');
    return;
  }
  if (isRunning) {
    event.reply('log-message', 'Already running a check...');
    return;
  }
  
  isRunning = true;
  event.reply('log-message', 'Starting course check...');
  
  // Verify paths again
  pythonPath = getPythonPath();
  scriptPath = getScriptPath();
  
  event.reply('log-message', `Using Python: ${pythonPath}`);
  event.reply('log-message', `Using script path: ${scriptPath}`);
  
  // Check if Python path exists
  if (!isDev && !fs.existsSync(pythonPath)) {
    event.reply('log-message', `Error: Python executable not found at: ${pythonPath}`);
    event.reply('log-message', 'Please make sure Python is properly installed with the application.');
    isRunning = false;
    event.reply('check-ended');
    return;
  }
  
  // Check if script path exists
  if (!fs.existsSync(scriptPath)) {
    event.reply('log-message', `Error: Script directory not found at: ${scriptPath}`);
    isRunning = false;
    event.reply('check-ended');
    return;
  }
  
  // Check if checker.py exists
  const checkerPath = path.join(scriptPath, 'checker.py');
  if (!fs.existsSync(checkerPath)) {
    event.reply('log-message', `Error: checker.py not found at: ${checkerPath}`);
    isRunning = false;
    event.reply('check-ended');
    return;
  }
  
  // save config to a temporary file
  const configPath = path.join(app.getPath('temp'), 'dlsu_config.json');
  fs.writeFileSync(configPath, JSON.stringify(config));
  
  const options = {
    mode: 'text',
    pythonPath: pythonPath,
    scriptPath: scriptPath,
    args: [configPath]
  };
  
  try {
    // the main python script runs
    pythonProcess = new PythonShell('checker.py', options);
    
    const { Notification } = require('electron');

    function showNotification(title, body, iconPath) {
      const notification = new Notification({
        title: title,
        body: body,
        icon: iconPath
      });
      
      notification.show();
      notification.on('click', () => {
        mainWindow.focus();
      });
    }

    pythonProcess.on('message', (message) => {
      try {
        const jsonData = JSON.parse(message);
        
        if (jsonData.event === 'class_available' && jsonData.data) {
          const courseCode = jsonData.data.course_code;
          const classCode = jsonData.data.class_code;
          
          event.reply('log-message', jsonData.message);
          event.reply('class-available', {
            courseCode: courseCode,
            classCode: classCode
          });
          
          showNotification(
            'Class Available!', 
            `${courseCode}-${classCode} is now OPEN for enrollment!`,
            'icon.png'
          );
          
          // send Discord notification for structured events
          if (discordBot) {
            discordBot.sendNotification(
              'Class Available!', 
              `${courseCode}-${classCode} is now OPEN for enrollment!`,
              { courseCode, classCode }
            );
          }
          
          mainWindow.flashFrame(true);
        } else {
          event.reply('log-message', jsonData.message || message);
        }
      } catch (e) {
        event.reply('log-message', message);
        
        if (message.includes('is OPEN for enrollment') && 
            !message.includes('Found available class') && 
            !message.includes('Found available classes! See summary')) {
          event.reply('class-available', true);
          showNotification('Class Available!', message, 'icon.png');
          
          let courseData = null;
          const match = message.match(/([A-Z]+)-(\d+)/);
          if (match && match.length >= 3) {
            courseData = {
              courseCode: match[1],
              classCode: match[2]
            };
          }
          
          if (discordBot) {
            discordBot.sendNotification('Class Available!', message, courseData);
          }
          
          mainWindow.flashFrame(true);
        }
      }
    });
    
    pythonProcess.on('stderr', (stderr) => {
      event.reply('log-message', `Error: ${stderr}`);
    });
    
    pythonProcess.end((err, code, signal) => {
      isRunning = false;
      if (err) {
        event.reply('log-message', `Process Error: ${err.message || err}`);
      }
      event.reply('check-ended');
      pythonProcess = null;
    });
  } catch (error) {
    event.reply('log-message', `Failed to start Python: ${error.message}`);
    isRunning = false;
    event.reply('check-ended');
  }
});

ipcMain.on('stop-check', (event) => {
  if (!isRunning || !pythonProcess) {
    event.reply('log-message', 'No check is currently running.');
    return;
  }
  
  pythonProcess.kill();
  pythonProcess = null;
  isRunning = false;
  event.reply('log-message', 'Stopped checking.');
  event.reply('check-ended');
});