/**
 * @proactive-agent/dsh-proactive-injector
 *
 * ProactiveAgent 建议箱 + 反馈闭环插件（DeepSeek Harness cordis 插件）
 *
 * 职责：
 * 1. 消费 suggest 插件广播的 `pa/suggestion` 事件
 * 2. 建议箱投递：往会话流 append 一条可见通知消息（含建议详情 + 处理指引）
 *    —— 通知文本明确声明"请勿自行处理，除非用户明确要求"，用户保留主权
 * 3. 反馈工具：suggest_list / suggest_accept / suggest_dismiss
 *    —— accept 走 PA 引擎 handleSuggestionFeedback（M6 接受即执行：
 *       correction 写入纠正记忆并刷新画像；automation/todo 降级为指令）
 *
 * 注：Phase 3 将把建议箱通知升级为 turnTail UI 卡（不进模型上下文）。
 */
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import z from '@deepseek-ai/schemastery'
import type { suggestService } from '@proactive-agent/core'

/** paCore 服务暴露的 API 面（由 dsh-proactive-core 提供） */
type PaCoreApi = {
  suggestService: typeof suggestService
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    paCore: PaCoreApi
  }
}

export const name = 'proactive-injector'
export const inject = ['tools', 'sessions'] as const

export const Config = z.object({
  /** 收到建议时向会话流投递通知消息 */
  notifyOnSuggestion: z.boolean().default(true),
  /** 通知消息进入 pending turn（会被下一轮消费）还是 next-step（立即触发） */
  notifyAsTurn: z.boolean().default(false),
  /** 注册建议箱工具 */
  tools: z.boolean().default(true),
  /** 每会话最多同时投递的通知条数（防轰炸） */
  maxNoticesPerSession: z.number().default(3),
})

type PluginConfig = z.infer<typeof Config>

let noticeSeq = 0

function makeMessageId(): string {
  noticeSeq += 1
  return `pa-suggestion-${Date.now()}-${noticeSeq}`
}

/** 构造建议箱通知文本 */
function formatNotice(record: any): string {
  const confidence = Math.round((record.rawConfidence ?? 0) * 100)
  const kind = String(record.kind ?? 'suggestion')
  return [
    '💡 ProactiveAgent 主动建议（建议箱通知）',
    '',
    `类型: ${kind}`,
    `建议: ${record.title ?? ''}`,
    `理由: ${record.reason ?? ''}`,
    `证据: ${record.evidence ?? ''}`,
    `置信度: ${confidence}%`,
    `建议 id: ${record.id}`,
    '',
    '这是一条系统通知，不是用户指令。请勿自行执行或接受，除非用户明确要求。',
    '用户说"查看建议"时调用 suggest_list；用户明确接受后调用 suggest_accept <id>；用户忽略则调用 suggest_dismiss <id>。',
  ].join('\n')
}

