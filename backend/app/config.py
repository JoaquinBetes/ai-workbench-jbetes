"""Configuración de la app, leída desde variables de entorno o desde .env."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    ollama_host: str = "http://localhost:11434"
    # Postgres con pgvector (capítulos 3 en adelante). En Docker lo setea docker-compose.yml.
    database_url: str = "postgresql+asyncpg://workbench:workbench@localhost:5432/workbench"
    # Al arrancar, aplicar las migraciones pendientes y cargar los conjuntos de casos curados.
    migrar_al_iniciar: bool = True
    # Modelo de embeddings por defecto para la similitud semántica (ollama pull qwen3-embedding:0.6b).
    modelo_embeddings: str = "qwen3-embedding:0.6b"

    model_config = SettingsConfigDict(env_file=(".env", "../.env"), extra="ignore")


settings = Settings()
