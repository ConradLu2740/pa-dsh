# @proactive-agent/dsh-proactive-memory

ProactiveAgent 记忆插件（DeepSeek Harness / cordis）：把 ProactiveAgent 的主动记忆能力以
**原生 dsh 工具 + 提示词段**的形式接入。

## 功能

- 原生工具（无 `mcp__` 前缀）：
  - `memory_capture`：显式存储长期记忆（fact / preference / correction / sop / todo_context / event）
  - `memory_recall`：BM25 关键词召回（无 LLM 调用，确定性）
  - `memory_stats`：记忆统计（总数/按类型/待确认/画像状态）
- persona 提示词段：用户画像以 `systemPrompt.section` 常驻，每次组装动态求值

## 安装

```bash
pnpm add @proactive-agent/dsh-proactive-core @proactive-agent/dsh-proactive-memory
```

## 使用（cordis.patch.yml）

```yaml
- insert:
    - id: pa-core
      name: '@proactive-agent/dsh-proactive-core'
      config: {}
    - id: pa-memory
      name: '@proactive-agent/dsh-proactive-memory'
      config:
        personaOrder: 5
```

## 配置

| 字段 | 默认 | 说明 |
| --- | --- | --- |
| personaOrder | 5 | persona 段在提示词中的顺序（0 为部署 persona） |
| captureTool / recallTool / statsTool | true | 工具开关 |

## 数据

记忆库默认 `~/.proma-proactive/`（`PROACTIVE_DATA_DIR` 可覆盖），与 Claude Code 版
ProactiveAgent **共享同一份记忆**。项目识别跟随 dsh 进程 cwd。
