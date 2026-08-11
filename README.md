# 顺藤摸瓜 — AI 智能办公伙伴

> 不做"另一个钉钉/飞书/WPS"，而是做一个有温度、懂你的 AI 智能办公伙伴。以 MAF 多智能体编排为引擎，以 3D 数字生命体赋予 AI 人格，以压力预警仪守护身心健康。

> 📌 本项目基于 [GuaDa（瓜达AI工作站）](https://github.com/donggua-zen/guada) 二次开发，感谢原作者 [@donggua-zen](https://github.com/donggua-zen) 的开源贡献。

[![NestJS](https://img.shields.io/badge/NestJS-11.x-red.svg)](https://nestjs.com)
[![Vue](https://img.shields.io/badge/Vue-3.x-4FC08D?logo=vue.js&logoColor=white)](https://vuejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.x-blue.svg)](https://www.typescriptlang.org)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

[English](README.en.md)

---

## 项目仓库

- **GitHub**: https://github.com/TINGTING-A/shuntengmogua

---

## 核心卖点

### 1. 3D 数字生命体 — 伴生精灵

系统不再是冷冰冰的进度条。一个利用 Three.js WebGL 渲染的 3D 伴生精灵，随着任务状态实时变化表情和动画，陪你一起工作。蛋 → 鸟 → 狐 → 龙，四阶段进化树，见证它的成长。

### 2. 压力预警仪

AI 通过本地分析工作模式——消息回复速度、文档修改频率、在线时长、会议密度——判断压力水平。4 维加权评分 + 3 级预警，所有数据本地处理，决不上传云端。

### 3. CRDT 个人总线

Yjs 实时同步 + libsodium E2EE 端到端加密，打通本地文件、知识库、IM 消息等数据孤岛。本地优先架构，断网全功能可用。

---

## 技术架构

| 层级 | 技术选型 |
|------|---------|
| **Agent 编排** | LangGraph 1.4+（MAF 兼容），StateGraph 图式工作流 + 检查点/断点续跑 + 人机环流 |
| **后端框架** | NestJS 11 + TypeScript 6 |
| **前端框架** | Vue 3.5 + Vite 8 (Rolldown Rust) + Pinia |
| **UI 组件** | Element Plus + TailwindCSS 4 |
| **3D 渲染** | Three.js WebGL（伴生精灵） |
| **桌面端** | Electron 43 |
| **数据库** | SQLite + sqlite-vec 向量检索 + FTS5 + jieba 分词 + BM25 |
| **向量嵌入** | BGE-M3 / BAAI/bge-small-zh-v1.5（本地部署，512 维） |
| **长期记忆** | Mem0（多级记忆 + 实体链接 + 时间推理） |
| **CRDT 同步** | Yjs（实时协同 + 离线合并） |
| **端到端加密** | libsodium (XChaCha20-Poly1305 + Curve25519) |
| **知识图谱** | Kuzu 嵌入式图库（实体提取 + 关系建模 + DFS 路径搜索） |
| **语音识别** | Faster-Whisper small（本地 CPU，端口 9000） |
| **语音合成** | Fish Speech（6 种情感语调，待部署） |
| **浏览器自动化** | Playwright + Web Tool Provider（fetch_url / search_web） |
| **LLM 适配** | OpenAI SDK 统一适配（DeepSeek / OpenAI / 通义 / 智谱 / Kimi / 混元 / 星火 等 16 供应商） |
| **容器化** | Docker + Docker Compose + Nginx |

---

## 29 子智能体体系

| 类别 | Agent | 说明 |
|------|-------|------|
| **核心** | PlanningAgent | 主编排，MAF StateGraph 工作流驱动 |
| **核心** | FileAgent | 本地文件系统，深度搜索、智能分类 |
| **核心** | SearchAgent | BGE-M3 语义搜索 + BM25 混合检索 |
| **核心** | MemoryAgent | Mem0 多级记忆，自动提取 + 实体链接 |
| **连接器** | WechatAgent | iLink Bot，微信消息提取/搜索/收藏/导出 |
| **连接器** | NotionAgent | Notion API，页面 CRUD + 数据库查询 |
| **连接器** | EmailAgent | IMAP 协议，Gmail/Outlook/QQ 邮箱 |
| **连接器** | BrowserAgent | Web Tool Provider，网页抓取 + 搜索 |
| **连接器** | KnowledgeGraphAgent | Kuzu 图库，实体提取 + 关系路径查找 |
| **连接器** | SyncAgent | Yjs CRDT 同步 + E2EE 加密 |
| **连接器** | VoiceAgent | Whisper STT + Fish Speech TTS，双向语音 |
| **连接器** | SpriteAgent | 3D 精灵状态控制，MAF 联动动画 |
| **连接器** | StressAgent | 4 维压力监测 + 3 级预警 + 精灵联动 |
| **企业** | DingTalkAgent / FeishuAgent / WecomAgent / WPSAgent | 待开放平台凭证激活 |
| **技能** | WriteDocument / TranslateText / SummarizeContent / SearchKnowledge / ExtractInfo / WriteEmail / CodeReview / GenerateImagePrompt / ScheduleTask / AnalyzeData / Brainstorm / DailyAssistant | 12 个内置技能子智能体 |

---

## 核心功能

### AI 对话引擎
- LangGraph StateGraph 图式工作流，替代传统 ReAct 循环
- 检查点与断点续跑，Agent 崩溃后从检查点恢复
- 人机环流审批，关键操作需人工确认
- SSE 流式传输，会话锁防并发，中断处理节省 Token
- 两级上下文压缩（工具结果裁剪 + 语义压缩），非破坏性可回退
- Token 精准计数（@huggingface/tokenizers）

### RAG 知识库
- 40+ 格式文档上传，智能分块 + 向量嵌入
- 混合检索：语义（sqlite-vec）+ 关键词（FTS5 + jieba + BM25）
- Agent 自助搜索与自助添加文档
- 层级目录管理，异步处理自动恢复

### Skills 技能框架
- 兼容 Anthropic Skills 协议，文件即技能、热插拔
- 12 个内置技能已封装为独立子智能体
- 聊天输入框 `/` 触发技能选择器

### IM 机器人网关
- QQ / 企业微信 / Discord 统一接入
- 自动重连、消息合并、会话映射
- 配合知识库搭建 24h 智能客服

### 92 个 AI 角色
- 12 个分组：前沿模型 / 办公效率 / 知识专业 / 技术开发 / 创意灵感 / 生活陪伴 / 金融财经 / 教育职场 / 法律医疗 / 电商时尚 / 生活服务 / AI 前沿应用
- 每个角色含完整 System Prompt + 推荐模型 + 工具配置

### 定时任务
- Cron 表达式与固定间隔，角色继承，会话隔离，完整执行记录

### 多模型管理
- 16 家供应商，200+ 模型模板补齐
- 测试连接、动态切换、层级配置（角色/会话/全局）
- 思考强度控制（DeepSeek reasoning_effort）

---

## 快速开始

### 环境要求
- Node.js 22
- Python 3.10+（Whisper / Embedding 服务）

### 一键启动

```bash
python3 /home/an/scripts/start-shuntengmogua.py
```

同时启动 4 个服务：

| 服务 | 端口 | 说明 |
|------|------|------|
| Whisper STT | 9000 | 语音识别（faster-whisper small） |
| Embedding | 9001 | 向量嵌入（BAAI/bge-small-zh-v1.5） |
| 后端 | 3000 | NestJS API |
| 前端 | 5173 | Vite 开发服务器 |

访问 `http://192.168.1.21:5173`，默认账户 `admin` / `123456`

### 手动启动

```bash
# 后端
cd backend-ts
npm install
npm run db:seed:force
npm run start:dev          # → http://localhost:3000

# 前端
cd frontend
npm install
npm run dev                # → http://localhost:5173
```

### Docker 部署

```bash
cp backend-ts/.env.example backend-ts/.env
chmod +x deploy.sh && ./deploy.sh
# 前端: http://localhost:8787
```

---

## 项目结构

```
guada_ai-master/
├── backend-ts/                  # NestJS 后端
│   ├── prisma/schema.prisma     # 数据库 Schema
│   ├── src/
│   │   ├── modules/
│   │   │   ├── chat/            # Agent 引擎 + MAF 编排 + 压缩 + 上下文
│   │   │   ├── agents/          # 29 子智能体 + Mem0 + 语音 + 压力监测 + 智能文档
│   │   │   ├── knowledge-base/  # RAG 知识库
│   │   │   ├── skills/          # Skills 技能框架
│   │   │   ├── tools/           # 工具调用 + MCP
│   │   │   ├── llm-core/        # LLM 适配层（16 供应商）
│   │   │   ├── bot-gateway/     # IM 机器人网关
│   │   │   ├── personal-bus/    # CRDT 同步 + E2EE 加密 + 本地嵌入
│   │   │   ├── characters/      # 92 角色管理
│   │   │   ├── scheduler/       # 定时任务
│   │   │   ├── models/          # 多模型管理
│   │   │   └── ...
│   │   └── main.ts
│   └── bundled-skills/          # 12 个内置技能
├── frontend/                    # Vue 3 前端
│   └── src/components/
│       ├── chat/                # 对话界面
│       ├── sprite/              # 3D 伴生精灵
│       ├── stress-monitor/      # 压力预警仪
│       ├── personal-bus/        # 个人总线
│       ├── agent-center/        # 智能体中心
│       ├── knowledge-base/      # 知识库管理
│       └── ...
├── electron/                    # Electron 桌面端
├── docs/                        # 部署文档
└── docker-compose.yml
```

---

## 开发路线

| 模块 | 状态 |
|------|------|
| MAF / LangGraph Agent 编排 | ✅ 完成 |
| 29 子智能体体系 | ✅ 完成 |
| Mem0 长期记忆引擎 | ✅ 代码完成（待配 Key） |
| 3D 伴生精灵 + 进化树 | ✅ 完成 |
| 压力预警仪 | ✅ 完成 |
| CRDT 个人总线 + E2EE | ✅ 完成 |
| BGE-M3 本地嵌入 | ✅ 完成 |
| Whisper STT 语音识别 | ✅ 完成 |
| SmartDoc 智能文档 | ✅ 完成 |
| 12 内置技能子智能体 | ✅ 完成 |
| IM 机器人网关 | ✅ 完成 |
| 16 供应商 / 200+ 模型 | ✅ 完成 |
| 92 AI 角色 / 12 分组 | ✅ 完成 |
| Docker 部署 | ✅ 完成 |
| Electron 桌面打包 | 🔧 配置完成（待打包） |
| Fish Speech TTS | 📝 待部署 |
| 企业连接器（钉钉/飞书/企微/WPS） | 📝 待配置凭证 |

---

## 许可证

本项目基于 [MIT License](LICENSE) 开源，继承自 GuaDa 项目。

---

## 致谢

本项目基于 [GuaDa（瓜达AI工作站）](https://github.com/donggua-zen/guada) 二次开发，感谢原作者 [@donggua-zen](https://github.com/donggua-zen) 及 GuaDa 社区的开源贡献。

顺藤摸瓜在 GuaDa 的基础上进行了以下增强：
- LangGraph / MAF Agent 编排引擎（替代手写 ReAct 循环）
- 29 子智能体体系（12 技能 Agent + 9 连接器 Agent + 4 企业 Agent + 4 核心 Agent）
- Mem0 长期记忆引擎、3D 伴生精灵、压力预警仪
- CRDT 个人总线（Yjs + libsodium E2EE）、Kuzu 图数据库知识图谱
- 本地 Whisper STT + BGE-M3 Embedding 双服务
- 16 家模型供应商、200+ 模型、92 个 AI 角色
- 深色/浅色双主题壁纸、完整品牌定制
