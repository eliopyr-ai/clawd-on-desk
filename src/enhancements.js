"use strict";

/**
 * Clawd on Desk Enhancements v2
 * - File drop → open Codex GUI
 * - Right-click menu: auto-tasks, camera, mic, voice activation
 * - Voice assistant with "火火" wake word
 * - Camera integration with proper Electron permissions
 */

const { shell, BrowserWindow, dialog, ipcMain, session, screen } = require("electron");
const path = require("path");
const fs = require("fs");
const { exec, spawn } = require("child_process");

// ── Camera Permissions Setup ──────────────────────────────────────────

function setupCameraPermissions() {
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowedPermissions = ["media", "mediaKeySystem", "notifications"];
    if (allowedPermissions.includes(permission)) {
      callback(true);
    } else {
      callback(false);
    }
  });
}

// ── File Drop Handler ──────────────────────────────────────────────────

function setupFileDropHandler(ctx) {
  ipcMain.on("file-dropped", (event, filePaths) => {
    if (!filePaths || filePaths.length === 0) return;

    console.log("[enhancements] Files dropped:", filePaths);

    const filePath = filePaths[0];
    const ext = path.extname(filePath).toLowerCase();
    const codeExts = [".py", ".js", ".ts", ".jsx", ".tsx", ".java", ".c", ".cpp", ".h", ".cs", ".go", ".rs", ".rb", ".php", ".html", ".css", ".json", ".yaml", ".yml", ".toml", ".md", ".txt", ".sh", ".bat", ".ps1"];

    if (codeExts.includes(ext)) {
      exec("codex app", (err) => {
        if (err) console.error("[enhancements] Failed to open Codex:", err.message);
      });
    } else {
      shell.openPath(filePath);
    }
  });
}

// ── Auto-Task System ──────────────────────────────────────────────────

