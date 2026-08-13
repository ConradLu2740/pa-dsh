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
 */
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { memoryService, suggestService } from '@proactive-agent/core'

export const name = 'proactive-core'

export const Config = z.object({})

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

export function apply(ctx: Context) {
  ctx.provide('paCore', { memoryService, suggestService })
}
