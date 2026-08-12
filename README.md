<div align="center">

# 🎮 Text2Game Studio

### *Build High-Quality 3D Games by Just Speaking. No Code. No Experience. Zero Cost.*

[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Three.js](https://img.shields.io/badge/Three.js-WebGL-black?style=for-the-badge&logo=threedotjs&logoColor=white)](https://threejs.org/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Gemini AI](https://img.shields.io/badge/Gemini-AI-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev/)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

<br/>

> **Text2Game Studio** is a revolutionary, browser-based 3D game creation engine.  
> Simply speak your idea — the **Neural Architect AI** builds your game instantly.

<br/>

![Text2Game Studio Interface](./public/preview.png)

</div>

---

## 📌 Table of Contents

- [✨ What is Text2Game Studio?](#-what-is-text2game-studio)
- [🚀 Key Features](#-key-features)
- [🏗️ How It Works](#️-how-it-works)
- [🧠 Neural Architect AI](#-neural-architect-ai)
- [📁 Supported Asset Types](#-supported-asset-types)
- [🖥️ Tech Stack](#️-tech-stack)
- [⚙️ Getting Started](#️-getting-started)
- [🔑 BYOK — Bring Your Own Key](#-byok--bring-your-own-key)
- [📱 Mobile-Ready Games](#-mobile-ready-games)
- [💰 Use Cases](#-use-cases)
- [🗺️ Roadmap](#️-roadmap)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)

---

## ✨ What is Text2Game Studio?

**Text2Game Studio** is an advanced, AI-powered 3D game engine that runs **100% inside your browser**.

Traditional game development requires months of learning complex software, expensive teams of programmers, and costly cloud infrastructure. **Text2Game Studio eliminates all of that.**

A user simply:
1. **Uploads** their 3D characters, environments, and music
2. **Speaks** their idea into the microphone (e.g., *"Create an endless running game with aggressive enemies"*)
3. The **Neural Architect AI** instantly writes the game logic and builds a live, playable 3D game

No coding. No software installation. **Zero cost.**

---

## 🚀 Key Features

| Feature | Description |
|---|---|
| 🎙️ **Voice-to-Code Engine** | Speak in natural language — the AI writes the game code in real time |
| 🦴 **Auto Animation Rigging** | Upload a character + skeleton → AI auto-connects them flawlessly |
| 📐 **Procedural IK** | Inverse Kinematics ensures feet touch the ground naturally on any terrain |
| 🌍 **World Architect** | AI generates realistic, hilly procedural terrains automatically |
| 📱 **Auto Mobile Controls** | Virtual joystick & buttons are auto-injected for mobile-ready gameplay |
| 🖥️ **Dual Preview** | See your game in both Mobile and Desktop screen previews simultaneously |
| 🔐 **100% Private** | All assets are processed locally in your browser — nothing leaves your device |
| ⚡ **Zap Engine** | Automated mesh compression and texture optimization for 60 FPS performance |
| 🌐 **One-Click HTML Export** | Export your entire game as a single portable HTML file |
| 💸 **Zero Server Cost** | BYOK architecture means you pay nothing for cloud computing |

---

## 🏗️ How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                    USER UPLOADS ASSETS                       │
│         (3D Characters, Skeletons, Environments,             │
│              Enemies, NPCs, Music, Logic Cells)              │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                 INTELLIGENT AUTO-ROUTER                      │
│   Automatically categorizes assets by type using keywords   │
│   Base64 FileReader converts all files locally in browser   │
└──────────┬──────────────────────────────────────┬───────────┘
           │                                      │
           ▼                                      ▼
┌──────────────────────┐              ┌───────────────────────┐
│  Animation Retarget  │              │    World Architect     │
│  + Procedural IK     │              │  (Procedural Terrain)  │
└──────────┬───────────┘              └───────────┬───────────┘
           │                                      │
           └──────────────┬───────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              NEURAL ARCHITECT AI (BYOK)                      │
│   Processes voice prompts → Generates game logic & scripts  │
│   Manages NPC Behavior Trees & cinematic cameras            │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌──────────────┐       ┌────────────────────────────────────┐
│ 🖥️  Desktop  │       │  📱 Mobile Preview                 │
│   Preview    │◄─────►│  (Auto Virtual Joystick Injected)  │
└──────────────┘       └────────────────────────────────────┘
                            │
                            ▼
                ┌───────────────────────┐
                │  📦 Export HTML File  │
                │  Playable Anywhere!   │
                └───────────────────────┘
```

---

## 🧠 Neural Architect AI

The **Neural Architect** is the core brain of Text2Game Studio. It is powered by the **Google Gemini API** and acts as a virtual co-creator that handles every complex technical task for you.

### What it does automatically:
- **Animation Retargeting** — Translates bone names between different rig formats (e.g., Mixamo vs. Unreal Engine skeletons) and maps animations to your custom characters perfectly
- **Inverse Kinematics (IK)** — Mathematically calculates foot, hand, and joint positions so your character moves naturally on uneven terrain without clipping or glitching
- **NPC Behavior Trees** — Generates AI logic for enemies and NPCs (patrol, chase, attack, retreat) from a single text prompt
- **Cinematic Camera** — Creates professional camera rigs, follow-cams, and cutscene logic automatically
- **Mobile Touch Controls** — At runtime, detects mobile screen size and injects virtual joystick and action buttons directly into the game iframe

---

## 📁 Supported Asset Types

```
text1/
├── 🧍 Characters      → GLTF / GLB (3D character meshes)
├── 🦴 Skeletons       → GLTF / GLB (motion animation files: run, jump, attack, shoot)
├── 👹 Enemies         → GLTF / GLB (enemy character models)
├── 🤖 NPCs            → GLTF / GLB (non-player character models)
├── 🌄 Environments    → GLTF / GLB (world/level design assets)
├── 🎵 Music & SFX     → MP3 / WAV / OGG (background music and sound effects)
└── ⚙️  Logic Cells    → JSON (custom game rules and behavior definitions)
```

---

## 🖥️ Tech Stack

```
Frontend Framework   →  React 18 + TypeScript
Build Tool           →  Vite 6
3D Rendering Engine  →  Three.js + @react-three/fiber
AI Engine            →  Google Gemini API (BYOK)
Asset Processing     →  Browser FileReader API (Base64)
State Management     →  localStorage + React Context
Styling              →  Vanilla CSS + CSS Variables
3D File Format       →  GLTF / GLB (via GLTFLoader)
Export Format        →  Single Portable HTML File
```

---

## ⚙️ Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) v18 or higher
- A [Google Gemini API Key](https://ai.google.dev/) (free to obtain)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/YOUR_USERNAME/text2game-studio.git

# 2. Navigate into the project folder
cd text2game-studio

# 3. Install all dependencies
npm install

# 4. Start the development server
npm run dev
```

### Open in Browser
```
http://localhost:3000
```

---

## 🔑 BYOK — Bring Your Own Key

Text2Game Studio uses a **"Bring Your Own Key"** (BYOK) model.

This means:
- You use your **own free Google Gemini API key**
- The app runs **entirely in your browser** — there is no backend server
- You pay **absolutely zero** in cloud server fees, no matter how many games you create
- Your API key is stored **only in your browser's localStorage** — it never reaches any external server

### How to add your key:
1. Get a free API key from [https://ai.google.dev/](https://ai.google.dev/)
2. Click **"GEMINI API CONFIG"** in the top right corner of the app
3. Paste your API key and click Save
4. Start building! ✅

---

## 📱 Mobile-Ready Games

Every game built in Text2Game Studio is **automatically mobile-optimized**.

The Neural Architect detects the output screen size at runtime and:
- Injects a **virtual on-screen joystick** for movement
- Injects **action buttons** (Jump, Attack, Shoot) for touch input
- Scales and adapts the game canvas to fit any screen resolution

The final exported **HTML file** is playable on:
- ✅ Desktop browsers (Chrome, Firefox, Edge, Safari)
- ✅ Mobile browsers (Android Chrome, iOS Safari)
- ✅ Tablets
- ✅ Any device with a modern browser — **no app store needed**

---

## 💰 Use Cases

| Sector | How Text2Game Studio Helps |
|---|---|
| 🎮 **Indie Game Dev** | Solo creators build AAA-quality games at zero cost using their own assets |
| 📚 **EdTech** | Teachers create interactive 3D learning simulations without any coding |
| 📣 **Digital Marketing** | Brands create playable 3D mini-games for campaigns and embed them in websites |
---

## 🗺️ Roadmap

- [x] Voice-to-Code Neural Architect Engine
- [x] Animation Retargeting Pipeline
- [x] Procedural Inverse Kinematics (IK)
- [x] World Architect (Procedural Terrain)
- [x] Dual Preview (Mobile + Desktop)
- [x] Auto Mobile Touch Controls Injection
- [x] Single HTML File Export
- [x] BYOK Gemini API Architecture
- [ ] **Pro Tier:** AI Generation of 3D Models & Animations without uploads
- [ ] **Cloud Save:** Optional encrypted cloud project storage
- [ ] **Multiplayer Logic:** Neural Architect generates multiplayer game scripts
- [ ] **Asset Marketplace:** Community asset sharing library

---

## 🤝 Contributing

Contributions are always welcome! Here's how to get started:

```bash
# Fork the repository, then:
git checkout -b feature/your-feature-name
git commit -m "Add: your feature description"
git push origin feature/your-feature-name
# Open a Pull Request on GitHub
```

Please make sure your code follows the existing TypeScript + React patterns and that the project still builds successfully with `npm run dev`.

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Made with ❤️ by Naveen Kumar**

⭐ **If you found this project useful, please give it a star on GitHub!** ⭐

</div>
