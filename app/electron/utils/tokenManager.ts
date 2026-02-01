import Store from "electron-store";
import * as crypto from "crypto";

class SecureTokenManager {
  private store: Store;
  private readonly encryptionKey: Buffer;
  private readonly IV_LENGTH: number = 16;
  private readonly ENCRYPTION_KEY_LENGTH: number = 32;

  constructor(masterKey: string = "your-secret-master-key") {
    // Generate a consistent encryption key from the master key
    const salt = crypto.scryptSync(
      masterKey,
      "fixed-salt",
      this.ENCRYPTION_KEY_LENGTH,
    );
    this.encryptionKey = salt;

    this.store = new Store({
      name: "pinac-secure-tokens",
    });
  }

  private encrypt(text: string): string {
    const iv = crypto.randomBytes(this.IV_LENGTH);
    const cipher = crypto.createCipheriv("aes-256-gcm", this.encryptionKey, iv);

    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    const authTag = cipher.getAuthTag();

    return `${iv.toString("hex")}:${encrypted}:${authTag.toString("hex")}`;
  }

  private decrypt(encryptedData: string): string {
    try {
      const [ivHex, encryptedText, authTagHex] = encryptedData.split(":");

      if (!ivHex || !encryptedText || !authTagHex) {
        throw new Error("Invalid encrypted data format");
      }

      const iv = Buffer.from(ivHex, "hex");
      const authTag = Buffer.from(authTagHex, "hex");

      const decipher = crypto.createDecipheriv(
        "aes-256-gcm",
        this.encryptionKey,
        iv,
      );

      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(encryptedText, "hex", "utf8");
      decrypted += decipher.final("utf8");

      return decrypted;
    } catch (error) {
      throw new Error("Failed to decrypt data: " + (error as Error).message);
    }
  }

  storeToken(tokenType: string, token: string): void {
    try {
      const encryptedToken = this.encrypt(token);
      this.store.set(tokenType, encryptedToken);
    } catch (error) {
      console.error(`Error storing ${tokenType}:`, error);
      throw new Error(`Failed to store ${tokenType}`);
    }
  }

  retrieveToken(tokenType: string): string | null {
    try {
      const encryptedToken = this.store.get(tokenType) as string | undefined;

      if (!encryptedToken) {
        return null;
      }

      return this.decrypt(encryptedToken);
    } catch (error) {
      console.error(`Error retrieving ${tokenType}:`, error);
      throw new Error(`Failed to retrieve ${tokenType}`);
    }
  }

  deleteToken(tokenType: string): void {
    try {
      this.store.delete(tokenType);
    } catch (error) {
      console.error(`Error deleting ${tokenType}:`, error);
      throw new Error(`Failed to delete ${tokenType}`);
    }
  }

  clearAllTokens(): void {
    try {
      this.store.clear();
    } catch (error) {
      console.error("Error clearing tokens:", error);
      throw new Error("Failed to clear all tokens");
    }
  }

  // Check if a token exists
  hasToken(tokenType: string): boolean {
    return this.store.has(tokenType);
  }

  getStoredTokenTypes(): string[] {
    return Object.keys(this.store.store);
  }
}

export default SecureTokenManager;