const AUTO_TASKS = [
  {
    id: "auto-commit",
    label: "自动 Git 提交",
    description: "每5分钟自动提交代码变更",
    enabled: false,
    interval: null,
    start(ctx) {
      this.interval = setInterval(() => {
        exec("git add -A && git diff --cached --quiet || git commit -m 'auto: periodic commit'", { cwd: process.cwd() }, (err, stdout) => {
          if (!err && stdout) console.log("[auto-commit]", stdout);
        });
      }, 5 * 60 * 1000);
      this.enabled = true;
    },
    stop() {
      if (this.interval) clearInterval(this.interval);
      this.interval = null;
      this.enabled = false;
    },
  },
  {
    id: "auto-format",
    label: "自动格式化代码",
    description: "每10分钟自动格式化代码",
    enabled: false,
    interval: null,
    start(ctx) {
      this.interval = setInterval(() => {
        exec("npx prettier --write . 2>/dev/null || npx eslint --fix . 2>/dev/null", { cwd: process.cwd() }, (err) => {
          if (!err) console.log("[auto-format] Done");
        });
      }, 10 * 60 * 1000);
      this.enabled = true;
    },
    stop() {
      if (this.interval) clearInterval(this.interval);
      this.interval = null;
      this.enabled = false;
    },
  },
  {
    id: "auto-test",
    label: "自动运行测试",
    description: "每15分钟自动运行测试",
    enabled: false,
    interval: null,
    start(ctx) {
      this.interval = setInterval(() => {
        exec("npm test 2>&1 | tail -5", { cwd: process.cwd() }, (err, stdout) => {
          console.log("[auto-test]", stdout || "No output");
        });
      }, 15 * 60 * 1000);
      this.enabled = true;
    },
    stop() {
      if (this.interval) clearInterval(this.interval);
      this.interval = null;
      this.enabled = false;
    },
  },
  {
    id: "auto-lint",
    label: "自动代码检查",
    description: "每10分钟自动运行 lint 检查",
    enabled: false,
    interval: null,
    start(ctx) {
      this.interval = setInterval(() => {
        exec("npx eslint . 2>&1 | head -20", { cwd: process.cwd() }, (err, stdout) => {
          if (stdout) console.log("[auto-lint]", stdout);
        });
      }, 10 * 60 * 1000);
      this.enabled = true;
    },
    stop() {
      if (this.interval) clearInterval(this.interval);
      this.interval = null;
      this.enabled = false;
    },
  },
  {
    id: "auto-build",
    label: "自动构建项目",
    description: "每20分钟自动构建项目",
    enabled: false,
    interval: null,
    start(ctx) {
      this.interval = setInterval(() => {
        exec("npm run build 2>&1 | tail -10", { cwd: process.cwd() }, (err, stdout) => {
          console.log("[auto-build]", stdout || "Build complete");
        });
      }, 20 * 60 * 1000);
      this.enabled = true;
    },
    stop() {
      if (this.interval) clearInterval(this.interval);
      this.interval = null;
      this.enabled = false;
    },
  },
  {
    id: "auto-backup",
    label: "自动备份文件",
    description: "每30分钟自动备份当前目录",
    enabled: false,
    interval: null,
    start(ctx) {
      this.interval = setInterval(() => {
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const backupDir = path.join(process.cwd(), ".backups", timestamp);
        fs.mkdirSync(backupDir, { recursive: true });
        exec(`xcopy /E /I /Q . "${backupDir}" 2>nul || cp -r . "${backupDir}"`, { cwd: process.cwd() }, (err) => {
          if (!err) console.log("[auto-backup] Backed up to", backupDir);
        });
      }, 30 * 60 * 1000);
      this.enabled = true;
    },
    stop() {
      if (this.interval) clearInterval(this.interval);
      this.interval = null;
      this.enabled = false;
    },
  },
  {
    id: "auto-cleanup",
    label: "自动清理临时文件",
    description: "每小时自动清理临时文件",
    enabled: false,
    interval: null,
    start(ctx) {
      this.interval = setInterval(() => {
        const patterns = ["*.tmp", "*.log", ".DS_Store", "Thumbs.db"];
        patterns.forEach(pattern => {
          exec(`del /Q ${pattern} 2>nul || rm -f ${pattern}`, { cwd: process.cwd() });
        });
        console.log("[auto-cleanup] Cleaned temp files");
      }, 60 * 60 * 1000);
      this.enabled = true;
    },
    stop() {
      if (this.interval) clearInterval(this.interval);
      this.interval = null;
      this.enabled = false;
    },
  },
  {
    id: "auto-sync",
    label: "自动 Git 拉取",
    description: "每10分钟自动拉取远程更新",
    enabled: false,
    interval: null,
    start(ctx) {
      this.interval = setInterval(() => {
        exec("git pull --rebase 2>&1", { cwd: process.cwd() }, (err, stdout) => {
          if (!err) console.log("[auto-sync]", stdout);
        });
      }, 10 * 60 * 1000);
      this.enabled = true;
    },
    stop() {
      if (this.interval) clearInterval(this.interval);
      this.interval = null;
      this.enabled = false;
    },
  },
  {
    id: "auto-deps",
    label: "自动检查依赖更新",
    description: "每小时检查依赖更新",
    enabled: false,
    interval: null,
    start(ctx) {
      this.interval = setInterval(() => {
        exec("npm outdated 2>&1 | head -10", { cwd: process.cwd() }, (err, stdout) => {
          if (stdout) console.log("[auto-deps]", stdout);
        });
      }, 60 * 60 * 1000);
      this.enabled = true;
    },
    stop() {
      if (this.interval) clearInterval(this.interval);
      this.interval = null;
      this.enabled = false;
    },
  },
];

function getAutoTaskMenuItems(ctx, t) {
  return AUTO_TASKS.map((task) => ({
    label: task.label,
    type: "checkbox",
    checked: task.enabled,
    click: (menuItem) => {
      if (menuItem.checked) {
        task.start(ctx);
        console.log(`[enhancements] Started: ${task.label}`);
      } else {
        task.stop();
        console.log(`[enhancements] Stopped: ${task.label}`);
      }
    },
  }));
}

// ── Voice Assistant ──────────────────────────────────────────────────

let voiceAssistantActive = false;

