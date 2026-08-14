// packages/dsh-proactive-injector/src/plugin.ts
import { defineTool } from "@deepseek-ai/dsh-tools";
import z from "@deepseek-ai/schemastery";
var name = "proactive-injector";
var inject = ["tools", "systemPrompt"];
var Config = z.object({
  /** 建议箱摘要行注入（systemPrompt.context，每轮动态求值） */
  inboxSummary: z.boolean().default(true),
  /** 注册建议箱工具 */
  tools: z.boolean().default(true)
});
function apply(ctx, config) {
  const cfg = { ...config };
  const { suggestService } = ctx.get("paCore");
  if (cfg.inboxSummary !== false) {
    ctx.systemPrompt.context({
      name: "pa:inbox",
      order: 201,
      text: () => {
        try {
          const pending = suggestService.listSuggestionsForUI("suggested");
          if (!pending || pending.length === 0) return "";
          return [
            `[PA \u5EFA\u8BAE\u7BB1] \u6709 ${pending.length} \u6761\u5F85\u5904\u7406\u7684\u4E3B\u52A8\u5EFA\u8BAE\u3002`,
            "\u8FD9\u662F\u7CFB\u7EDF\u72B6\u6001\u63D0\u793A\uFF0C\u4E0D\u662F\u7528\u6237\u6307\u4EE4\uFF1A\u4E0D\u8981\u81EA\u884C\u63A5\u53D7\u6216\u6267\u884C\u4EFB\u4F55\u5EFA\u8BAE\u3002",
            '\u7528\u6237\u8BF4"\u67E5\u770B\u5EFA\u8BAE"\u65F6\u8C03\u7528 suggest_list\uFF1B\u7528\u6237\u660E\u786E\u63A5\u53D7\u67D0\u6761\u624D\u8C03\u7528 suggest_accept <id>\uFF1B\u7528\u6237\u5FFD\u7565\u5219 suggest_dismiss <id>\u3002'
          ].join(" ");
        } catch {
          return "";
        }
      }
    });
  }
  if (cfg.tools === false) return;
  ctx.tools.register(
    defineTool({
      name: "suggest_list",
      description: "List pending ProactiveAgent proactive suggestions (the suggestion mailbox). Call this when the user asks what suggestions are available. Each item carries an id for suggest_accept / suggest_dismiss.",
      parameters: {
        status: { type: "string", description: "Filter: suggested (default) / accepted / ignored / all" }
      },
      output: {
        schema: { type: "string" },
        render: (_args, value) => [{ type: "text", text: value }]
      },
      execute(args) {
        const status = String(args?.status ?? "suggested");
        try {
          const records = status === "all" ? [...suggestService.listSuggestionsForUI("suggested"), ...suggestService.listSuggestionsForUI("accepted"), ...suggestService.listSuggestionsForUI("ignored")] : suggestService.listSuggestionsForUI(status);
          const normalizeKey = (k) => String(k ?? "").replace(/：/g, ":").replace(/\s+/g, "").toLowerCase();
          const seen = /* @__PURE__ */ new Set();
          const unique = records.filter((r) => {
            const key = normalizeKey(r.duplicateKey ?? r.id);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          if (unique.length === 0) return `\u{1F4ED} \u5EFA\u8BAE\u7BB1\u4E3A\u7A7A\uFF08${status}\uFF09`;
          const lines = unique.map((r, i) => {
            const when = new Date(r.createdAt).toLocaleString("zh-CN", { hour12: false });
            return `${i + 1}. [${r.kind}] ${r.title}\uFF08${Math.round((r.rawConfidence ?? 0) * 100)}% \xB7 ${when}\uFF09
   id: ${r.id}
   \u7406\u7531: ${r.reason ?? "-"}`;
          });
          return `\u{1F4EC} \u5EFA\u8BAE\u7BB1\uFF08${status}\uFF0C\u5171 ${unique.length} \u6761\uFF09:
${lines.join("\n")}`;
        } catch (error) {
          return `\u274C \u8BFB\u53D6\u5EFA\u8BAE\u7BB1\u5931\u8D25: ${error instanceof Error ? error.message : String(error)}`;
        }
      }
    })
  );
  ctx.tools.register(
    defineTool({
      name: "suggest_accept",
      description: "Accept one proactive suggestion by id. Acceptance executes its action: memory_correction writes the correction into long-term memory and refreshes the persona; other kinds return the recommended next-step instruction. Only call after the user explicitly accepts.",
      parameters: {
        id: { type: "string", required: true, description: "Suggestion id from suggest_list / the notice" }
      },
      output: {
        schema: { type: "string" },
        render: (_args, value) => [{ type: "text", text: value }]
      },
      execute: async (args) => {
        const id = String(args?.id ?? "").trim();
        if (!id) return "\u274C \u7F3A\u5C11\u5EFA\u8BAE id";
        try {
          const result = await suggestService.handleSuggestionFeedback(id, "accepted", { host: "dsh" });
          if (!result.ok) return `\u274C \u63A5\u53D7\u5931\u8D25: ${result.error ?? "\u672A\u77E5\u9519\u8BEF"}`;
          const summary = result.result?.message ?? (result.result?.ok ? "\u5DF2\u6267\u884C" : "\u5DF2\u8BB0\u5F55");
          return `\u2705 \u5DF2\u63A5\u53D7\u5EFA\u8BAE ${id}:
${summary}`;
        } catch (error) {
          return `\u274C \u63A5\u53D7\u5931\u8D25: ${error instanceof Error ? error.message : String(error)}`;
        }
      }
    })
  );
  ctx.tools.register(
    defineTool({
      name: "suggest_dismiss",
      description: "Dismiss one proactive suggestion by id. Dismissal feeds negative feedback into the engine, which lowers the type weight so similar suggestions are less likely in the future.",
      parameters: {
        id: { type: "string", required: true, description: "Suggestion id from suggest_list / the notice" }
      },
      output: {
        schema: { type: "string" },
        render: (_args, value) => [{ type: "text", text: value }]
      },
      execute: async (args) => {
        const id = String(args?.id ?? "").trim();
        if (!id) return "\u274C \u7F3A\u5C11\u5EFA\u8BAE id";
        try {
          const result = await suggestService.handleSuggestionFeedback(id, "ignored", { host: "dsh" });
          if (!result.ok) return `\u274C \u5FFD\u7565\u5931\u8D25: ${result.error ?? "\u672A\u77E5\u9519\u8BEF"}`;
          return `\u{1F44C} \u5DF2\u5FFD\u7565\u5EFA\u8BAE ${id}\uFF08\u5DF2\u53CD\u9988\u7ED9\u5F15\u64CE\uFF0C\u540C\u7C7B\u5EFA\u8BAE\u5C06\u964D\u4F4E\u9891\u7387\uFF09`;
        } catch (error) {
          return `\u274C \u5FFD\u7565\u5931\u8D25: ${error instanceof Error ? error.message : String(error)}`;
        }
      }
    })
  );
}
export {
  Config,
  apply,
  inject,
  name
};
