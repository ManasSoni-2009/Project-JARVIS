"""
jarvis/config.py

Central configuration loaded from environment variables via pydantic-settings.
Supports multiple LLM providers: Google Gemini, OpenAI, Anthropic, OpenRouter.
All settings are validated with Pydantic at startup.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal, Optional

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """J.A.R.V.I.S application settings loaded from .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # -- LLM Provider Selection ----------------------------------------
    llm_provider: Literal["google", "openai", "anthropic", "openrouter"] = "google"

    # -- API Keys (all optional - only the selected provider is required)
    gemini_api_key: Optional[str] = None
    openai_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    openrouter_api_key: Optional[str] = None

    # -- OpenRouter-specific settings ----------------------------------
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    chat_model: str = "nvidia/nemotron-3-super-120b-a12b:free"
    vision_model: str = "nvidia/nemotron-3-super-120b-a12b:free"
    supervisor_model: str = "nvidia/nemotron-3-super-120b-a12b:free"

    # -- GitHub ---------------------------------------------------------
    github_token: str = Field(default="", description="GitHub personal access token")

    # -- Obsidian -------------------------------------------------------
    obsidian_vault_path: Path = Field(
        default=Path("."),
        description="Path to Obsidian vault directory",
    )

    @field_validator("obsidian_vault_path", mode="before")
    @classmethod
    def validate_vault(cls, v: str) -> Path:
        """Validate the Obsidian vault path exists."""
        p = Path(v)
        if not p.exists():
            import logging
            logging.getLogger(__name__).warning(
                "Obsidian vault path does not exist: %s -- memory features disabled", p
            )
        return p

    # -- STT (Faster-Whisper) ------------------------------------------
    whisper_model_size: str = "tiny"
    whisper_device: str = "cpu"
    whisper_compute_type: str = "int8"

    # -- TTS (Kokoro) --------------------------------------------------
    tts_voice: str = "af_heart"
    tts_lang: str = "en"

    # -- Dashboard -----------------------------------------------------
    dashboard_host: str = "0.0.0.0"
    dashboard_port: int = 7779

    # -- Logging -------------------------------------------------------
    log_level: str = "INFO"

    # -- Computed properties -------------------------------------------

    @property
    def flash_model(self) -> str:
        """Auto-select the best fast model for the active provider."""
        models = {
            "google": "gemini-3.5-flash",
            "openai": "gpt-5",
            "anthropic": "claude-sonnet-5-20250514",
            "openrouter": self.chat_model,
        }
        return models[self.llm_provider]

    @property
    def active_api_key(self) -> str:
        """Return the API key for the currently selected provider."""
        keys = {
            "google": self.gemini_api_key,
            "openai": self.openai_api_key,
            "anthropic": self.anthropic_api_key,
            "openrouter": self.openrouter_api_key,
        }
        key = keys[self.llm_provider]
        if not key:
            raise ValueError(
                f"No API key configured for provider '{self.llm_provider}'. "
                f"Set the corresponding key in .env"
            )
        return key

    @property
    def openrouter_headers(self) -> dict[str, str]:
        """HTTP headers required by the OpenRouter API."""
        return {
            "HTTP-Referer": "https://github.com/jarvis-ai",
            "X-Title": "J.A.R.V.I.S",
        }


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return cached singleton settings instance."""
    return Settings()


def reload_settings() -> Settings:
    """Clear the settings cache and reload from .env."""
    get_settings.cache_clear()
    return get_settings()
