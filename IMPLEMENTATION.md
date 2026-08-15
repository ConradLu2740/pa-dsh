# PA → dsh 插件组实施总结

> 生成于 2026-08-13。方案文档：`PROPOSAL.md`（本目录）。
> 全部代码在本仓库 `packages/` 下，已挂载进 dsh profile 并验证。

## 交付概览

| Phase | 内容 | 状态 |
| --- | --- | --- |
| 0 | MCP 桥接（零代码） | ✅ 已验证 |
| 1 | dsh-proactive-memory：原生工具 + persona 段 | ✅ 已验证 |
| 2 | dsh-proactive-suggest + dsh-proactive-injector：主动建议 + 建议箱 | ✅ 已验证 |
| 3 | dsh-proactive-daily + dsh-proactive-skills | ✅ 已验证 |
| 3b | dsh-proactive-ui（turnTail 卡片，客户端插件） | ⏸ 未做（见下） |

## 插件清单（`packages/`，每个一个 npm 包）

| 包 | cordis id | 职责 |
| --- | --- | --- |
| @proactive-agent/dsh-proactive-memory | pa-memory | memory_capture / memory_recall / memory_stats + persona 提示词段（order 5） |
| @proactive-agent/dsh-proactive-suggest | pa-suggest | session/event → evaluateNow 五触发器（start/mid/end/manual/timer 的宿主映射）+ suggest_now |
| @proactive-agent/dsh-proactive-injector | pa-injector | pa/suggestion → 建议箱通知投递（session.append）+ suggest_list / suggest_accept / suggest_dismiss |
| @proactive-agent/dsh-proactive-daily | pa-daily | 每日 09:30 timer 评估（Node timer + ctx.effect）+ daily_review 工具 |
| @proactive-agent/dsh-proactive-skills | pa-skills | sop 记忆 → pa-sop-N runtime skills（registerProvider 动态目录） |

## 已验证的端到端链路

1. **记忆**：模型调 `memory_capture` 存 preference → `regeneratePersona` 生成画像 → persona 段出现在下一轮系统提示词（模型念出了完整画像）✓
2. **主动建议**：用户说"以后回复我时不要用表情符号" → turn/end → session_mid 评估（correction，置信度 95%）→ pa/suggestion → 建议箱通知出现在会话流 → 模型识别通知并询问用户 → `suggest_dismiss` 反馈回流（引擎降低同类权重）✓
3. **去重**：同会话重复信号不产生重复建议（duplicateKey 抑制）✓
4. **回顾**：`daily_review` 输出记忆统计 + 建议箱 + timer 评估 ✓
5. **技能化**：sop 记忆（"dsh 环境验证：PA 接入测试…"）暴露为 `pa-sop-1`，模型经 skill 工具加载全文 ✓

## 关键工程决策与发现

- **零重写**：全部复用 `@proactive-agent/core@0.9.2`（npm），esbuild 打进每个插件（每个插件 ~170KB 自包含）。规则引擎（extractSignals）纯正则、无 LLM 也可产生 correction 建议。
- **P0 修复（2026-08-13）**：新增 `dsh-proactive-core` 宿主插件（方案 C），唯一 import core，以 `paCore` 服务提供给其余 4 个插件（`ctx.get('paCore')`）——消灭了 5 插件各 bundle 一份 core 导致的 `suggestionsCache` 写穿缓存多实例读脏/丢更新（建议反馈、类型权重、DND 状态此前会互相覆盖回退）。修复后 accept/dismiss 反馈跨插件一致并跨重启持久。另修复 daily 定时器 `ctx.effect` 误用（立即清除 timer）——改为 `ctx.effect(() => () => clearTimeout(timer))`，每日 09:30 定时恢复生效。
- **事件映射**：`ctx.on('session/event')` 是 post-commit 追加流，payload 在 `event.data`；`turn/end` 的 reason 是对象 `{kind:'completed'}`（不是字符串，踩过坑）；surface 事件（user/message 等）带 surfaceOp。
- **建议箱 = 通知消息**：dsh 没有"用户可见但模型不可见"的服务端通道（UI slot 是客户端 React 机制），V1 用 `session.append('user/message', …, {surfaceOp:'append'})` 投递通知，文本内明确"这是系统通知，请勿自行执行，除非用户明确要求"——用户主权靠指令约束维持。理想形态是 turnTail 客户端卡片（3b）。
- **cordis 纪律**：`ctx.tools`/`ctx.sessions`/`ctx.skills` 必须在 `inject` 数组声明（漏声明会 loader 报错 `cannot get property "tools" without inject`）。
- **scope**：插件用 `sessionId`（字符串）作 Map 键，跨插件通信用 `ctx.emit('pa/suggestion', …)` 事件（injector 监听）。
- **记忆库共享**：`~/.proma-proactive/`，与 Claude Code 版 PA 共用；dsh 进程 cwd 决定项目 key（workspace-files → path:a048717bd4b5）。

