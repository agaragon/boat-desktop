const { Terminal } = require("xterm");
const { FitAddon } = require("xterm-addon-fit");

const contextSelect = document.getElementById("context-select");
const podListDiv = document.getElementById("pod-list");
const terminalContainer = document.getElementById("terminal-container");
const errorDisplay = document.getElementById("error-display");

let currentPods = [];
let activeTerminal = null;
let activeTermId = null;
const fitAddon = new FitAddon();

// --- Error Handling ---
function showError(message) {
    errorDisplay.textContent = message;
    errorDisplay.style.display = "block";
    // Hide error after 5 seconds
    setTimeout(() => {
        errorDisplay.style.display = "none";
    }, 5000);
}

// --- Context Handling ---
window.electronAPI.onUpdateContexts((contexts) => {
    console.log("Received contexts:", contexts);
    contextSelect.innerHTML = ""; // Clear previous options
    if (contexts && contexts.length > 0) {
        contexts.forEach(context => {
            const option = document.createElement("option");
            option.value = context;
            option.textContent = context;
            contextSelect.appendChild(option);
        });
        // Automatically select the first context and load pods
        if (contextSelect.options.length > 0) {
            contextSelect.value = contextSelect.options[0].value;
            handleContextChange();
        }
    } else {
        const option = document.createElement("option");
        option.textContent = "No contexts found";
        option.disabled = true;
        contextSelect.appendChild(option);
        podListDiv.innerHTML = "<p>No contexts found in kubeconfig.</p>";
    }
});

contextSelect.addEventListener("change", handleContextChange);

async function handleContextChange() {
    const selectedContext = contextSelect.value;
    if (!selectedContext) return;

    console.log(`Context selected: ${selectedContext}`);
    podListDiv.innerHTML = "<p>Loading pods...</p>"; // Show loading state
    clearTerminal(); // Clear terminal when context changes

    try {
        const result = await window.electronAPI.setContext(selectedContext);
        if (result.success) {
            console.log(`Successfully set context to: ${result.context}`);
            fetchPods(); // Fetch pods for the new context
        } else {
            showError(`Failed to set context: ${result.error}`);
            podListDiv.innerHTML = `<p>Error setting context: ${result.error}</p>`;
        }
    } catch (error) {
        showError(`Error setting context: ${error.message}`);
        podListDiv.innerHTML = `<p>Error setting context: ${error.message}</p>`;
        console.error("Error setting context:", error);
    }
}

// --- Pod Handling ---
async function fetchPods(namespace = "default") {
    console.log(`Fetching pods for namespace: ${namespace}`);
    try {
        const result = await window.electronAPI.getPods(namespace);
        if (result.success) {
            currentPods = result.pods;
            console.log("Received pods:", currentPods);
            displayPods(currentPods);
        } else {
            showError(`Failed to fetch pods: ${result.error}`);
            podListDiv.innerHTML = `<p>Error fetching pods: ${result.error}</p>`;
        }
    } catch (error) {
        showError(`Error fetching pods: ${error.message}`);
        podListDiv.innerHTML = `<p>Error fetching pods: ${error.message}</p>`;
        console.error("Error fetching pods:", error);
    }
}

function displayPods(pods) {
    podListDiv.innerHTML = ""; // Clear previous list
    if (!pods || pods.length === 0) {
        podListDiv.innerHTML = "<p>No pods found in the default namespace.</p>";
        return;
    }

    const ul = document.createElement("ul");
    pods.forEach(pod => {
        const li = document.createElement("li");
        li.textContent = `${pod.name} (${pod.status})`;

        const button = document.createElement("button");
        button.textContent = "Open Terminal";
        button.onclick = () => openTerminalForPod(pod.name);

        li.appendChild(button);
        ul.appendChild(li);
    });
    podListDiv.appendChild(ul);
}

// --- Terminal Handling ---
function openTerminalForPod(podName, namespace = "default", shell = "/bin/sh") {
    console.log(`Requesting terminal for pod: ${podName}`);
    clearTerminal(); // Clear existing terminal before opening a new one

    activeTermId = `${namespace}-${podName}`;
    activeTerminal = new Terminal({
        cursorBlink: true,
        rows: 20, // Initial rows, FitAddon will adjust
        theme: {
            background: "#1e1e1e",
            foreground: "#d4d4d4"
        }
    });

    activeTerminal.loadAddon(fitAddon);
    activeTerminal.open(terminalContainer);
    fitAddon.fit(); // Adjust size

    // Send create request to main process
    window.electronAPI.createTerminal(podName, namespace, shell);

    activeTerminal.onData(data => {
        // User typed in terminal -> send to main process
        window.electronAPI.terminalInput(activeTermId, data);
    });

    activeTerminal.focus();
}

function clearTerminal() {
    if (activeTerminal) {
        window.electronAPI.closeTerminal(activeTermId); // Request main process to kill pty
        activeTerminal.dispose();
        activeTerminal = null;
        activeTermId = null;
    }
    terminalContainer.innerHTML = "<p>Select a pod and click 'Open Terminal' to start.</p>"; // Reset placeholder
}

// Listen for data from the main process terminal
window.electronAPI.onTerminalData((termId, data) => {
    if (activeTerminal && termId === activeTermId) {
        activeTerminal.write(data);
    }
});

// Listen for terminal exit from the main process
window.electronAPI.onTerminalExit((termId, message) => {
    if (termId === activeTermId) {
        console.log(`Terminal exited: ${message}`);
        showError(`Terminal session for ${termId.split('-').slice(1).join('-')} ended: ${message}`);
        clearTerminal();
    }
});

// Listen for terminal creation errors
window.electronAPI.onTerminalError((podName, message) => {
    showError(`Terminal error for ${podName}: ${message}`);
    clearTerminal();
});

// Listen for general errors from main process
window.electronAPI.onShowError((message) => {
    showError(message);
});

// Adjust terminal size on window resize
window.addEventListener("resize", () => {
    if (activeTerminal) {
        fitAddon.fit();
        // Inform the main process/pty about the resize
        window.electronAPI.terminalResize(activeTermId, { cols: activeTerminal.cols, rows: activeTerminal.rows });
    }
});

// Initial setup
console.log("Renderer script loaded.");
// Initial context load is triggered by main process sending 'update-contexts'

