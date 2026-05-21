"""Centralized configuration management for Pinac-Workspace API using Pydantic Settings.

Hybrid configuration approach:
  - System / structural configs  →  config.toml
  - Secrets and environment vars →  .env file
"""

from __future__ import annotations

import tomllib
from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def _load_toml(config_path: str | Path) -> dict:
    """Load and parse a TOML configuration file.

    Raises:
        FileNotFoundError: The specified file does not exist.
        ValueError: The file contains invalid TOML syntax.
    """
    config_path = Path(config_path)
    if not config_path.exists():
        raise FileNotFoundError(f"Config file not found: '{config_path}'")
    try:
        with open(config_path, "rb") as f:
            return tomllib.load(f)
    except tomllib.TOMLDecodeError as exc:
        raise ValueError(
            f"Invalid TOML in config file: '{config_path}'\nERROR: {exc}"
        ) from exc


# ---------------------------------------------------------------------------
# Settings for specific configuration domains
# ---------------------------------------------------------------------------


class SecuritySettings(BaseSettings):
    """Security-related settings for the application."""

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", frozen=False
    )

    secret_key: str = Field(default="", alias="SECRET_KEY")
    algorithm: str = "HS256"

    @field_validator("secret_key")
    @classmethod
    def validate_secret_key(cls, v: str) -> str:
        """Ensure the secret key meets minimum length requirements."""

        if len(v) < 32:
            raise ValueError(
                "SECRET_KEY must be at least 32 characters long. "
                'Generate one with: python -c "import secrets; print(secrets.token_hex(32))"'
            )
        return v

    @classmethod
    def from_toml(cls, data: dict) -> "SecuritySettings":
        """Initialise security settings from a parsed TOML dictionary."""
        sec = data.get("security", {})
        instance = cls()
        instance.algorithm = sec.get("algorithm", instance.algorithm)
        return instance


class CORSSettings(BaseSettings):
    """Configuration for Cross-Origin Resource Sharing."""

    model_config = SettingsConfigDict(frozen=False)

    allow_origins: list[str] = Field(default_factory=list)
    allow_credentials: bool = True
    allow_methods: list[str] = Field(
        default_factory=lambda: ["GET", "POST", "PUT", "DELETE"]
    )
    allow_headers: list[str] = Field(default_factory=lambda: ["*"])

    @classmethod
    def from_toml(cls, data: dict) -> "CORSSettings":
        """Initialise CORS settings from a parsed TOML dictionary."""
        cfg = data.get("cors", {})
        instance = cls()
        instance.allow_origins = cfg.get("allow_origins", instance.allow_origins)
        instance.allow_credentials = cfg.get(
            "allow_credentials", instance.allow_credentials
        )
        instance.allow_methods = cfg.get("allow_methods", instance.allow_methods)
        instance.allow_headers = cfg.get("allow_headers", instance.allow_headers)
        return instance


# ---------------------------------------------------------------------------
# Root Settings
# ---------------------------------------------------------------------------


class AppSettings(BaseSettings):
    """Root application settings managed via a multi-layer loading strategy.

    Config precedence (highest to lowest):
      1. Environment variables and .env file.
      2. TOML configuration file (path defined by SENTINEL_SYSTEM_CONFIG).
      3. Class-defined default values.
    """

    config_path: str = "src/config/config.toml"

    app_name: str = "Pinac-Workspace API"
    app_version: str = "1.0.0"
    environment: str = "development"
    debug: bool = False

    security: SecuritySettings = Field(default_factory=SecuritySettings)
    cors: CORSSettings = Field(default_factory=CORSSettings)

    @model_validator(mode="after")
    def _load_toml_config(self) -> "AppSettings":
        """Merge structural config from the TOML file into this settings instance.
        Runs *after* Pydantic has populated all env-var fields (including
        "api_keys"), so the registry is guaranteed to be fully populated
        before "EmbeddingSettings.from_toml" and "LLMSettings.from_toml"
        consume it.

        Returns:
            The "AppSettings" instance with TOML data merged in.
        """

        raw = _load_toml(self.config_path)
        app = raw.get("app", {})
        self.app_name = app.get("name", self.app_name)
        self.app_version = app.get("version", self.app_version)
        self.environment = app.get("env", self.environment)
        self.debug = app.get("debug", self.debug)
        self.security = SecuritySettings.from_toml(raw)
        self.cors = CORSSettings.from_toml(raw)
        return self

    @property
    def is_production(self) -> bool:
        """Return "True" if the current environment is production."""
        return self.environment == "production"


@lru_cache
def get_settings() -> AppSettings:
    """Return a cached singleton instance of the application settings.

    Thread-safe for read-only access.  Call "get_settings.cache_clear()"
    in tests to force a fresh load between test cases.

    Returns:
        The globally shared "AppSettings" instance.
    """
    return AppSettings()
