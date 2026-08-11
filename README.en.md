# 顺藤摸瓜 (ShunTengMoGua) — AI Intelligent Office Partner

> Not "yet another DingTalk/Feishu/WPS", but a warm, understanding AI office partner. Powered by MAF multi-agent orchestration, personified by a 3D digital companion, and safeguarded by a stress monitor for your wellbeing.

> 📌 Built upon [GuaDa](https://github.com/donggua-zen/guada). With gratitude to [@donggua-zen](https://github.com/donggua-zen) for the original open-source work.

[![NestJS](https://img.shields.io/badge/NestJS-11.x-red.svg)](https://nestjs.com)
[![Vue](https://img.shields.io/badge/Vue-3.x-4FC08D?logo=vue.js&logoColor=white)](https://vuejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.x-blue.svg)](https://www.typescriptlang.org)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

---

## Repository

- **GitHub**: https://github.com/TINGTING-A/shuntengmogua

---

## Key Innovations

### 1. 3D Digital Companion Sprite

Not a cold progress bar. A Three.js WebGL rendered 3D companion sprite that expresses emotions and animations in real-time as tasks progress. A four-stage evolution tree (Egg → Bird → Fox → Dragon) charts its growth alongside yours.

### 2. Stress Monitor

AI analyzes local work patterns — response speed, document edit frequency, online duration, meeting density — to assess stress levels. 4-dimension weighted scoring + 3-tier alerts. All data processed locally, never uploaded.

### 3. CRDT Personal Bus

Yjs real-time sync + libsodium E2EE encryption bridges local files, knowledge bases, and IM messages. Local-first architecture, fully functional offline.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Agent Orchestration** | LangGraph 1.4+ (MAF-compatible), StateGraph workflows + checkpoint/resume + human-in-the-loop |
| **Backend** | NestJS 11 + TypeScript 6 |
| **Frontend** | Vue 3.5 + Vite 8 (Rolldown Rust) + Pinia |
| **UI** | Element Plus + TailwindCSS 4 |
| **3D** | Three.js WebGL |
| **Desktop** | Electron 43 |
| **Database** | SQLite + sqlite-vec + FTS5 + jieba + BM25 |
| **Embeddings** | BGE-M3 / BAAI/bge-small-zh-v1.5 (local, 512-dim) |
| **Long-term Memory** | Mem0 (multi-level memory + entity linking + temporal reasoning) |
| **CRDT Sync** | Yjs (real-time collaboration + offline merge) |
| **E2EE** | libsodium (XChaCha20-Poly1305 + Curve25519) |
| **Knowledge Graph** | Kuzu embedded graph DB (entity extraction + relationship modeling) |
| **Speech-to-Text** | Faster-Whisper small (local CPU, port 9000) |
| **Text-to-Speech** | Fish Speech (6 emotional tones, pending deployment) |
| **Browser Automation** | Playwright + Web Tool Provider |
| **LLM Adapters** | OpenAI SDK, 16 providers (DeepSeek/OpenAI/Qwen/Zhipu/Kimi/Hunyuan/Spark etc.) |
| **Containerization** | Docker + Docker Compose + Nginx |

---

## 29 Sub-Agent System

| Category | Agents |
|----------|--------|
| **Core** | PlanningAgent, FileAgent, SearchAgent, MemoryAgent |
| **Connector** | WechatAgent, NotionAgent, EmailAgent, BrowserAgent, KnowledgeGraphAgent, SyncAgent, VoiceAgent, SpriteAgent, StressAgent |
| **Enterprise** | DingTalkAgent, FeishuAgent, WecomAgent, WPSAgent (pending credentials) |
| **Skill** | WriteDocument, TranslateText, SummarizeContent, SearchKnowledge, ExtractInfo, WriteEmail, CodeReview, GenerateImagePrompt, ScheduleTask, AnalyzeData, Brainstorm, DailyAssistant |

---

## Quick Start

### Prerequisites
- Node.js 22
- Python 3.10+ (for Whisper / Embedding services)

### One-click Launch

```bash
python3 /home/an/scripts/start-shuntengmogua.py
```

Starts 4 services simultaneously:

| Service | Port | Purpose |
|---------|------|---------|
| Whisper STT | 9000 | Speech recognition |
| Embedding | 9001 | Vector embeddings |
| Backend | 3000 | NestJS API |
| Frontend | 5173 | Vite dev server |

Open `http://192.168.1.21:5173`, default credentials `admin` / `123456`

### Manual Start

```bash
# Backend
cd backend-ts
npm install && npm run db:seed:force && npm run start:dev

# Frontend
cd frontend
npm install && npm run dev
```

### Docker

```bash
cp backend-ts/.env.example backend-ts/.env
chmod +x deploy.sh && ./deploy.sh
# Frontend: http://localhost:8787
```

---

## Project Structure

```
guada_ai-master/
├── backend-ts/              # NestJS backend
├── frontend/                # Vue 3 frontend
├── electron/                # Electron desktop
├── docs/                    # Deployment docs
└── docker-compose.yml
```

---

## Development Status

| Feature | Status |
|---------|--------|
| MAF / LangGraph Agent Orchestration | ✅ Done |
| 29 Sub-Agent System | ✅ Done |
| 3D Companion Sprite + Evolution Tree | ✅ Done |
| Stress Monitor | ✅ Done |
| CRDT Personal Bus + E2EE | ✅ Done |
| BGE-M3 Local Embeddings | ✅ Done |
| Whisper STT | ✅ Done |
| 12 Built-in Skill Agents | ✅ Done |
| IM Bot Gateway | ✅ Done |
| 16 Providers / 200+ Models | ✅ Done |
| 92 AI Characters / 12 Groups | ✅ Done |
| Docker Deployment | ✅ Done |
| Electron Packaging | 🔧 Configured |
| Fish Speech TTS | 📝 Pending |
| Enterprise Connectors | 📝 Pending credentials |

---

## License

MIT License, inherited from the GuaDa project.

---

## Acknowledgments

Built upon [GuaDa](https://github.com/donggua-zen/guada). Special thanks to [@donggua-zen](https://github.com/donggua-zen) and the GuaDa community.

Key enhancements over GuaDa:
- LangGraph / MAF Agent orchestration (replaces hand-written ReAct loop)
- 29 sub-agent system (12 skills + 9 connectors + 4 enterprise + 4 core)
- Mem0 long-term memory, 3D companion sprite, stress monitor
- CRDT Personal Bus (Yjs + libsodium E2EE), Kuzu knowledge graph
- Local Whisper STT + BGE-M3 Embedding dual services
- 16 model providers, 200+ models, 92 AI characters
- Light/dark dual-theme wallpapers, full brand customization
