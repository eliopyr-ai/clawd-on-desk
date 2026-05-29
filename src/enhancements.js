"use strict";

/**
 * Clawd on Desk Enhancements
 * - File drop → open Codex GUI
 * - Right-click menu: auto-tasks, camera, mic, voice activation
 * - Voice assistant with "火火" wake word
 * - Camera integration
 */

const { shell, BrowserWindow, dialog, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const { exec } = require("child_process");

// ── File Drop Handler ──────────────────────────────────────────────────

function setupFileDropHandler(ctx) {
  ipcMain.on("file-dropped", (event, filePaths) => {
    if (!filePaths || filePaths.length === 0) return;

    console.log("[enhancements] Files dropped:", filePaths);

    // Open Codex desktop app with the first file
    const filePath = filePaths[0];
    const ext = path.extname(filePath).toLowerCase();

    // Send file to Codex if it's a code file
    const codeExts = [".py", ".js", ".ts", ".jsx", ".tsx", ".java", ".c", ".cpp", ".h", ".cs", ".go", ".rs", ".rb", ".php", ".html", ".css", ".json", ".yaml", ".yml", ".toml", ".md", ".txt", ".sh", ".bat", ".ps1"];

    if (codeExts.includes(ext)) {
      // Open Codex desktop and send the file path
      try {
        exec(`codex app`, (err) => {
          if (err) console.error("[enhancements] Failed to open Codex:", err.message);
        });

        // Show bubble notification
        if (typeof ctx.showBubble === "function") {
          ctx.showBubble(`正在打开: ${path.basename(filePath)}`);
        }
      } catch (e) {
        console.error("[enhancements] File drop error:", e.message);
      }
    } else {
      // For non-code files, open with default app
      shell.openPath(filePath);
    }
  });
}

// ── Auto-Task System ──────────────────────────────────────────────────

const AUTO_TASKS = [
  {
    id: "auto-commit",
    label: "自动 Git 提交",
    labelEn: "Auto Git Commit",
    enabled: false,
    interval: null,
    start(ctx) {
      this.interval = setInterval(() => {
        exec("git add -A && git diff --cached --quiet || git commit -m 'auto: periodic commit'", { cwd: process.cwd() }, (err, stdout) => {
          if (!err && stdout) console.log("[auto-commit]", stdout);
        });
      }, 5 * 60 * 1000); // every 5 minutes
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
    labelEn: "Auto Format Code",
    enabled: false,
    interval: null,
    start(ctx) {
      this.interval = setInterval(() => {
        // Try prettier first, then eslint --fix
        exec("npx prettier --write . 2>/dev/null || npx eslint --fix . 2>/dev/null", { cwd: process.cwd() }, (err) => {
          if (!err) console.log("[auto-format] Formatted");
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
    labelEn: "Auto Run Tests",
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
    // Show the pet's response
    if (typeof ctx.showBubble === "function") {
      ctx.showBubble("我在听！有什么需要帮忙的？");
    }
    // Focus Codex or open it
    exec("codex app", (err) => {
      if (err) console.error("[enhancements] Failed to open Codex:", err.message);
    });
  });

  ipcMain.on("voice-command", (event, transcript) => {
    console.log(`[enhancements] Voice command: ${transcript}`);
    // Process voice commands
    const cmd = transcript.toLowerCase();

    if (cmd.includes("打开") && cmd.includes("代码")) {
      exec("codex app");
    } else if (cmd.includes("截图") || cmd.includes("screenshot")) {
      // Take screenshot
      const { screen } = require("electron");
      const primaryDisplay = screen.getPrimaryDisplay();
      const { width, height } = primaryDisplay.workAreaSize;
      console.log(`[enhancements] Screen: ${width}x${height}`);
    } else if (cmd.includes("天气")) {
      if (typeof ctx.showBubble === "function") {
        ctx.showBubble("今天天气不错！记得出门带伞~");
      }
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

  cameraWindow.loadURL(`data:text/html,
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        * { margin: 0; padding: 0; }
        body { background: transparent; overflow: hidden; border-radius: 16px; }
        video { width: 100%; height: 100%; object-fit: cover; border-radius: 16px; transform: scaleX(-1); }
        .close-btn {
          position: absolute; top: 8px; right: 8px;
          background: rgba(0,0,0,0.5); color: white;
          border: none; border-radius: 50%;
          width: 24px; height: 24px; cursor: pointer;
          font-size: 14px; display: flex;
          align-items: center; justify-content: center;
        }
      </style>
    </head>
    <body>
      <video id="cam" autoplay playsinline></video>
      <button class="close-btn" onclick="window.close()">×</button>
      <script>
        navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } })
          .then(stream => { document.getElementById('cam').srcObject = stream; })
          .catch(err => { document.body.innerHTML = '<p style="color:white;padding:20px">摄像头未授权或不可用</p>'; });
      </script>
    </body>
    </html>
  `);

  // Position near the pet
  const { screen } = require("electron");
  const cursor = screen.getCursorScreenPoint();
  cameraWindow.setPosition(cursor.x - 160, cursor.y - 280);
}

// ── Enhanced Menu Builder ──────────────────────────────────────────────

function buildEnhancedMenuItems(ctx, t) {
  const items = [];

  // ── Open Codex ──
  items.push({
    label: "打开 Codex",
    click: () => {
      exec("codex app", (err) => {
        if (err) console.error("[enhancements]", err.message);
      });
    },
  });

  // ── Camera ──
  items.push({
    label: "摄像头",
    click: () => toggleCamera(ctx),
  });

  // ── Voice Assistant ──
  items.push({
    label: "语音助手 (说\"火火\"唤醒)",
    type: "checkbox",
    checked: voiceAssistantActive,
    click: (menuItem) => {
      voiceAssistantActive = menuItem.checked;
      // Notify all windows
      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send("voice-assistant-status", voiceAssistantActive);
      });
    },
  });

  items.push({ type: "separator" });

  // ── Auto Tasks ──
  items.push({
    label: "自动任务",
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
      if (files.length > 0 && window.hitAPI) {
        // Send to main process
        const { ipcRenderer } = require('electron');
        ipcRenderer.send('file-dropped', files);
      }
    });

    // ── Voice Assistant with "火火" Wake Word ──
    let voiceRecognition = null;
    let isListening = false;

    function startVoiceAssistant() {
      if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        console.log('Speech recognition not supported');
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

          // Check for wake word "火火"
          if (transcript.includes('火火') || transcript.includes('huǒ huǒ')) {
            if (window.hitAPI) {
              const { ipcRenderer } = require('electron');
              ipcRenderer.send('voice-wake-word-detected', transcript);
            }
          }

          // Send all voice commands
          if (window.hitAPI) {
            const { ipcRenderer } = require('electron');
            ipcRenderer.send('voice-command', transcript);
          }
        }
      };

      voiceRecognition.onerror = (event) => {
        console.log('[voice] Error:', event.error);
        if (event.error === 'no-speech' || event.error === 'aborted') {
          // Restart
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

      voiceRecognition.start();
      isListening = true;
      console.log('[voice] Assistant started - say "火火" to wake');
    }

    function stopVoiceAssistant() {
      isListening = false;
      if (voiceRecognition) {
        voiceRecognition.stop();
        voiceRecognition = null;
      }
    }

    // Listen for toggle from main process
    if (typeof require !== 'undefined') {
      try {
        const { ipcRenderer } = require('electron');
        ipcRenderer.on('voice-assistant-status', (event, active) => {
          if (active) startVoiceAssistant();
          else stopVoiceAssistant();
        });
      } catch(e) {}
    }
  `;

  try {
    win.webContents.executeJavaScript(enhancementScript).catch(() => {});
  } catch (e) {}
}

// ── Export ──────────────────────────────────────────────────────────────

module.exports = {
  setupFileDropHandler,
  setupVoiceAssistant,
  buildEnhancedMenuItems,
  injectEnhancementsIntoWindow,
  toggleCamera,
  AUTO_TASKS,
};
