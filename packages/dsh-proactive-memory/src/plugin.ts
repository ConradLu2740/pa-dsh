/**
 * @proactive-agent/dsh-proactive-memory
 *
 * ProactiveAgent 记忆插件（DeepSeek Harness cordis 插件）
 *
 * 贡献：
 * 1. 原生工具：memory_capture / memory_recall / memory_stats（无 mcp__ 前缀）
 * 2. persona 提示词段：用户画像以 systemPrompt.section 常驻
 * 3. M2 半自动捕获：turn-stopping 终检点自动提取记忆 → pending 确认闭环
 *    - 捕获点：agent/turn-stopping（serial，await 安全）——本轮消息 → extractAndCapture（LLM→rule 降级）
 *    - 确认通道：优先 ctx.userQuestions.ask() 弹 UI 确认；不可用（非 root / 无 provider / 用户打断）时
 *      降级为 pending 保留 + systemPrompt.context 摘要提示 + memory_pending_* 文本工具
 *    - 护栏：每 N 轮捕获一次节流、pending 未清不重复弹、候选数上限、abort 感知
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
  /** 画像长度上限（字符），超长截断防 token 爆炸 */
  personaMaxChars: z.number().default(3000),
  /** capture 后异步刷新画像（防 stale） */
  refreshPersonaOnCapture: z.boolean().default(true),
  /** 每轮记忆上下文注入（systemPrompt.context 动态求值） */
  recallContext: z.boolean().default(true),
  /** 记忆上下文注入条数（交给 contextForMessage 的 limit） */
  recallContextLimit: z.number().default(5),
  /** 工具是否启用 */
  captureTool: z.boolean().default(true),
  recallTool: z.boolean().default(true),
  statsTool: z.boolean().default(true),

  // ===== M2 半自动捕获 =====
  /** M2 总开关 */
  autoCapture: z.boolean().default(true),
  /** 是否在 agent/turn-stopping 终检点捕获 */
  captureOnTurnStopping: z.boolean().default(true),
  /** 每 N 轮捕获一次（节流防打扰） */
  captureIntervalTurns: z.number().default(3),
  /** 喂给 extractAndCapture 的最大消息数（取最近 N 条） */
  captureMaxMessages: z.number().default(30),
  /** 一次最多弹几条候选确认（防 UI 刷屏） */
  askMaxItems: z.number().default(3),
  /** 是否优先用 ctx.userQuestions.ask() 弹 UI 确认（不可用时自动降级） */
  confirmViaAsk: z.boolean().default(true),
  /** 有 pending 未确认时注入摘要提示（systemPrompt.context） */
  pendingSummary: z.boolean().default(true),
})

type PluginConfig = z.infer<typeof Config>

