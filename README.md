# Boat Desktop

A simple Kubernetes cluster management desktop application built with Electron.

This application allows you to:

1.  List Kubernetes contexts (clusters) found in your `~/.kube/config` file.
2.  Select a context to view pods in the default namespace.
3.  Open an interactive terminal session into a selected pod.

## Prerequisites

*   Node.js and npm (or yarn)
*   `kubectl` installed and configured with access to your Kubernetes cluster(s).
*   A valid `~/.kube/config` file.

## Installation & Running

1.  **Clone the repository (or download the source code):**
    ```bash
    git clone https://github.com/agaragon/boat-desktop.git
    cd boat-desktop
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```
    *Note: This step might involve rebuilding native modules like `node-pty` for Electron compatibility. If you encounter issues, ensure you have build tools (like `build-essential` on Debian/Ubuntu or Xcode Command Line Tools on macOS) installed.*

3.  **Run the application:**
    ```bash
    npm start
    ```

## Features

*   **Context Selection:** Choose the desired Kubernetes context from the dropdown list in the sidebar.
*   **Pod Listing:** Once a context is selected, the pods in the `default` namespace will be listed below the context selector.
*   **Pod Terminal:** Click the "Open Terminal" button next to a pod to open an interactive shell session within that pod in the main panel.

## Notes

*   The application currently only lists pods from the `default` namespace.
*   Error messages related to cluster connection or `kubectl` execution will be displayed in a notification area at the bottom of the window.

