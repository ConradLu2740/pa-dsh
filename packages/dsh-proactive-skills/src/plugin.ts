/**
 * @proactive-agent/dsh-proactive-skills
 *
 * 把 ProactiveAgent 的 sop（流程）类长期记忆动态暴露为 dsh skills。
 * 每条 sop 记忆 → 一个 runtime skill（pa-sop-N），模型可通过 skill 工具发现/加载。
 */
import type { Context } from '@deepseek-ai/cordis'
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

export const name = 'proactive-skills'
export const inject = ['skills'] as const

export const Config = z.object({
  /** 最多暴露的 sop 技能数 */
  maxSkills: z.number().default(10),
  /** 技能描述截断长度 */
  descriptionLength: z.number().default(90),
})

type PluginConfig = z.infer<typeof Config>

/** 读取当前 sop 记忆（已确认） */
function loadSops(limit: number): Array<{ content: string; scope: string }> {
  try {
    const page = memoryService.atomsPaged({ type: 'sop', confirmed: true, pageSize: limit, page: 1, sort: 'newest' })
    return (page.atoms ?? [])
      .map((a: any) => ({ content: String(a?.content ?? ''), scope: String(a?.scope ?? 'project') }))
      .filter((s) => s.content.trim())
  } catch {
    return []
  }
}

function toSkillName(index: number): string {
  return `pa-sop-${index + 1}`
}

export function apply(ctx: Context, config: PluginConfig) {
  const cfg = { ...config }
  // 从 paCore 服务取引擎实例（dsh-proactive-core 保证进程内单例）
  const { memoryService } = ctx.get('paCore')

  ctx.skills.registerProvider(() => ({
    name: 'proactive-memory-sops',
    list: async () => {
      const sops = loadSops(cfg.maxSkills)
      if (sops.length === 0) return []
      return sops.map((sop, i) => ({
        name: toSkillName(i),
        description: `[PA 流程记忆·${sop.scope === 'global' ? '全局' : '项目'}] ${sop.content.slice(0, cfg.descriptionLength)}${sop.content.length > cfg.descriptionLength ? '…' : ''}`,
        whenToUse: '用户提到需要执行该流程/规范时，加载此技能获取沉淀的流程细节',
        invocation: { modelInvocable: true, userInvocable: true },
        source: 'runtime' as const,
        provider: 'proactive-memory-sops',
        rank: 700,
        locator: sop.content,
      }))
    },
    get: async (candidate: any) => {
      const content = String(candidate.locator ?? '')
      if (!content) return undefined
      return {
        name: candidate.name,
        description: candidate.description,
        whenToUse: candidate.whenToUse,
        source: 'runtime' as const,
        provider: 'proactive-memory-sops',
        invocation: candidate.invocation,
        content: `# ${candidate.name}\n\n以下是 ProactiveAgent 从历史协作中沉淀的流程记忆（sop），请作为执行规范参考：\n\n${content}\n\n> 本技能由 ProactiveAgent 长期记忆库动态生成。`,
      }
    },
  }))
}