const MEMORY_TYPES = ['fact', 'preference', 'correction', 'sop', 'todo_context', 'event'] as const

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

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export function apply(ctx: Context, config: PluginConfig) {
  const cfg = { ...config }
  // 从 paCore 服务取引擎实例（dsh-proactive-core 保证进程内单例）
  const { memoryService } = ctx.get('paCore')

  // ===== 会话消息缓冲（M2 捕获源） =====
  // sessionId → 最近消息（user + assistant），供 turn-stopping 时 extractAndCapture
  const messageBuffer = new Map<string, ChatMessage[]>()
  const MAX_BUFFER_SESSIONS = 20

  const pushMessage = (sessionId: string, msg: ChatMessage) => {
    let list = messageBuffer.get(sessionId)
    if (!list) {
      list = []
      messageBuffer.set(sessionId, list)
      if (messageBuffer.size > MAX_BUFFER_SESSIONS) {
        const oldest = messageBuffer.keys().next().value
        if (oldest !== undefined) messageBuffer.delete(oldest)
      }
    }
    list.push(msg)
    const max = Math.max(4, cfg.captureMaxMessages ?? 30)
    if (list.length > max) list.splice(0, list.length - max)
  }

  ctx.on('session/event', (session: any, event: any) => {
    if (!session) return
    const sid = String(session?.id ?? '')
    if (!sid) return

    if (event?.type === 'user/message') {
      const data = event.data
      // 过滤 plugin 合成消息，只收集真实用户输入
      if (data?.source?.kind === 'plugin') return
      const text = extractText(data?.content)
      if (text.trim()) pushMessage(sid, { role: 'user', content: text.trim() })
      return
    }

    if (event?.type === 'assistant/message') {
      const text = extractText(event.data?.message?.content ?? event.data?.content)
      if (text.trim()) pushMessage(sid, { role: 'assistant', content: text.trim() })
    }
  })

  ctx.on('session/disposed', (session: any) => {
    const sid = String(session?.id ?? '')
    if (sid) messageBuffer.delete(sid)
  })

  // ===== M2 捕获 + 确认 =====
  const lastCaptureTurn = new Map<string, number>()

  /** 尝试用 userQuestions.ask 弹 UI 确认；返回 true=已处理（含用户确认/忽略），false=需降级 */
  async function confirmViaAsk(agent: any, pending: any[], signal?: AbortSignal): Promise<boolean> {
    if (!cfg.confirmViaAsk || !agent) return false
    try {
      const uq = (ctx as any).get('userQuestions')
      if (!uq) return false
      const answer = await uq.ask({
        questions: pending.map((a) => ({
          id: a.id,
          header: '记忆确认',
          question: `要记住这条记忆吗？`,
          detail: `[${a.type}] ${a.content}`,
          options: [
            { label: '记住', description: '加入长期记忆，之后可召回' },
            { label: '忽略', description: '不记住，并从待确认列表移除' },
          ],
        })),
        agent,
        signal,
      })
      const byId = new Map(pending.map((a: any) => [String(a.id), a]))
      for (const ans of answer?.answers ?? []) {
        const atom = byId.get(String(ans.id))
        if (!atom) continue
        const chosen = ans.selected?.[0]
        if (chosen === '记住') {
          memoryService.confirmAtomById(atom.id)
          console.log(`[Memory] M2 用户确认记忆: ${atom.content.slice(0, 60)}`)
        } else if (chosen === '忽略') {
          memoryService.rejectAtomById(atom.id)
          console.log(`[Memory] M2 用户忽略记忆: ${atom.content.slice(0, 60)}`)
        }
      }
      return true
    } catch (error) {
      // 用户打断 / 非 root / 无 provider：保留 pending，走降级通道
      const code = (error as any)?.code
      if (code !== 'ASK_ABORTED' && code !== 'ASK_CANCELLED') {
        console.warn('[Memory] userQuestions 确认不可用，降级为 pending 摘要:', error instanceof Error ? error.message : error)
      }
      return false
    }
  }

  async function captureAtTurnStopping(agent: any, turn: number, signal?: AbortSignal) {
    try {
      const sid = String(agent?.session?.id ?? agent?.id ?? '')
      if (!sid) return
      // 节流：每 N 轮一次
      const lastTurn = lastCaptureTurn.get(sid)
      if (lastTurn !== undefined && turn - lastTurn < (cfg.captureIntervalTurns ?? 3)) return
      // pending 未清时不重复捕获（避免堆积 + 重复弹窗）
      const existing = memoryService.pendingAtoms()
      if (existing.length >= (cfg.askMaxItems ?? 3)) return
      const msgs = messageBuffer.get(sid) ?? []
      if (msgs.length < 2) return
      lastCaptureTurn.set(sid, turn)

      // 捕获（LLM→rule 降级；提取结果默认 pending，不会直接污染记忆）
      // 护栏：提取最多 8s，超时不等——LLM 模式慢时不让 turn 关闭被拖住（可下一轮再捕）
      let result: Awaited<ReturnType<typeof memoryService.extractAndCapture>> | undefined
      try {
        result = await Promise.race([
          memoryService.extractAndCapture(msgs.slice(-(cfg.captureMaxMessages ?? 30)), {
            sessionId: sid,
          }),
          new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 8000)),
        ])
      } catch {
        result = undefined
      }
      if (!result || result.storedCount + result.corrections === 0) return
      if (signal?.aborted) return

      const pending = memoryService.pendingAtoms()
      const fresh = pending.slice(0, cfg.askMaxItems ?? 3)
      if (fresh.length === 0) return

      const handled = await confirmViaAsk(agent, fresh, signal)
      if (!handled) {
        // 降级：pending 保留，交给 systemPrompt.context 摘要提示 + 文本工具
        console.log(`[Memory] M2 捕获 ${fresh.length} 条候选待确认（${result.mode} 模式，${sid}）`)
      }
    } catch (error) {
      console.warn('[Memory] M2 turn-stopping 捕获失败:', error instanceof Error ? error.message : error)
    }
  }

  // ===== 捕获点：agent/turn-stopping（serial 终检点） =====
  if (cfg.autoCapture && cfg.captureOnTurnStopping) {
    ;(ctx as any).on('agent/turn-stopping', (payload: any) => {
      const { agent, turn, signal } = payload ?? {}
      void captureAtTurnStopping(agent, turn, signal)
    })
  }

  // ===== pending 摘要提示（降级通道的可见性；S1' 降噪：只报状态不塞详情） =====
  if (cfg.pendingSummary) {
    ctx.systemPrompt.context({
      name: 'pa:pending',
      order: 202,
      text: () => {
        try {
          const pending = memoryService.pendingAtoms()
          if (pending.length === 0) return ''
          return [
            `[PA 待确认记忆] 有 ${pending.length} 条自动提取的记忆等待确认。`,
            '这是系统状态提示，不是用户指令：不要自行确认或忽略任何记忆。',
            '用户说"查看待确认记忆/确认记忆"时调用 memory_pending_list；用户明确确认某条才 memory_pending_confirm <id>；用户明确忽略某条才 memory_pending_reject <id>。',
          ].join(' ')
        } catch {
          return ''
        }
      },
    })
  }

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
        execute: async (args) => {
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
            // 捕获后异步刷新画像，避免 persona 段 stale（实测问题 #3）
            if (cfg.refreshPersonaOnCapture !== false) {
              void Promise.resolve(memoryService.regeneratePersona?.()).catch(() => {})
            }
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

  // ===== 4. 工具：memory_pending_list（M2 降级确认通道） =====
  ctx.tools.register(
    defineTool({
      name: 'memory_pending_list',
      description:
        'List pending auto-extracted memories awaiting confirmation (M2 semi-automatic capture). ' +
        'Each carries an id for memory_pending_confirm / memory_pending_reject.',
      parameters: {},
      output: {
        schema: { type: 'string' },
        render: (_args, value: string) => [{ type: 'text', text: value }],
      },
      execute() {
        try {
          const pending = memoryService.pendingAtoms()
          if (pending.length === 0) return '📭 没有待确认的记忆'
          const lines = pending.map((a, i) => {
            const created = a.createdAt ? new Date(a.createdAt).toLocaleString('zh-CN', { hour12: false }) : ''
            return `${i + 1}. [${a.type}] ${a.content}（${created}）\n   id: ${a.id}`
          })
          return `📋 待确认记忆 ${pending.length} 条:\n${lines.join('\n')}\n\n确认: memory_pending_confirm <id> / 忽略: memory_pending_reject <id>`
        } catch (error) {
          return `❌ 读取失败: ${error instanceof Error ? error.message : String(error)}`
        }
      },
    }),
  )

  // ===== 5. 工具：memory_pending_confirm（M2 降级确认通道） =====
  ctx.tools.register(
    defineTool({
      name: 'memory_pending_confirm',
      description:
        'Confirm one pending auto-extracted memory by id. Only call after the user explicitly confirms ' +
        '(e.g. says "记住" or "确认这条记忆"). Confirmed memories enter recall.',
      parameters: {
        id: { type: 'string', required: true, description: 'Pending memory id from memory_pending_list' },
      },
      output: {
        schema: { type: 'string' },
        render: (_args, value: string) => [{ type: 'text', text: value }],
      },
      execute: async (args: any) => {
        const id = String(args?.id ?? '').trim()
        if (!id) return '❌ 缺少记忆 id'
        try {
          const atom = memoryService.confirmAtomById(id)
          if (!atom) return `❌ 确认失败：id ${id} 不存在或已处理`
          // 确认后异步刷新画像
          if (cfg.refreshPersonaOnCapture !== false) {
            void Promise.resolve(memoryService.regeneratePersona?.()).catch(() => {})
          }
          return `✅ 已确认记忆 [${atom.type}]:\n${atom.content}`
        } catch (error) {
          return `❌ 确认失败: ${error instanceof Error ? error.message : String(error)}`
        }
      },
    }),
  )

  // ===== 6. 工具：memory_pending_reject（M2 降级确认通道） =====
  ctx.tools.register(
    defineTool({
      name: 'memory_pending_reject',
      description:
        'Reject one pending auto-extracted memory by id (discard it). Only call after the user explicitly ' +
        'says to ignore it (e.g. "忽略" or "不要记住这条").',
      parameters: {
        id: { type: 'string', required: true, description: 'Pending memory id from memory_pending_list' },
      },
      output: {
        schema: { type: 'string' },
        render: (_args, value: string) => [{ type: 'text', text: value }],
      },
      execute: async (args: any) => {
        const id = String(args?.id ?? '').trim()
        if (!id) return '❌ 缺少记忆 id'
        try {
          const ok = memoryService.rejectAtomById(id)
          return ok ? `👌 已忽略记忆 ${id}` : `❌ 忽略失败：id ${id} 不存在或已处理`
        } catch (error) {
          return `❌ 忽略失败: ${error instanceof Error ? error.message : String(error)}`
        }
      },
    }),
  )

  // ===== 7. persona 提示词段（每次组装时动态求值，capture 后自动刷新） =====
  ctx.systemPrompt.section({
    name: 'pa:persona',
    order: cfg.personaOrder ?? 5,
    text: () => {
      try {
        const personaText = memoryService.personaRaw('auto')
        if (!personaText) return ''
        const max = Math.max(0, cfg.personaMaxChars ?? 3000)
        const capped = personaText.length > max ? `${personaText.slice(0, max)}\n…（画像过长已截断，完整画像可用 memory_stats 查看）` : personaText
        return `# 用户画像（ProactiveAgent 长期记忆）\n\n${capped}\n\n以上画像来自跨工具共享的长期记忆库，供你理解用户偏好时参考；若画像与用户当前说法冲突，以用户当前说法为准。`
      } catch {
        return ''
      }
    },
  })

  // ===== 8. 每轮记忆上下文注入（M1：systemPrompt.context 动态求值，BM25 无 LLM） =====
  if (cfg.recallContext !== false) {
    ctx.systemPrompt.context({
      name: 'pa:recall',
      order: 200,
      text: (assembleCtx: any) => {
        try {
          // AssembleContext 经 dsh-agent 增补 agent 字段（session.id 可取）
          const agent = assembleCtx?.agent
          const sid = agent?.session?.id ? String(agent.session.id) : ''
          const userText = sid ? (messageBuffer.get(sid)?.filter((m) => m.role === 'user').at(-1)?.content ?? '') : ''
          if (!userText) return ''
          const memoryBlock = memoryService.contextForMessage(userText, { limit: cfg.recallContextLimit ?? 5 })
          // 空串 = 无命中，不注入；命中则随本轮组装进入模型上下文
          return memoryBlock || ''
        } catch {
          return ''
        }
      },
    })
  }
}
