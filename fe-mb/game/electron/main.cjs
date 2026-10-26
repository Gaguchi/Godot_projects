// Electron shell for FE_MB — a fully LOCKED window: fixed 1280x720, not
// resizable, not maximizable, not fullscreenable, and NOT movable (the window
// cannot be dragged). Chosen over Tauri because Tauri's Windows toolchain
// (Rust + MSVC build tools, ~6 GB) does not fit on this machine's nearly-full
// C: drive, whereas Electron installs entirely via npm onto E:.
//
// TWO MODES.
//   dev  (default)  — loads the vite dev server (pinned to 5184 via strictPort
//                     in vite.config.ts; 5173 belongs to another app here).
//   prod (--dist)   — SERVES ../dist over http on a free loopback port and
//                     loads that. The build cannot be opened as a file:// page:
//                     index.html pulls its bundle as an ES module (blocked from
//                     an opaque file origin) and the game asks for sprites, art
//                     and fonts by ROOT-absolute path (/sprites/…), which under
//                     file:// resolve to the drive root. A server is the fix,
//                     so the shell carries a 40-line one instead of a dependency.
// FEMB_URL overrides both (e.g. point at `npm run preview`).
const { app, BrowserWindow, Menu } = require('electron')
const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')

const DIST = path.join(__dirname, '..', 'dist')
const useDist = process.argv.includes('--dist')

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
}

/** Serve `dist` on 127.0.0.1 with an ephemeral port; resolves to the base URL. */
function serveDist() {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(path.join(DIST, 'index.html'))) {
      reject(new Error(`no build at ${DIST} — run "npm run build" first`))
      return
    }
    const server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', 'http://127.0.0.1')
      const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '')
      // every unknown path falls back to index.html (single page), and nothing
      // outside dist is ever readable
      const target = path.resolve(DIST, rel === '' ? 'index.html' : rel)
      const inside = target === DIST || target.startsWith(DIST + path.sep)
      const file = inside && fs.existsSync(target) && fs.statSync(target).isFile() ? target : path.join(DIST, 'index.html')
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      })
      fs.createReadStream(file).pipe(res)
    })
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      app.on('will-quit', () => server.close())
      const url = `http://127.0.0.1:${port}/`
      console.log(`[fe_mb] serving ${DIST} at ${url}`)
      resolve(url)
    })
  })
}

function createWindow(url) {
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
  void win.loadURL(url)
  return win
}

async function start() {
  const url = process.env.FEMB_URL || (useDist ? await serveDist() : 'http://localhost:5184/')
  createWindow(url)
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(url) })
}

app.whenReady().then(start).catch((err) => {
  // A missing build or a taken port must say so instead of opening a black window.
  console.error(String(err && err.message ? err.message : err))
  app.exit(1)
})

app.on('window-all-closed', () => { app.quit() })
