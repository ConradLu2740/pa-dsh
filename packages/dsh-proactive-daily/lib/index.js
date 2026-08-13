// packages/dsh-proactive-daily/src/plugin.ts
import { defineTool } from "@deepseek-ai/dsh-tools";
import z from "@deepseek-ai/schemastery";
var name = "proactive-daily";
var inject = ["tools"];
var Config = z.object({
  /** 每日回顾时间 HH:MM */
  dailyAt: z.string().default("09:30"),
  /** 定时评估开关 */
  timerEnabled: z.boolean().default(true),
  /** daily_review 工具 */
  reviewTool: z.boolean().default(true),
  /** 消息保留时长（毫秒） */
  messageTtlMs: z.number().default(24 * 60 * 60 * 1e3)
});
function apply(ctx, config) {
  const cfg = { ...config };
  const { memoryService, suggestService } = ctx.get("paCore");
  const recent = [];
  let lastSessionId;
  const pushMessage = (sessionId, role, content) => {
    recent.push({ role, content, at: Date.now() });
    lastSessionId = sessionId;
    const cutoff = Date.now() - cfg.messageTtlMs;
    while (recent.length > 0 && (recent[0]?.at ?? 0) < cutoff) recent.shift();
    if (recent.length > 200) recent.splice(0, recent.length - 200);
  };
  ctx.on("session/event", (session, event) => {
    const sessionId = String(session?.id ?? "");
    if (!sessionId) return;
    if (event?.type === "user/message") {
      const kind = event.data?.source?.kind;
      if (kind === "plugin") return;
      const text = extractText(event.data?.content);
      if (text.trim()) pushMessage(sessionId, "user", text.trim());
    } else if (event?.type === "assistant/message") {
      const text = extractText(event.data?.message?.content ?? event.data?.content);
      if (text.trim()) pushMessage(sessionId, "assistant", text.trim());
    }
  });
  const runTimerEvaluation = async () => {
    const messages = recent.map((m) => ({ role: m.role, content: m.content }));
    try {
      const records = await suggestService.evaluateNow({
        trigger: "timer",
        sessionId: lastSessionId,
        messages,
        suppressIfQuiet: true
      });
      if (records.length > 0) {
        if (lastSessionId) {
          for (const record of records) {
            ctx.emit("pa/suggestion", { sessionId: lastSessionId, record });
          }
          return `\u4EA7\u751F ${records.length} \u6761\u5EFA\u8BAE\uFF0C\u5DF2\u6295\u9012\u5EFA\u8BAE\u7BB1`;
        }
        return `\u4EA7\u751F ${records.length} \u6761\u5EFA\u8BAE\uFF08\u65E0\u6D3B\u8DC3\u4F1A\u8BDD\uFF0C\u5DF2\u5165\u5E93\u7B49\u5F85\u4E0B\u6B21\u4F1A\u8BDD\u63A8\u9001\uFF09`;
      }
      return "\u672A\u4EA7\u751F\u65B0\u5EFA\u8BAE\uFF08\u964D\u566A/\u9884\u7B97/\u53BB\u91CD\u6291\u5236\uFF09";
    } catch (error) {
      return `\u8BC4\u4F30\u5931\u8D25: ${error instanceof Error ? error.message : String(error)}`;
    }
  };
  if (cfg.timerEnabled !== false) {
    const parseTime = (s) => {
      const [h2 = "9", m2 = "30"] = String(s).split(":");
      return { h: Math.max(0, Math.min(23, Number(h2) || 0)), m: Math.max(0, Math.min(59, Number(m2) || 0)) };
    };
    const { h, m } = parseTime(cfg.dailyAt);
    const DAY_MS = 24 * 60 * 60 * 1e3;
    const nextDelay = () => {
      const now = /* @__PURE__ */ new Date();
      const target = new Date(now);
      target.setHours(h, m, 0, 0);
      if (target.getTime() <= now.getTime()) target.setTime(target.getTime() + DAY_MS);
      return target.getTime() - now.getTime();
    };
    let timer;
    const schedule = () => {
      timer = setTimeout(() => {
        void runTimerEvaluation();
        schedule();
      }, nextDelay());
    };
    schedule();
    ctx.effect(() => () => {
      if (timer) clearTimeout(timer);
    });
  }
  if (cfg.reviewTool !== false) {
    ctx.tools.register(
      defineTool({
        name: "daily_review",
        description: 'Run the ProactiveAgent daily review: memory statistics, pending suggestions, and a timer-trigger evaluation over recent messages. Use for end-of-day reviews or when the user asks "\u56DE\u987E\u4E00\u4E0B".',
        parameters: {},
        output: {
          schema: { type: "string" },
          render: (_args, value) => [{ type: "text", text: value }]
        },
        execute: async () => {
          const stats = memoryService.stats();
          const pending = suggestService.listSuggestionsForUI("suggested");
          const evalResult = await runTimerEvaluation();
          const lines = [
            "\u{1F4C5} ProactiveAgent \u6BCF\u65E5\u56DE\u987E",
            "",
            "\u3010\u8BB0\u5FC6\u5E93\u3011",
            `- \u8BB0\u5FC6\u603B\u6570: ${stats.atomCount}\uFF08\u5F85\u786E\u8BA4\u63D0\u53D6 ${stats.pendingAtoms}\uFF0C\u5F85\u786E\u8BA4\u7EA0\u6B63 ${stats.pendingCorrections}\uFF09`,
            `- \u5DF2\u5F52\u6863: ${stats.archivedCount}\uFF0C\u573A\u666F\u6570: ${stats.sceneCount}`,
            `- \u6309\u7C7B\u578B: ${Object.entries(stats.byType ?? {}).map(([k, v]) => `${k}=${v}`).join(", ") || "\u65E0"}`,
            `- \u753B\u50CF\u72B6\u6001: ${stats.personaExists ? "\u5DF2\u751F\u6210" : "\u672A\u751F\u6210"}`,
            "",
            "\u3010\u5EFA\u8BAE\u7BB1\u3011",
            pending.length === 0 ? "- \u65E0\u5F85\u5904\u7406\u5EFA\u8BAE" : pending.map((r, i) => `${i + 1}. [${r.kind}] ${r.title}\uFF08id: ${r.id}\uFF09`).join("\n"),
            "",
            `\u3010\u5B9A\u65F6\u8BC4\u4F30\u3011${evalResult}`
          ];
          return lines.join("\n");
        }
      })
    );
  }
}
function extractText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.filter((b) => b && b.type === "text" && typeof b.text === "string").map((b) => b.text).join("\n");
  }
  return "";
}
export {
  Config,
  apply,
  inject,
  name
};
