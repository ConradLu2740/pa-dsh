# @proactive-agent/dsh-proactive-core

ProactiveAgent 引擎单例宿主插件（DeepSeek Harness / cordis）。

## 作用

PA→dsh 插件组的**基础依赖**：本插件是进程内唯一 import `@proactive-agent/core` 的地方，
通过 cordis 服务 `paCore` 把 `memoryService` / `suggestService` 提供给其余插件。

> 为什么必须装它：其他 dsh-proactive-* 插件依赖 `paCore` 服务。若各插件各自打包 core，
> 会导致引擎模块级单例状态（建议索引、类型权重、DND）分裂，反馈闭环失效。

## 安装

```bash
pnpm add @proactive-agent/dsh-proactive-core
```

## 使用（cordis.patch.yml）

```yaml
- insert:
    - id: pa-core
      name: '@proactive-agent/dsh-proactive-core'
      config: {}
```

必须排在所有 `pa-*` 插件之前。

## 提供的服务

| 服务 | 内容 |
| --- | --- |
| `paCore` | `{ memoryService, suggestService }`（@proactive-agent/core 0.9.x 实例） |

## 配套插件

- `@proactive-agent/dsh-proactive-memory`：原生记忆工具 + persona 段
- `@proactive-agent/dsh-proactive-suggest`：主动建议引擎（事件映射）
- `@proactive-agent/dsh-proactive-injector`：建议箱 + 反馈闭环
- `@proactive-agent/dsh-proactive-daily`：每日回顾
- `@proactive-agent/dsh-proactive-skills`：sop 记忆 → skills

## 文档

- 方案与实施说明：见 [pa-dsh 仓库](https://github.com/proma-ai/Proma)（ProactiveAgent → dsh 插件化）
