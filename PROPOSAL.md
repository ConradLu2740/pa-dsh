# ProactiveAgent → DeepSeek Harness（dsh）插件化正式方案

> 版本：v1（讨论稿） · 日期：2026-08-13 · 作者：Proma Agent × Conrad
> 依据：PA 全面评估（2026-08-13）、dsh 0.1.0-rc.6 源码与文档实测、PA core 0.10.0 API 梳理

---

## 1. 背景与目标

ProactiveAgent（PA）是"主动记忆 + 主动建议"的主动智能体插件，当前以 MCP 服务器 + 宿主 hooks + 独立 daemon 的三件套形态支持 Claude Code / Kimi / Cline / Codex。2026-08-13 评估结论：**引擎扎实（404 测试全绿、记忆闭环确定性），但"主动"层脆弱**——hooks 会漂移（Kimi 0.34 整版失效）、`claude -p` 不触发 hooks、daemon 依赖 launchd/systemd、沉默策略靠参数拍脑袋。

DeepSeek Harness（dsh）自称"一切皆插件"（cordis 架构）。本方案将 PA 重构为 **dsh 原生插件组**，用 dsh 的内置服务替换 PA 最脆弱的外挂部分。

**目标**：PA 的三大能力（记忆共享 / 主动建议 / 静默自律）在 dsh 中以一等公民身份落地，且核心引擎零重写。

---

## 2. 核心洞察：为什么 dsh 是 PA 最理想宿主

| PA 在 Claude Code 里的外挂（脆弱点） | dsh 原生对应物（已核实存在） |
|---|---|
| UserPromptSubmit / Stop hooks | `session/event` 持久事件流：`turn/start`、`turn/end`、`user/message`、`assistant/message`、`step/*` |
| SessionStart / SessionEnd hooks | `session/created` / `session/disposed` 生命周期事件 |
| daemon 定时巡检（launchd/cron） | `dsh-schedule` 插件：`schedule_create` 支持 at / after / every |
| hook 把建议塞进提示词 | `dsh-system-prompt`：`ctx.systemPrompt.context()` 每次组装时求值 + `system-prompt/assemble` waterfall |
| 系统通知（macOS/Windows/Linux 各写一遍） | UI slots（`conversation.chat.turnTail` 等）+ 建议箱 UI |
| 跨工具适配层（每宿主一个 adapter） | cordis 稳定插件接口，**一个插件组通吃 web/headless/tui 三个 profile** |

dsh 官方文档原话："超出「调用模型、运行工具、重复」的所有内容，都属于监听事件分类体系的插件"——PA 的 signals 层正是这个位置，是 dsh 架构里被期待存在的插件。

**意外收获**：PA core 的 `EvaluateNowTrigger` 已经定义了 `session_start | session_mid | session_end | manual | timer` 五种触发器，与 dsh 事件天然一一对应（见 §5），设计不用改一行引擎代码。

---

## 3. 总体架构

### 3.1 插件组（bundle）设计

PA 不是一个插件，而是一组 6 个插件，每个对应一层能力、可独立启用：

```
@proactive-agent/dsh
├── dsh-proactive-memory      记忆核心：工具 + persona 注入 + 记忆上下文注入
├── dsh-proactive-suggest     建议引擎：监听事件 → signals/rules → 建议队列
├── dsh-proactive-injector    建议投递：队列 → system prompt / 建议箱 UI 状态
├── dsh-proactive-daily       每日回顾：dsh-schedule 驱动的定时巡检（替代 daemon）
├── dsh-proactive-ui          界面：turnTail 记忆/建议卡片 + 设置页 + 建议箱
└── dsh-proactive-skills      skill 沉淀：sop 类记忆 → dsh skill provider
```

所有插件共享一个**进程内引擎实例**（`@proactive-agent/core` 的 memoryService + suggestService），存储统一指向 `~/.proma-proactive/`（与 Claude Code 版共享同一份记忆，跨宿主"教一次处处用"）。

### 3.2 数据流总览

```
用户消息
  │
  ▼
dsh session/event 流 ──► [suggest] turn/end 事件 → evaluateNow(session_mid)
  │                                                      │
  │                                              ┌───────┴────────┐
  │                                              ▼                ▼
  │                                       建议队列（内存）    suggestService 持久化
  │                                              │                │
  ▼                                              ▼                ▼
[memory] turn/start → contextForMessage   [injector] systemPrompt.context() 注入
  │                                        （下一轮提示词自动携带）
  ▼
记忆上下文注入 system prompt

[ui] turnTail 显示本回合捕获的记忆 + 建议箱（用户点开才注入模型流）
[skills] sop 记忆 → skills.registerProvider() → 模型按需加载 SKILL
[daily] dsh-schedule 每日定时 → evaluateNow(timer) → 每日回顾卡片
```

