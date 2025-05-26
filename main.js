const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const k8s = require('@kubernetes/client-node');
const pty = require('node-pty');

let mainWindow;
let currentKubeConfig;
let currentContextName;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      enableRemoteModule: false,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('index.html');

  // Open DevTools - remove for production
  // mainWindow.webContents.openDevTools();

  mainWindow.on('closed', function () {
    mainWindow = null;
  });

  // Load kubeconfig and contexts on startup
  try {
    currentKubeConfig = new k8s.KubeConfig();
    currentKubeConfig.loadFromDefault();
    const contexts = currentKubeConfig.getContexts();
    mainWindow.webContents.on('did-finish-load', () => {
      mainWindow.webContents.send('update-contexts', contexts.map(c => c.name));
      // Set initial context if needed
      if (contexts.length > 0) {
        setContext(contexts[0].name);
      }
    });
  } catch (error) {
    console.error('Error loading kubeconfig:', error);
    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.send('show-error', `Error loading kubeconfig: ${error.message}`);
    });
  }
}

// --- IPC Handlers ---

// Handle context selection from renderer
ipcMain.handle('set-context', async (event, contextName) => {
  return setContext(contextName);
});

// Handle pod fetching request from renderer
ipcMain.handle('get-pods', async (event, namespace = 'default') => {
  if (!currentKubeConfig || !currentContextName) {
    return { success: false, error: 'No context selected or kubeconfig not loaded.' };
  }
  try {
    const k8sApi = currentKubeConfig.makeApiClient(k8s.CoreV1Api);
    const res = await k8sApi.listNamespacedPod(namespace);
    return { success: true, pods: res.body.items.map(p => ({ name: p.metadata.name, status: p.status.phase })) };
  } catch (error) {
    console.error(`Error fetching pods in namespace ${namespace}:`, error);
    return { success: false, error: `Error fetching pods: ${error.message}` };
  }
});

// Handle terminal creation
const terminals = {};
ipcMain.on('create-terminal', (event, podName, namespace = 'default', shell = '/bin/sh') => {
    if (!currentKubeConfig || !currentContextName) {
        event.sender.send('terminal-error', podName, 'No context selected or kubeconfig not loaded.');
        return;
    }

    const kcExec = new k8s.Exec(currentKubeConfig);
    const termId = `${namespace}-${podName}`;

    // Use node-pty to create a pseudo-terminal
    const ptyProcess = pty.spawn('kubectl', [
        'exec',
        '-it',
        podName,
        `-n=${namespace}`,
        '--context', currentContextName,
        '--', shell
    ], {
        name: 'xterm-color',
        cols: 80,
        rows: 30,
        cwd: process.env.HOME,
        env: process.env
    });

    terminals[termId] = ptyProcess;

    ptyProcess.onData((data) => {
        event.sender.send('terminal-data', termId, data);
    });

    ptyProcess.onExit(({ exitCode, signal }) => {
        event.sender.send('terminal-exit', termId, `Exited with code: ${exitCode}, signal: ${signal}`);
        delete terminals[termId];
    });

    console.log(`Terminal created for pod: ${podName} in namespace: ${namespace}`);
});

// Handle terminal input
ipcMain.on('terminal-input', (event, termId, data) => {
    if (terminals[termId]) {
        terminals[termId].write(data);
    }
});

// Handle terminal resize
ipcMain.on('terminal-resize', (event, termId, { cols, rows }) => {
    if (terminals[termId]) {
        terminals[termId].resize(cols, rows);
    }
});

// Handle terminal close
ipcMain.on('close-terminal', (event, termId) => {
    if (terminals[termId]) {
        terminals[termId].kill();
        delete terminals[termId];
        console.log(`Terminal closed: ${termId}`);
    }
});

// --- Helper Functions ---
function setContext(contextName) {
  if (!currentKubeConfig) {
    return { success: false, error: 'Kubeconfig not loaded.' };
  }
  try {
    currentKubeConfig.setCurrentContext(contextName);
    currentContextName = contextName;
    console.log(`Switched context to: ${contextName}`);
    // Optionally trigger pod refresh here if needed
    // mainWindow.webContents.send('context-changed', contextName);
    return { success: true, context: contextName };
  } catch (error) {
    console.error(`Error setting context to ${contextName}:`, error);
    return { success: false, error: `Error setting context: ${error.message}` };
  }
}

// --- App Lifecycle ---
app.on('ready', createWindow);

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', function () {
  if (mainWindow === null) {
    createWindow();
  }
});

