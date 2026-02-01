import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import * as fs from "fs";

import { createMainWindow } from "./windows/mainWindow";
import { registerUserHandlers } from "./ipc/user";
import { registerFileHandlers } from "./ipc/file";
import { registerWindowHandlers } from "./ipc/window";
import { registerAiHandlers } from "./ipc/ai";
import { registerSettingsHandlers } from "./ipc/settings";
import SecureMasterKeyManager from "./utils/masterKeyManager";
import SecureTokenManager from "./utils/tokenManager";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

process.env.APP_ROOT = path.join(__dirname, "..");

export const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");

let mainWindow: BrowserWindow | null = null;

// Register IPC Handlers
registerUserHandlers();
registerFileHandlers();
registerAiHandlers();
registerSettingsHandlers();

const initWindow = () => {
  mainWindow = createMainWindow(
    path.join(__dirname, "preload.js"),
    RENDERER_DIST,
    VITE_DEV_SERVER_URL,
  );

  // Register handlers that need window instance
  registerWindowHandlers(mainWindow);
};

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    mainWindow = null;
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    initWindow();
  }
});

// =========================================================================== //
//                                                                             //
//                      Authentication (using Deep Link)                       //
//                                                                             //
// =========================================================================== //

const userDataPath = app.getPath("userData");
const masterKey = SecureMasterKeyManager.getPersistentMasterKey();
const derivedKey = SecureMasterKeyManager.deriveMasterKey(masterKey);
const tokenManager = new SecureTokenManager(derivedKey);

// App startup Auth Checking
ipcMain.handle("check-auth", async () => {
  const status = tokenManager.hasToken("idToken");
  return status;
});

ipcMain.handle("logout", async () => {
  try {
    fs.unlink(path.join(userDataPath, "user-info.json"), () => {});
    tokenManager.clearAllTokens();
    return true;
  } catch (error) {
    console.error("Logout failed", error);
    return false;
  }
});

// Registering app's custom protocol (MUST be before app.whenReady() on Linux)
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient("pinac-workspace", process.execPath, [
      path.resolve(process.argv[1]),
    ]);
  }
} else {
  app.setAsDefaultProtocolClient("pinac-workspace");
}

app.whenReady().then(async () => {
  initWindow();
});

// for Windows and Linux
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", (_, commandLine) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    const url = commandLine.pop();
    if (url) {
      parseAuthDataFromUrl(url);
    } else {
      dialog.showErrorBox(
        "Error",
        "Something went wrong, unable to authenticate. Please try again.",
      );
    }
  });
}

// for MacOS
app.on("open-url", (event, url) => {
  event.preventDefault();
  parseAuthDataFromUrl(url);
});

//   Parse Auth data from URL
// -----------------------------

const parseAuthDataFromUrl = (url: string) => {
  const urlObj = new URL(url);
  const encodedData = urlObj.searchParams.get("data");
  if (encodedData) {
    const authData = JSON.parse(decodeURIComponent(encodedData));
    //  Storing user-info
    const userInfo = {
      displayName: authData.displayName,
      email: authData.email,
      bio: "",
      photoURL: authData.photoUrl,
    };
    const userInfoJson = JSON.stringify(userInfo);
    fs.writeFileSync(path.join(userDataPath, "user-info.json"), userInfoJson);
    //    Storing TOKEN
    try {
      tokenManager.storeToken("idToken", authData.idToken);
      tokenManager.storeToken("refreshToken", authData.refreshToken);
      tokenManager.storeToken("webApiKey", authData.webApiKey);
      mainWindow?.reload();
    } catch (error) {
      console.error("Token handling error:", error);
    }
  } else {
    dialog.showErrorBox(
      "Error",
      "Something went wrong, unable to authenticate. Please try again.",
    );
  }
};
