// packages/dsh-proactive-skills/src/plugin.ts
import z from "@deepseek-ai/schemastery";
var name = "proactive-skills";
var inject = ["skills"];
var Config = z.object({
  /** 最多暴露的 sop 技能数 */
  maxSkills: z.number().default(10),
  /** 技能描述截断长度 */
  descriptionLength: z.number().default(90)
});
function loadSops(limit) {
  try {
    const page = memoryService.atomsPaged({ type: "sop", confirmed: true, pageSize: limit, page: 1, sort: "newest" });
    return (page.atoms ?? []).map((a) => ({ content: String(a?.content ?? ""), scope: String(a?.scope ?? "project") })).filter((s) => s.content.trim());
  } catch {
    return [];
  }
}
function toSkillName(index) {
  return `pa-sop-${index + 1}`;
}
function apply(ctx, config) {
  const cfg = { ...config };
  const { memoryService: memoryService2 } = ctx.get("paCore");
  ctx.skills.registerProvider(() => ({
    name: "proactive-memory-sops",
    list: async () => {
      const sops = loadSops(cfg.maxSkills);
      if (sops.length === 0) return [];
      return sops.map((sop, i) => ({
        name: toSkillName(i),
        description: `[PA \u6D41\u7A0B\u8BB0\u5FC6\xB7${sop.scope === "global" ? "\u5168\u5C40" : "\u9879\u76EE"}] ${sop.content.slice(0, cfg.descriptionLength)}${sop.content.length > cfg.descriptionLength ? "\u2026" : ""}`,
        whenToUse: "\u7528\u6237\u63D0\u5230\u9700\u8981\u6267\u884C\u8BE5\u6D41\u7A0B/\u89C4\u8303\u65F6\uFF0C\u52A0\u8F7D\u6B64\u6280\u80FD\u83B7\u53D6\u6C89\u6DC0\u7684\u6D41\u7A0B\u7EC6\u8282",
        invocation: { modelInvocable: true, userInvocable: true },
        source: "runtime",
        provider: "proactive-memory-sops",
        rank: 700,
        locator: sop.content
      }));
    },
    get: async (candidate) => {
      const content = String(candidate.locator ?? "");
      if (!content) return void 0;
      return {
        name: candidate.name,
        description: candidate.description,
        whenToUse: candidate.whenToUse,
        source: "runtime",
        provider: "proactive-memory-sops",
        invocation: candidate.invocation,
        content: `# ${candidate.name}

\u4EE5\u4E0B\u662F ProactiveAgent \u4ECE\u5386\u53F2\u534F\u4F5C\u4E2D\u6C89\u6DC0\u7684\u6D41\u7A0B\u8BB0\u5FC6\uFF08sop\uFF09\uFF0C\u8BF7\u4F5C\u4E3A\u6267\u884C\u89C4\u8303\u53C2\u8003\uFF1A

${content}

> \u672C\u6280\u80FD\u7531 ProactiveAgent \u957F\u671F\u8BB0\u5FC6\u5E93\u52A8\u6001\u751F\u6210\u3002`
      };
    }
  }));
}
export {
  Config,
  apply,
  inject,
  name
};
