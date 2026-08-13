/**
 * @proactive-agent/dsh-proactive-daily
 *
 * 每日主动回顾插件：替代 PA 桌面版 daemon 的定时职责。
 *
 * - 每天 dailyAt（默认 09:30）触发一次 timer 评估：把最近 24h 收集到的
 *   会话消息喂给 evaluateNow({trigger:'timer'})，产出的建议通过
 *   `pa/suggestion` 事件进入建议箱（injector 投递）。
 * - daily_review 工具：手动触发回顾，输出记忆统计 + 待处理建议 + timer 评估结果。
 */
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import z from '@deepseek-ai/schemastery'
import type { memoryService, suggestService } from '@proactive-agent/core'

/** paCore 服务暴露的 API 面（由 dsh-proactive-core 提供） */
type PaCoreApi = {
  memoryService: typeof memoryService
  suggestService: typeof suggestService
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    paCore: PaCoreApi
  }
}

export const name = 'proactive-daily'
export const inject = ['tools'] as const

export const Config = z.object({
  /** 每日回顾时间 HH:MM */
  dailyAt: z.string().default('09:30'),
  /** 定时评估开关 */
  timerEnabled: z.boolean().default(true),
  /** daily_review 工具 */
  reviewTool: z.boolean().default(true),
  /** 消息保留时长（毫秒） */
  messageTtlMs: z.number().default(24 * 60 * 60 * 1000),
})

type PluginConfig = z.infer<typeof Config>

interface TimedMessage {
  role: 'user' | 'assistant'
  content: string
  at: number
}

export function apply(ctx: Context, config: PluginConfig) {
  const cfg = { ...config }
  // 从 paCore 服务取引擎实例（dsh-proactive-core 保证进程内单例）
  const { memoryService, suggestService } = ctx.get('paCore')
  /** 最近消息（带时间戳，过期剔除） */
  const recent: TimedMessage[] = []
  let lastSessionId: string | undefined

  const pushMessage = (sessionId: string, role: 'user' | 'assistant', content: string) => {
    recent.push({ role, content, at: Date.now() })
    lastSessionId = sessionId
    const cutoff = Date.now() - cfg.messageTtlMs
    while (recent.length > 0 && (recent[0]?.at ?? 0) < cutoff) recent.shift()
    if (recent.length > 200) recent.splice(0, recent.length - 200)
  }

  // 轻量消息收集（仅最近消息，供 timer 评估）
  ctx.on('session/event', (session: any, event: any) => {
    const sessionId = String(session?.id ?? '')
    if (!sessionId) return
    if (event?.type === 'user/message') {
      const kind = event.data?.source?.kind
      if (kind === 'plugin') return
      const text = extractText(event.data?.content)
      if (text.trim()) pushMessage(sessionId, 'user', text.trim())
    } else if (event?.type === 'assistant/message') {
      const text = extractText(event.data?.message?.content ?? event.data?.content)
      if (text.trim()) pushMessage(sessionId, 'assistant', text.trim())
    }
  })

  const runTimerEvaluation = async (): Promise<string> => {
    const messages = recent.map((m) => ({ role: m.role, content: m.content }))
    try {
      const records = await suggestService.evaluateNow({
        trigger: 'timer',
        sessionId: lastSessionId,
        messages,
        suppressIfQuiet: true,
      })
      if (records.length > 0) {
        // 有活会话时直接投递建议箱；无活会话时建议已由 evaluateNow 落库，
        // 下次 session_start 会走存量推送（不再伪造 'daily' 假 id）
        if (lastSessionId) {
          for (const record of records) {
            ctx.emit('pa/suggestion', { sessionId: lastSessionId, record })
          }
          return `产生 ${records.length} 条建议，已投递建议箱`
        }
        return `产生 ${records.length} 条建议（无活跃会话，已入库等待下次会话推送）`
      }
      return '未产生新建议（降噪/预算/去重抑制）'
    } catch (error) {
      return `评估失败: ${error instanceof Error ? error.message : String(error)}`
    }
  }

  // ===== 每日定时（Node timer + cordis effect 清理） =====
  if (cfg.timerEnabled !== false) {
    const parseTime = (s: string): { h: number; m: number } => {
      const [h = '9', m = '30'] = String(s).split(':')
      return { h: Math.max(0, Math.min(23, Number(h) || 0)), m: Math.max(0, Math.min(59, Number(m) || 0)) }
    }
    const { h, m } = parseTime(cfg.dailyAt)
    const DAY_MS = 24 * 60 * 60 * 1000
    const nextDelay = () => {
      const now = new Date()
      const target = new Date(now)
      target.setHours(h, m, 0, 0)
      if (target.getTime() <= now.getTime()) target.setTime(target.getTime() + DAY_MS)
      return target.getTime() - now.getTime()
    }
    let timer: NodeJS.Timeout | undefined
    const schedule = () => {
      timer = setTimeout(() => {
        void runTimerEvaluation()
        schedule() // 下一天
      }, nextDelay())
    }
    schedule()
    // cordis effect：立即注册 disposer（不要在注册时清理！），插件卸载时才清除定时器
    ctx.effect(() => () => {
      if (timer) clearTimeout(timer)
    })
  }

  // ===== daily_review 工具 =====
  if (cfg.reviewTool !== false) {
    ctx.tools.register(
      defineTool({
        name: 'daily_review',
        description:
          'Run the ProactiveAgent daily review: memory statistics, pending suggestions, ' +
          'and a timer-trigger evaluation over recent messages. Use for end-of-day reviews or when the user asks "回顾一下".',
        parameters: {},
        output: {
          schema: { type: 'string' },
          render: (_args: unknown, value: string) => [{ type: 'text', text: value }],
        },
        execute: async () => {
          const stats = memoryService.stats()
          const pending = suggestService.listSuggestionsForUI('suggested')
          const evalResult = await runTimerEvaluation()
          const lines = [
            '📅 ProactiveAgent 每日回顾',
            '',
            '【记忆库】',
            `- 记忆总数: ${stats.atomCount}（待确认提取 ${stats.pendingAtoms}，待确认纠正 ${stats.pendingCorrections}）`,
            `- 已归档: ${stats.archivedCount}，场景数: ${stats.sceneCount}`,
            `- 按类型: ${Object.entries(stats.byType ?? {}).map(([k, v]) => `${k}=${v}`).join(', ') || '无'}`,
            `- 画像状态: ${stats.personaExists ? '已生成' : '未生成'}`,
            '',
            '【建议箱】',
            pending.length === 0 ? '- 无待处理建议' : pending.map((r: any, i: number) => `${i + 1}. [${r.kind}] ${r.title}（id: ${r.id}）`).join('\n'),
            '',
            `【定时评估】${evalResult}`,
          ]
          return lines.join('\n')
        },
      }),
    )
  }
}

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
