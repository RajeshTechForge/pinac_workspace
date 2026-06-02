<div align="center">

<img width="6000" height="2000" alt="Welcome to Pinac-Workspace" src="https://github.com/user-attachments/assets/8072e546-9ffc-4a02-8348-efcec808a86c" />

### Privacy-first, cross-platform desktop AI assistant for everyone

<br />

![](https://skillicons.dev/icons?i=react,tailwindcss,typescript,tauri,python,fastapi)

</div>


---

## What is Pinac-Workspace ?

Pinac-Workspace is a minimalist-designed & lightweight secure desktop AI-chat experience built with Tauri & React and powered by python FastAPI backend. It is designed for people who want flexibility, speed, security and control over their data _with minimum load on RAM.

## 🔥 Features

- **Model Freedom:** Bring your own API key and connect any supported model — including those with extended thinking mode. No vendor lock-in, no forced defaults.

- **Security-oriented Architecture:** Built desktop-first, not as a browser-based shell. The reduced attack surface means your keys and conversation data stay where they belong: on your machine.

- **Local Chat History:** Every conversation is persisted locally via SQLite. Pick up where you left off without relying on any cloud sync or external service.

- **FastAPI Backend:** The Python backend is thin, fast, and easy to extend. Swap components, add endpoints, or hook into your own tooling without fighting the architecture.

- **Lightweight by Design:** Low RAM footprint with minimal resource usage — runs comfortably alongside the rest of your development environment without competing for headroom.

- **Cross-platform Consistency:** A native feel across major desktop platforms with no platform-specific workarounds required.

- **Minimalist Interface:** No dashboards, no telemetry nags, no clutter. Just a focused UI that stays out of your way.

## 🚀 Getting Started

There are two ways to setup depending on your focus:

- **Frontend only** — No Rust or Python required. Launch the _mock UI_ in a browser and work entirely on the desktop app's interface. Made for testing UI changes without needing to run the full desktop app.
- **Full setup** — Required if you are working on the backend, core desktop functionality, or want to run the full app locally.

### Prerequisites

| Requirement | Purpose |
|---|---|
| **Node.js** | Desktop app and mock UI |
| **Python** + **[uv](https://docs.astral.sh/uv/getting-started/installation/)** | Backend and package management (full setup only) |
| **Rust** | Tauri desktop builds (full setup only) |

### 1. Clone the Repository

```bash
git clone https://github.com/RajeshTechForge/pinac_workspace.git
cd pinac_workspace
```

### 2. Install Dependencies

```bash
# Desktop app dependencies
cd desktop
npm install

# Python backend dependencies
uv sync
uv pip install -e .   # Install in editable mode
```

### 3. Launch the App

The backend and desktop app run as separate processes. Open two terminal panels:

**Terminal 1 — FastAPI backend:**
```bash
cd backend
uv run uvicorn nexus.api.app:app --reload
```

**Terminal 2 — Desktop app:**
```bash
# Full desktop app
npm run tauri dev

# Mock UI in browser (no Rust or Python needed)
npm run dev:mock
```

## ⌛ Finding old versions ?

Checkout `build/electron` branch for the old Electron-based version of Pinac-Workspace. This branch contains the previous implementation before we switched to Tauri for better performance and security. Also you can find in release section of this repository for the old releases. 

## 🤝 Contributing

Contributions are always welcome, whether you are fixing bugs, improving UX, or proposing new features.

Please read the [Contributing Guidelines](CONTRIBUTING.md) to get started.

## 📝 License

Distributed under the **MIT License**. See [LICENSE](LICENSE) for details.

---

<div align="center">
  <p>Built with ❤️ for a better AI future by @RajeshTechForge</p>
</div>
