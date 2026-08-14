# @proactive-agent/dsh

ProactiveAgent（主动记忆 + 主动建议）× DeepSeek Harness 的 **bundle 聚合包**。

一条命令安装整个 PA 插件组到 dsh profile：

```bash
dsh plugin --profile web add @proactive-agent/dsh
```

## 包含（6 个 cordis 插件）

| 包 | cordis id | 职责 |
| --- | --- | --- |
| @proactive-agent/dsh-proactive-core | pa-core | 引擎单例宿主（必须最先装） |
| @proactive-agent/dsh-proactive-memory | pa-memory | 记忆工具 + persona 画像 + 每轮记忆注入 |
| @proactive-agent/dsh-proactive-suggest | pa-suggest | 主动建议引擎（五触发器） |
| @proactive-agent/dsh-proactive-injector | pa-injector | 建议箱摘要 + accept/dismiss 反馈闭环 |
| @proactive-agent/dsh-proactive-daily | pa-daily | 每日回顾 |
| @proactive-agent/dsh-proactive-skills | pa-skills | sop 记忆 → dsh skills |

## 细粒度安装（高级）

不用 bundle、逐个启用时，直接安装对应包并在 profile 的 `cordis.patch.yml` 手写 insert 行（见本包 `cordis.patch.yml` 内容）。

## 文档

- 主 README：仓库根 `README.md`
- 升级蓝图：`UPGRADE-BLUEPRINT.md`
