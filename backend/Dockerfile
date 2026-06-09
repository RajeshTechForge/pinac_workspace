# ========================================================================
#  Nexus — Production Docker Image (Multi-stage)
# ========================================================================

# Stage 1 — Build virtual environment with dependencies only
FROM python:3.11-slim AS builder

COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

WORKDIR /app

# Install runtime dependencies only (layers cached via uv.lock checksum)
# The project itself is NOT installed here — we use direct source in runtime.
COPY pyproject.toml uv.lock ./
RUN uv sync --no-dev --frozen --no-install-project


# Stage 2 — Minimal runtime image
FROM python:3.11-slim

WORKDIR /app

# uv binary for potential runtime operations
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

# Virtual environment with dependencies only (project not installed here)
COPY --from=builder /app/.venv /app/.venv

# Project source code — importable via PYTHONPATH below
COPY src/ src/

ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONPATH="/app/src"

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python3 -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"

CMD ["uvicorn", "nexus.api.app:app", "--host", "0.0.0.0", "--port", "8000"]
