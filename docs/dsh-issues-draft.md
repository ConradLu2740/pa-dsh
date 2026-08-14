# dsh 官方 issue 草稿（deepseek-harness）

> 来源：pa-dsh 插件实测事故（2026-08-14）。两个 bug 都是真实数据试出来的。
> 状态：**已提交** —— 官方仓库 Issues 已禁用，已改发 GitHub Discussions：**[#1473](https://github.com/deepseek-ai/deepseek-harness/discussions/1473)**（2026-08-14）。症状经实测修正为「boot 崩溃」而非「reload 死循环」，详见文末「复现验证与提交记录」。

---

## Issue A：单个损坏的会话日志会让整个 workspace 陷入 reload 死循环（高）

**标题建议**：`A single corrupted session log wedges the whole workspace in a loader reload loop (CPU 100%, UI stuck at "Loading plugins…")`

### 现象

`~/.dsh/sessions/<workspace>/` 下只要有一个损坏的会话日志（torn zstd 帧，或尾部事件序列异常），dsh web 启动后：

- 服务端进程 CPU 持续 110–160%（单线程跑满）
- `curl http://localhost:8080` 返回 200，但前端永远卡在 **"Loading plugins…"**
- 该会话被移出目录后一切恢复正常

### 根因（CPU profile 证据）

Node `--cpu-prof` 采样显示热点集中在：

```
cordis-plugin-loader/lib/index.js:159  entries()      (数百次采样)
cordis-plugin-loader/lib/index.js:167  getTasks()
cordis/lib/index.js:1292               _updateState
cordis/lib/index.js:1347               _reload
cordis/lib/index.js:192                composeError   (错误构造风暴)
```

即：`dsh-workspace` 初始化读取坏会话失败 → `Fiber._reload` 抛出 → 状态变化再次触发 reload → **无限重试循环**。loader 对失败条目的处理没有退避/放弃路径。

### 预期行为

- 损坏的会话应被**跳过并报错**（或标记 corrupt、移入 quarantine），其余会话正常加载
- loader 对反复失败的条目应有 backoff / fail-fast，而不是无限 reload

### 复现

1. 取一个正常会话日志，在尾部追加一段「`turn/end` 之后的 `user/message`（source.kind=plugin）+ `session/end-seed`」序列（第三方插件通知写入日志的真实形态），或直接截断 zstd 流制造 torn frame
2. 重启 dsh web
3. 观察 CPU 与前端状态

### 环境

- dsh `0.1.0-rc.6`（npm `@deepseek-ai/dsh`），Node v24.19.0，macOS
- 后端 `dsh-session-persistence-jsonl`（zstd 压缩）

---

## Issue B：zstd write-behind 被 SIGTERM 打断会留下 torn frame，且启动时无有效恢复（中）

**标题建议**：`SIGTERM during write-behind leaves a torn Zstandard frame that breaks the next startup`

### 现象

`pkill` / SIGTERM 终止 dsh 时，若 `write-behind` 尚未 flush，会话日志尾部会留下不完整 zstd 帧。下次启动时该文件**无法被 `readFirstZstdLine` / 全量解码正确读取**，进而触发 Issue A 的 reload 循环。

### 证据

- 事故现场捕获到两个会话日志尾部 torn frame：一个 53KB 多帧流文件（`@mongodb-js/zstd` 与 python zstandard 的流式行为不一致），一个在 pkill 后新帧损坏
- 修复手段是人工解压出全部可读事件、按「每行一帧」重写

### 预期

- SIGTERM 应触发 flush（或 write-behind 定时 flush 间隔足够短）
- 启动时对 torn final frame 的恢复应真正生效（代码注释提到 torn-tail marker 会记录字节偏移并恢复不完整帧，但实测该机制未能阻止后续失败）
- 最坏情况下也应跳过坏帧/坏会话，而不是进入 reload 循环

---

## 附：事故背景（供 issue 引用）

- 触发方：pa-dsh（第三方 cordis 插件组，@proactive-agent/*）的旧版建议通知曾以 `session.append('user/message', …)` 写入会话日志，每次重启追加一条——**该插件侧问题已修复**（v0.2.0），但历史会话尾部留下了「end-seed + 通知」序列
- 该序列与 torn frame 一起，成为 Issue A 的复现输入
- 从插件作者视角：会话日志是 durable 事实源，第三方插件按公开 API append 是合法行为，dsh 恢复路径应能容忍"非 turn 内消息 / 尾部噪音"而不至于全 workspace 瘫痪

## 建议优先级

1. **Issue A 优先**：单点故障放大为全应用不可用，是 rc 期最伤体验的问题；修掉后 Issue B 的残留影响也被兜住
2. Issue B 随后：优雅退出 flush + torn tail 恢复验证

---

*草稿生成：2026-08-14，Proma Agent。提 issue 时建议附上 CPU profile 与复现脚本。*

---

# 验证与定稿记录（2026-08-14，review 子 Agent）

## 0. 提交通道被阻塞（最重要）

- `gh api repos/deepseek-ai/deepseek-harness` → `has_issues: false`，`has_discussions: true`。
- `gh issue list -R deepseek-ai/deepseek-harness` → `the 'deepseek-ai/deepseek-harness' repository has disabled issues`。
- 官方 `CONTRIBUTING.md` 原文：*"Identify and report issues or bugs in GitHub Discussions"*（不接受外部 PR）。
- 仓库内多份既有 bug 报告均注明 *"Reported via GitHub Discussions per the README/CONTRIBUTING (the repository has Issues disabled)"*。
- 源码里的 `.github/ISSUE_TEMPLATE/` 与 `issue-management/policy.mjs` 属于内部 `deepseek-harness/deepseek-harness` 组织仓库（公开 404），不是公开仓库的通道。

**结论**：无法执行 `gh issue create`。若要上报，只能发 GitHub Discussion（`gh discussion create` 尚非 gh 原生命令，需用 API 或网页）。是否改用 Discussions 发布，需父 Agent/用户确认。

## 1. 技术断言验证（对照源码 + CPU profile）

| 断言 | 结论 | 证据 |
| --- | --- | --- |
| Issue A 根因热点 entries:159 / getTasks:167 / _updateState:1292 / _reload:1347 / composeError:192 | ✅ 证实 | `/tmp/prof/`、`/tmp/prof2/` 两份 cpuprofile 的 hitCount 排名完全吻合这些行号；`entries`/`getTasks` 为最高非 idle/GC 热点 |
| 服务端单线程跑满 CPU | ✅ 支持 | profile 中 loader 循环 + GC 采样占比高；Node 单线程 + GC 的多核记账可解释 110–160% |
| composeError「错误构造风暴」 | ✅ 证实 | `cordis/lib/index.js:192` composeError 每次调用 `new Error()`；profile 中 104/169 次采样 |
| Fiber._reload 抛出→状态变化→再次 reload→无限循环 | ✅ 机制证实（措辞略粗） | `cordis/lib/index.js` `_reload`(1348) 失败置 epoch=INACTIVE→`_unload`；`_updateState`(1293) emit `internal/status`；循环由 loader `await()` 的 `while(true)+Promise.allSettled` + 依赖重注入 `_setEpoch` 驱动 |
| loader 对失败条目无退避/放弃路径 | ✅ 证实 | `cordis-plugin-loader/lib/index.js` `await()`(178) `while(true)` 无 delay；`getTasks()`(168) 只要 `fiber.inertia` 非空就重试 |
| JSONL 的 assertZstdHeaderFrame / readFirstZstdLine / torn-tail marker | ✅ 存在 | `dsh-session-persistence-jsonl/lib/index.js`：741 / 1279 / 957-1008（`tornMarker.truncateTo`+`recoveredEvents`+`commitRepair`） |
| consumeEventLine 对 seq gap + turn/end 抛错 | ✅ 证实 | 同上 275-299：`seq gap in committed region`，含 `turn/end` 时 throw |
| 版本 dsh 0.1.0-rc.6 | ✅ 证实 | npm 运行时 `@deepseek-ai/dsh` 与 `dsh-session-persistence-jsonl` 均 0.1.0-rc.6 |
| Issue B「SIGTERM 打断 write-behind 留 torn frame」 | ⚠️ 需修正措辞 | CLI 已装 SIGTERM→graceful dispose→flush（`apps/cli/src/process-shutdown.ts`，5s 上限；`coordinator.ts` dispose 会 `flush` 全部 live session）。**单次干净 SIGTERM 会 flush**；torn frame 实际来自「graceful drain 期间二次信号 / 5s 超时 / SIGKILL / 事件循环被 reload 循环打满」 |
| 「readFirstZstdLine / 全量解码无法读取 torn 文件」 | ⚠️ 需修正措辞 | `readFirstZstdLine` 只读首帧（header），尾部 torn 不影响它；`readZstdPrefix` 对**干净尾部 torn**有截断+恢复路径。真正卡死更可能是**内容级损坏**（turn/end 之后的 user/message + end-seed → consumeEventLine 抛 seq gap/turn-end），而非纯 zstd 帧撕裂 |
| 「torn-tail 恢复机制实测未能阻止后续失败」 | ⚠️ 未证实（对干净 torn tail 该机制应能恢复） | 机制存在且看似覆盖干净尾部；「失败」需区分 torn 帧 vs 内容损坏。事故文件已删，无法复核 |
| 事故日志在 `.dsh-run/dsh-web.log` | ⚠️ 缺口 | 该文件仅 1 行 `dsh web: http://127.0.0.1:8080`，实际报错未落盘于此 |
| 「53KB 多帧流 @mongodb-js/zstd 与 python zstandard 不一致」 | ⚠️ 无法复核 | 损坏会话已删；现存 4 个 session 文件（66KB/584KB/54KB/254KB） |

## 2. 去重结果（检索 Discussions，因 Issues 已禁用）

与 Issue A（corrupt session → 全 workspace reload 死循环 → CPU 100% → 卡 "Loading plugins…"）最接近的既有讨论，**均不覆盖「单点损坏放大为全 workspace reload 死循环」这一症状**：

- #255 / #333 / #420 / #496 —— 「corrupt session log: seq gap」：都是**单个会话历史加载失败**（RangeError / seq gap），不是全 workspace 卡死。
- #718（Zn070515）—— 含「coordinator 死循环」但那是 `coordinator.adopt()` 的 load 挂死（另一条机制），且「write-behind 滞留」针对写失败（磁盘满/文件锁），非 force-kill torn frame。
- #111「启动的时候直接卡住」、#115「新版主页CPU直接跑到100%」—— 无技术细节、未定位。
- #1262 —— 100% CPU 死循环在 FrameQueue（host↔browser 事件 mux），另一机制。

与 Issue B（write-behind 被 force-kill 打断 → torn zstd frame）高度重叠：

- **#483（qyz7438）**「After a force-kill … write-behind batching loses the un-flushed tail」—— 机制几乎同一（write-behind 未 flush 的尾部在强杀后丢失）。
- #466（DRAG0NM）「宿主被沙箱内 agent 重启杀死后，会话日志留下未闭合 turn」。
- #718 问题 4「write-behind 写失败后批事件滞留」。
- #496 附带提到「torn first frame」是另一代码路径。

**结论**：Issue A 是新的、有价值的上报点；Issue B 与 #483/#466/#718 高度相似，不宜再重复发帖。

## 3. 合并 or 分开的决策

- 根因不同：A 是 loader/orchestration 层缺 backoff/fail-fast（单插件失败放大为全应用不可用）；B 是 persistence 层写耐久/恢复缺口。修复点也不同。
- 但 B 确实只是 A 的**触发路径之一**（A 的复现可用「内容损坏」或「torn 帧」任一制造）；且 B 已被 #483 基本覆盖。
- **决策：合并为一份、以 A 为主体上报**，B 作为「触发路径之一」写入，并交叉引用 #483/#420/#496/#718，不再单独发第二份。

## 4. 最终上报文本要点（Discussions 版，英文为主）

- 标题（聚焦 A 的新症状，避免官方模板的中文标题要求——Discussions 无此硬约束，但仓库中文活跃，可中英双标题）。
- 现象：一个 corrupt session log 使 `dsh web` 启动后 CPU 持续打满、HTTP 200 但前端永久卡 "Loading plugins…"；移走坏会话即恢复。
- 复现：尾部追加 `turn/end` 后的 `user/message(source.kind=plugin)` + `session/end-seed`（第三方插件合法 append），或截断 zstd 流制造 torn frame。
- 证据：CPU profile 热点（entries/getTasks/_updateState/_reload/composeError，附行号）；源码定位 loader `await()` 无退避。
- 预期：损坏会话应跳过/隔离（quarantine）而非瘫痪全 workspace；loader 对反复失败条目应 backoff/fail-fast。
- 环境：dsh 0.1.0-rc.6 / Node v24.19.0 / macOS。
- 交叉引用：#483、#420、#496、#718、#466（说明与既有 corrupt-session 报告的区别：这是**全 workspace 放大**，非单会话加载失败）。
- 文末注明：Found while developing @proactive-agent/dsh plugins（pa-dsh）。
- Issue B 关键修正：不说「SIGTERM 不 flush」，改为「graceful drain 期间二次信号/5s 超时/SIGKILL 打断 write-behind 留 torn frame，且该 torn/内容损坏文件成为 A 的触发路径」。

## 5. 待办 / 缺口

- 是否改用 GitHub Discussions 发布（通道切换 + 对外发布，需父 Agent/用户确认）。
- 若发布，需补充一份**最小复现脚本/损坏样本**（事故文件已删）。
- `.dsh-run/dsh-web.log` 无实际报错，重跑复现时应把 stderr 落到可提交的位置。

---

# 复现验证与提交记录（2026-08-14，review 子 Agent）

## 0. 提交结果

- **Discussion 已提交**：https://github.com/deepseek-ai/deepseek-harness/discussions/1473 （编号 **#1473**，分类 General，作者 ConradLu2740）。
- 仓库 Issues 已禁用（`has_issues: false`），唯一通道是 Discussions；已改用 GraphQL `createDiscussion` 提交。
- 复现脚本：`pa-dsh/scripts/repro-corrupt-session.mjs`（`--mode corrupt-header|torn-header|torn-tail|seq-gap`，`--cleanup` 清理）。

## 1. 实测结果（对草稿的关键修正）

在本地制造损坏会话并真实重启 `dsh web`，四种损坏模式结果：

| 损坏模式 | 实测结果 |
| --- | --- |
| **corrupt-header**（首帧 ≠ 恰好一行 header） | **dsh web 启动崩溃退出**：`dsh: plugin tree failed to load: failed to apply loader entry workspace (@deepseek-ai/dsh-workspace): corrupt Zstandard session log: first frame is not exactly one header line` |
| torn-header（首帧截断到 40 字节） | 正常启动（该会话被 `list()` 静默跳过） |
| torn-tail（末帧截 8 字节） | 正常启动（torn-tail 恢复路径生效） |
| seq-gap（尾部 user/message + turn/end 带 seq 空洞） | 正常启动；打开该会话报「history unavailable」，仅单会话失败 |

**核心修正**：草稿 Issue A 的「reload 死循环 / CPU 100% / 前端卡 Loading plugins…」**未被复现**。可确定复现的症状是**单点损坏 → 整个 workspace 启动失败（进程退出）**——这比「卡住」更严重（整体不可用）。

- 触发链（已从启动日志取证）：`dsh-workspace [cordis.init]`（≈324）→ `sessionPersistence.list()` → `listArtifacts`（1078）→ `readFirstZstdLine`（1279）→ `assertZstdHeaderFrame`（742）抛出 → `Fiber._reload` → `Entry._start/_init` 失败 → 根 loader `await()` 抛错 → 进程退出。
- **不对称性**（bug 本质）：`readFirstZstdLine` 对「torn 首帧」返回 undefined → 跳过（正常）；但对「结构完整但解码成 0 或 2+ 行」的首帧 → `assertZstdHeaderFrame` **throw**，无 per-session 容错，整份 `list()` 失败。
- 关于 CPU profile（`/tmp/prof/`、`/tmp/prof2/`，各约 10-12s、~90% 非 idle 采样）：其热点（entries/getTasks/_updateState/_reload/composeError）与「一次加载 ~150 个插件的正常 boot」也一致，无法排除是正常启动被误读为死循环；「reload 死循环」未能在本机复现，已在帖中据实改为「boot 失败」。

## 2. 提交文本要点（最终版，英文）

- 标题：`[Bug] A single corrupted session log prevents the whole workspace from booting (loader entry "workspace" fails to apply)`。
- 现象：单个损坏会话日志（首帧非恰好一行 header）使 `dsh web` 整体启动失败，进程退出。
- 复现：`node repro-corrupt-session.mjs --mode corrupt-header` + `dsh web`；产物 817 字节 / 7 帧，帧 0（199B）解码为 2 行 JSONL。
- 预期 vs 实际：损坏会话应被跳过/隔离，而非拖垮整份 `list()`。
- 根因定位：`assertZstdHeaderFrame` / `readFirstZstdLine` / `listArtifacts` / `list` / `dsh-workspace [cordis.init]` 调用链（含行号）。
- 环境：dsh 0.1.0-rc.6 / Node v24.19.0 / macOS / zstd 后端。
- 交叉引用：#420 / #255 / #333 / #496（单会话 seq gap 失败）、#718、#483（另一机制）。
- 文末：Found while developing @proactive-agent/dsh plugins（pa-dsh）。

## 3. 待办 / 备注

- 「reload 死循环 / CPU 100%」未复现，若后续能构造出确定触发该症状的样本，可再补一条评论或另开帖。
- 复现会临时弄坏 dsh，已验证清理恢复：测试会话已删（repro 计数 0），`cordis.patch.yml` 已还原，dsh web 已恢复健康（port 8080、CPU ~0.1%）。
