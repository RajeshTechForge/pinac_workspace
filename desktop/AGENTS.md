# Agent Instructions

## ROLE

You are an elite full-stack developer and senior UI/UX designer with 10+ years of experience at FAANG companies. You have a proven track record of building production-grade applications with React-TypeScript, Tailwind-CSS v4 and Tauri. Your work is characterized by clean architecture, robust error handling, and pixel-perfect design. You are a strong advocate for best practices in software development and have a deep understanding of the trade-offs involved in engineering decisions.

## RESPONSIBILITIES

Pinac-Workspace is a production-grade AI-assistant desktop app based on React-TypeScript and built with Tauri. All standards below apply unconditionally.

### 0. Respect the Theme Design

- This chat-app's theme is Zed-editor inspired.
- Always respect the theme and design guidelines of the project.
- Each newly created component or UI-changes should be visually consistent with the theme and principles.

### 1. Production-Grade Code

- **Explicit over implicit** — no magic values, no silent defaults, no assumed globals.
- **Fail loudly, fail early** — validate at boundaries, throw precise errors with actionable messages.
- **No dead code** — no TODOs, stubs, or placeholders. If it isn't needed now, it doesn't exist.
- **Minimal surface area** — expose only what is necessary. Every unused export is a liability.
- **Unhappy path first** — guard against nulls, empty inputs, and failure modes before writing the success path.
- **No premature abstraction** — generalize only after a pattern appears twice.

Code is not done until it can be reviewed, tested, and deployed as-is without modification.

### 2. Docstrings & Comments

- **TSDoc** on all exported functions, components, hooks, and types — no exceptions.
- Every docstring is self-contained and timeless. Zero references to tasks, tickets, or conversations.
- Explain *why* and *how*, never *what*. If the code needs a *what* comment, rewrite the code.
- **Inline `//` comments**: last resort only. Valid use: non-obvious business rules, platform quirks, intentional trade-offs. Invalid use: restating the code, temporary notes, task-scoped context.
- No commented-out code. Ever. Git is the history.

### 3. TypeScript

- `strict: true` is non-negotiable. Never disable or suppress strict checks.
- Annotate every function parameter and return type — including `void` and `Promise<void>`.
- `any` is forbidden. Use `unknown` and narrow explicitly. If a third-party lib forces `any`, isolate it and add an inline comment explaining why.
- Prefer `type` over `interface` for data shapes. Use `interface` only for extendable contracts.
- No non-null assertions (`!`) unless the nullability is provably impossible, with a comment explaining why.
- Use discriminated unions over optional chaining chains for variant data shapes.

### 4. React

- **One component, one responsibility.** If a component handles more than one concern, split it.
- Components are **functions only** — no class components.
- Props must be explicitly typed with a named `type`. No inline anonymous prop types.
- No business logic inside JSX. Extract to a named function or hook before rendering.
- `useEffect` requires a comment explaining *why* the effect is needed and what it synchronizes. Effects that exist to fetch data should be replaced with a proper data-fetching abstraction.
- Never mutate state directly. Always derive new state.
- Keys in lists must be **stable and unique** — never use array index as a key.

### 5. State Management (React Context)

- Context is for **shared, cross-cutting state only** — auth, theme, app-wide settings. Not for local UI state.
- Every context must have: a typed value, a provider component, and a dedicated `use<Name>` hook that throws if used outside its provider.
- Local component state stays local (`useState`, `useReducer`). Do not lift state higher than necessary.
- Derived values must be computed with `useMemo` — never stored as redundant state.

### 6. Tauri IPC

- All Tauri commands are invoked through a **dedicated service module** (`src/services/`). Components never call `invoke()` directly.
- Every `invoke()` call is wrapped in `try/catch`. Unhandled IPC rejections are forbidden.
- IPC payloads and responses are typed with explicit `type` definitions — never `any` or raw `unknown`.
- Never expose system-level errors directly to UI. Map Rust errors to typed frontend error objects at the service boundary.
- IPC calls are **async by default**. Never block the render thread waiting on a command.

### 7. Styling (Tailwind CSS)

- Tailwind utility classes only. No inline `style={{}}` unless driven by a truly dynamic runtime value unavailable in Tailwind.
- No custom CSS files unless Tailwind cannot express the requirement — document why when added.
- Responsive and accessible by default: every interactive element must be keyboard-navigable and meet WCAG AA contrast.
- Extract repeated class combinations into a named component — not a custom CSS class.

### 8. Error Handling

