use aes_gcm::{
    Aes128Gcm, Nonce,
    aead::{Aead, KeyInit, OsRng},
};
use base64::{Engine, engine::general_purpose::STANDARD as B64};
use rand::RngCore;
use std::{fs, path::PathBuf};
use tauri::AppHandle;
use tauri::Manager;
use thiserror::Error;

/// Typed errors for secure-storage operations.
#[derive(Debug, Error)]
pub enum SecureStorageError {
    #[error("Failed to resolve app data directory: {0}")]
    DataDir(String),

    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Base64 decode error: {0}")]
    Base64(#[from] base64::DecodeError),

    #[error("Encryption failed")]
    Encrypt,

    #[error("Decryption failed — key may be corrupt or tampered")]
    Decrypt,

    #[error("Key file is malformed: expected <nonce_b64>:<ciphertext_b64>")]
    MalformedFile,
}

impl From<SecureStorageError> for String {
    fn from(err: SecureStorageError) -> String {
        err.to_string()
    }
}

// ---------------------------------------------------------------------------
// File-path helpers
// ---------------------------------------------------------------------------

/// Returns the path to the master key file (`api_key.key`) stored inside the
/// app's private data directory. The file contains 16 raw bytes (AES-128 key).
fn master_key_path(app: &AppHandle) -> Result<PathBuf, SecureStorageError> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| SecureStorageError::DataDir(e.to_string()))?;
    fs::create_dir_all(&dir)?;
    Ok(dir.join("api_key.key"))
}

/// Returns the path to the ciphertext file (`api_key.enc`). The file contains
/// a single line in the format `<nonce_base64>:<ciphertext_base64>`.
fn ciphertext_path(app: &AppHandle) -> Result<PathBuf, SecureStorageError> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| SecureStorageError::DataDir(e.to_string()))?;
    Ok(dir.join("api_key.enc"))
}

// ---------------------------------------------------------------------------
// Master key management
// ---------------------------------------------------------------------------

/// Loads the 16-byte AES-128 master key from disk, generating and persisting
/// a fresh random key the first time this is called.
///
/// The key file is created inside the OS-managed app data directory, which
/// is already inaccessible to other user accounts on all major platforms.
fn load_or_create_master_key(app: &AppHandle) -> Result<[u8; 16], SecureStorageError> {
    let path = master_key_path(app)?;

    if path.exists() {
        let raw = fs::read(&path)?;
        raw.try_into()
            .map_err(|_| SecureStorageError::MalformedFile)
    } else {
        let mut key = [0u8; 16];
        OsRng.fill_bytes(&mut key);
        fs::write(&path, key)?;
        Ok(key)
    }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/// Encrypts `plaintext` with AES-128-GCM and writes the result to disk.
///
/// A fresh 96-bit nonce is generated for every call. The output file stores
/// `<nonce_base64>:<ciphertext_base64>` so both values are recoverable.
pub fn encrypt_and_store(app: &AppHandle, plaintext: &str) -> Result<(), SecureStorageError> {
    let key_bytes = load_or_create_master_key(app)?;
    let cipher = Aes128Gcm::new_from_slice(&key_bytes)
        // Safety: key_bytes is exactly 16 bytes — new_from_slice only errors
        // on wrong length, which cannot happen here.
        .expect("AES-128 key is always 16 bytes");

    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_bytes())
        .map_err(|_| SecureStorageError::Encrypt)?;

    let encoded = format!("{}:{}", B64.encode(nonce_bytes), B64.encode(&ciphertext));
    fs::write(ciphertext_path(app)?, encoded)?;

    Ok(())
}

/// Reads the ciphertext file, decrypts it with AES-128-GCM, and returns the
/// plaintext API key.
///
/// Returns an error if the file is absent, malformed, or if decryption fails
/// (e.g., the key file was replaced or the ciphertext was tampered with).
///
/// Unused until the LLM commands are wired to forward the key to the API
/// gateway in the next implementation session.
#[allow(dead_code)]
pub fn load_and_decrypt(app: &AppHandle) -> Result<String, SecureStorageError> {
    let path = ciphertext_path(app)?;
    let raw = fs::read_to_string(&path)?;

    let (nonce_b64, ct_b64) = raw
        .split_once(':')
        .ok_or(SecureStorageError::MalformedFile)?;

    let nonce_bytes = B64.decode(nonce_b64.trim())?;
    let ciphertext = B64.decode(ct_b64.trim())?;

    let nonce_arr: [u8; 12] = nonce_bytes
        .try_into()
        .map_err(|_| SecureStorageError::MalformedFile)?;

    let key_bytes = load_or_create_master_key(app)?;
    let cipher = Aes128Gcm::new_from_slice(&key_bytes).expect("AES-128 key is always 16 bytes");

    let plaintext = cipher
        .decrypt(Nonce::from_slice(&nonce_arr), ciphertext.as_ref())
        .map_err(|_| SecureStorageError::Decrypt)?;

    String::from_utf8(plaintext).map_err(|_| SecureStorageError::Decrypt)
}

/// Returns `true` when an encrypted API key file exists
pub fn api_key_file_exists(app: &AppHandle) -> Result<bool, SecureStorageError> {
    let path = ciphertext_path(app)?;
    Ok(path.exists())
}