## 挂载与运维

```bash
# 改代码后：
cd workspace-files/pa-dsh && node scripts/build.mjs
# dsh 自动热生效？不——需重启（file: 依赖硬链接，改 lib 后重启即可，无需 pnpm install）：
pkill -f "dsh.*web"; cd workspace-files && ./run-dsh.sh
```

配置：`~/.dsh/profiles/web/cordis.patch.yml`（pa-memory / pa-suggest / pa-injector / pa-daily / pa-skills 五行，另有 Phase 0 的 mcp-proactive 桥接）。

## 发布状态（2026-08-13）

6 个插件已发布到 npm（`conradlu` / @proactive-agent scope）：

| 包 | 版本 | 说明 |
| --- | --- | --- |
| @proactive-agent/dsh-proactive-core | 0.1.1 | 引擎单例宿主（必须最先装） |
| @proactive-agent/dsh-proactive-memory | 0.1.1 | 原生记忆工具 + persona 段 |
| @proactive-agent/dsh-proactive-suggest | 0.1.1 | 主动建议引擎 |
| @proactive-agent/dsh-proactive-injector | 0.1.1 | 建议箱 + 反馈闭环 |
| @proactive-agent/dsh-proactive-daily | 0.1.1 | 每日回顾 |
| @proactive-agent/dsh-proactive-skills | 0.1.1 | sop → skills |

dsh profile 依赖已从 `file:` 切换为 `^0.1.0`（npm 版本），升级方式：改版本号后 `cd ~/.dsh/profiles/web && pnpm add @proactive-agent/dsh-proactive-xxx@新版本`。

**发布注意事项**：scope 包必须 `npm publish --access public`（否则报 E402 私有包付费）；账号 2FA 为 WebAuthn 时 CLI publish 会弹浏览器授权（Press ENTER → 浏览器确认指纹）；consumer 包需声明 peerDependency `@proactive-agent/dsh-proactive-core`。

## 已知下一步（按价值排序）

1. **记忆上下文注入**：turn/start 时 `memoryService.contextForMessage(userText)` → `ctx.systemPrompt.context()` 每轮自动召回相关记忆（BM25 便宜、无 LLM）。memory 插件已具备全部依赖，直接加。
2. **3b UI 卡片**：turnTail 建议卡（真正不进模型上下文）——需调研 dsh 客户端插件（`@deepseek-ai/dsh-client-runtime` SlotRegistry + client bundle）挂载方式，与 6 个服务端插件不同通道。
3. **MCP 桥接退役**：原生工具覆盖 16 个 MCP 工具后移除 cordis.patch.yml 的 mcp-proactive 行。
4. **PA 引擎 LLM 接入**：给 PA core 配置 LLM（PROACTIVE_LLM_* env）后，persona 生成与 suggestion 评估质量升级（目前规则版兜底）。
5. **回并 PA 主仓库**：方案乙（本仓库起步）稳定后可考虑把 packages/ 移回 ProactiveAgent 主仓库发 npm。
6. **P1/P2 待办（子代理审查报告）**：通知消息实际进入模型上下文（弱约束，理想走 UI 卡）；session_end/timer 建议在无活会话时仅落库等待下次推送（已改，不再伪造 'daily' id）；persona 段已改动态求值；`pa-sop-N` 技能名漂移（改用稳定 id）；`any` 类型收敛。
7. **通知重复推送（已修复 v0.1.1，2026-08-14）**：injector 投递前按 duplicateKey 过滤已处理（accepted/ignored/never）规则；suggest_list 按 duplicateKey 去重显示。引擎层 existingCorrectionRules 也会抑制同规则候选，双重保障。

