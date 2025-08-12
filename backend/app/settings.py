"""
Configuration management for Lawyerless application using pydantic-settings.
"""

import os
from typing import Optional, List
from pydantic_settings import BaseSettings
from pydantic import Field, field_validator, ConfigDict
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


class Settings(BaseSettings):
    """Application settings with environment variable support."""
    
    model_config = ConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False
    )
    
    # LLM Configuration
    llm_provider: str = Field(default="openai")
    llm_api_key: str = Field(...)
    llm_model: str = Field(default="gpt-4o-mini")
    llm_base_url: Optional[str] = Field(default="https://api.openai.com/v1")
    
    # FastAPI Configuration
    app_name: str = Field(default="Lawyerless API")
    app_version: str = Field(default="1.0.0")
    app_env: str = Field(default="development")
    debug: bool = Field(default=False)
    log_level: str = Field(default="INFO")
    
    # Server Configuration
    host: str = Field(default="localhost")
    port: int = Field(default=8000)
    reload: bool = Field(default=True)
    
    # CORS Configuration
    cors_origins: List[str] = Field(
        default=[
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "https://localhost:3000",
            "https://127.0.0.1:3000"
        ]
    )
    cors_allow_credentials: bool = Field(default=True)
    cors_allow_methods: List[str] = Field(default=["GET", "POST", "PUT", "DELETE", "OPTIONS"])
    cors_allow_headers: List[str] = Field(default=["*"])
    
    # File Upload Configuration
    max_file_size: int = Field(default=52428800)  # 50MB in bytes
    allowed_file_types: List[str] = Field(default=["application/pdf"])
    upload_timeout: int = Field(default=300)  # 5 minutes in seconds
    
    # PDF Processing Configuration
    pdf_processing_timeout: int = Field(default=120)  # 2 minutes in seconds
    max_pdf_pages: int = Field(default=200)
    pdf_chunk_overlap: int = Field(default=200)  # Characters overlap between chunks
    pdf_chunk_size: int = Field(default=4000)  # Characters per chunk for LLM
    
    # LLM Processing Configuration
    llm_timeout: int = Field(default=180)  # 3 minutes in seconds
    llm_max_retries: int = Field(default=3)
    llm_temperature: float = Field(default=0.1)  # Low temperature for consistent legal analysis
    llm_max_tokens: int = Field(default=4096)
    
    # Analysis Configuration
    risk_analysis_enabled: bool = Field(default=True)
    negotiation_questions_count: int = Field(default=5)
    
    @field_validator("llm_api_key")
    @classmethod
    def validate_api_key(cls, v):
        """Ensure API key is not empty."""
        if not v or v.strip() == "":
            raise ValueError("LLM API key cannot be empty")
        return v
    
    @field_validator("max_file_size")
    @classmethod
    def validate_file_size(cls, v):
        """Ensure file size is reasonable."""
        if v > 104857600:  # 100MB
            raise ValueError("Max file size cannot exceed 100MB")
        if v < 1048576:  # 1MB
            raise ValueError("Max file size must be at least 1MB")
        return v
    
    @field_validator("cors_origins")
    @classmethod
    def validate_cors_origins(cls, v):
        """Ensure CORS origins are valid URLs."""
        if not v:
            return ["*"]  # Allow all origins if none specified
        return v
    
    @field_validator("llm_temperature")
    @classmethod
    def validate_temperature(cls, v):
        """Ensure temperature is between 0 and 1."""
        if not 0 <= v <= 1:
            raise ValueError("Temperature must be between 0 and 1")
        return v


# Global settings instance
try:
    settings = Settings()
except Exception:
    # For testing, create settings with dummy values
    import os
    os.environ.setdefault("LLM_API_KEY", "test_key")
    settings = Settings()