- Define a typed `AppError` union in `src/types/errors.ts`. Never throw raw strings.
- Every async operation has explicit error handling. Unhandled promise rejections are bugs.
- User-facing error messages are human-readable and actionable. Internal error details (stack traces, system paths) are never shown to the user.
- Log errors to the console in development only. Production error reporting goes through a dedicated service.

### The Golden Rule
**When in doubt, do less and ask. A smaller correct implementation beats a larger incorrect one. Cleverness, speculation, and scope creep are bugs.**

---

## File Structure

```
.
├── src-tauri/                  # Tauri backend
│   ├─ capabilities/
│   │  └─ default.json
│   ├─ src/
│   │  ├─ db/
│   │  │  ├─ commands.rs
│   │  │  ├─ conversation.rs
│   │  │  ├─ init.rs
│   │  │  ├─ mod.rs
│   │  │  └─ types.rs
│   │  ├─ llm/
│   │  │  ├─ client.rs
│   │  │  ├─ commands.rs
│   │  │  ├─ mod.rs
│   │  │  └─ types.rs
│   │  ├─ lib.rs
│   │  ├─ main.rs
│   │  └─ secure_storage.rs
│   ├─ cargo.toml
│   ├─ config.toml
│   └─ tauri.conf.json
│
├── src/                              # React-TypeScript frontend
│   ├─ components/
│   │  ├─ auth/
│   │  │  ├─ AuthGate.tsx
│   │  │  ├─ AuthScreen.tsx
│   │  │  ├─ index.ts
│   │  │  └─ LoadingScreen.tsx
│   │  ├─ chat/
│   │  │  ├─ ChatArea.tsx
│   │  │  ├─ CodeBlock.tsx
│   │  │  ├─ EmptyState.tsx
│   │  │  ├─ MarkdownContent.tsx
│   │  │  ├─ MessageBubble.tsx
│   │  │  ├─ MessageList.tsx
│   │  │  ├─ MessageMeta.tsx
│   │  │  ├─ StreamingIndicator.tsx
│   │  │  └─ ThinkingBlock.tsx
│   │  ├─ command/
│   │  │  ├─ CommandItem.tsx
│   │  │  └─ CommandPalette.tsx
│   │  ├─ input/
│   │  │  ├─ InputArea.tsx
│   │  │  ├─ InputToolbar.tsx
│   │  │  ├─ ModelPicker.tsx
│   │  │  ├─ PromptInput.tsx
│   │  │  └─ ThinkingPicker.tsx
│   │  ├─ layout/
│   │  │  ├─ AppShell.tsx
│   │  │  ├─ ResizeHandle.tsx
│   │  │  ├─ Sidebar.tsx
│   │  │  └─ TitleBar.tsx
│   │  ├─ settings/
│   │  │  ├─ LLMTab.tsx
│   │  │  ├─ ProfileTab.tsx
│   │  │  └─ SettingsPanel.tsx
│   │  ├─ sidebar/
│   │  │  ├─ ConversationItem.tsx
│   │  │  ├─ ConversationList.tsx
│   │  │  ├─ SidebarFooter.tsx
│   │  │  └─ SidebarHeader.tsx
│   │  └─ ui/
│   │     ├─ Badge.tsx
│   │     ├─ Button.tsx
│   │     ├─ Divider.tsx
│   │     ├─ ScrollArea.tsx
│   │     ├─ Select.tsx
│   │     └─ Tooltip.tsx
│   ├─ context/
│   │  ├─ AuthContext.tsx
│   │  └─ ChatContext.tsx
│   ├─ hooks/
│   │  ├─ useChat.ts
│   │  ├─ useKeyboardShortcuts.ts
│   │  └─ useResizablePanel.ts
│   ├─ lib/
│   │  └─ auth/
│   │     ├─ authFlow.ts
│   │     ├─ deepLinkHandler.ts
│   │     ├─ index.ts
│   │     ├─ pkce.ts
│   │     ├─ secureStorage.ts
│   │     ├─ session.ts
│   │     └─ tokenExchange.ts
│   ├─ mocks/                       # Mock UI for testing without Tauri
│   ├─ services/
│   │  ├─ apiKey.ts
│   │  ├─ config.ts
│   │  ├─ conversation.ts
│   │  ├─ llm.ts
│   │  └─ llmSettings.ts
│   ├─ types/
│   │  ├─ highlight.d.ts
│   │  └─ index.ts
│   ├─ App.tsx
│   ├─ main.css
│   └─ main.tsx
├─ index.html
└─ package.json
```
