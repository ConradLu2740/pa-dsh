# @proactive-agent/dsh-proactive-suggest

ProactiveAgent 主动建议引擎插件（DeepSeek Harness / cordis）：把 dsh 的会话事件流映射为
PA 引擎的 `evaluateNow` 五种触发器。

## 触发器映射

| dsh 事件 | 触发器 | 行为 |
| --- | --- | --- |
| `session/created` | `session_start` | 推送存量待处理建议（≤5） |
| `turn/end`（completed） | `session_mid` | 限 1 条强信号（correction/automation，阈值 0.8） |
| `session/disposed` | `session_end` | 完整评估 |
| `suggest_now` 工具 | `manual` | 手动触发 |

产出建议通过 cordis 事件 `pa/suggestion` 广播（由 `dsh-proactive-injector` 消费投递）。

## 安装

```bash
pnpm add @proactive-agent/dsh-proactive-core @proactive-agent/dsh-proactive-suggest
```

## 使用（cordis.patch.yml）

```yaml
- insert:
    - id: pa-core
      name: '@proactive-agent/dsh-proactive-core'
      config: {}
    - id: pa-suggest
      name: '@proactive-agent/dsh-proactive-suggest'
      config:
        sessionStartPush: true
        sessionMidPush: true
        sessionEndEvaluate: true
        manualTool: true
```

## 配置

| 字段 | 默认 | 说明 |
| --- | --- | --- |
| sessionStartPush | true | session/created 推送存量建议 |
| sessionMidPush | true | turn/end 会话中评估 |
| sessionEndEvaluate | true | session/disposed 完整评估 |
| manualTool | true | 注册 `suggest_now` 工具 |
| maxMessages | 40 | 每会话喂给评估器的消息上限 |
| silentErrors | true | 评估失败静默 |
