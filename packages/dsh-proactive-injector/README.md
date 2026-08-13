# @proactive-agent/dsh-proactive-injector

ProactiveAgent 建议箱 + 反馈闭环插件（DeepSeek Harness / cordis）。

## 功能

- 消费 `pa/suggestion` 事件 → 向会话流投递一条**建议箱通知**（plugin user message，
  文本内明确"请勿自行执行，除非用户明确要求"，用户保留主权）
- 反馈工具：
  - `suggest_list`：列出待处理建议
  - `suggest_accept`：接受（correction 写入长期记忆 + 刷新画像；权重提升）
  - `suggest_dismiss`：忽略（权重下降，同类建议降低频率）

## 安装

```bash
pnpm add @proactive-agent/dsh-proactive-core @proactive-agent/dsh-proactive-injector
```

## 使用（cordis.patch.yml）

```yaml
- insert:
    - id: pa-core
      name: '@proactive-agent/dsh-proactive-core'
      config: {}
    - id: pa-suggest
      name: '@proactive-agent/dsh-proactive-suggest'
      config: {}
    - id: pa-injector
      name: '@proactive-agent/dsh-proactive-injector'
      config:
        notifyOnSuggestion: true
        tools: true
        maxNoticesPerSession: 3
```

## 配置

| 字段 | 默认 | 说明 |
| --- | --- | --- |
| notifyOnSuggestion | true | 收到建议时投递通知 |
| tools | true | 注册建议箱工具 |
| maxNoticesPerSession | 3 | 每会话通知上限（防轰炸） |

> 注意：当前通知以 plugin user message 进入模型上下文（弱约束保持用户主权）。
> 理想形态是 turnTail 客户端卡片（模型不可见），属于后续升级方向。