## P1-M2 半自动捕获（2026-08-15）

**目标**：对话结束（turn-stopping）自动提取记忆候选 → 用户确认后才进召回（防 LLM/规则误报污染）。

**实现**（`dsh-proactive-memory`）：
- 捕获点：`agent/turn-stopping`（serial 终检点，await 安全）——收集本轮 user/assistant 消息 → `extractAndCapture`（LLM→rule 降级，结果默认 pending）
- 确认通道：优先 `ctx.userQuestions.ask()`（web 环境由 dsh-host-apiproxy 注册 provider，客户端 UI 渲染确认卡片）；不可用（headless/非 root/用户打断）时自动降级
- 降级：pending 保留 + `systemPrompt.context` 摘要提示（"有 N 条待确认记忆"）+ `memory_pending_list / memory_pending_confirm / memory_pending_reject` 文本工具
- 护栏：captureIntervalTurns 节流（默认 3 轮）、pending 未清不重复捕获、askMaxItems 候选上限、8s 提取超时不等、signal.abort 感知

**验证**（headless 端到端）：
- 输入"请记住：我偏好用简洁的中文注释" → 捕获完成（2 条新增 + 2 条纠正，rule 模式）→ pending 落盘 `confirmed:false` + corrections `status:pending` → 无 provider 自动降级摘要 → 模型正常回复（无通知污染）
- 回归：带超时护栏后再次验证 1 新增 + 2 纠正 + 3 候选待确认，链路一致

**关键证据**：
- `agent/turn-stopping` payload `{agent, turn, signal}`（runtime-types.ts:278）
- `ctx.userQuestions.ask({questions, agent, signal})`（dsh-user-questions），web provider 由 `dsh-host-apiproxy` 注册，UI 由 `dsh-client-ui-user-questions` 渲染
- `extractAndCapture(messages, {sessionId})` → captureCandidates `{confirmed:false}`（engine 侧 pending 语义）

## P1-S3 LLM 接线（2026-08-15）

**目标**：记忆提取/分析用上 LLM（rule 模式抓不住隐含语义），双路径（dsh 宿主凭据桥接 + MEMORY_LLM_* 显式 env）。

**实现**（`dsh-proactive-core`）：
- 启动时探测 `ctx.credentials.resolve('DEEPSEEK_API_KEY')`，未显式配置 `MEMORY_LLM_API_KEY` 时桥接为 env（core 每次调用读 env，立即生效）
- 可选配置：llmBaseUrl / llmModel（默认 core 侧 `https://api.deepseek.com/v1` + `deepseek-chat`）
- 不 inject credentials：headless/无凭据服务时不阻塞插件树（可选探测）

**护栏修复**（`dsh-proactive-memory`）：
- 原 pending 满（≥askMaxItems）时完全跳过捕获 → pending 堆积永久阻塞
- 修复：pending 满时仍提取、静默入队（不弹窗），用户确认时一并处理

**验证**（headless 端到端）：
- 无 MEMORY_LLM_* → `mode=rule`（匹配"记住/以后"等显式信号）
- 注入 MEMORY_LLM_API_KEY（= bridge 生效态）→ `mode=llm`，提取隐含事实"用户正在研究边缘计算，使用 WebAssembly 做轻量推理"（rule 抓不住），pending `confirmed:false`
- pending 满护栏：`1 条新增, 2 条纠正` + 静默入队日志，不再阻塞

