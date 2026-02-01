<div align="center">

<img src="https://github.com/RajeshTechForge/pinac_workspace/blob/main/assets/header_2.png" alt="header image">

<br>
<br>

<img alt="Github Contributors" src="https://img.shields.io/github/contributors/RajeshTechForge/pinac_workspace"/>
<img alt="GitHub closed issues" src="https://img.shields.io/github/issues-closed/RajeshTechForge/pinac_workspace"/>

[![View My Profile](https://img.shields.io/badge/View-My_Profile-blue?logo=GitHub)](https://github.com/rajeshtechforge)

A privacy-first, cross-platform, open-source desktop AI assistant for all

<br>

![](https://skillicons.dev/icons?i=react,tailwindcss,typescript,vite,electron,python,fastapi)

</div>

<br />

## PINAC Workspace

PINAC Workspace is a modern-looking _privacy-first_ AI chat for desktops, seamlessly blending Electron-React for a modern user experience with powerfully Python backend. Unlock the full potential of AI with unparalleled simplicity and user-friendliness, while enjoying ultimate freedom and privacy.

## ✨ Features

- **Total Freedom:** Choose between local (Ollama) and Cloud AI models (using API keys) to suit your workflow and privacy needs.
- **Privacy by Design:** No personal data is ever shared or stored on our servers. All features work fully offline, ensuring your data stays on your device.
- **Secure Authentication:** Sign in and out securely with Firebase Authentication, protecting your identity and access.
- **Real-Time Web Search:** Instantly access up-to-date information from the web to answer questions and enhance conversations.
- **Local Chat History:** All conversations are stored locally for your privacy and convenience. Easily revisit and refine past chats.
- **Modern Desktop Experience:** Enjoy a sleek, responsive UI built with Electron and React, powered by a robust Python backend.

## 🛹 UI-Design

<img src="https://github.com/RajeshTechForge/pinac_workspace/blob/main/assets/UI-Design.png" alt="app screenshot">

## 🚀 Getting Started

PINAC Workspace's python backend utilizes [uv](https://github.com/astral-sh/uv) for high-speed dependency resolution.

> [!NOTE]  
> Make sure your Ollama is running for using local AI models.

1. Clone the Repository

   ```bash
   git clone https://github.com/RajeshTechForge/pinac_workspace.git
   cd pinac_workspace

   ```

2. Install all dependencies

   ```bash
   npm install
   # install all backend and frontend dependencies
   npm run install:all

   # Create a `.env` file based on example
   # no need to modify .env, no changes required
   cp .env.example .env

   ```

3. Launch the App

   ```bash
   npm run dev
   # this will start both fast-api backend and
   # electron app at once
   ```

> [!IMPORTANT]
> **For Linux Users (Dev Mode):** To enable sign-in functionality, you need to register the custom protocol handler. Run the following commands once:
>
> ```bash
> # Create launcher script
> cat > ~/pinac-workspace-launcher.sh << 'EOF'
> #!/bin/bash
> cd /path/to/pinac_workspace/app
> /path/to/pinac_workspace/app/node_modules/.bin/electron . "$@"
> EOF
> chmod +x ~/pinac-workspace-launcher.sh
>
> # Create desktop entry (replace /path/to/ with your actual path)
> cat > ~/.local/share/applications/pinac-workspace-dev.desktop << 'EOF'
> [Desktop Entry]
> Version=1.0
> Name=PINAC Workspace Dev
> Exec=/home/$USER/pinac-workspace-launcher.sh %u
> Type=Application
> MimeType=x-scheme-handler/pinac-workspace;
> EOF
>
> # Register the protocol
> xdg-mime default pinac-workspace-dev.desktop x-scheme-handler/pinac-workspace
> update-desktop-database ~/.local/share/applications
> ```
>
> This enables the browser to redirect back to the app after authentication. For production builds (AppImage/deb), this is handled automatically.

## 🤝 Contributing

We love contributors! Whether you are fixing a bug or suggesting a feature.  
Check out [Contributing Guidelines](CONTRIBUTING.md) for more details.

## 📄 License

Distributed under the **MIT license**. See [LICENSE](LICENSE) for more information.

## 🌏 Contributors

Thanks to our contributors, we have received huge support from the open-source community.

<a href="https://github.com/RajeshTechForge/pinac_workspace/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=RajeshTechForge/pinac_workspace" />
</a>

---

<div align="center">
<p>Built with ❤️ for a better AI future by @RajeshTechForge</p>
</div>
