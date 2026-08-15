# paCore 公共服务（第三方插件接入指南）

> 版本：v1（2026-08-15，P1-9 起稳定承诺）
> 包：`@proactive-agent/dsh-proactive-core`
> cordis 服务名：`paCore`

## 一句话

PA-DSH 从"6 插件产品"升级为 **dsh 主动层基础设施**：任何第三方 dsh 插件都可以通过
`ctx.get('paCore')` 读写长期记忆、评估/订阅主动建议，无需依赖任何 `@proactive-agent/core` 内部实现。

## 服务面（稳定 API v1）

| 成员 | 类型 | 用途 | 稳定性 |
| --- | --- | --- | --- |
| `memoryService` | `typeof import('@proactive-agent/core').memoryService` | 记忆读写：capture / search / recall / persona / pending 确认 | ✅ 稳定 |
| `suggestService` | `typeof import('@proactive-agent/core').suggestService` | 建议引擎：evaluateNow / listSuggestionsForUI / handleSuggestionFeedback | ✅ 稳定 |

**注入方式**：

```ts
import type { Context } from '@deepseek-ai/cordis'

declare module '@deepseek-ai/cordis' {
  interface Context {
    paCore: {
      memoryService: typeof import('@proactive-agent/core').memoryService
      suggestService: typeof import('@proactive-agent/core').suggestService
    }
  }
}

export function apply(ctx: Context) {
  const { memoryService, suggestService } = ctx.get('paCore')
  // ...
}
```

**注意**：`paCore` 依赖 `dsh-proactive-core` 插件先加载（cordis 自动按服务依赖排序）。
**不要**直接 `import { memoryService } from '@proactive-agent/core'`——那会创建第二个引擎实例，
破坏单例（P0 方案 C 已消灭过此问题）。

## 事件面（跨插件通信）

| 事件 | 载荷 | 方向 | 说明 |
| --- | --- | --- | --- |
| `pa/suggestion` | `{ sessionId, record: SuggestionRecord }` | suggest/daily → 消费方 | 新建议产生（injector 消费投递建议箱） |

第三方插件可以 `ctx.on('pa/suggestion', ...)` 订阅建议流，实现自己的投递/展示。

## 常用 API 速查（memoryService）

```ts
// 写入（显式 capture：用户明确要求记住，立即生效）
memoryService.captureCandidate({ content, type, priority }, { scope }, { confirmed: true })

// 检索（BM25 确定性，无 LLM）
const { hits } = memoryService.search({ query, limit, scope: 'auto' })

// 每轮上下文注入（供 systemPrompt.context 用）
const block = memoryService.contextForMessage(userText, { limit: 5 })

// 待确认闭环（M2 半自动捕获）
const pending = memoryService.pendingAtoms()
memoryService.confirmAtomById(id)   // 确认 → 进入召回
memoryService.rejectAtomById(id)    // 拒绝 → 删除

// 画像
const persona = memoryService.personaRaw('auto')
```

## 常用 API 速查（suggestService）

```ts
// 主动评估（触发器：session_start / session_mid / session_end / timer / manual）
const records = await suggestService.evaluateNow({
  trigger: 'session_mid',
  sessionId,
  messages,
  suppressIfQuiet: true,
})

// 建议箱
const pending = suggestService.listSuggestionsForUI('suggested')

// 反馈（接受/忽略；接受时自动执行动作，注入 executor 则真实创建）
await suggestService.handleSuggestionFeedback(id, 'accepted', { host: 'dsh' })
```

## 稳定性承诺（v1）

1. **不破坏性变更**：`paCore.memoryService` / `paCore.suggestService` 的方法签名
   与 `@proactive-agent/core@0.9.x` 对齐；升级 core 时若需破坏性变更，先升大版本并在 CHANGELOG 标注。
2. **单例保证**：`dsh-proactive-core` 是 `@proactive-agent/core` 的唯一 import 者
   （esbuild bundle 打进插件），第三方通过 `ctx.get('paCore')` 消费，永不同时存在第二份引擎状态。
3. **事件契约**：`pa/suggestion` 载荷字段（sessionId / record）为稳定契约；
   新字段只增不改。
4. **错误处理**：所有 API 抛错均为常规 Error，无特殊错误类型依赖；第三方应 try/catch。
5. **配置**：`dsh-proactive-core` 的 Config 字段均为可选、带默认值；新增配置只增不减。

## 版本记录

- **v1（2026-08-15）**：P1-9 公共服务化。定义稳定 API 面 + 事件契约 + 稳定性承诺。
  此前 S3 已加 LLM 凭据桥接、S4 已加宿主动作执行器（均不影响本服务面）。
