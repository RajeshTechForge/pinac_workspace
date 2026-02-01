import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { app } from "electron";

class SecureMasterKeyManager {
  private static readonly KEY_FILE_NAME = "app-secret.key";

  static generateMasterKey(length: number = 64): string {
    return crypto.randomBytes(length).toString("hex");
  }

  static getPersistentMasterKey(): string {
    const userDataPath = app.getPath("userData");
    const keyFilePath = path.join(userDataPath, this.KEY_FILE_NAME);

    try {
      if (fs.existsSync(keyFilePath)) {
        return fs.readFileSync(keyFilePath, "utf8").trim();
      }

      const newMasterKey = this.generateMasterKey();
      fs.mkdirSync(userDataPath, { recursive: true });
      fs.writeFileSync(keyFilePath, newMasterKey, {
        mode: 0o600,
        encoding: "utf8",
      });

      return newMasterKey;
    } catch (error) {
      console.error("Failed to manage master key:", error);
      throw new Error("Could not generate or retrieve master key");
    }
  }

  static deriveMasterKey(masterKey: string, salt?: string): string {
    const finalSalt = salt || "default-app-salt";
    const iterations = 100000; // PBKDF2 iterations
    const keyLength = 64;

    return crypto
      .pbkdf2Sync(masterKey, finalSalt, iterations, keyLength, "sha512")
      .toString("hex");
  }
}

export default SecureMasterKeyManager;
