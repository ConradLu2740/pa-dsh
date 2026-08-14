# dsh 官方 issue 草稿（deepseek-harness）

> 来源：pa-dsh 插件实测事故（2026-08-14）。两个 bug 都是真实数据试出来的。
> 状态：草稿，提 issue 前可自行调整语气与范围。

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
