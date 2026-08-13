/**
 * @proactive-agent/dsh-proactive-memory
 *
 * ProactiveAgent 记忆插件（DeepSeek Harness cordis 插件）
 *
 * 贡献：
 * 1. 原生工具：memory_capture / memory_recall / memory_stats（无 mcp__ 前缀）
 * 2. persona 提示词段：用户画像以 systemPrompt.section 常驻
 *
 * 引擎：@proactive-agent/core（由 dsh-proactive-core 宿主插件提供 paCore 服务，进程内单例）
 * 存储：默认 ~/.proma-proactive/（与 Claude Code 版 PA 共享记忆库）
 */
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import z from '@deepseek-ai/schemastery'
import type { memoryService } from '@proactive-agent/core'

/** paCore 服务暴露的 API 面（由 dsh-proactive-core 提供） */
type PaCoreApi = {
  memoryService: typeof memoryService
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    paCore: PaCoreApi
  }
}

export const name = 'proactive-memory'
export const inject = ['tools', 'systemPrompt'] as const

export const Config = z.object({
  /** persona 段在提示词中的顺序（0 为部署 persona） */
  personaOrder: z.number().default(5),
  /** 工具是否启用 */
  captureTool: z.boolean().default(true),
  recallTool: z.boolean().default(true),
  statsTool: z.boolean().default(true),
})

type PluginConfig = z.infer<typeof Config>

const MEMORY_TYPES = ['fact', 'preference', 'correction', 'sop', 'todo_context', 'event'] as const

export function apply(ctx: Context, config: PluginConfig) {
  const cfg = { ...config }
  // 从 paCore 服务取引擎实例（dsh-proactive-core 保证进程内单例）
  const { memoryService } = ctx.get('paCore')

  // ===== 1. 工具：memory_capture =====
  if (cfg.captureTool !== false) {
    ctx.tools.register(
      defineTool({
        name: 'memory_capture',
        description:
          'Explicitly store a long-term memory (takes effect immediately, enters recall). ' +
          'Use when the user clearly expresses a preference/fact/process/correction. ' +
          'Keep content concise, self-contained, and independently understandable. ' +
          'Types: fact / preference / correction / sop / todo_context / event.',
        parameters: {
          content: {
            type: 'string',
            required: true,
            description:
              'Memory content. Keep negations intact: e.g. "不要用 X" must be stored as-is, never drop 不/不要/别',
          },
          type: {
            type: 'string',
            description: 'Memory type: fact / preference / correction / sop / todo_context / event (default fact)',
          },
          priority: { type: 'number', description: 'Importance 0-100, default 50' },
          scope: { type: 'string', description: 'Write scope: project (default) / global' },
        },
        output: {
          schema: { type: 'string' },
          render: (_args, value: string) => [{ type: 'text', text: value }],
        },
        execute(args) {
          const content = String(args.content ?? '').trim()
          if (!content) return '❌ 记忆内容不能为空'
          const type = (MEMORY_TYPES as readonly string[]).includes(String(args.type)) ? (args.type as (typeof MEMORY_TYPES)[number]) : 'fact'
          const priority = typeof args.priority === 'number' ? Math.max(0, Math.min(100, args.priority)) : undefined
          const scope = args.scope === 'global' ? 'global' : 'project'
          try {
            const result = memoryService.captureCandidate(
              { content, type, priority },
              { scope },
              { confirmed: true },
            )
            const verb = result.deduplicated ? '已合并进已有记忆' : '已记住'
            return `✅ ${verb} [${result.atom.type}]（${result.atom.scope ?? scope} 层，优先级 ${result.atom.priority ?? 50}）:\n${result.atom.content}`
          } catch (error) {
            return `❌ 写入失败: ${error instanceof Error ? error.message : String(error)}`
          }
        },
      }),
    )
  }

  // ===== 2. 工具：memory_recall =====
  if (cfg.recallTool !== false) {
    ctx.tools.register(
      defineTool({
        name: 'memory_recall',
        description:
          'Recall long-term memories by keyword search (deterministic BM25, no LLM calls). ' +
          'Use proactively when the user mentions a topic that may have stored memories. ' +
          'Returns scored hits with scope (project/global).',
        parameters: {
          query: { type: 'string', required: true, description: 'Search keywords (Chinese or English)' },
          limit: { type: 'number', description: 'Max hits, default 5' },
          type: { type: 'string', description: 'Filter by memory type (optional)' },
          scope: { type: 'string', description: 'Read scope: auto (default) / project / global' },
        },
        output: {
          schema: { type: 'string' },
          render: (_args, value: string) => [{ type: 'text', text: value }],
        },
        execute(args) {
          const query = String(args.query ?? '').trim()
          if (!query) return '❌ 检索关键词不能为空'
          const request: Parameters<typeof memoryService.search>[0] = {
            query,
            limit: typeof args.limit === 'number' ? args.limit : 5,
            scope: (args.scope as 'project' | 'global' | 'auto' | undefined) ?? 'auto',
          }
          const t = String(args.type ?? '')
          if (t && (MEMORY_TYPES as readonly string[]).includes(t)) {
            request.type = t as (typeof MEMORY_TYPES)[number]
          }
          try {
            const result = memoryService.search(request)
            if (result.hits.length === 0) return `🔍 没有找到与「${query}」相关的记忆`
            const lines = result.hits.map(
              (hit, i) =>
                `${i + 1}. [${hit.atom.type}]${hit.atom.scope === 'global' ? '(全局)' : '(项目)'} ${hit.atom.content}${hit.score !== undefined ? ` —— 相关度 ${hit.score}` : ''}`,
            )
            return `🔍 召回 ${result.hits.length} 条记忆:\n${lines.join('\n')}`
          } catch (error) {
            return `❌ 检索失败: ${error instanceof Error ? error.message : String(error)}`
          }
        },
      }),
    )
  }

  // ===== 3. 工具：memory_stats =====
  if (cfg.statsTool !== false) {
    ctx.tools.register(
      defineTool({
        name: 'memory_stats',
        description:
          'Show ProactiveAgent memory statistics: total count, by-type distribution, pending items, storage location.',
        parameters: {},
        output: {
          schema: { type: 'string' },
          render: (_args, value: string) => [{ type: 'text', text: value }],
        },
        execute() {
          try {
            const stats = memoryService.stats()
            return [
              '📊 记忆统计:',
              `- 记忆总数: ${stats.atomCount}`,
              `- 待确认提取: ${stats.pendingAtoms}`,
              `- 待确认纠正: ${stats.pendingCorrections}`,
              `- 场景数: ${stats.sceneCount}`,
              `- 已归档: ${stats.archivedCount}`,
              `- 按类型: ${Object.entries(stats.byType ?? {}).map(([k, v]) => `${k}=${v}`).join(', ') || '无'}`,
              `- 画像状态: ${stats.personaExists ? '已生成' : '未生成'}`,
            ].join('\n')
          } catch (error) {
            return `❌ 统计失败: ${error instanceof Error ? error.message : String(error)}`
          }
        },
      }),
    )
  }

  // ===== 4. persona 提示词段（每次组装时动态求值，capture 后自动刷新） =====
  ctx.systemPrompt.section({
    name: 'pa:persona',
    order: cfg.personaOrder ?? 5,
    text: () => {
      try {
        const personaText = memoryService.personaRaw('auto')
        if (!personaText) return ''
        return `# 用户画像（ProactiveAgent 长期记忆）\n\n${personaText}\n\n以上画像来自跨工具共享的长期记忆库，供你理解用户偏好时参考。`
      } catch {
        return ''
      }
    },
  })
}