### 3.3 挂载形态

```
~/.dsh/profiles/web/cordis.patch.yml   ← 用户 patch 层（生产）
- insert:
    - id: pa-memory
      name: '@proactive-agent/dsh-memory'   # 或本地路径/workspace 包
      config: { dataDir: '~/.proma-proactive' }
    - id: pa-suggest
      name: '@proactive-agent/dsh-suggest'
      ...
```

`headless` profile 同样可挂（事件流通用，无 UI 部分自动降级），`tui` 同理。

---

## 4. 插件详细设计

### 4.1 dsh-proactive-memory（记忆核心）

**复用**：`memoryService`（capture / search / contextForMessage / persona / correction / stats）。

| 贡献 | 机制 |
|---|---|
| 原生工具注册 | `memory_capture` / `memory_recall` / `memory_extract` / `memory_pending` / `memory_confirm` / `memory_reject` / `persona_get` / `persona_save` / `scene_summary` / `memory_stats` 注册进 `ctx.tools`（原生名，无 `mcp__` 前缀，符合 dsh 工具注册惯例） |
| persona 注入 | `ctx.systemPrompt.section({ name: 'pa:persona', order: 5, text })`——persona 以提示词段形式常驻 |
| 记忆上下文注入 | 监听 `turn/start` 后用最新 `user/message` 调 `contextForMessage()`，结果存入共享状态；见 §4.3 |

### 4.2 dsh-proactive-suggest（建议引擎，PA 的"主动"心脏）

**复用**：`suggestService.evaluateNow()`（含全部抑制策略：会话内限 1 条、阈值 0.8、类型静默、预算、DND）。

**监听**：`session/event`（dsh-session 持久事件流，插件订阅事件的标准入口）。
- `session/created` → `evaluateNow({ trigger: 'session_start' })` → 存量待处理建议摘要
- `turn/end`（用户消息轮次完成）→ `evaluateNow({ trigger: 'session_mid', messages })` → 最多 1 条强信号建议
- `session/disposed` → `evaluateNow({ trigger: 'session_end', messages })` → 完整评估 + 会话沉淀

**产出**：建议记录写入 suggestService 持久化（与 Claude Code 版共享建议库），同时发布到进程内建议队列，供 injector/UI 消费。

### 4.3 dsh-proactive-injector（建议投递与记忆上下文）

两种投递模式（可配置切换）：

| 模式 | 机制 | 特征 |
|---|---|---|
| **上下文注入** | `ctx.systemPrompt.context()` 贡献动态上下文：每次提示词组装时求值，把队列头部建议 + `contextForMessage` 记忆上下文渲染进去 | 模型直接看到，最"主动" |
| **建议箱（推荐默认）** | 建议只进 UI 建议箱（§4.5），用户点选后才注入 | 模型流零打扰，用户主权 |

关键设计：`systemPrompt.context()` 是**每轮组装时求值**的动态提供方，建议的"出场"天然绑定下一轮提示词组装，无需 hook 式注入。

### 4.4 dsh-proactive-daily（每日回顾，替代 daemon）

- 复用 `dsh-schedule` 的 `schedule_create`（at / after / every 三种模式），**零自建定时器**
- 每日固定时间触发 `evaluateNow({ trigger: 'timer' })` + `memoryService.memoryReviewOpportunity()`（记忆 3 天未更新提醒）
- 产出注入建议箱 / turnTail 卡片，不再依赖 launchd/systemd

### 4.5 dsh-proactive-ui（界面层）

| UI 位置 | 内容 |
|---|---|
| `conversation.chat.turnTail`（已核实存在，派发 TurnTailOwnerProps） | 本回合捕获的记忆提示 + 建议卡片（接受/忽略按钮 → `suggestService` feedback） |
| 建议箱（sidebar 或 overlay slot） | 待处理建议列表，用户点选注入，ROI 转化数据回写 feedback |
| 设置页（settings section slot） | 每日上限 / 冷却 / DND / 投递模式切换——**把拍脑袋参数变成用户可见的旋钮** |

