use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes128Gcm, Nonce,
};
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use rand::RngCore;
use std::{fs, path::PathBuf};
use tauri::AppHandle;
use tauri::Manager;
use thiserror::Error;

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

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

    #[error("Invalid key name \"{0}\": must be non-empty and contain only ASCII alphanumerics or underscores")]
    InvalidKeyName(String),
}

impl From<SecureStorageError> for String {
    fn from(err: SecureStorageError) -> String {
        err.to_string()
    }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

fn validate_key_name(key_name: &str) -> Result<(), SecureStorageError> {
    if key_name.is_empty()
        || !key_name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '_')
    {
        return Err(SecureStorageError::InvalidKeyName(key_name.to_string()));
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// File-path helpers
// ---------------------------------------------------------------------------

/// Returns the app's private data directory, creating it if absent.
fn app_data_dir(app: &AppHandle) -> Result<PathBuf, SecureStorageError> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| SecureStorageError::DataDir(e.to_string()))?;
    fs::create_dir_all(&dir)?;
    Ok(dir)
}

/// Returns the path to the shared AES-128 master key file (`master.key`).
fn master_key_path(app: &AppHandle) -> Result<PathBuf, SecureStorageError> {
    Ok(app_data_dir(app)?.join("master.key"))
}

/// Returns the path to the ciphertext file for the given `key_name`.
fn ciphertext_path(app: &AppHandle, key_name: &str) -> Result<PathBuf, SecureStorageError> {
    Ok(app_data_dir(app)?.join(format!("{key_name}.enc")))
}

// ---------------------------------------------------------------------------
// Master key management
// ---------------------------------------------------------------------------

/// Loads the 16-byte AES-128 master key from disk, generating and persisting
/// a fresh random key the first time this is called.
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

/// Encrypts `plaintext` with AES-128-GCM and writes the result to
/// `<app_data_dir>/<key_name>.enc`.
pub fn encrypt_and_store(
    app: &AppHandle,
    key_name: &str,
    plaintext: &str,
) -> Result<(), SecureStorageError> {
    validate_key_name(key_name)?;

    let key_bytes = load_or_create_master_key(app)?;
    let cipher = Aes128Gcm::new_from_slice(&key_bytes)
        .expect("AES-128 key is always 16 bytes");

    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_bytes())
        .map_err(|_| SecureStorageError::Encrypt)?;

    let encoded = format!("{}:{}", B64.encode(nonce_bytes), B64.encode(&ciphertext));
    fs::write(ciphertext_path(app, key_name)?, encoded)?;

    Ok(())
}

/// Reads `<app_data_dir>/<key_name>.enc`, decrypts it with AES-128-GCM, and
/// returns the plaintext API key.
pub fn load_and_decrypt(
    app: &AppHandle,
    key_name: &str,
) -> Result<String, SecureStorageError> {
    validate_key_name(key_name)?;

    let path = ciphertext_path(app, key_name)?;
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

    let plaintext_bytes = cipher
        .decrypt(Nonce::from_slice(&nonce_arr), ciphertext.as_ref())
        .map_err(|_| SecureStorageError::Decrypt)?;

    String::from_utf8(plaintext_bytes).map_err(|_| SecureStorageError::Decrypt)
}

/// Returns `true` when `<app_data_dir>/<key_name>.enc` exists on disk.
pub fn api_key_file_exists(
    app: &AppHandle,
    key_name: &str,
) -> Result<bool, SecureStorageError> {
    validate_key_name(key_name)?;
    Ok(ciphertext_path(app, key_name)?.exists())
}
