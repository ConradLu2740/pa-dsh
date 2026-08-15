# pa-dsh 升级蓝图 v2：dsh × PA 1+1>2 协同路线

> 生成于 2026-08-14 · 依据：dsh 源码深潜（deepseek-harness HEAD 47f9438，clone 于会话工作台 dsh-src/）+ 本地 live 实测（localhost:8080，11 项）+ @proactive-agent/core@0.9.2 API 面调研 + 官方文档调研。
> 状态：蓝图已定，待实施。实施顺序见 §5。

## 0. 一句话结论

PA 的地基（跨会话语义记忆 + 主动建议引擎）是稳的，**糟粕在于重复造了 dsh 已提供的基础设施**（自研 turn 检测 / 定时器 / HTTP LLM 客户端 / UI 管线 / 技能注册）。升级主线 = **用 dsh 原生机制替换 PA 的自研外围层**，同时把 PA 的"主动"能力做成 dsh 生态的补位（1+1>2）。

## 1. 实测问题清单（2026-08-14 live 测试，按严重度）

| # | 问题 | 严重度 | 证据与影响 |
|---|---|---|---|
| 1 | 建议通知干扰模型 | 🔴 | 通知以 `user/message`(source.kind=plugin) 进会话流，模型复述通知、讨论处理方式；用户"好的"被解读为同意 dismiss |
| 2 | 通知永久写入会话日志 | 🔴 | fork/续聊重放；新会话开箱即收全部 pending 通知 |
| 3 | 画像 stale | 🟠 | profile.md 停在 08-13，当天 capture 的未刷新；capture 后不强制 regeneratePersona |
| 4 | 建议洪水 | 🟠 | 5 分钟内同一 duplicateKey 生成两条通知 |
| 5 | dup key 双全角冒号 bug | 🟠 | 同规则产生 accept+ignore 两条记录（`：以后…` vs `:以后…`） |
| 6 | 原生工具与 MCP 桥摇摆 | 🟠 | 同一会话模型既调 `memory_recall` 又调 `mcp__proactive__memory_pending`，工具面重复 |
| 7 | 建议箱串项目 | 🟡 | dsh 项目建议箱出现 arkcli 项目的旧建议 |
| 8 | pa-daily 内存缓冲重启即丢 | 🟡 | 24h 缓冲纯内存；进程不在 09:30 就不触发 |

已验证通过：跨会话记忆闭环 ✅、建议反馈闭环 ✅、重启持久性 ✅、MCP 桥（Phase 0）✅。

## 2. 六插件裁决（取其精华去其糟粕）

| 插件 | 裁决 | 理由 |
|---|---|---|
| pa-core | ✅ 保留 | 进程内单例宿主是整套设计的精华（P0 修复），继续作为唯一 core import 者 |
| pa-memory | ✅ 保留 +2 改 | 修复：capture 后强制 regeneratePersona；persona 长度 cap（画像过长风险） |
| pa-suggest | ⚠️ 保留骨架 +3 改 | silentErrors 默认 true 掩盖错误；collectors Map 生命周期；lastSessionId 竞态。turn 检测改 `agent/turn-stopping` |
| pa-injector | ⚠️ 工具保留，通知通道必须 turnTail 化 | session.append 通知是实测伤害最大的设计，废弃 |
| pa-daily | 🔧 改造 | 自建 Node timer + 内存缓冲 → jobs 异步 + 缓冲落盘 + 外部调度 |
| pa-skills | ✅ 保留 +修编号漂移 | pa-sop-N 改为稳定 id；保留 control 引用以支持 invalidate() |

**收拢目标**：6 插件 → 3 插件（memory/suggest/daily）+ 1 个客户端 slot 插件 + 1 个 projection/types 包。

## 3. 1+1>2 双向协同设计

### dsh → PA（dsh 原生机制让 PA 脱胎换骨）

