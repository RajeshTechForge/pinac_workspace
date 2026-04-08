<div align="center">

<img src="https://github.com/RajeshTechForge/pinac_workspace/blob/main/assets/header.png" alt="PINAC Workspace header" />

<br />
<br />

### Privacy-first, cross-platform, open-source desktop AI for everyone

<br />

![](https://skillicons.dev/icons?i=react,tailwindcss,typescript,vite,electron,python,fastapi)

</div>

<br />

PINAC Workspace is a modern desktop AI chat experience built with Electron + React and powered by a Python backend. It is designed for people who want flexibility, speed, and control over their data.

Whether you prefer local models with Ollama or cloud models via API keys, PINAC Workspace gives you a clean, productive interface without compromising privacy.

## Why PINAC Workspace?

- **Model freedom:** Use local models (Ollama) or cloud models based on your workflow.
- **Privacy by design:** Conversations and data stay on your machine.
- **Cross-platform desktop UX:** Fast, responsive interface built for daily use.
- **Secure sign-in:** Firebase Authentication for secure account access.
- **Real-time web search:** Bring fresh, up-to-date context into conversations.
- **Local chat history:** Revisit and continue previous chats anytime.

## App Screenshot

<div align="center">
  <img src="https://github.com/RajeshTechForge/pinac_workspace/blob/main/assets/UI-Design.png" alt="PINAC Workspace app screenshot" />
</div>

## Quick Start

The Python backend uses [uv](https://github.com/astral-sh/uv) for fast dependency management.

> [!NOTE]
> If you plan to use local AI models, make sure Ollama is installed and running.

1. Clone the repository:

```bash
git clone https://github.com/RajeshTechForge/pinac_workspace.git
cd pinac_workspace
```

2. Install dependencies:

```bash
npm install
npm run install:all
cp .env.example .env
```

3. Start the app (backend + desktop app):

```bash
npm run dev
```

## Linux (Dev Mode): Enable Sign-In Redirect

In Linux development mode, you need to register the custom protocol handler once so browser auth can redirect back to the app.

```bash
# Create launcher script
cat > ~/pinac-workspace-launcher.sh << 'EOF'
#!/bin/bash
cd /path/to/pinac_workspace/app
/path/to/pinac_workspace/app/node_modules/.bin/electron . "$@"
EOF
chmod +x ~/pinac-workspace-launcher.sh

# Create desktop entry (replace /path/to/ with your actual path)
cat > ~/.local/share/applications/pinac-workspace-dev.desktop << 'EOF'
[Desktop Entry]
Version=1.0
Name=PINAC Workspace Dev
Exec=/home/$USER/pinac-workspace-launcher.sh %u
Type=Application
MimeType=x-scheme-handler/pinac-workspace;
EOF

# Register the protocol
xdg-mime default pinac-workspace-dev.desktop x-scheme-handler/pinac-workspace
update-desktop-database ~/.local/share/applications
```

For production builds (AppImage/deb), this is handled automatically.

## Contributing

Contributions are always welcome, whether you are fixing bugs, improving UX, or proposing new features.

Please read the [Contributing Guidelines](CONTRIBUTING.md) to get started.

## License

Distributed under the **MIT License**. See [LICENSE](LICENSE) for details.

## Contributors

Thanks to everyone who supports and improves this project.

<a href="https://github.com/RajeshTechForge/pinac_workspace/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=RajeshTechForge/pinac_workspace" alt="Project contributors" />
</a>

---

<div align="center">
  <p>Built with ❤️ for a better AI future by @RajeshTechForge</p>
</div>
