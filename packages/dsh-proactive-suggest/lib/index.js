// packages/dsh-proactive-suggest/src/plugin.ts
import { defineTool } from "@deepseek-ai/dsh-tools";
import z from "@deepseek-ai/schemastery";
var name = "proactive-suggest";
var inject = ["tools"];
var Config = z.object({
  /** session/created 时推送存量建议 */
  sessionStartPush: z.boolean().default(true),
  /** turn/end 时会话中评估（强信号限 1 条） */
  sessionMidPush: z.boolean().default(true),
  /** session/disposed 时完整评估 */
  sessionEndEvaluate: z.boolean().default(true),
  /** 注册 suggest_now 工具（manual 触发器） */
  manualTool: z.boolean().default(true),
  /** 每会话最多保留的消息数（喂给评估器） */
  maxMessages: z.number().default(40),
  /** 评估失败静默（true）还是往日志打 warn */
  silentErrors: z.boolean().default(true)
});
function extractText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.filter((b) => b && b.type === "text" && typeof b.text === "string").map((b) => b.text).join("\n");
  }
  return "";
}
function apply(ctx, config) {
  const cfg = { ...config };
  const { suggestService } = ctx.get("paCore");
  const collectors = /* @__PURE__ */ new Map();
  let lastSessionId;
  const pushMessage = (sessionId, msg) => {
    let list = collectors.get(sessionId);
    if (!list) {
      list = [];
      collectors.set(sessionId, list);
    }
    list.push(msg);
    if (cfg.maxMessages > 0 && list.length > cfg.maxMessages) {
      list.splice(0, list.length - cfg.maxMessages);
    }
    lastSessionId = sessionId;
  };
  const broadcast = (sessionId, records) => {
    for (const record of records) {
      ctx.emit("pa/suggestion", { sessionId, record });
    }
  };
  const evaluate = async (trigger, sessionId) => {
    const messages = sessionId ? collectors.get(sessionId) ?? [] : [];
    try {
      const records = await suggestService.evaluateNow({
        trigger,
        sessionId,
        messages: messages.length > 0 ? messages : void 0,
        suppressIfQuiet: trigger === "session_mid" ? true : void 0
      });
      if (records.length > 0 && sessionId) broadcast(sessionId, records);
      return records;
    } catch (error) {
      if (!cfg.silentErrors) console.warn("[proactive-suggest] evaluateNow \u5931\u8D25:", error instanceof Error ? error.message : error);
      return [];
    }
  };
  ctx.on("session/event", (session, event) => {
    const sessionId = String(session?.id ?? "");
    if (!sessionId) return;
    if (event?.type === "user/message") {
      const data = event.data;
      const kind = data?.source?.kind;
      if (kind === "plugin") return;
      const text = extractText(data?.content);
      if (text.trim()) pushMessage(sessionId, { role: "user", content: text.trim() });
      return;
    }
    if (event?.type === "assistant/message") {
      const text = extractText(event.data?.message?.content ?? event.data?.content);
      if (text.trim()) pushMessage(sessionId, { role: "assistant", content: text.trim() });
      return;
    }
    if (event?.type === "turn/end") {
      const reasonKind = event.data?.reason?.kind ?? event.data?.reason;
      if (cfg.sessionMidPush && reasonKind === "completed") {
        void evaluate("session_mid", sessionId);
      }
      return;
    }
  });
  ctx.on("session/created", (session) => {
    const sessionId = String(session?.id ?? "");
    if (!sessionId || !cfg.sessionStartPush) return;
    collectors.set(sessionId, []);
    void evaluate("session_start", sessionId);
  });
  ctx.on("session/disposed", (session) => {
    const sessionId = String(session?.id ?? "");
    if (!sessionId) return;
    if (cfg.sessionEndEvaluate) {
      void evaluate("session_end", sessionId);
    }
    collectors.delete(sessionId);
    if (lastSessionId === sessionId) lastSessionId = void 0;
  });
  if (cfg.manualTool !== false) {
    ctx.tools.register(
      defineTool({
        name: "suggest_now",
        description: "Run ProactiveAgent proactive-suggestion evaluation right now on the current conversation (manual trigger). Returns any suggestions produced. Each suggestion carries an id; use suggest_accept / suggest_dismiss to handle it.",
        parameters: {},
        output: {
          schema: { type: "string" },
          render: (_args, value) => [{ type: "text", text: value }]
        },
        execute: async () => {
          const sid = lastSessionId;
          const records = await evaluate("manual", sid);
          if (records.length === 0) return "\u{1F4A4} \u672C\u6B21\u8BC4\u4F30\u6CA1\u6709\u4EA7\u751F\u65B0\u5EFA\u8BAE\uFF08\u53EF\u80FD\u88AB\u964D\u566A/\u9884\u7B97/DND \u6291\u5236\uFF09";
          const lines = records.map(
            (r, i) => `${i + 1}. [${r.kind}] ${r.title}
   ${r.reason}\uFF08\u7F6E\u4FE1\u5EA6 ${Math.round(r.rawConfidence * 100)}%\uFF09
   \u5EFA\u8BAE id: ${r.id}`
          );
          return `\u{1F4A1} \u4EA7\u751F ${records.length} \u6761\u4E3B\u52A8\u5EFA\u8BAE:
${lines.join("\n")}

\u5904\u7406\u65B9\u5F0F: suggest_accept <id> \u63A5\u53D7 / suggest_dismiss <id> \u5FFD\u7565`;
        }
      })
    );
  }
}
export {
  Config,
  apply,
  inject,
  name
};
