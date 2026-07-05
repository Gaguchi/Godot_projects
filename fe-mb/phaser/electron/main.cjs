// Electron shell for FE_MB — a fully LOCKED window: fixed 1280x720, not
// resizable, not maximizable, not fullscreenable, and NOT movable (the window
// cannot be dragged). Chosen over Tauri because Tauri's Windows toolchain
// (Rust + MSVC build tools, ~6 GB) does not fit on this machine's nearly-full
// C: drive, whereas Electron installs entirely via npm onto E:.
//
// Loads the dev server by default; set FEMB_URL to point elsewhere (e.g. a
// built+previewed dist for a production-feel launch).
const { app, BrowserWindow, Menu } = require('electron')

const URL = process.env.FEMB_URL || 'http://localhost:5174/'

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    useContentSize: true,     // 1280x720 is the CONTENT area -> game renders at 1x, crisp
    resizable: false,
    movable: false,           // <-- the requested lock: window cannot be moved
    maximizable: false,
    fullscreenable: false,
    minimizable: true,
    center: true,
    title: 'FE_MB',
    autoHideMenuBar: true,
    backgroundColor: '#050403',
    webPreferences: { contextIsolation: true },
  })
  Menu.setApplicationMenu(null)
  void win.loadURL(URL)
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('window-all-closed', () => { app.quit() })
