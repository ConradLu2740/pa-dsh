/**
 * @proactive-agent/dsh-proactive-daily
 *
 * 每日主动回顾插件：替代 PA 桌面版 daemon 的定时职责。
 *
 * - 每天 dailyAt（默认 09:30）触发一次 timer 评估：把最近 24h 收集到的
 *   会话消息喂给 evaluateNow({trigger:'timer'})，产出的建议通过
 *   `pa/suggestion` 事件进入建议箱（injector 投递）。
 * - P1-8 改造：
 *   1. 缓冲落盘：24h 消息缓冲持久化到磁盘（重启不丢），启动时恢复
 *   2. 外部调度兜底：进程错过 dailyAt 后，下次启动补跑一次"补做评估"
 *      （catch-up，最多补 1 次，避免堆积）
 *   3. daily_review 工具：手动触发回顾（输出记忆统计 + 建议箱 + 评估结果）
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'
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
  /** 缓冲落盘路径（默认 ~/.proma-proactive/dsh-daily-buffer.json） */
  bufferFile: z.string().default(''),
  /** 错过后补跑评估（最多补 1 次，避免堆积） */
  catchUpOnStart: z.boolean().default(true),
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

  // ===== 缓冲落盘（P1-8：重启不丢） =====
  const bufferFile =
    cfg.bufferFile ||
    join(homedir(), '.proma-proactive', 'dsh-daily-buffer.json')

  const loadBuffer = (): TimedMessage[] => {
    try {
      if (!existsSync(bufferFile)) return []
      const raw = JSON.parse(readFileSync(bufferFile, 'utf8'))
      // 兼容两种格式：纯数组（旧）或 {messages, lastCatchUp}（新）
      const list = Array.isArray(raw) ? raw : Array.isArray(raw?.messages) ? raw.messages : []
      const now = Date.now()
      const cutoff = now - cfg.messageTtlMs
      return list
        .filter((m: any) => m && typeof m.content === 'string' && typeof m.at === 'number')
        .filter((m: TimedMessage) => m.at >= cutoff)
        .slice(-200)
    } catch {
      return []
    }
  }

  const saveBuffer = (messages: TimedMessage[]) => {
    try {
      mkdirSync(dirname(bufferFile), { recursive: true })
      const existing = (() => {
        try {
          if (!existsSync(bufferFile)) return {}
          const raw = JSON.parse(readFileSync(bufferFile, 'utf8'))
          return typeof raw === 'object' && raw && !Array.isArray(raw) ? raw : {}
        } catch {
          return {}
        }
      })()
      writeFileSync(bufferFile, JSON.stringify({ ...existing, messages: messages.slice(-200) }), 'utf8')
    } catch (error) {
      ctx.logger?.warn?.('[proactive-daily] 缓冲落盘失败:', error instanceof Error ? error.message : error)
    }
  }

  /** 最近消息（启动时恢复 + 运行中追加；TTL 过期剔除） */
  const recent: TimedMessage[] = loadBuffer()
  let lastSessionId: string | undefined

  const pushMessage = (sessionId: string, role: 'user' | 'assistant', content: string) => {
    recent.push({ role, content, at: Date.now() })
    lastSessionId = sessionId
    const cutoff = Date.now() - cfg.messageTtlMs
    while (recent.length > 0 && (recent[0]?.at ?? 0) < cutoff) recent.shift()
    if (recent.length > 200) recent.splice(0, recent.length - 200)
    saveBuffer(recent)
  }

  // 轻量消息收集（仅最近消息，供 timer 评估；落盘防重启丢失）
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
        // 下次 session_start 会走存量推送
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

    // P1-8：启动时补跑——若今天已过 dailyAt 且今天还没评估过，补做一次
    if (cfg.catchUpOnStart !== false) {
      const now = new Date()
      const todayTarget = new Date(now)
      todayTarget.setHours(h, m, 0, 0)
      if (now.getTime() > todayTarget.getTime() + 5 * 60 * 1000) {
        // 今天已过 dailyAt 5 分钟以上 → 补跑一次（进程此前不在线）
        const todayKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`
        const lastRunKey = (() => {
          try {
            if (!existsSync(bufferFile)) return ''
            const raw = JSON.parse(readFileSync(bufferFile, 'utf8'))
            return typeof raw === 'object' && raw && typeof raw.lastCatchUp === 'string' ? raw.lastCatchUp : ''
          } catch {
            return ''
          }
        })()
        if (lastRunKey !== todayKey) {
          void runTimerEvaluation().then((result) => {
            ctx.logger?.info?.(`[proactive-daily] 启动补跑今日评估（错过 ${cfg.dailyAt}）: ${result}`)
            // 记录补跑日期，避免同一天重复补跑
            try {
              mkdirSync(dirname(bufferFile), { recursive: true })
              const existing = existsSync(bufferFile) ? JSON.parse(readFileSync(bufferFile, 'utf8')) : {}
              const payload =
                typeof existing === 'object' && existing && !Array.isArray(existing)
                  ? { ...existing, lastCatchUp: todayKey }
                  : { messages: Array.isArray(existing) ? existing : [], lastCatchUp: todayKey }
              writeFileSync(bufferFile, JSON.stringify(payload), 'utf8')
            } catch {
              // 忽略
            }
          })
        }
      }
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
