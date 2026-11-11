const { app, BrowserWindow, shell } = require("electron");
const path = require("path");

// In development (`npm start`) load the CRA dev server; the packaged app
// loads the static build.
const DEV_URL = process.env.ELECTRON_START_URL || "http://localhost:3000";

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: "CosIng Checker",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (app.isPackaged) {
    win.loadFile(path.join(__dirname, "..", "build", "index.html"));
  } else {
    win.loadURL(DEV_URL);
  }

  // Links such as CosIng pages and SCCS opinions open in the system browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
