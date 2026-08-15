/**
 * @proactive-agent/dsh-proactive-core
 *
 * PA 引擎单例宿主插件（方案 C：消灭 core 多实例分裂）。
 *
 * 背景：此前 5 个插件各自 esbuild bundle 一份 `@proactive-agent/core`，
 * 导致 core 的模块级单例状态（suggestionsCache 写穿缓存、类型权重、
 * enabled/DND）互相独立 → 建议接受/忽略反馈跨插件丢更新。
 *
 * 本插件是 core 的**唯一** import 者，通过 cordis 服务 `paCore` 暴露
 * memoryService / suggestService；其余插件用 `ctx.get('paCore')` 消费，
 * 从根上保证进程内只有一份 core 状态。
 *
 * S3 LLM 接线（P1-6）：core 的 LLM 提取/分析（extractAndCapture、
 * runAnalysisAndPersistDetailed）原生读 `MEMORY_LLM_*` 环境变量（OpenAI
 * 兼容接口）。本插件启动时把 dsh 宿主凭据（ctx.credentials）桥接过去——
 * 若用户未显式配置 MEMORY_LLM_*，就用 dsh 已配置的模型凭据，让记忆提取
 * 直接复用宿主模型，无需单独配 key。双路径：显式 env 优先，桥接兜底。
 */
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { memoryService, suggestService } from '@proactive-agent/core'

export const name = 'proactive-core'
// 不 inject credentials：headless/无凭据服务时也不阻塞插件树（LLM 桥接改为可选探测）
export const inject = [] as const

export const Config = z.object({
  /** 是否把 dsh 宿主凭据桥接为 MEMORY_LLM_*（core 提取/分析用）；显式 env 优先 */
  bridgeLlmCredentials: z.boolean().default(true),
  /** 桥接来源 ref（默认 DEEPSEEK_API_KEY，dsh 模型路由的标准凭据） */
  llmApiKeyRef: z.string().default('DEEPSEEK_API_KEY'),
  /** 桥接 baseUrl（dsh 官方 DeepSeek 兼容端点；留空则不覆盖 MEMORY_LLM_BASE_URL） */
  llmBaseUrl: z.string().default(''),
  /** 桥接 model（留空则不覆盖 MEMORY_LLM_MODEL，此时需宿主侧有默认路由） */
  llmModel: z.string().default(''),
})

/** 暴露给其他插件的 PA core API 面 */
export interface PaCoreApi {
  memoryService: typeof memoryService
  suggestService: typeof suggestService
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    paCore: PaCoreApi
  }
}

export function apply(ctx: Context, config: PluginConfig) {
  const cfg = { ...config }

  // 先同步提供 paCore 服务（其余插件依赖它，不能等异步）
  ctx.provide('paCore', { memoryService, suggestService })

  // ===== S3 LLM 凭据桥接（异步探测，不阻塞插件树） =====
  if (cfg.bridgeLlmCredentials !== false) {
    const apiKeyRef = cfg.llmApiKeyRef || 'DEEPSEEK_API_KEY'
    void (async () => {
      try {
        // 可选探测：环境变量已有显式配置则直接跳过（双路径：显式 env 优先）
        if (process.env.MEMORY_LLM_API_KEY) return
        const creds = (ctx as any).credentials
        if (!creds?.resolve) return
        const resolved = await creds.resolve(apiKeyRef)
        if (resolved?.value) {
          process.env.MEMORY_LLM_API_KEY = resolved.value
          ctx.logger?.info?.(`[proactive-core] LLM 凭据桥接: ${apiKeyRef} → MEMORY_LLM_API_KEY（记忆提取/分析启用 LLM 模式）`)
          if (cfg.llmBaseUrl && !process.env.MEMORY_LLM_BASE_URL) {
            process.env.MEMORY_LLM_BASE_URL = cfg.llmBaseUrl
          }
          if (cfg.llmModel && !process.env.MEMORY_LLM_MODEL) {
            process.env.MEMORY_LLM_MODEL = cfg.llmModel
          }
        } else {
          ctx.logger?.info?.('[proactive-core] 未找到宿主 LLM 凭据，记忆提取保持 rule 降级模式')
        }
      } catch (error) {
        ctx.logger?.warn?.('[proactive-core] LLM 凭据桥接失败（不影响引擎启动）:', error instanceof Error ? error.message : error)
      }
    })()
  }
}

type PluginConfig = z.infer<typeof Config>