export function apply(ctx: Context, config: PluginConfig) {
  const cfg = { ...config }
  // 从 paCore 服务取引擎实例（dsh-proactive-core 保证进程内单例）
  const { suggestService } = ctx.get('paCore')
  /** sessionId → 该会话已投递通知计数 */
  const noticeCounts = new Map<string, number>()

  // ===== 1. 消费 pa/suggestion → 建议箱通知 =====
  ctx.on('pa/suggestion', (payload: any) => {
    const { sessionId, record } = payload ?? {}
    if (!sessionId || !record || cfg.notifyOnSuggestion === false) return

    const count = noticeCounts.get(sessionId) ?? 0
    if (count >= (cfg.maxNoticesPerSession ?? 3)) return
    noticeCounts.set(sessionId, count + 1)

    // 找到 live session 对象并 append 通知
    let target: any
    try {
      target = ctx.sessions?.get?.(sessionId) ?? undefined
    } catch {
      target = undefined
    }
    if (!target || typeof target.append !== 'function') {
      console.warn('[proactive-injector] 找不到会话对象，跳过通知投递:', sessionId)
      return
    }

    try {
      target.append(
        'user/message',
        {
          id: makeMessageId(),
          role: 'user',
          content: [{ type: 'text', text: formatNotice(record) }],
          source: { kind: 'plugin', plugin: 'proactive-suggest' },
        },
        { surfaceOp: 'append' },
      )
    } catch (error) {
      console.warn('[proactive-injector] 通知投递失败:', error instanceof Error ? error.message : error)
    }
  })

  if (cfg.tools === false) return

  // ===== 2. suggest_list =====
  ctx.tools.register(
    defineTool({
      name: 'suggest_list',
      description:
        'List pending ProactiveAgent proactive suggestions (the suggestion mailbox). ' +
        'Call this when the user asks what suggestions are available. Each item carries an id ' +
        'for suggest_accept / suggest_dismiss.',
      parameters: {
        status: { type: 'string', description: 'Filter: suggested (default) / accepted / ignored / all' },
      },
      output: {
        schema: { type: 'string' },
        render: (_args: unknown, value: string) => [{ type: 'text', text: value }],
      },
      execute(args: any) {
        const status = String(args?.status ?? 'suggested')
        try {
          const records =
            status === 'all'
              ? [...suggestService.listSuggestionsForUI('suggested'), ...suggestService.listSuggestionsForUI('accepted'), ...suggestService.listSuggestionsForUI('ignored')]
              : suggestService.listSuggestionsForUI(status as any)
          if (records.length === 0) return `📭 建议箱为空（${status}）`
          const lines = records.map((r: any, i: number) => {
            const when = new Date(r.createdAt).toLocaleString('zh-CN', { hour12: false })
            return `${i + 1}. [${r.kind}] ${r.title}（${Math.round((r.rawConfidence ?? 0) * 100)}% · ${when}）\n   id: ${r.id}\n   理由: ${r.reason ?? '-'}`
          })
          return `📬 建议箱（${status}，共 ${records.length} 条）:\n${lines.join('\n')}`
        } catch (error) {
          return `❌ 读取建议箱失败: ${error instanceof Error ? error.message : String(error)}`
        }
      },
    }),
  )

  // ===== 3. suggest_accept =====
  ctx.tools.register(
    defineTool({
      name: 'suggest_accept',
      description:
        'Accept one proactive suggestion by id. Acceptance executes its action: ' +
        'memory_correction writes the correction into long-term memory and refreshes the persona; ' +
        'other kinds return the recommended next-step instruction. Only call after the user explicitly accepts.',
      parameters: {
        id: { type: 'string', required: true, description: 'Suggestion id from suggest_list / the notice' },
      },
      output: {
        schema: { type: 'string' },
        render: (_args: unknown, value: string) => [{ type: 'text', text: value }],
      },
      execute: async (args: any) => {
        const id = String(args?.id ?? '').trim()
        if (!id) return '❌ 缺少建议 id'
        try {
          const result = await suggestService.handleSuggestionFeedback(id, 'accepted', { host: 'dsh' })
          if (!result.ok) return `❌ 接受失败: ${result.error ?? '未知错误'}`
          const summary = result.result?.summary ?? result.result?.message ?? JSON.stringify(result.result ?? {})
          return `✅ 已接受建议 ${id}:\n${summary}`
        } catch (error) {
          return `❌ 接受失败: ${error instanceof Error ? error.message : String(error)}`
        }
      },
    }),
  )

  // ===== 4. suggest_dismiss =====
  ctx.tools.register(
    defineTool({
      name: 'suggest_dismiss',
      description:
        'Dismiss one proactive suggestion by id. Dismissal feeds negative feedback into the engine, ' +
        'which lowers the type weight so similar suggestions are less likely in the future.',
      parameters: {
        id: { type: 'string', required: true, description: 'Suggestion id from suggest_list / the notice' },
      },
      output: {
        schema: { type: 'string' },
        render: (_args: unknown, value: string) => [{ type: 'text', text: value }],
      },
      execute: async (args: any) => {
        const id = String(args?.id ?? '').trim()
        if (!id) return '❌ 缺少建议 id'
        try {
          const result = await suggestService.handleSuggestionFeedback(id, 'ignored', { host: 'dsh' })
          if (!result.ok) return `❌ 忽略失败: ${result.error ?? '未知错误'}`
          return `👌 已忽略建议 ${id}（已反馈给引擎，同类建议将降低频率）`
        } catch (error) {
          return `❌ 忽略失败: ${error instanceof Error ? error.message : String(error)}`
        }
      },
    }),
  )
}