| 机制 | 替换 PA 的什么 | 优先级 |
|---|---|---|
| `agent/turn-stopping`（serial 终检点，可 steer 续轮） | 自研 turn/end 检测 + session 事件猜测 | P0 |
| `ctx.systemPrompt.context()`（每步求值、durable snapshot） | 静态提示词注入 → 每轮记忆注入 M1 | P0 |
| `agent/session-start`（source: startup/resume/clear/compact）+ `agent.inject()` | 会话开场无播种 | P0 |
| `ctx.userQuestions.ask()`（无 open-turn 要求） | pending 记忆确认的纯文本追问（M2 确认通道） | P0 |
| 官方 `dsh-schedule`（durable schedule/change 事件） | pa-daily 自研 Node timer（"schedule 做闹钟、PA 做执行"，PA 消费 dispatch 事件不 followup 白烧调用） | P1 |
| `ctx.llm.stream()` 宿主适配器注册表 | 自建 HTTP LLM 客户端（S3 主路径；MEMORY_LLM_* 降级为可选 pa-memory adapter env 源） | P1 |
| `todo/write` 事件（UI 自动渲染 checklist） | automation 建议的文本指令（插件可直接 session.append 落 todo） | P1 |
| `ctx.jobs`（JobKindMap 可扩展）+ `runMaintenance` | daily 分析同步阻塞 | P1 |
| session projection（`SessionProjectionMap` 可扩展 + useProjection） | 自建前端数据管道（`pa:suggestions` key 事件源化、可回放、重启恢复） | P1 |
| `conversation.chat.turnTail` chain slot | 会话流通知（S2 卡片） | P0 |
| compaction / spill / token-meter | 注入量无约束 | P2 |
| goal（maxGoalRounds 自主续跑） | 多步自动化建议逐轮 steer | P2 |

### PA → dsh（PA 给 dsh 生态的增量）

1. **跨会话主动记忆是 dsh 官方生态空白**（官方仅有被动 mcp-memory 示例）——PA 的"捕获→检索→注入→确认"闭环可成为社区范式 / cookbook 候选。
2. `agent/turn-stopping` 建议循环范式：PA 是首个"数据决定的主动建议"实例。
3. `runMaintenance` + jobs 的后台 LLM 分析 + 结果回注范式。
4. userQuestions 新 intent 提议（`memory-confirm`，presentation-only 不破协议）。
5. session projection 多 key 插件实践。
6. `MessageSourceMap` 扩展（`kind:'proactive'`）+ 注入 provenance 实践。

## 4. 关键 API 证据（实施时直接引用）

```
# dsh（deepseek-harness，rc.6）
packages/core/agent/src/runtime-types.ts        # Agent 接口 + agent/* 事件全表
packages/core/system-prompt/src/index.ts        # section/context/variable/tools/assemble
packages/core/agent-loop/src/                   # preStep 每步 assemble
packages/interaction/user-questions/src/        # ctx.userQuestions.ask
packages/jobs/jobs/src/                         # ctx.jobs.start / JobKindMap
packages/llm/llm/src/                           # ctx.llm.registerAdapter / stream
packages/todo/tool-todo/src/                    # todo/write append 模式
packages/schedule/schedule/src/                 # schedule/change 事件 + followup 派发
packages/session/session-projection/src/        # SessionProjectionMap 扩展
packages/client/ui-conversation/src/client/contract/slots.ts  # turnTail slot 契约
packages/extensions/cordis-client-runner/src/client/slot-catalog.ts
packages/context/time-context/src/              # pre-step durable 注入 + 节流范式
packages/context/agent-instructions/src/        # AGENTS.md 注入范式
packages/goal/goal-round-driver/src/            # 自主续轮范式
examples/web-schedule/cordis.yml                # 挂 schedule 官方示范
docs/event-producer-consumer.md                 # 事件全表
docs/cookbook/adding-a-conversation-node.md     # 客户端插件 cookbook
```

```
# @proactive-agent/core 0.9.2（pa-dsh/node_modules）
contextForMessage(text, {limit})                # M1：同步 BM25，<memory_context> XML 块，空串=未命中
extractAndCapture / extractionMode /           # M2：半自动捕获闭环（默认 llm 模式，无 LLM 降级 rule）
pendingAtoms / confirmAtomById / rejectAtomById
setActionExecutorProvider(HostActionExecutor)  # S4：createAutomation/createTodo 执行器接线
setAutomationTitlesProvider                    # S4 配套：去重源
listActionCards / toActionCard                 # S2：卡片协议已就绪
runAnalysisAndPersistDetailed                  # LLM 工作模式分析师（daily 用）
getDnd / updateDnd / dndActive                 # DND 配置面
MEMORY_LLM_API_KEY/BASE_URL/MODEL              # S3 env（OpenAI 兼容，同源原则；无 PROACTIVE_LLM_*）
searchAsync / contextForMessage                # hybrid（含 embedding）vs keyword
```

