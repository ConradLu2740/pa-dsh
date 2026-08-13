# @proactive-agent/dsh-proactive-daily

ProactiveAgent 每日回顾插件（DeepSeek Harness / cordis）：替代 PA 桌面版 daemon 的定时职责。

## 功能

- 每天 `dailyAt`（默认 09:30）触发一次 timer 评估：把最近 24h 会话消息喂给
  `evaluateNow({trigger:'timer'})`，产出的建议进入建议箱（有活会话时投递，无则落库等下次推送）
- `daily_review` 工具：手动回顾（记忆统计 + 建议箱 + 定时评估）

## 安装

```bash
pnpm add @proactive-agent/dsh-proactive-core @proactive-agent/dsh-proactive-daily
```

## 使用（cordis.patch.yml）

```yaml
- insert:
    - id: pa-core
      name: '@proactive-agent/dsh-proactive-core'
      config: {}
    - id: pa-daily
      name: '@proactive-agent/dsh-proactive-daily'
      config:
        dailyAt: '09:30'
        timerEnabled: true
        reviewTool: true
```

## 配置

| 字段 | 默认 | 说明 |
| --- | --- | --- |
| dailyAt | 09:30 | 每日评估时间 HH:MM |
| timerEnabled | true | 定时评估开关 |
| reviewTool | true | `daily_review` 工具 |
| messageTtlMs | 24h | 最近消息保留时长 |