### 4.6 dsh-proactive-skills（记忆 → skill 沉淀）⭐

- dsh 的 `ctx.skills.registerProvider()`（已核实）允许自定义 skill 来源
- PA 里 `sop` 类型记忆（用户教的固定流程）经 provider 动态暴露为 dsh skill，格式 = PA 记忆内容 → SKILL.md（frontmatter + 正文）
- 效果："教一次处处用"在 dsh 里的落点不只是模型记忆，而是可被 `dsh-tool-skill` 按需加载的一等公民 skill
- 跨宿主对比：Claude Code 版 PA 做不到这件事（skill 是各宿主私有机制）

---

## 5. 事件映射总表（dsh ↔ PA 引擎）

| dsh 事件 / 挂载点 | PA 引擎触发器 | 动作 | 说明 |
|---|---|---|---|
| `session/created` | `session_start` | 返回存量待处理建议（≤5） | 新会话开场即提醒，不产生新建议 |
| `turn/end`（user 轮次） | `session_mid` | 评估 1 条强信号建议（correction/automation，raw≥0.8） | 会话中不打断工作流 |
| `session/disposed` | `session_end` | 完整评估 + 建议落库 | 会话结束沉淀 |
| `schedule_create` 每日 | `timer` | 同 session_mid 抑制 + 记忆回顾 | 替代 daemon |
| MCP 工具 / 原生工具 `suggest_now` | `manual` | 完整评估 | 用户主动要求 |
| `systemPrompt.context()` 组装 | — | 注入队列头部建议 + 记忆上下文 | 每轮组装求值 |
| `turn/start` | — | `contextForMessage()` 预热记忆上下文 | 供下一轮组装使用 |

---

## 6. 沉默机制设计（"该开口时开口、不该开口时闭嘴"）

三层递进，全部有 dsh 原生支撑：

1. **引擎层**（复用 core，已实现）：会话内限 1 条、阈值 0.8、类型连续忽略自动静默、全局接受率 <30% 自动降预算、DND 时段零产出。
2. **投递层**（新增）：建议箱模式默认开启——建议**不进模型上下文**，只在 UI 出现。模型流永远不被打扰。
3. **反馈层**（复用 core + 新增 UI）：接受/忽略 → feedback 持久化 → 类型权重调节 + ROI 转化率采集。**这是 Claude Code 版缺的真实数据闭环，dsh 版从第一天起就有转化数据**。

---

## 7. 存储与跨宿主共享

- 默认 `~/.proma-proactive/`，环境变量 `PROACTIVE_DATA_DIR` 可覆盖
- 与 Claude Code 版 PA 共享同一份记忆/建议库：在 Claude Code 教过的东西，dsh 里立刻 recall 得到
- dsh 侧不另造存储：session 持久化归 dsh，PA 记忆归 PA——两个系统各司其职，互不侵入

---

## 8. 技术选型与复用清单

| 复用 | 不重写 | 新增代码（预估） |
|---|---|---|
| `@proactive-agent/core` 全部引擎（memory/suggest/signals/rules/feedback/roi，404 测试） | 信号引擎、规则引擎、记忆存储、建议评估 | 6 个 cordis 插件薄层（合计约 1500–2500 行 TS） |
| suggestService 的 5 种触发器与抑制策略 | daemon（换 dsh-schedule）、通知（换 UI slots）、hooks 桥接（换事件订阅） | 建议箱 UI（约 400–600 行 React 风格组件，经 slots 注册） |
| 记忆存储格式与 CLI 迁移工具 | adapter 模式（dsh 一个插件组通吃三 profile） | skill provider 桥接（约 100–200 行） |

**依赖**：`@proactive-agent/core`（npm 已发布 0.10.0）+ `@deepseek-ai/dsh-*`（peer deps，运行时由 dsh 提供）。

**仓库决策（待讨论）**：
- 方案甲：并入 ProactiveAgent 仓库，新增 `packages/proactive-dsh`（与 core/adapters/mcp 并列，发布为 `@proactive-agent/dsh`）
- 方案乙：dsh 工作区独立仓库（当前 `workspace-files/pa-dsh/`），`@proactive-agent/core` 作为 npm 依赖
- 倾向：**方案乙起步**（快速迭代、不动 PA 主仓库的发布链路），稳定后视情况并回

---

## 9. 分阶段实施计划