function setupVoiceAssistant(ctx) {
  ipcMain.on("voice-assistant-toggle", (event) => {
    voiceAssistantActive = !voiceAssistantActive;
    event.reply("voice-assistant-status", voiceAssistantActive);
    console.log(`[enhancements] Voice assistant: ${voiceAssistantActive ? "ON" : "OFF"}`);
  });

  ipcMain.on("voice-wake-word-detected", (event, transcript) => {
    console.log(`[enhancements] Wake word detected: ${transcript}`);
    exec("codex app", (err) => {
      if (err) console.error("[enhancements] Failed to open Codex:", err.message);
    });
  });

  ipcMain.on("voice-command", (event, transcript) => {
    console.log(`[enhancements] Voice command: ${transcript}`);
    const cmd = transcript.toLowerCase();

    if (cmd.includes("打开") && cmd.includes("代码")) {
      exec("codex app");
    } else if (cmd.includes("截图") || cmd.includes("screenshot")) {
      const primaryDisplay = screen.getPrimaryDisplay();
      const { width, height } = primaryDisplay.workAreaSize;
      console.log(`[enhancements] Screen: ${width}x${height}`);
    } else if (cmd.includes("天气")) {
      console.log("[enhancements] Weather command received");
    }
  });
}

// ── Camera Integration ──────────────────────────────────────────────────

let cameraWindow = null;