## 5. 升级路线 v2（实施顺序）

### P0（第一波：消掉 4 个实测问题，全部为残值高投入）
1. **F1 MCP 桥退役**：移除 cordis.patch.yml 的 mcp-proactive 行（实测模型在双工具面摇摆）。
2. **S2a 服务端 durable 事件**：建议改发 durable 非-surface 事件（声明合并 SessionEventMap + `ignorable: true` 信封 + version 自描述），废弃 session.append 通知。消掉问题 1/2/4 的模型干扰与日志污染；事件设计是跨版本可迁移的架构资产（残值高）。
3. **M1 护栏版**：先修 capture 后强制刷画像 + persona 长度 cap；再用 `ctx.systemPrompt.context()` 动态函数 + session-start `agent.inject()` 播种做每轮记忆注入（检索逻辑在 core，残值高）。
4. **修复**：dup key 规范化（全角冒号）、suggest collectors 生命周期、silentErrors 默认改 false。

### P1（第二波：记忆质量 + 建议智能 + 基础设施化）
5. **M2 半自动捕获**：捕获点 = pre-step + tools/post-execute + turn-stopping；pending 确认走 `ctx.userQuestions.ask()`；前置修三层去重（injector 通知去重已做 v0.1.1、引擎 existingCorrectionRules、+ dup key 规范化）。
6. **S3 LLM 接线**：主路径 `ctx.llm.stream()`；可选 pa-memory adapter 读 MEMORY_LLM_*；daily 跑 `runAnalysisAndPersistDetailed`。
7. **S4 automation 落地**：`setActionExecutorProvider` → 提醒类落官方 dsh-schedule 或 todo/write（执行类仍只给指令）。
8. **pa-daily 改造**：jobs 异步 + 缓冲落盘（重启不丢）+ 外部调度兜底。
9. **paCore 公共服务化**：paCore API 面有意设计 + 文档 + 稳定性承诺——PA 从"6 插件产品"升级为"dsh 主动层基础设施"（第三方插件可 `ctx.get('paCore')` 读写记忆/订阅建议），插件组本身成为参考实现。
10. **DeepSeek 模型适配**：中文记忆第一公民（BM25 中文分词质量）；投递形态按 DeepSeek 模型对"系统通知 vs 用户指令"的区分习惯调（实测已暴露该问题）。

### P1 末尾（小步试水，唯一 rc 特化投入）
11. **S2b turnTail 客户端卡片原型**：最小可用版本验证 slot 机制（exports["./client"] + dsh.client 声明 + ctx.slots.inject + select 路由 + Typert Remote accept/dismiss），不投入精致 UI；等 dsh 正式版再打磨。

### P2（第三波：体验/生态）
12. S5 漂移检测：插件层启发式（同 type 反义检测，只提示不改写）+ 上游提 PR 到 core。
13. projection 事件源化（pa:suggestions / pa:memory-digest key）。
14. 收拢为 3 插件 + client 包 + types 包，回并 PA 主仓库评估。

### 节奏与信号（rc 期策略）
- **锁 rc.6 不追版**：dsh 每次 rc 都可能破坏性变更，追版负收益；每波完成发 npm 小版本。
- **残值分层**：P0 与 P1 的 core 接线类投入 dsh 怎么变都不亏（见 §6 残值表）；S2b 客户端是唯一 rc 特化投入，小步试水。
- **观察信号（切换投资力度的触发器）**：① dsh 每次 rc/正式版发布说明；② 官方对 PA 后续 issue/PR 的响应（合并/讨论/拒绝都是 dsh 走向的早期信号）。
- **对冲**：向 deepseek-harness 提 issue/PR（userQuestions memory-confirm intent、MessageSourceMap proactive kind、schedule 语义）——既提前锁定 API 方向，又是生态占位。P0 修完、有真实踩坑故事后再提。

## 6. 风险登记

