# @proactive-agent/dsh-proactive-skills

ProactiveAgent 流程记忆 → dsh skills 插件（DeepSeek Harness / cordis）。

## 功能

把 `@proactive-agent/core` 记忆库中的 **sop（流程）类长期记忆**动态暴露为 dsh 技能：

- 每条 sop 记忆 → 一个 runtime skill（`pa-sop-N`）
- 通过 `registerProvider` 动态目录（list/get），记忆更新后目录自动反映
- 模型可通过 skill 工具发现并加载流程细节

## 安装

```bash
pnpm add @proactive-agent/dsh-proactive-core @proactive-agent/dsh-proactive-skills
```

## 使用（cordis.patch.yml）

```yaml
- insert:
    - id: pa-core
      name: '@proactive-agent/dsh-proactive-core'
      config: {}
    - id: pa-skills
      name: '@proactive-agent/dsh-proactive-skills'
      config:
        maxSkills: 10
```

## 配置

| 字段 | 默认 | 说明 |
| --- | --- | --- |
| maxSkills | 10 | 最多暴露的 sop 技能数 |
| descriptionLength | 90 | 技能描述截断长度 |