function toggleCamera(ctx) {
  if (cameraWindow && !cameraWindow.isDestroyed()) {
    cameraWindow.close();
    cameraWindow = null;
    return;
  }

  // Setup permissions before creating window
  setupCameraPermissions();

  cameraWindow = new BrowserWindow({
    width: 320,
    height: 240,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: true,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const cameraHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          background: #1a1a2e;
          overflow: hidden;
          border-radius: 16px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        .container {
          position: relative;
          width: 100%;
          height: 100vh;
        }
        video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 16px;
          transform: scaleX(-1);
        }
        .overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 12px;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .title {
          color: white;
          font-size: 14px;
          font-weight: 600;
          text-shadow: 0 1px 3px rgba(0,0,0,0.5);
        }
        .close-btn {
          background: rgba(255,255,255,0.2);
          color: white;
          border: none;
          border-radius: 50%;
          width: 28px;
          height: 28px;
          cursor: pointer;
          font-size: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          backdrop-filter: blur(10px);
          transition: background 0.2s;
        }
        .close-btn:hover {
          background: rgba(255,0,0,0.5);
        }
        .footer {
          display: flex;
          justify-content: center;
          gap: 12px;
        }
        .btn {
          background: rgba(255,255,255,0.2);
          color: white;
          border: none;
          border-radius: 20px;
          padding: 8px 16px;
          cursor: pointer;
          font-size: 12px;
          backdrop-filter: blur(10px);
          transition: background 0.2s;
        }
        .btn:hover {
          background: rgba(255,255,255,0.3);
        }
        .error {
          color: #ff6b6b;
          padding: 20px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100vh;
        }
        .error-icon {
          font-size: 48px;
          margin-bottom: 12px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <video id="cam" autoplay playsinline muted></video>
        <div class="overlay">
          <div class="header">
            <span class="title">📷 摄像头</span>
            <button class="close-btn" onclick="window.close()">×</button>
          </div>
          <div class="footer">
            <button class="btn" onclick="takeSnapshot()">📸 截图</button>
            <button class="btn" onclick="toggleMirror()">🔄 镜像</button>
          </div>
        </div>
      </div>
      <script>
        let isMirrored = true;
        const video = document.getElementById('cam');

        navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 240, facingMode: 'user' },
          audio: false
        })
        .then(stream => {
          video.srcObject = stream;
        })
        .catch(err => {
          document.body.innerHTML = '<div class="error"><div class="error-icon">📷</div><p>摄像头未授权或不可用</p><p style="font-size:12px;opacity:0.7;margin-top:8px">' + err.message + '</p></div>';
        });

        function takeSnapshot() {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          canvas.getContext('2d').drawImage(video, 0, 0);
          const link = document.createElement('a');
          link.download = 'snapshot-' + Date.now() + '.png';
          link.href = canvas.toDataURL('image/png');
          link.click();
        }

        function toggleMirror() {
          isMirrored = !isMirrored;
          video.style.transform = isMirrored ? 'scaleX(-1)' : 'scaleX(1)';
        }
      </script>
    </body>
    </html>
  `;

  cameraWindow.loadURL(`data:text/html,${encodeURIComponent(cameraHTML)}`);

  // Position near cursor
  const cursor = screen.getCursorScreenPoint();
  cameraWindow.setPosition(cursor.x - 160, cursor.y - 280);
}

// ── Enhanced Menu Builder ──────────────────────────────────────────────

function buildEnhancedMenuItems(ctx, t) {
  const items = [];

  // ── Open Codex ──
  items.push({
    label: "🤖 打开 Codex",
    click: () => {
      exec("codex app", (err) => {
        if (err) console.error("[enhancements]", err.message);
      });
    },
  });

  // ── Camera ──
  items.push({
    label: "📷 摄像头",
    click: () => toggleCamera(ctx),
  });

  // ── Voice Assistant ──
  items.push({
    label: "🎤 语音助手 (说\"火火\"唤醒)",
    type: "checkbox",
    checked: voiceAssistantActive,
    click: (menuItem) => {
      voiceAssistantActive = menuItem.checked;
      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send("voice-assistant-status", voiceAssistantActive);
      });
    },
  });

  items.push({ type: "separator" });

  // ── Auto Tasks ──
  items.push({
    label: "⚡ 自动任务",
    submenu: getAutoTaskMenuItems(ctx, t),
  });

  items.push({ type: "separator" });

  return items;
}

// ── Inject Voice/Camera UI into Pet Window ──────────────────────────────

function injectEnhancementsIntoWindow(win) {
  const enhancementScript = `
    // ── File Drop Handler ──
    document.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); });
    document.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const files = Array.from(e.dataTransfer.files).map(f => f.path);
      if (files.length > 0) {
        try {
          const { ipcRenderer } = require('electron');
          ipcRenderer.send('file-dropped', files);
        } catch(e) {}
      }
    });

    // ── Voice Assistant with "火火" Wake Word ──
    let voiceRecognition = null;
    let isListening = false;

    function startVoiceAssistant() {
      if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        console.log('[voice] Speech recognition not supported in this environment');
        return;
      }

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      voiceRecognition = new SpeechRecognition();
      voiceRecognition.continuous = true;
      voiceRecognition.interimResults = true;
      voiceRecognition.lang = 'zh-CN';

      voiceRecognition.onresult = (event) => {
        const last = event.results[event.results.length - 1];
        if (last.isFinal) {
          const transcript = last[0].transcript.trim();
          console.log('[voice]', transcript);

          if (transcript.includes('火火') || transcript.includes('huǒ huǒ')) {
            try {
              const { ipcRenderer } = require('electron');
              ipcRenderer.send('voice-wake-word-detected', transcript);
            } catch(e) {}
          }

          try {
            const { ipcRenderer } = require('electron');
            ipcRenderer.send('voice-command', transcript);
          } catch(e) {}
        }
      };

      voiceRecognition.onerror = (event) => {
        console.log('[voice] Error:', event.error);
        if (event.error === 'no-speech' || event.error === 'aborted') {
          setTimeout(() => {
            if (isListening && voiceRecognition) {
              try { voiceRecognition.start(); } catch(e) {}
            }
          }, 1000);
        }
      };

      voiceRecognition.onend = () => {
        if (isListening) {
          try { voiceRecognition.start(); } catch(e) {}
        }
      };

      try {
        voiceRecognition.start();
        isListening = true;
        console.log('[voice] Assistant started - say "火火" to wake');
      } catch(e) {
        console.log('[voice] Failed to start:', e);
      }
    }

    function stopVoiceAssistant() {
      isListening = false;
      if (voiceRecognition) {
        try { voiceRecognition.stop(); } catch(e) {}
        voiceRecognition = null;
      }
    }

    // Listen for toggle from main process
    try {
      const { ipcRenderer } = require('electron');
      ipcRenderer.on('voice-assistant-status', (event, active) => {
        if (active) startVoiceAssistant();
        else stopVoiceAssistant();
      });
    } catch(e) {}
  `;

  try {
    win.webContents.executeJavaScript(enhancementScript).catch(() => {});
  } catch (e) {}
}

// ── Export ──────────────────────────────────────────────────────────────

module.exports = {
  setupCameraPermissions,
  setupFileDropHandler,
  setupVoiceAssistant,
  buildEnhancedMenuItems,
  injectEnhancementsIntoWindow,
  toggleCamera,
  AUTO_TASKS,
};