| 风险 | 缓解 |
|---|---|
| dsh rc.6 预览版，API 会漂移 | 锁定版本；薄层隔离；自定义事件带 version 自描述 |
| 自定义 pa/suggestion 事件写入会话日志，正式版迁移 | ignorable 信封 + 少量字段 + 迁移脚本预案 |
| dsh-schedule followup 会开 turn 烧模型调用 | "schedule 做闹钟、PA 做执行"——PA 消费 dispatch 事件不 followup |
| schedule 是 session-local（冷会话补投） | 与 P1-8 外部调度兜底并存 |
| userQuestions 仅 live root agent 可用（DELEGATED_CALLER 边界） | 确认交互只在主会话发起 |

### 投资残值分层（dsh 正式版若 API 全变，各项投入的剩余价值）

| 项目 | 残值 | 说明 |
|---|---|---|
| M1 记忆注入 | 高 | 检索逻辑在 core；dsh 侧只是找动态上下文缝隙，换缝隙成本小时级 |
| M2 捕获闭环 | 高 | 引擎 extractAndCapture/pending 是 core 的；触发点可换 |
| S4 automation | 高 | setActionExecutorProvider 是 core 接口；执行器可换实现 |
| S3 LLM | 高 | ctx.llm 与 MEMORY_LLM_* 双路径，哪边稳用哪边 |
| 通知去重/画像护栏等修复 | 高 | 纯 PA 内部质量，与 dsh 无关 |
| S2a durable 事件设计 | 高 | 事件源化是可迁移架构资产 |
| S2b 客户端卡片 UI | 中 | slot 契约/client bundle 是 rc 特化，UI 部分可能要重写 |

## 7. 历史记录

- 2026-08-14：三子代理调研（宿主机制/官方文档/core API 面）→ 确认 M1 context()、S1/S2 合流、S3 改 MEMORY_LLM_*、S4 纯接线。
- 2026-08-14：二子代理深潜（clone 源码 + live 实测）→ 本蓝图的 8 个实测问题、六插件裁决、1+1>2 双向设计。
- 2026-08-14：清理 live 测试残留（2 测试原子、3 测试建议、1 测试会话；session-cb363db2 误入一条测试消息保留在日志中）。
- 2026-08-14 晚：**P0 实施完成**。① F1 MCP 桥退役（cordis.patch.yml 删 mcp-proactive，备份 .bak-20260814）② S1' 投递降噪（injector 废弃 session.append 通知，改 systemPrompt.context 建议箱摘要行，实测 turn/end 后无通知 append）③ M1 护栏 + 每轮记忆注入（capture 后 regeneratePersona、persona 3k 字符 cap、pa:recall context 每轮 BM25 注入，实测模型不调工具直接引用记忆）④ 修复（silentErrors=false、collectors 会话上限、lastSessionId 防御、suggest_list dup key 全角冒号规范化）。
- 2026-08-14 晚：**发现 S2a 被 rc.6 阻塞**——`Session.append()` 无 ignorable 写入入口，persistence 拒绝未知事件类型（assertEventsSupported），官方第三方事件注册面 deferred。S2a 改为 S1'（已做），durable 事件需求转为官方 issue 素材。
- 2026-08-14 晚：**运维发现**——profile 依赖为 npm 包非 file: 链接，改源码后需热替换 lib 到 ~/.dsh/profiles/web/node_modules。新增 scripts/deploy-local.sh 固化流程（构建+热替换+重启）。
- 2026-08-15：**P1 实施完成（7 提交）**。① M2 半自动捕获（turn-stopping 提取 → pending 确认闭环，userQuestions.ask 优先 + 文本工具降级，护栏：节流/pending 堆积静默入队/8s 超时）② S3 LLM 接线（dsh 凭据桥接 MEMORY_LLM_*，提取升级 LLM 模式实测抓隐含事实）③ S4 动作执行器注入（提醒→schedule_create / 待办→todo_write）④ pa-daily 改造（缓冲落盘 + 启动补跑）⑤ paCore 公共服务化（稳定 API v1 + README 接入指南）⑥ DeepSeek 适配（persona correction 强化小节）⑦ S2b turnTail 客户端卡片原型（slot 机制全链路验证）。P1 期间复现 #1473 现场（损坏会话导致 UI 会话管理瘫痪 + 前端无限重试 CPU 打满），未删数据、修复 workspace 索引（备份可回滚）。
