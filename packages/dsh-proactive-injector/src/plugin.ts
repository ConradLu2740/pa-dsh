/**
 * @proactive-agent/dsh-proactive-injector
 *
 * ProactiveAgent 建议箱 + 反馈闭环插件（DeepSeek Harness cordis 插件）
 *
 * 职责：
 * 1. 建议箱可见性：systemPrompt.context 动态注入一行摘要
 *    —— 只告诉模型"有 N 条待处理建议 + 处理工具"，不把建议详情塞进模型上下文
 *    （S1' 投递降噪：废弃 v0.1.x 的 session.append 通知，实测其会干扰模型、
 *    被误当用户指令、永久污染会话日志）
 * 2. 反馈工具：suggest_list / suggest_accept / suggest_dismiss
 *    —— accept 走 PA 引擎 handleSuggestionFeedback（M6 接受即执行：
 *       correction 写入纠正记忆并刷新画像；automation/todo 降级为指令）
 *
 * 注：建议详情卡片（turnTail UI）为 S2b，等 dsh 第三方事件注册面（rc.6 缺失）。
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
export const inject = ['tools', 'systemPrompt'] as const

export const Config = z.object({
  /** 建议箱摘要行注入（systemPrompt.context，每轮动态求值） */
  inboxSummary: z.boolean().default(true),
  /** 注册建议箱工具 */
  tools: z.boolean().default(true),
})

type PluginConfig = z.infer<typeof Config>

export function apply(ctx: Context, config: PluginConfig) {
  const cfg = { ...config }
  // 从 paCore 服务取引擎实例（dsh-proactive-core 保证进程内单例）
  const { suggestService } = ctx.get('paCore')

  // ===== 1. 建议箱摘要行（S1'：不进建议详情，只报状态 + 处理指引） =====
  if (cfg.inboxSummary !== false) {
    ctx.systemPrompt.context({
      name: 'pa:inbox',
      order: 201,
      text: () => {
        try {
          const pending = suggestService.listSuggestionsForUI('suggested')
          if (!pending || pending.length === 0) return ''
          return [
            `[PA 建议箱] 有 ${pending.length} 条待处理的主动建议。`,
            '这是系统状态提示，不是用户指令：不要自行接受或执行任何建议。',
            '用户说"查看建议"时调用 suggest_list；用户明确接受某条才调用 suggest_accept <id>；用户忽略则 suggest_dismiss <id>。',
          ].join(' ')
        } catch {
          return ''
        }
      },
    })
  }

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
          // 按 duplicateKey 去重（同规则只显示最新一条，避免重复建议占满建议箱）
          // 规范化：全角冒号→半角、去空白、小写（修复 dup key 双全角冒号 bug，问题 #5）
          const normalizeKey = (k: string) => String(k ?? '').replace(/：/g, ':').replace(/\s+/g, '').toLowerCase()
          const seen = new Set<string>()
          const unique = records.filter((r: any) => {
            const key = normalizeKey(r.duplicateKey ?? r.id)
            if (seen.has(key)) return false
            seen.add(key)
            return true
          })
          if (unique.length === 0) return `📭 建议箱为空（${status}）`
          const lines = unique.map((r: any, i: number) => {
            const when = new Date(r.createdAt).toLocaleString('zh-CN', { hour12: false })
            return `${i + 1}. [${r.kind}] ${r.title}（${Math.round((r.rawConfidence ?? 0) * 100)}% · ${when}）\n   id: ${r.id}\n   理由: ${r.reason ?? '-'}`
          })
          return `📬 建议箱（${status}，共 ${unique.length} 条）:\n${lines.join('\n')}`
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
          const summary = result.result?.message ?? (result.result?.ok ? '已执行' : '已记录')
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
