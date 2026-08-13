// packages/dsh-proactive-memory/src/plugin.ts
import { defineTool } from "@deepseek-ai/dsh-tools";
import z from "@deepseek-ai/schemastery";
var name = "proactive-memory";
var inject = ["tools", "systemPrompt"];
var Config = z.object({
  /** persona 段在提示词中的顺序（0 为部署 persona） */
  personaOrder: z.number().default(5),
  /** 工具是否启用 */
  captureTool: z.boolean().default(true),
  recallTool: z.boolean().default(true),
  statsTool: z.boolean().default(true)
});
var MEMORY_TYPES = ["fact", "preference", "correction", "sop", "todo_context", "event"];
function apply(ctx, config) {
  const cfg = { ...config };
  const { memoryService } = ctx.get("paCore");
  if (cfg.captureTool !== false) {
    ctx.tools.register(
      defineTool({
        name: "memory_capture",
        description: "Explicitly store a long-term memory (takes effect immediately, enters recall). Use when the user clearly expresses a preference/fact/process/correction. Keep content concise, self-contained, and independently understandable. Types: fact / preference / correction / sop / todo_context / event.",
        parameters: {
          content: {
            type: "string",
            required: true,
            description: 'Memory content. Keep negations intact: e.g. "\u4E0D\u8981\u7528 X" must be stored as-is, never drop \u4E0D/\u4E0D\u8981/\u522B'
          },
          type: {
            type: "string",
            description: "Memory type: fact / preference / correction / sop / todo_context / event (default fact)"
          },
          priority: { type: "number", description: "Importance 0-100, default 50" },
          scope: { type: "string", description: "Write scope: project (default) / global" }
        },
        output: {
          schema: { type: "string" },
          render: (_args, value) => [{ type: "text", text: value }]
        },
        execute(args) {
          const content = String(args.content ?? "").trim();
          if (!content) return "\u274C \u8BB0\u5FC6\u5185\u5BB9\u4E0D\u80FD\u4E3A\u7A7A";
          const type = MEMORY_TYPES.includes(String(args.type)) ? args.type : "fact";
          const priority = typeof args.priority === "number" ? Math.max(0, Math.min(100, args.priority)) : void 0;
          const scope = args.scope === "global" ? "global" : "project";
          try {
            const result = memoryService.captureCandidate(
              { content, type, priority },
              { scope },
              { confirmed: true }
            );
            const verb = result.deduplicated ? "\u5DF2\u5408\u5E76\u8FDB\u5DF2\u6709\u8BB0\u5FC6" : "\u5DF2\u8BB0\u4F4F";
            return `\u2705 ${verb} [${result.atom.type}]\uFF08${result.atom.scope ?? scope} \u5C42\uFF0C\u4F18\u5148\u7EA7 ${result.atom.priority ?? 50}\uFF09:
${result.atom.content}`;
          } catch (error) {
            return `\u274C \u5199\u5165\u5931\u8D25: ${error instanceof Error ? error.message : String(error)}`;
          }
        }
      })
    );
  }
  if (cfg.recallTool !== false) {
    ctx.tools.register(
      defineTool({
        name: "memory_recall",
        description: "Recall long-term memories by keyword search (deterministic BM25, no LLM calls). Use proactively when the user mentions a topic that may have stored memories. Returns scored hits with scope (project/global).",
        parameters: {
          query: { type: "string", required: true, description: "Search keywords (Chinese or English)" },
          limit: { type: "number", description: "Max hits, default 5" },
          type: { type: "string", description: "Filter by memory type (optional)" },
          scope: { type: "string", description: "Read scope: auto (default) / project / global" }
        },
        output: {
          schema: { type: "string" },
          render: (_args, value) => [{ type: "text", text: value }]
        },
        execute(args) {
          const query = String(args.query ?? "").trim();
          if (!query) return "\u274C \u68C0\u7D22\u5173\u952E\u8BCD\u4E0D\u80FD\u4E3A\u7A7A";
          const request = {
            query,
            limit: typeof args.limit === "number" ? args.limit : 5,
            scope: args.scope ?? "auto"
          };
          const t = String(args.type ?? "");
          if (t && MEMORY_TYPES.includes(t)) {
            request.type = t;
          }
          try {
            const result = memoryService.search(request);
            if (result.hits.length === 0) return `\u{1F50D} \u6CA1\u6709\u627E\u5230\u4E0E\u300C${query}\u300D\u76F8\u5173\u7684\u8BB0\u5FC6`;
            const lines = result.hits.map(
              (hit, i) => `${i + 1}. [${hit.atom.type}]${hit.atom.scope === "global" ? "(\u5168\u5C40)" : "(\u9879\u76EE)"} ${hit.atom.content}${hit.score !== void 0 ? ` \u2014\u2014 \u76F8\u5173\u5EA6 ${hit.score}` : ""}`
            );
            return `\u{1F50D} \u53EC\u56DE ${result.hits.length} \u6761\u8BB0\u5FC6:
${lines.join("\n")}`;
          } catch (error) {
            return `\u274C \u68C0\u7D22\u5931\u8D25: ${error instanceof Error ? error.message : String(error)}`;
          }
        }
      })
    );
  }
  if (cfg.statsTool !== false) {
    ctx.tools.register(
      defineTool({
        name: "memory_stats",
        description: "Show ProactiveAgent memory statistics: total count, by-type distribution, pending items, storage location.",
        parameters: {},
        output: {
          schema: { type: "string" },
          render: (_args, value) => [{ type: "text", text: value }]
        },
        execute() {
          try {
            const stats = memoryService.stats();
            return [
              "\u{1F4CA} \u8BB0\u5FC6\u7EDF\u8BA1:",
              `- \u8BB0\u5FC6\u603B\u6570: ${stats.atomCount}`,
              `- \u5F85\u786E\u8BA4\u63D0\u53D6: ${stats.pendingAtoms}`,
              `- \u5F85\u786E\u8BA4\u7EA0\u6B63: ${stats.pendingCorrections}`,
              `- \u573A\u666F\u6570: ${stats.sceneCount}`,
              `- \u5DF2\u5F52\u6863: ${stats.archivedCount}`,
              `- \u6309\u7C7B\u578B: ${Object.entries(stats.byType ?? {}).map(([k, v]) => `${k}=${v}`).join(", ") || "\u65E0"}`,
              `- \u753B\u50CF\u72B6\u6001: ${stats.personaExists ? "\u5DF2\u751F\u6210" : "\u672A\u751F\u6210"}`
            ].join("\n");
          } catch (error) {
            return `\u274C \u7EDF\u8BA1\u5931\u8D25: ${error instanceof Error ? error.message : String(error)}`;
          }
        }
      })
    );
  }
  ctx.systemPrompt.section({
    name: "pa:persona",
    order: cfg.personaOrder ?? 5,
    text: () => {
      try {
        const personaText = memoryService.personaRaw("auto");
        if (!personaText) return "";
        return `# \u7528\u6237\u753B\u50CF\uFF08ProactiveAgent \u957F\u671F\u8BB0\u5FC6\uFF09

${personaText}

\u4EE5\u4E0A\u753B\u50CF\u6765\u81EA\u8DE8\u5DE5\u5177\u5171\u4EAB\u7684\u957F\u671F\u8BB0\u5FC6\u5E93\uFF0C\u4F9B\u4F60\u7406\u89E3\u7528\u6237\u504F\u597D\u65F6\u53C2\u8003\u3002`;
      } catch {
        return "";
      }
    }
  });
}
export {
  Config,
  apply,
  inject,
  name
};
