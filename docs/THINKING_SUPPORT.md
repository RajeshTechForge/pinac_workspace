# LLM Extended Thinking / Reasoning Support

> **Audience:** Backend developers maintaining or extending the Nexus LLM service.
> **Scope:** Covers the full thinking architecture — from API request to provider SDK call to SSE stream — and a step-by-step guide for adding thinking support to a new provider.

---

## Table of Contents

1. [Background & Motivation](#1-background--motivation)
2. [Architecture Overview](#2-architecture-overview)
3. [Request Representation — `ThinkingConfig`](#3-request-representation--thinkingconfig)
4. [Schema Layer — Validation & Serialization](#4-schema-layer--validation--serialization)
5. [Token Counting Contract](#5-token-counting-contract)
6. [Streaming Wire Format](#6-streaming-wire-format)
7. [Provider Implementation Guide](#7-provider-implementation-guide)
   - [Anthropic](#anthropic)
   - [OpenAI](#openai)
   - [Gemini](#gemini)
8. [Adding a New Provider with Thinking Support](#8-adding-a-new-provider-with-thinking-support)
9. [Known Constraints & Gotchas](#9-known-constraints--gotchas)
10. [File Reference](#10-file-reference)

---

## 1. Background & Motivation

Modern LLMs expose a "thinking" or "reasoning" phase where the model explicitly reasons through a problem before generating a final answer. This improves accuracy on complex tasks at the cost of extra latency and tokens.

Each provider implements this differently:

| Provider | Toggle | Level/Budget Control | Exposes Thinking Text? |
|---|---|---|---|
| **Anthropic** | `thinking.type` = `adaptive` / `enabled` / `disabled` | `effort` (adaptive) or `budget_tokens` (enabled) | Yes — `ThinkingBlock` in content |
| **OpenAI** | None (reasoning always available) | `reasoning_effort` = `low` / `medium` / `high` / `xhigh` | No — reasoning is internal |
| **Gemini** | `ThinkingConfig(include_thoughts=True)` | `thinking_level` = `MINIMAL` / `LOW` / `MEDIUM` / `HIGH` | Yes — `thought` parts in content |

The goal of this implementation is to expose all three through a **single, consistent API** while preserving provider-specific controls for power users.

---

## 2. Architecture Overview

```
HTTP Request (ChatRequest)
        │
        ▼
┌─────────────────────┐
│   api/schemas.py    │  Validates ThinkingConfigSchema + provider mismatch check
│   ChatRequest       │
└────────┬────────────┘
         │ .to_llm_request()
         ▼
┌─────────────────────┐
│ services/llm/base.py│  LLMRequest.thinking: ThinkingConfig | None
│ Domain dataclasses  │  LLMResponse.thinking_content: str
│                     │  StreamChunk.is_thinking: bool
│                     │  TokenUsage.thinking_tokens: int
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  byok.py            │  Transparent dispatcher — no changes needed
│  BYOKLLMService     │
└────────┬────────────┘
         │
         ▼
┌────────────────────────────────────────┐
│  providers/{anthropic,openai,gemini}.py│
│                                        │
│  _build_thinking_params()              │  Maps ThinkingConfig → SDK kwargs
│  complete() / stream()                 │  Calls SDK with thinking params
│  _build_response()                     │  Extracts thinking_content, thinking_tokens
└────────────────────────────────────────┘
         │
         ▼
HTTP Response (LLMResponseSchema or SSE StreamChunkSchema)
```

**Key design principle:** `BYOKLLMService` and the route handler (`api/routes/llm.py`) require **zero changes** when a new provider is added. All thinking logic is encapsulated inside each provider implementation.

---

## 3. Request Representation — `ThinkingConfig`

### Domain dataclass (`services/llm/base.py`)

```python
@dataclass(frozen=True)
class ThinkingConfig:
    enabled: bool = False
    effort: str | None = None          # "low" | "medium" | "high"
    provider_options: dict[str, str | int | None] | None = None
```

- `enabled` — Master switch. When `False`, no thinking parameters are sent to any provider.
- `effort` — Normalized level covering the common 80% case. Each provider maps it to their native vocabulary (see §7).
- `provider_options` — Provider-specific overrides, already validated and serialized from the schema layer. The `provider` discriminator key is stripped before this dict reaches the domain.

### How it flows into `LLMRequest`

```python
@dataclass
class LLMRequest:
    ...
    thinking: ThinkingConfig | None = None
```

When `thinking` is `None` or `thinking.enabled is False`, providers must not send any thinking parameters to their SDK — standard behavior is preserved exactly.

---

## 4. Schema Layer — Validation & Serialization

### `ThinkingConfigSchema` (`services/llm/schemas.py`)

```python
class ThinkingConfigSchema(BaseModel):
    enabled: bool = False
    effort: Literal["low", "medium", "high"] | None = None
    provider_options: ProviderThinkingOptions | None = None
```

`ProviderThinkingOptions` is a **Pydantic discriminated union** keyed on the `provider` literal:

```python
ProviderThinkingOptions = Annotated[
    AnthropicThinkingOptions | OpenAIThinkingOptions | GeminiThinkingOptions,
    Field(discriminator="provider"),
]
```

This means the `provider_options` payload must include a `"provider"` key matching one of the three literal values. Pydantic uses this to select the correct model and reject unknown fields automatically.

### Provider-specific options models

**`AnthropicThinkingOptions`**
```python
provider: Literal["anthropic"]
thinking_type: Literal["adaptive", "enabled"] | None  # default: "adaptive"
budget_tokens: int | None  # ge=1024, only for thinking_type="enabled"
effort: Literal["low", "medium", "high", "xhigh", "max"] | None
```

**`OpenAIThinkingOptions`**
```python
provider: Literal["openai"]
effort: Literal["none", "minimal", "low", "medium", "high", "xhigh"] | None
```

**`GeminiThinkingOptions`**
```python
provider: Literal["gemini"]
level: Literal["MINIMAL", "LOW", "MEDIUM", "HIGH"] | None
```

### `to_domain()` serialization

`ThinkingConfigSchema.to_domain()` strips the `provider` key and calls `model_dump(exclude={"provider"}, exclude_none=True)` on the provider options. The resulting plain `dict[str, str | int | None]` is what arrives in `ThinkingConfig.provider_options`.

### Provider mismatch validation (`api/schemas.py`)

`ChatRequest` has a model validator that rejects requests where `thinking.provider_options.provider` doesn't match the top-level `provider` field:

```python
@model_validator(mode="after")
def thinking_provider_must_match(self) -> "ChatRequest":
    if (
        self.thinking
        and self.thinking.provider_options
        and self.thinking.provider_options.provider != self.provider.value
    ):
        raise ValueError(...)
    return self
```

This fires before `to_llm_request()` — the domain layer never sees an inconsistent request.

### Example API payloads

**Normalized (works for all providers):**
```json
{
  "provider": "gemini",
  "thinking": {
    "enabled": true,
    "effort": "high"
  }
}
```

**Anthropic adaptive with xhigh effort:**
```json
{
  "provider": "anthropic",
  "thinking": {
    "enabled": true,
    "provider_options": {
      "provider": "anthropic",
      "thinking_type": "adaptive",
      "effort": "xhigh"
    }
  }
}
```

**Anthropic fixed-budget (legacy):**
```json
{
  "provider": "anthropic",
  "thinking": {
    "enabled": true,
    "provider_options": {
      "provider": "anthropic",
      "thinking_type": "enabled",
      "budget_tokens": 8000
    }
  }
}
```

**Gemini with explicit level:**
```json
{
  "provider": "gemini",
  "thinking": {
    "enabled": true,
    "provider_options": {
      "provider": "gemini",
      "level": "HIGH"
    }
  }
}
```

---

## 5. Token Counting Contract

### `TokenUsage` semantic contract

```python
@dataclass
class TokenUsage:
    prompt_tokens: int = 0      # input tokens
    completion_tokens: int = 0  # answer tokens ONLY (never includes thinking)
    thinking_tokens: int = 0    # reasoning tokens; 0 when provider doesn't expose this
    total_tokens: int = 0       # prompt + completion + thinking
```

`total_tokens` **always** equals `prompt_tokens + completion_tokens + thinking_tokens`. This invariant is enforced by `TokenUsageSchema.total_is_consistent()`.

### Per-provider mapping

| Provider | `completion_tokens` source | `thinking_tokens` source | Notes |
|---|---|---|---|
| **Anthropic** | `usage.output_tokens` (includes thinking) | `0` | Anthropic doesn't expose a separate count. Honest zero — no approximation. |
| **OpenAI** | `usage.completion_tokens - reasoning_tokens` | `usage.completion_tokens_details.reasoning_tokens` | Exact; subtracted from total completion count. |
| **Gemini** | `usage_metadata.candidates_token_count` | `usage_metadata.thoughts_token_count` | Exact; both fields are separate and non-overlapping. |

> **Why Anthropic reports `thinking_tokens=0`:** Anthropic's API bills thinking tokens as part of `output_tokens` and provides no separate counter. Using tiktoken (OpenAI's tokenizer) to approximate would use the wrong vocabulary and produce misleading numbers. An honest `0` is better than a wrong number that corrupts downstream cost tracking.

---

## 6. Streaming Wire Format

### SSE event shape

```
data: {
  "event_type": "chunk",
  "data": {
    "delta": "...",        ← text of this chunk (empty on final)
    "is_thinking": false,  ← true if this delta is reasoning text
    "is_final": false,
    "finish_reason": "unknown",
    "usage": {...},        ← populated on final chunk only
    "model": "",
    "provider": null,      ← populated on final chunk only
    "latency_ms": 0.0
  }
}
```

### `is_thinking` flag

`is_thinking: true` means the `delta` carries reasoning/thinking text from the model's thought process, not the final answer.

**Ordering contract (guaranteed by all providers):**

```
[is_thinking=true chunks] → [is_thinking=false chunks] → [is_final=true sentinel]
```

The transition from `true` to `false` is **one-way and never interleaved**. Clients can use a simple boolean state variable to track the current render mode — no need to inspect every chunk.

**Why `is_thinking` lives inside `data`, not at the envelope level:**

`event_type` is a structural routing discriminator (tells the client which schema to use). `is_thinking` is a semantic property of the chunk payload — it describes the content of `delta`. Elevating it to the envelope level would blur this boundary and create inconsistencies (e.g., what does `is_thinking` mean on a `done` or `error` event?).

**Provider behavior:**

| Provider | Streams thinking text? | `is_thinking=true` chunks |
|---|---|---|
| Anthropic | Yes (adaptive/enabled mode) | Via `thinking_delta` events in the raw SDK stream |
| OpenAI | No — reasoning is hidden | Always `false` |
| Gemini | Yes (when `include_thoughts=True`) | Via `thought=True` parts in candidate content |

### Client-side rendering example

```javascript
let inThinkingPhase = false;

for await (const line of sseStream) {
  const event = JSON.parse(line.replace("data: ", ""));
  if (event.event_type !== "chunk") continue;

  const { delta, is_thinking, is_final } = event.data;

  if (is_final) {
    finalizeUI(event.data);
    break;
  }

  if (is_thinking) {
    inThinkingPhase = true;
    appendToThinkingPanel(delta);   // styled differently
  } else {
    if (inThinkingPhase) collapseThinkingPanel(); // one-time transition
    inThinkingPhase = false;
    appendToAnswerPanel(delta);
  }
}
```

### Non-streaming response

`LLMResponse` carries the full accumulated reasoning text:

```json
{
  "content": "The answer is 42.",
  "thinking_content": "Let me work through this step by step...",
  "finish_reason": "stop",
  "usage": {
    "prompt_tokens": 120,
    "completion_tokens": 30,
    "thinking_tokens": 850,
    "total_tokens": 1000
  }
}
```

`thinking_content` is an empty string `""` when:
- Thinking was not requested
- The provider doesn't expose thinking text (OpenAI)
- Anthropic's `display` is set to `"omitted"`

---

## 7. Provider Implementation Guide

### Anthropic

**File:** `src/nexus/services/llm/providers/anthropic.py`

#### `_build_thinking_params(thinking: ThinkingConfig | None) → dict[str, object]`

Maps `ThinkingConfig` to the `thinking` and `output_config` SDK keyword arguments.

```
ThinkingConfig.enabled = False  →  {} (empty, no thinking params sent)

enabled = True, thinking_type = "enabled":
    → {"thinking": {"type": "enabled", "budget_tokens": N}}
    Default N = 10_000 when budget_tokens not specified.

enabled = True, thinking_type = "adaptive" (or omitted):
    → {"thinking": {"type": "adaptive"},
       "output_config": {"effort": "<effort>"}}
    Effort precedence: provider_options.effort → thinking.effort → "high"
```

#### Temperature suppression

Anthropic requires temperature and top_p to be **omitted** (not set to 1) when thinking is active on many models. The implementation passes `anthropic.NOT_GIVEN` for both whenever `thinking_kwargs` is non-empty:

```python
temperature=(
    request.temperature if not thinking_kwargs else anthropic.NOT_GIVEN
),
top_p=(
    request.top_p if request.top_p != 1.0 and not thinking_kwargs
    else anthropic.NOT_GIVEN
),
```

This is intentional — the server stays stateless w.r.t. model version catalogs. If a specific model rejects the omission, the Anthropic API will return a 400 which our existing error mapper handles cleanly.

#### Stream event handling

The implementation iterates **raw SDK events** instead of using the convenience `text_stream` accessor. This is required because `text_stream` only yields text deltas and discards thinking deltas.

```
content_block_delta event with delta.type == "thinking_delta"
    → yield StreamChunk(delta=delta.thinking, is_thinking=True)

content_block_delta event with delta.type == "text_delta"
    → yield StreamChunk(delta=delta.text, is_thinking=False)
```

All other event types (`content_block_start`, `content_block_stop`, `message_delta`, etc.) are silently ignored in the stream loop.

#### `_build_response` block classification

Blocks are classified by `block.type` first, not by attribute presence:

```python
block_type = getattr(block, "type", None)
if block_type == "text" and hasattr(block, "text"):
    content_parts.append(block.text)
elif block_type == "thinking" and hasattr(block, "thinking"):
    thinking_parts.append(block.thinking)
# All other block types (tool_use, redacted_thinking) are skipped.
```

> **Why not `hasattr(block, "text")`?** This is fragile — if Anthropic ever adds a `.text` attribute to `ThinkingBlock` for summarized display, thinking text would silently leak into the answer. The `block.type` check is the correct, spec-compliant approach.

---

### OpenAI

**File:** `src/nexus/services/llm/providers/openai.py`

#### `_build_thinking_params(thinking: ThinkingConfig | None) → dict[str, str]`

OpenAI reasoning models are always reasoning-capable. There is no on/off toggle.

```
ThinkingConfig.enabled = False  →  {} (reasoning_effort not sent; model decides)

enabled = True:
    Effort precedence: provider_options.effort → thinking.effort → omit
    → {"reasoning_effort": "<effort>"} or {} if effort is None
```

#### `max_completion_tokens` requirement

OpenAI o-series reasoning models **reject `max_tokens`** with `invalid_request_error`. They require `max_completion_tokens` to account for both reasoning and answer tokens in a single budget. The implementation always uses `max_completion_tokens` — it is accepted by all current GPT and o-series models:

```python
max_completion_tokens=request.max_tokens,
```

#### Token extraction

`reasoning_tokens` are nested inside `completion_tokens_details`:

```python
details = raw.usage.completion_tokens_details
thinking_toks = details.reasoning_tokens or 0 if details else 0
comp_toks = raw.usage.completion_tokens - thinking_toks
```

This produces exact, non-overlapping counts.

#### Thinking text

OpenAI **never streams or returns reasoning text**. All deltas have `is_thinking=False`. `thinking_content` in `LLMResponse` is always `""`.

---

### Gemini

**File:** `src/nexus/services/llm/providers/gemini.py`

#### `_build_generation_config(request, system_instruction, thinking)`

When thinking is enabled, a `ThinkingConfig` is added to `GenerateContentConfig`:

```python
# Effort → Level mapping:
"low"    → "LOW"
"medium" → "MEDIUM"
"high"   → "HIGH"
# provider_options.level takes precedence over normalized effort.

thinking_config = genai_types.ThinkingConfig(
    thinking_level=level,   # omitted when level is None
    include_thoughts=True,  # REQUIRED — without this, thought parts are not returned
)
```

> **Critical:** `include_thoughts=True` is **required**. Without it, Gemini performs the reasoning internally (causing the latency increase) but **does not return thought text** in the response parts. The `part.thought` flag is only set on parts when this option is enabled.

#### Stream and response thought extraction

Gemini returns thought text as separate `Part` objects with `part.thought == True`:

```python
for part in candidate.content.parts:
    if hasattr(part, "thought") and part.thought:
        # This is a thinking part
        yield StreamChunk(delta=part.text, is_thinking=True)
    elif part.text:
        # This is an answer part
        yield StreamChunk(delta=part.text, is_thinking=False)
```

> **Critical:** Never use `chunk.text` or `raw.text` as a fallback for streaming or response building when thinking is enabled. These are **shortcut accessors that concatenate ALL parts**, including thought parts. Using them as fallbacks would merge thinking text into the answer content.

#### Token extraction

```python
thinking_toks = getattr(usage_metadata, "thoughts_token_count", None) or 0
comp_toks = usage_metadata.candidates_token_count or 0
# Both are separate, non-overlapping fields in Gemini's usage_metadata.
```

---

## 8. Adding a New Provider with Thinking Support

Follow this checklist when integrating a new LLM provider that supports thinking/reasoning.

### Step 1 — Add a provider options schema (`services/llm/schemas.py`)

```python
class MyProviderThinkingOptions(BaseModel):
    """MyProvider-specific thinking overrides."""

    provider: Literal["myprovider"] = "myprovider"
    # Add any provider-specific fields here, e.g.:
    reasoning_mode: Literal["fast", "deep"] | None = Field(default=None)
```

Add it to the `ProviderThinkingOptions` union:

```python
ProviderThinkingOptions = Annotated[
    AnthropicThinkingOptions
    | OpenAIThinkingOptions
    | GeminiThinkingOptions
    | MyProviderThinkingOptions,    # ← add here
    Field(discriminator="provider"),
]
```

### Step 2 — Add the provider enum value

Ensure `ProviderType` in `base.py` includes your provider. If it doesn't already:

```python
class ProviderType(str, Enum):
    ANTHROPIC = "anthropic"
    OPENAI = "openai"
    GEMINI = "gemini"
    MYPROVIDER = "myprovider"   # ← add
```

### Step 3 — Enable `supports_thinking` in `CAPABILITIES`

```python
CAPABILITIES = ProviderCapabilities(
    ...
    supports_thinking=True,
    ...
)
```

### Step 4 — Implement `_build_thinking_params()`

```python
@staticmethod
def _build_thinking_params(
    thinking: ThinkingConfig | None,
) -> dict[str, object]:
    """Map ThinkingConfig to MyProvider SDK keyword arguments.

    Returns an empty dict when thinking is disabled so callers can
    safely unpack with **.

    Precedence:
        1. provider_options fields
        2. Normalized thinking.effort
        3. Provider default
    """
    if thinking is None or not thinking.enabled:
        return {}

    opts = thinking.provider_options or {}

    # Map normalized effort to provider-native vocabulary
    effort_map = {"low": "fast", "medium": "balanced", "high": "deep"}
    mode = opts.get("reasoning_mode") or effort_map.get(thinking.effort or "", "balanced")

    return {"reasoning_mode": mode}
```

### Step 5 — Update `complete()` and `stream()`

Merge the thinking kwargs into your SDK call:

```python
thinking_kwargs = self._build_thinking_params(request.thinking)
raw = await self._client.generate(
    ...
    **thinking_kwargs,
)
```

**If the provider requires parameter changes when thinking is active** (like Anthropic suppressing temperature), handle that here before the SDK call.

### Step 6 — Update `_build_response()` for thinking content

```python
# Extract thinking text from provider-specific response structure
thinking_content = ""
if hasattr(raw, "reasoning_text"):          # hypothetical field name
    thinking_content = raw.reasoning_text or ""

return LLMResponse(
    content=...,
    thinking_content=thinking_content,
    ...
)
```

### Step 7 — Update stream loop for `is_thinking` chunks

```python
async for event in raw_stream:
    if event.type == "reasoning_delta":
        yield StreamChunk(delta=event.text, is_thinking=True)
    elif event.type == "text_delta":
        yield StreamChunk(delta=event.text, is_thinking=False)
```

### Step 8 — Update token counting in `_build_response()` and stream sentinel

Consult the provider's docs for whether thinking tokens are:
- **Separate fields** (like Gemini) → use them directly for `thinking_tokens`, use answer field for `completion_tokens`
- **Nested inside completion** (like OpenAI) → subtract to get `completion_tokens`
- **Not exposed** (like Anthropic) → `thinking_tokens=0`, `completion_tokens=full_output_tokens`

```python
usage = TokenUsage(
    prompt_tokens=...,
    completion_tokens=...,     # answer-only
    thinking_tokens=...,       # 0 if provider doesn't expose
    total_tokens=...,
)
```

### Step 9 — Lint and format

```bash
uv run ruff check src/nexus/services/llm/
uv run ruff format src/nexus/services/llm/
```

### Step 10 — Update `__all__` exports

In `providers/__init__.py`, export your new config and provider classes.

---

## 9. Known Constraints & Gotchas

### Anthropic

- **Temperature must be omitted (not `1.0`, but `NOT_GIVEN`) when thinking is active.** Passing `temperature=1.0` explicitly can still cause a 400 on some models. Always use `anthropic.NOT_GIVEN`.
- **`top_p` must also be omitted** when thinking is active — same reason.
- **`ThinkingBlock` has no `.text` attribute.** Do not use `hasattr(block, "text")` to classify blocks — use `block.type == "text"` first.
- **`budget_tokens` is deprecated on Claude 4.6+ and removed on Opus 4.7+.** Prefer adaptive mode for new integrations.
- **Multi-turn conversations with thinking:** The Anthropic API requires `ThinkingBlock` content (including the cryptographic `signature`) to be returned verbatim in subsequent turns. Do not strip or modify thinking blocks from conversation history. This is not yet handled — if multi-turn with thinking is needed, the conversation history builder must preserve `ThinkingBlock` payloads.
- **`thinking_tokens = 0`** is an honest unknown — Anthropic does not expose a separate count. Do not approximate using tiktoken (wrong tokenizer vocabulary, will produce misleading numbers).

### OpenAI

- **Use `max_completion_tokens`, not `max_tokens`.** o-series models reject `max_tokens` with `invalid_request_error`. `max_completion_tokens` is also accepted by standard GPT models — use it unconditionally.
- **Reasoning text is never exposed.** Do not attempt to parse reasoning content from OpenAI responses. `thinking_content` is always `""`.
- **`reasoning_effort` is absent from standard GPT models.** If a user sends `thinking.enabled=true` with a GPT-4o model, OpenAI will likely ignore the parameter. This is the correct behavior — the server is stateless w.r.t. model capability detection.

### Gemini

- **`include_thoughts=True` is required** in `ThinkingConfig`. Without it, the model thinks internally (adding latency) but returns no thought text — `part.thought` will never be `True`.
- **Never use `chunk.text` or `raw.text` as a fallback.** These shortcut accessors concatenate all parts, including thought parts. They will merge thinking text into the answer if used as fallbacks when candidates are present.
- **`thoughts_token_count` is separate from `candidates_token_count`** — they are non-overlapping. Do not add them together for `completion_tokens`.

### General

- **The ordering invariant (thinking before answer) is guaranteed by all three providers.** Clients may rely on it, but providers must not yield answer chunks before all thinking chunks are complete.
- **Thinking in non-streaming mode (`stream=false`)** returns the full `thinking_content` in a single `LLMResponse`. Clients that don't want thinking content can ignore the field — it defaults to `""`.
- **`provider_options` keys are validated by Pydantic at the schema boundary.** Unknown keys are rejected with a 422. Each provider's options model defines exactly what keys are accepted.

---

## 10. File Reference

| File | Role |
|---|---|
| [`src/nexus/services/llm/base.py`](src/nexus/services/llm/base.py) | Domain dataclasses: `ThinkingConfig`, `LLMRequest`, `LLMResponse`, `StreamChunk`, `TokenUsage`, `ProviderCapabilities` |
| [`src/nexus/services/llm/schemas.py`](src/nexus/services/llm/schemas.py) | Pydantic schemas: `ThinkingConfigSchema`, `AnthropicThinkingOptions`, `OpenAIThinkingOptions`, `GeminiThinkingOptions`, `ProviderThinkingOptions`, updated `TokenUsageSchema`, `LLMResponseSchema`, `StreamChunkSchema` |
| [`src/nexus/api/schemas.py`](src/nexus/api/schemas.py) | API boundary: `ChatRequest.thinking`, provider mismatch validator |
| [`src/nexus/services/llm/providers/anthropic.py`](src/nexus/services/llm/providers/anthropic.py) | Anthropic implementation: `_build_thinking_params`, `_build_response`, stream event handling |
| [`src/nexus/services/llm/providers/openai.py`](src/nexus/services/llm/providers/openai.py) | OpenAI implementation: `_build_thinking_params`, `_build_response`, `max_completion_tokens` usage |
| [`src/nexus/services/llm/providers/gemini.py`](src/nexus/services/llm/providers/gemini.py) | Gemini implementation: `_build_generation_config`, `_build_response`, thought part extraction |
| [`src/nexus/services/llm/byok.py`](src/nexus/services/llm/byok.py) | BYOK dispatcher — **no changes** needed for thinking support |
| [`src/nexus/api/routes/llm.py`](src/nexus/api/routes/llm.py) | Route handler — **no changes** needed for thinking support |