### Phase 0 · MCP 桥接跑通（0.5 天，零代码）
- 在 `~/.dsh/profiles/web/cordis.patch.yml` 加一个 `dsh-mcp-client` 实例指向 PA 的 stdio MCP 服务器
- 验证：dsh 模型可用 `mcp__proactive__memory_capture` 等 16 个工具
- 价值：立即获得记忆能力，同时作为后续原生插件的对照基线

### Phase 1 · 记忆原生落地（1–2 天）
- `dsh-proactive-memory` 插件：原生工具注册（无 mcp__ 前缀）+ persona 段 + 记忆上下文注入
- 验证：工具注册、persona 在提示词中出现、相关记忆随消息注入

### Phase 2 · 主动建议落地（2–3 天）⭐ 核心
- `dsh-proactive-suggest`（事件监听）+ `dsh-proactive-injector`（建议箱模式 + 上下文注入模式）
- 验证：说"以后别用 var"→ turn/end 后建议箱出现 correction 建议 → 点接受 → 下一轮提示词携带该建议；接受率数据开始积累

### Phase 3 · 体验完善（2–3 天）
- `dsh-proactive-daily`（schedule 每日回顾）+ `dsh-proactive-ui`（turnTail 卡片 + 设置页）+ `dsh-proactive-skills`（sop → skill）
- 验证：每日回顾卡出现；设置页可调参数；sop 记忆可作为 skill 被模型调用

---

## 10. 风险与开放问题

| 风险 / 问题 | 等级 | 缓解 |
|---|---|---|
| dsh 是 0.1.0-rc.6，插件 API 可能随版本漂移 | 中 | 薄层隔离：插件只依赖 core + 少数已核实 API；dsh 升级时只需改薄层 |
| `systemPrompt.context()` 每轮求值的性能（记忆检索延迟） | 低 | contextForMessage 是确定性 BM25，无 LLM 调用，<10ms 量级 |
| headless 模式无 UI，建议箱不可用 | 低 | 自动降级为上下文注入模式（或关闭） |
| cordis 插件开发工具链不熟（TS 编译、HMR、cordis.yml 语法） | 中 | Phase 0/1 先走通最小闭环；用 dsh 自带的 cordis-plugin-development skill 作为开发参考 |
| `~/.proma-proactive/` 并发写（dsh 与 Claude Code 同时用） | 低 | PA core 自带锁与 pid 安全（评估已核实） |
| 与 PA 主仓库的版本同步策略 | 中 | Phase 1 前定仓库归属（§8 决策） |

**开放问题（需要讨论）**：
1. 插件包命名与发布范围：`@proactive-agent/dsh` 发 npm，还是先本地 workspace 包？
2. 建议箱的默认形态：常驻侧边栏 vs turnTail 内联 vs 两者都要？
3. 记忆上下文注入的粒度：每轮注入 top-3 相关记忆，还是仅 persona + 强相关记忆？
4. 与 Claude Code 版共存时，建议预算是否共享？（core 是进程内状态，双宿主并存时预算各自独立）

---

## 11. 验收标准

- [ ] **Phase 0**：dsh 会话中 `memory_capture` 写入后，新会话 `memory_recall` 可召回（跨会话、跨 profile 验证）
- [ ] **Phase 1**：persona 段出现在每次提示词组装；相关记忆在讨论相关话题时自动注入上下文
- [ ] **Phase 2**：强信号触发建议箱（不打断模型流）；接受后建议进入后续轮次；忽略 2 次同类型建议后自动静默；接受率 <30% 时预算自动下调
- [ ] **Phase 3**：每日回顾按时出现；sop 记忆可作为 skill 被 `dsh-tool-skill` 调用；设置页参数实时生效
- [ ] **跨宿主**：Claude Code 里 capture 的记忆，dsh 会话 recall 命中；反向亦然
- [ ] **回归**：PA core 404 测试全程保持全绿（引擎零改动）

---

## 12. 与 PA 现有架构的关系

```
@proactive-agent
├── core          （引擎，零改动）✅ 复用
├── adapters      （claude/kimi/cursor/cline/codex 配置生成器，dsh 用不上）
├── mcp           （MCP 服务器，Phase 0 过渡用，Phase 2 后 dsh 侧可弃）
└── dsh           （本方案，原生插件组）🆕
```

一个值得玩味的结论：**PA 在 dsh 里不再需要 adapter 模式**——adapter 存在是因为各宿主机制互不兼容，而 cordis 是稳定插件接口。这验证了"dsh 是最理想宿主"的判断。
