const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
    // Renderer to Main (Invoke/Handle)
    setContext: (contextName) => ipcRenderer.invoke("set-context", contextName),
    getPods: (namespace) => ipcRenderer.invoke("get-pods", namespace),

    // Renderer to Main (Send)
    createTerminal: (podName, namespace, shell) => ipcRenderer.send("create-terminal", podName, namespace, shell),
    terminalInput: (termId, data) => ipcRenderer.send("terminal-input", termId, data),
    terminalResize: (termId, size) => ipcRenderer.send("terminal-resize", termId, size),
    closeTerminal: (termId) => ipcRenderer.send("close-terminal", termId),

    // Main to Renderer (on)
    onUpdateContexts: (callback) => ipcRenderer.on("update-contexts", (_event, value) => callback(value)),
    onShowError: (callback) => ipcRenderer.on("show-error", (_event, value) => callback(value)),
    onTerminalData: (callback) => ipcRenderer.on("terminal-data", (_event, termId, data) => callback(termId, data)),
    onTerminalExit: (callback) => ipcRenderer.on("terminal-exit", (_event, termId, message) => callback(termId, message)),
    onTerminalError: (callback) => ipcRenderer.on("terminal-error", (_event, podName, message) => callback(podName, message)),

    // Cleanup
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});

console.log("Preload script loaded.");

