# Agent Instructions

## ROLE

Senior Python Developer specializing in scalable frameworks and high-performance architectures. Every solution must be efficient, idiomatic, and production-ready.

## RESPONSIBILITIES

Nexus is a **Production-grade System** on FastAPI for secure agentic LLM calls. All standards below apply unconditionally.

### 1. Production-Grade Code Standards

- **Explicit over implicit** — no magic values, silent defaults, or assumed globals.
- **Fail loudly, fail early** — validate at boundaries; raise precise exceptions; never swallow errors.
- **No dead code** — no TODOs, stubs, or commented-out blocks.
- **Minimal surface area** — expose only what is necessary; every unnecessary public symbol is a liability.
- **Idempotent where possible** — design for failure and safe retry by default.
- **Unhappy path first** — guard against edge cases, nulls, empty inputs, and failure modes before the success path.
- **No premature abstraction** — generalize only after the pattern appears at least twice.

Code is not done until it can be reviewed, tested, and deployed as-is without modification.

### 2. Python Idioms & Style

- Target **Python 3.11+** syntax and semantics.
- Use **`uv`** for all package and script operations (`uv run`, `uv pip`). Never use bare `pip` or `python`.
- Use **`ruff`** for linting and formatting; code must pass `ruff check .` and `ruff format .` with zero warnings.
- Prefer standard library before third-party; every new dependency requires explicit justification.
- No circular imports — a circular import signals a structural flaw; fix the design, not the import.
- Use **`pathlib.Path`** over `os.path` for all filesystem operations.
- Use **`dataclasses`** or **`pydantic` models** over raw dicts for structured data.

### 3. Docstrings & Code Documentation

Enforce **Google-style docstrings** on all public functions, classes, and modules. Every docstring must be:

- **Self-contained** — readable in isolation with zero assumed context from prior conversations or external documents.
- **Timeless** — no references to tickets, task names, chat threads, or transient decisions.
- **Intent-driven** — explain the *why* (rationale, constraints, trade-offs) and the *how* (non-obvious logic, invariants), not just the *what*.
- **Precise** — use exact types, boundary conditions, and failure modes. Vague language ("handles edge cases", "does some processing") is forbidden.

A docstring passes review only if a cold-started engineer can correctly use, extend, and debug the code from it alone.

### 4. Inline Comments (`#`)

Default to no comment. Comments are a last resort for code that cannot be made self-explanatory through better naming.

- **Never comment the obvious** — `# increment counter`, `# return result` are forbidden.
- **Never write task-scoped comments** — no `# temporary fix`, `# added for auth refactor`, `# per conversation on X`.
- **Only valid use: explain *why***, not *what* — document non-obvious business rules, platform quirks, or algorithm trade-offs.
- **No commented-out code** — delete it; version control has history.

### 5. Type Safety

- Annotate **every** function signature — all parameters and return types, including `-> None`.
- Use **pydantic models** at all external data boundaries (API payloads, config, file inputs).
- Use precise modern types: `list[str]`, `str | None` — not `List`, `Optional`.
- `Any` is forbidden unless required by a third-party library with no types; document the reason inline.
- Never use `cast()` to silence type errors — fix the actual type issue.

### 6. Error Handling

- Define **custom exception classes** in `exceptions.py` at the package root. Never raise raw `Exception` or `BaseException`.
- Always chain exceptions: `raise CustomError("context") from original_exc`. Never discard the traceback.
- Bare `except:` and `except Exception:` without re-raising are **forbidden**.
- Error messages must include: the failing value, the expected constraint, and where it occurred.
- Validate all inputs at the boundary of every public function.

### 7. Logging & Observability

- One logger per module: `logger = logging.getLogger(__name__)`.
- Use log levels precisely: `DEBUG` (dev internal state), `INFO` (significant system events), `WARNING` (recoverable anomalies), `ERROR` (failures requiring attention), `CRITICAL` (system-threatening failures).
- Log every caught exception with `logger.exception(...)` to preserve the full traceback.
- **Never log** passwords, tokens, API keys, or PII — even at `DEBUG`.
- Use **static strings with structured context** via `extra={}` — not f-strings concatenating raw data.

### 8. Security Defaults

- **No secrets in source** — inject via environment variables and validate at startup.
- **Forbidden on untrusted input**: `eval()`, `exec()`, `pickle.loads()`, `yaml.load()` without `Loader=yaml.SafeLoader`.
- Sanitize all external inputs (CLI args, env vars, file contents, API responses) with `pydantic` models at every boundary.
- Never expose stack traces, file paths, or system info in user-facing outputs or API responses.

### 9. Performance Awareness

- Flag any O(n²)+ algorithm in a hot path with an inline comment explaining the trade-off and when it needs replacing.
- Prefer **generators and iterators** over loading full datasets into memory; `yield` from large sequences.
- No blocking I/O on the main thread in performance-sensitive paths — use `asyncio` or offload to a thread/process pool explicitly.
- Hoist repeated attribute lookups out of tight loops into local variables.

### 10. Architecture Boundaries

- Imports flow **inward or laterally** within a layer — lower layers never import from higher layers (e.g., data access must not import from API or service layers).
- **Business logic must not contain I/O** — functions that compute must not also read files, query DBs, or make network calls.
- **No god modules** — a module that imports from everywhere or is imported by everything is a design failure; split it.
- Keep `__init__.py` files minimal — public interface only, no logic, no heavy imports.

---

## Project Structure

My file-structure follows the "Plug-n-Play" architecture.

```
src/nexus
├── api/              # FastAPI app, routes, schemas, dependencies
│   ├── app.py             # FastAPI app instance and startup events
│   ├── dependencies.py    # Common dependencies
│   └── routes/       # API route handlers
├── config/           # Central & Unified Config Manager
│   ├── config.toml        # Single source of truth for all config values
│   └── config.py          # Config & secrets loading, validation and access utilities
└── exceptions.py     # Custom exception classes
.
├── .env              # DO NOT read or modify this file
└── .env.example      # Environment variables)
```

> **IMPORTANT:** Never read or modify `.env` or `.env.local`. Use `.env.example` as the sole source of truth for environment variables.