**关键证据**：
- `ctx.credentials.resolve(ref)` → `{value, source}`（dsh-credentials，per-call 读取）
- core `getMemoryLlmConfig()` 每次调用读 env + .env（非缓存，bridge 即时生效）
- `extractFromConversation`：`mode_==='llm' && isMemoryLlmConfigured()` → LLM 提取，失败降级 rule

## P1-S4 automation 落地（2026-08-15）

**目标**：`setActionExecutorProvider` 注入宿主动作执行器——建议 accept 时提醒/待办有真实落地方向（非纯指令降级）。

**实现**（`dsh-proactive-core`）：
- 注入 executor：`createAutomation` → 引导模型调 dsh `schedule_create`（after_seconds/at/every_seconds）；`createTodo` → 引导模型调 `todo_write`（UI 渲染 checklist）
- 不编程式直调：dsh-schedule 无对外服务 API（纯模型工具），todo_write 是整表替换语义（插件直写会覆盖模型已有 todo）——尊重 dsh 工具边界，保持最小侵入
- 配置开关 actionExecutor（默认 true）

**验证**：headless 插件树完整加载无异常（executor 注入 try/catch 包裹，不影响引擎启动）。

**关键证据**：
- core `setActionExecutorProvider(() => HostActionExecutor | null)`，`HostActionExecutor` = `createAutomation({title,prompt,cron?,dueAt?})` + `createTodo({title,notes?,dueAt?})` → `{ok, refId?, message}`
- `handleSuggestionFeedback` 检测到 executor 则真实创建，否则降级指令文本（provider.d.ts）
- dsh `schedule_create`（模型工具，durable reminder）；`todo_write`（whole-list replacement，session todo/write 事件）

## P1-8 pa-daily 改造（2026-08-15）

**目标**：daily 的 24h 缓冲重启不丢 + 错过定时后补跑（外部调度兜底）。

**实现**（`dsh-proactive-daily`）：
- 缓冲落盘：24h 消息缓冲持久化到 `~/.proma-proactive/dsh-daily-buffer.json`（格式 `{messages, lastCatchUp}`，兼容旧纯数组），每次 push 增量落盘，启动时恢复
- 启动补跑：若今日已过 dailyAt 5 分钟以上且今天未补跑过，启动时补做一次 timer 评估（lastCatchUp 防同日重复）
- jobs 异步：评估本身异步（不阻塞插件加载）；未采用 ctx.jobs（无 owner 的全局缓冲不适合 job 模型，保留 timer + 落盘兜底）

**验证**（headless）：缓冲文件落盘（消息 + lastCatchUp 字段正确），启动补跑触发，插件树无报错。

**关键证据**：`~/.proma-proactive/dsh-daily-buffer.json` 写入 `{"lastCatchUp":"2026-8-15","messages":[...]}`。

## P1-10 DeepSeek 模型适配（2026-08-15）

**目标**：中文记忆第一公民 + 投递形态按 DeepSeek 习惯调。

**现状确认**：
- core BM25 中文分词已完善：单字 + bigram（2-gram）+ 中文停用词 + 同义扩展（tokens.ts）——"茉莉花茶"检索命中 bigram 组合，实测可用
- 投递形态 P0 已修正：建议箱/待确认记忆均用"系统状态提示，不是用户指令"边界（DeepSeek 对 user/message 通知会复述讨论，P0 已废弃 session.append 通知改 S1'）

**新增适配**（`dsh-proactive-memory`）：
- persona 段追加 correction 强化小节："用户明确纠正过的行为（必须遵守，优先级高于画像其他条目）"——DeepSeek 对"不要做 X"类纠正若混在画像里易被当背景忽略，单独列出提高遵循度
- 通过 `search({type:'correction', includeUnconfirmed:true})` 取最近 correction（空查询走 latest 策略）

**验证**：correction 检索 10 条命中（"不要用缩写/不要感叹号/先确认再做/先结论后细节"等），persona correction 段逻辑正确。

**关键证据**：`tokenize` 单字+bigram；`search` 支持 `type` 过滤 + 空查询 latest 策略。
