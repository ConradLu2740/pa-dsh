/**
 * @proactive-agent/dsh-proactive-suggest
 *
 * ProactiveAgent 主动建议引擎插件（DeepSeek Harness cordis 插件）
 *
 * 职责：把 dsh 的会话事件流映射为 PA 引擎的 evaluateNow 触发器。
 *
 * 触发器映射（方案 §6.3）：
 * - session/created → session_start（推送存量待处理建议摘要，≤5）
 * - turn/end       → session_mid（限 1 条强信号，suppressIfQuiet 降噪）
 * - session/disposed → session_end（完整评估）
 * - suggest_now 工具 → manual
 *
 * 产出建议通过 cordis 事件 `pa/suggestion` 广播（dsh-proactive-injector 消费）。
 */
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import z from '@deepseek-ai/schemastery'
import type { suggestService, SuggestionRecord } from '@proactive-agent/core'

/** paCore 服务暴露的 API 面（由 dsh-proactive-core 提供） */
type PaCoreApi = {
  suggestService: typeof suggestService
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    paCore: PaCoreApi
  }
}

export const name = 'proactive-suggest'
export const inject = ['tools'] as const

export const Config = z.object({
  /** session/created 时推送存量建议 */
  sessionStartPush: z.boolean().default(true),
  /** turn/end 时会话中评估（强信号限 1 条） */
  sessionMidPush: z.boolean().default(true),
  /** session/disposed 时完整评估 */
  sessionEndEvaluate: z.boolean().default(true),
  /** 注册 suggest_now 工具（manual 触发器） */
  manualTool: z.boolean().default(true),
  /** 每会话最多保留的消息数（喂给评估器） */
  maxMessages: z.number().default(40),
  /** 评估失败静默（true）还是往日志打 warn */
  silentErrors: z.boolean().default(true),
})

type PluginConfig = z.infer<typeof Config>

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

/** 从 dsh ContentBlock[] 提取纯文本 */
function extractText(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .filter((b: any) => b && b.type === 'text' && typeof b.text === 'string')
      .map((b: any) => b.text)
      .join('\n')
  }
  return ''
}

export function apply(ctx: Context, config: PluginConfig) {
  const cfg = { ...config }
  // 从 paCore 服务取引擎实例（dsh-proactive-core 保证进程内单例）
  const { suggestService } = ctx.get('paCore')
  /** sessionId → 会话消息（用于 session_mid / session_end 评估） */
  const collectors = new Map<string, ChatMessage[]>()
  let lastSessionId: string | undefined

  const pushMessage = (sessionId: string, msg: ChatMessage) => {
    let list = collectors.get(sessionId)
    if (!list) {
      list = []
      collectors.set(sessionId, list)
    }
    list.push(msg)
    if (cfg.maxMessages > 0 && list.length > cfg.maxMessages) {
      list.splice(0, list.length - cfg.maxMessages)
    }
    lastSessionId = sessionId
  }

  const broadcast = (sessionId: string, records: SuggestionRecord[]) => {
    for (const record of records) {
      ctx.emit('pa/suggestion', { sessionId, record })
    }
  }

  const evaluate = async (trigger: 'session_start' | 'session_mid' | 'session_end' | 'manual', sessionId?: string) => {
    const messages = sessionId ? (collectors.get(sessionId) ?? []) : []
    try {
      const records = await suggestService.evaluateNow({
        trigger,
        sessionId,
        messages: messages.length > 0 ? messages : undefined,
        suppressIfQuiet: trigger === 'session_mid' ? true : undefined,
      })
      if (records.length > 0 && sessionId) broadcast(sessionId, records)
      return records
    } catch (error) {
      if (!cfg.silentErrors) console.warn('[proactive-suggest] evaluateNow 失败:', error instanceof Error ? error.message : error)
      return []
    }
  }

  // ===== 1. 消息收集 + turn/end 触发（session/event 事件流） =====
  ctx.on('session/event', (session: any, event: any) => {

    const sessionId = String(session?.id ?? '')
    if (!sessionId) return

    if (event?.type === 'user/message') {
      const data = event.data
      // 过滤 plugin 合成消息（如我们自己的建议通知），避免自激循环
      const kind = data?.source?.kind
      if (kind === 'plugin') return
      const text = extractText(data?.content)
      if (text.trim()) pushMessage(sessionId, { role: 'user', content: text.trim() })
      return
    }

    if (event?.type === 'assistant/message') {
      const text = extractText(event.data?.message?.content ?? event.data?.content)
      if (text.trim()) pushMessage(sessionId, { role: 'assistant', content: text.trim() })
      return
    }

    if (event?.type === 'turn/end') {
      const reasonKind = event.data?.reason?.kind ?? event.data?.reason
      if (cfg.sessionMidPush && reasonKind === 'completed') {
        void evaluate('session_mid', sessionId)
      }
      return
    }
  })

  // ===== 2. session/created → 存量推送 =====
  ctx.on('session/created', (session: any) => {
    const sessionId = String(session?.id ?? '')
    if (!sessionId || !cfg.sessionStartPush) return
    collectors.set(sessionId, [])
    void evaluate('session_start', sessionId)
  })

  // ===== 3. session/disposed → 完整评估 + 清理 =====
  ctx.on('session/disposed', (session: any) => {
    const sessionId = String(session?.id ?? '')
    if (!sessionId) return
    if (cfg.sessionEndEvaluate) {
      void evaluate('session_end', sessionId)
    }
    collectors.delete(sessionId)
    if (lastSessionId === sessionId) lastSessionId = undefined
  })

  // ===== 4. suggest_now 工具（manual 触发器） =====
  if (cfg.manualTool !== false) {
    ctx.tools.register(
      defineTool({
        name: 'suggest_now',
        description:
          'Run ProactiveAgent proactive-suggestion evaluation right now on the current conversation ' +
          '(manual trigger). Returns any suggestions produced. Each suggestion carries an id; ' +
          'use suggest_accept / suggest_dismiss to handle it.',
        parameters: {},
        output: {
          schema: { type: 'string' },
          render: (_args: unknown, value: string) => [{ type: 'text', text: value }],
        },
        execute: async () => {
          const sid = lastSessionId
          const records = await evaluate('manual', sid)
          if (records.length === 0) return '💤 本次评估没有产生新建议（可能被降噪/预算/DND 抑制）'
          const lines = records.map(
            (r: SuggestionRecord, i: number) =>
              `${i + 1}. [${r.kind}] ${r.title}\n   ${r.reason}（置信度 ${Math.round(r.rawConfidence * 100)}%）\n   建议 id: ${r.id}`,
          )
          return `💡 产生 ${records.length} 条主动建议:\n${lines.join('\n')}\n\n处理方式: suggest_accept <id> 接受 / suggest_dismiss <id> 忽略`
        },
      }),
    )
  }
}
