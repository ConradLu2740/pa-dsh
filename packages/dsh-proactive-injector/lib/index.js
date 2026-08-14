// packages/dsh-proactive-injector/src/plugin.ts
import { defineTool } from "@deepseek-ai/dsh-tools";
import z from "@deepseek-ai/schemastery";
var name = "proactive-injector";
var inject = ["tools", "sessions"];
var Config = z.object({
  /** 收到建议时向会话流投递通知消息 */
  notifyOnSuggestion: z.boolean().default(true),
  /** 通知消息进入 pending turn（会被下一轮消费）还是 next-step（立即触发） */
  notifyAsTurn: z.boolean().default(false),
  /** 注册建议箱工具 */
  tools: z.boolean().default(true),
  /** 每会话最多同时投递的通知条数（防轰炸） */
  maxNoticesPerSession: z.number().default(3)
});
var noticeSeq = 0;
function makeMessageId() {
  noticeSeq += 1;
  return `pa-suggestion-${Date.now()}-${noticeSeq}`;
}
function formatNotice(record) {
  const confidence = Math.round((record.rawConfidence ?? 0) * 100);
  const kind = String(record.kind ?? "suggestion");
  return [
    "\u{1F4A1} ProactiveAgent \u4E3B\u52A8\u5EFA\u8BAE\uFF08\u5EFA\u8BAE\u7BB1\u901A\u77E5\uFF09",
    "",
    `\u7C7B\u578B: ${kind}`,
    `\u5EFA\u8BAE: ${record.title ?? ""}`,
    `\u7406\u7531: ${record.reason ?? ""}`,
    `\u8BC1\u636E: ${record.evidence ?? ""}`,
    `\u7F6E\u4FE1\u5EA6: ${confidence}%`,
    `\u5EFA\u8BAE id: ${record.id}`,
    "",
    "\u8FD9\u662F\u4E00\u6761\u7CFB\u7EDF\u901A\u77E5\uFF0C\u4E0D\u662F\u7528\u6237\u6307\u4EE4\u3002\u8BF7\u52FF\u81EA\u884C\u6267\u884C\u6216\u63A5\u53D7\uFF0C\u9664\u975E\u7528\u6237\u660E\u786E\u8981\u6C42\u3002",
    '\u7528\u6237\u8BF4"\u67E5\u770B\u5EFA\u8BAE"\u65F6\u8C03\u7528 suggest_list\uFF1B\u7528\u6237\u660E\u786E\u63A5\u53D7\u540E\u8C03\u7528 suggest_accept <id>\uFF1B\u7528\u6237\u5FFD\u7565\u5219\u8C03\u7528 suggest_dismiss <id>\u3002'
  ].join("\n");
}
function apply(ctx, config) {
  const cfg = { ...config };
  const { suggestService } = ctx.get("paCore");
  const noticeCounts = /* @__PURE__ */ new Map();
  const duplicateKeyAlreadyHandled = (duplicateKey) => {
    if (!duplicateKey) return false;
    const handled = ["accepted", "ignored", "never"];
    for (const status of handled) {
      try {
        const rows = suggestService.listSuggestionsForUI(status);
        if (rows.some((r) => r.duplicateKey === duplicateKey)) return true;
      } catch {
      }
    }
    return false;
  };
  ctx.on("pa/suggestion", (payload) => {
    const { sessionId, record } = payload ?? {};
    if (!sessionId || !record || cfg.notifyOnSuggestion === false) return;
    if (duplicateKeyAlreadyHandled(record.duplicateKey)) {
      console.log("[proactive-injector] \u8DF3\u8FC7\u91CD\u590D\u5EFA\u8BAE\u901A\u77E5\uFF08\u89C4\u5219\u5DF2\u5904\u7406\uFF09:", record.id, record.duplicateKey?.slice(0, 30));
      return;
    }
    const count = noticeCounts.get(sessionId) ?? 0;
    if (count >= (cfg.maxNoticesPerSession ?? 3)) return;
    noticeCounts.set(sessionId, count + 1);
    let target;
    try {
      target = ctx.sessions?.get?.(sessionId) ?? void 0;
    } catch {
      target = void 0;
    }
    if (!target || typeof target.append !== "function") {
      console.warn("[proactive-injector] \u627E\u4E0D\u5230\u4F1A\u8BDD\u5BF9\u8C61\uFF0C\u8DF3\u8FC7\u901A\u77E5\u6295\u9012:", sessionId);
      return;
    }
    try {
      target.append(
        "user/message",
        {
          id: makeMessageId(),
          role: "user",
          content: [{ type: "text", text: formatNotice(record) }],
          source: { kind: "plugin", plugin: "proactive-suggest" }
        },
        { surfaceOp: "append" }
      );
    } catch (error) {
      console.warn("[proactive-injector] \u901A\u77E5\u6295\u9012\u5931\u8D25:", error instanceof Error ? error.message : error);
    }
  });
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
          const seen = /* @__PURE__ */ new Set();
          const unique = records.filter((r) => {
            const key = r.duplicateKey ?? r.id;
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
          const summary = result.result?.summary ?? result.result?.message ?? JSON.stringify(result.result ?? {});
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
