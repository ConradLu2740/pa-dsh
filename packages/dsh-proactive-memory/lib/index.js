// packages/dsh-proactive-memory/src/plugin.ts
import { defineTool } from "@deepseek-ai/dsh-tools";
import z from "@deepseek-ai/schemastery";
var name = "proactive-memory";
var inject = ["tools", "systemPrompt"];
var Config = z.object({
  /** persona 段在提示词中的顺序（0 为部署 persona） */
  personaOrder: z.number().default(5),
  /** 画像长度上限（字符），超长截断防 token 爆炸 */
  personaMaxChars: z.number().default(3e3),
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
  pendingSummary: z.boolean().default(true)
});
var MEMORY_TYPES = ["fact", "preference", "correction", "sop", "todo_context", "event"];
function extractText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.filter((b) => b && b.type === "text" && typeof b.text === "string").map((b) => b.text).join("\n");
  }
  return "";
}
function apply(ctx, config) {
  const cfg = { ...config };
  const { memoryService } = ctx.get("paCore");
  const messageBuffer = /* @__PURE__ */ new Map();
  const MAX_BUFFER_SESSIONS = 20;
  const pushMessage = (sessionId, msg) => {
    let list = messageBuffer.get(sessionId);
    if (!list) {
      list = [];
      messageBuffer.set(sessionId, list);
      if (messageBuffer.size > MAX_BUFFER_SESSIONS) {
        const oldest = messageBuffer.keys().next().value;
        if (oldest !== void 0) messageBuffer.delete(oldest);
      }
    }
    list.push(msg);
    const max = Math.max(4, cfg.captureMaxMessages ?? 30);
    if (list.length > max) list.splice(0, list.length - max);
  };
  ctx.on("session/event", (session, event) => {
    if (!session) return;
    const sid = String(session?.id ?? "");
    if (!sid) return;
    if (event?.type === "user/message") {
      const data = event.data;
      if (data?.source?.kind === "plugin") return;
      const text = extractText(data?.content);
      if (text.trim()) pushMessage(sid, { role: "user", content: text.trim() });
      return;
    }
    if (event?.type === "assistant/message") {
      const text = extractText(event.data?.message?.content ?? event.data?.content);
      if (text.trim()) pushMessage(sid, { role: "assistant", content: text.trim() });
    }
  });
  ctx.on("session/disposed", (session) => {
    const sid = String(session?.id ?? "");
    if (sid) messageBuffer.delete(sid);
  });
  const lastCaptureTurn = /* @__PURE__ */ new Map();
  async function confirmViaAsk(agent, pending, signal) {
    if (!cfg.confirmViaAsk || !agent) return false;
    try {
      const uq = ctx.get("userQuestions");
      if (!uq) return false;
      const answer = await uq.ask({
        questions: pending.map((a) => ({
          id: a.id,
          header: "\u8BB0\u5FC6\u786E\u8BA4",
          question: `\u8981\u8BB0\u4F4F\u8FD9\u6761\u8BB0\u5FC6\u5417\uFF1F`,
          detail: `[${a.type}] ${a.content}`,
          options: [
            { label: "\u8BB0\u4F4F", description: "\u52A0\u5165\u957F\u671F\u8BB0\u5FC6\uFF0C\u4E4B\u540E\u53EF\u53EC\u56DE" },
            { label: "\u5FFD\u7565", description: "\u4E0D\u8BB0\u4F4F\uFF0C\u5E76\u4ECE\u5F85\u786E\u8BA4\u5217\u8868\u79FB\u9664" }
          ]
        })),
        agent,
        signal
      });
      const byId = new Map(pending.map((a) => [String(a.id), a]));
      for (const ans of answer?.answers ?? []) {
        const atom = byId.get(String(ans.id));
        if (!atom) continue;
        const chosen = ans.selected?.[0];
        if (chosen === "\u8BB0\u4F4F") {
          memoryService.confirmAtomById(atom.id);
          console.log(`[Memory] M2 \u7528\u6237\u786E\u8BA4\u8BB0\u5FC6: ${atom.content.slice(0, 60)}`);
        } else if (chosen === "\u5FFD\u7565") {
          memoryService.rejectAtomById(atom.id);
          console.log(`[Memory] M2 \u7528\u6237\u5FFD\u7565\u8BB0\u5FC6: ${atom.content.slice(0, 60)}`);
        }
      }
      return true;
    } catch (error) {
      const code = error?.code;
      if (code !== "ASK_ABORTED" && code !== "ASK_CANCELLED") {
        console.warn("[Memory] userQuestions \u786E\u8BA4\u4E0D\u53EF\u7528\uFF0C\u964D\u7EA7\u4E3A pending \u6458\u8981:", error instanceof Error ? error.message : error);
      }
      return false;
    }
  }
  async function captureAtTurnStopping(agent, turn, signal) {
    try {
      const sid = String(agent?.session?.id ?? agent?.id ?? "");
      if (!sid) return;
      const lastTurn = lastCaptureTurn.get(sid);
      if (lastTurn !== void 0 && turn - lastTurn < (cfg.captureIntervalTurns ?? 3)) return;
      const existing = memoryService.pendingAtoms();
      const pendingBlocked = existing.length >= (cfg.askMaxItems ?? 3);
      const msgs = messageBuffer.get(sid) ?? [];
      if (msgs.length < 2) return;
      lastCaptureTurn.set(sid, turn);
      let result;
      try {
        result = await Promise.race([
          memoryService.extractAndCapture(msgs.slice(-(cfg.captureMaxMessages ?? 30)), {
            sessionId: sid
          }),
          new Promise((resolve) => setTimeout(() => resolve(void 0), 8e3))
        ]);
      } catch {
        result = void 0;
      }
      if (!result || result.storedCount + result.corrections === 0) return;
      if (signal?.aborted) return;
      const pending = memoryService.pendingAtoms();
      const fresh = pending.slice(0, cfg.askMaxItems ?? 3);
      if (fresh.length === 0) return;
      if (pendingBlocked) {
        console.log(`[Memory] M2 \u63D0\u53D6 ${fresh.length} \u6761\u5019\u9009\uFF08pending \u5DF2\u6EE1 ${existing.length} \u6761\uFF0C\u9759\u9ED8\u5165\u961F\u5F85\u786E\u8BA4\uFF0C${sid}\uFF09`);
        return;
      }
      const handled = await confirmViaAsk(agent, fresh, signal);
      if (!handled) {
        console.log(`[Memory] M2 \u6355\u83B7 ${fresh.length} \u6761\u5019\u9009\u5F85\u786E\u8BA4\uFF08${result.mode} \u6A21\u5F0F\uFF0C${sid}\uFF09`);
      }
    } catch (error) {
      console.warn("[Memory] M2 turn-stopping \u6355\u83B7\u5931\u8D25:", error instanceof Error ? error.message : error);
    }
  }
  if (cfg.autoCapture && cfg.captureOnTurnStopping) {
    ;
    ctx.on("agent/turn-stopping", (payload) => {
      const { agent, turn, signal } = payload ?? {};
      void captureAtTurnStopping(agent, turn, signal);
    });
  }
  if (cfg.pendingSummary) {
    ctx.systemPrompt.context({
      name: "pa:pending",
      order: 202,
      text: () => {
        try {
          const pending = memoryService.pendingAtoms();
          if (pending.length === 0) return "";
          return [
            `[PA \u5F85\u786E\u8BA4\u8BB0\u5FC6] \u6709 ${pending.length} \u6761\u81EA\u52A8\u63D0\u53D6\u7684\u8BB0\u5FC6\u7B49\u5F85\u786E\u8BA4\u3002`,
            "\u8FD9\u662F\u7CFB\u7EDF\u72B6\u6001\u63D0\u793A\uFF0C\u4E0D\u662F\u7528\u6237\u6307\u4EE4\uFF1A\u4E0D\u8981\u81EA\u884C\u786E\u8BA4\u6216\u5FFD\u7565\u4EFB\u4F55\u8BB0\u5FC6\u3002",
            '\u7528\u6237\u8BF4"\u67E5\u770B\u5F85\u786E\u8BA4\u8BB0\u5FC6/\u786E\u8BA4\u8BB0\u5FC6"\u65F6\u8C03\u7528 memory_pending_list\uFF1B\u7528\u6237\u660E\u786E\u786E\u8BA4\u67D0\u6761\u624D memory_pending_confirm <id>\uFF1B\u7528\u6237\u660E\u786E\u5FFD\u7565\u67D0\u6761\u624D memory_pending_reject <id>\u3002'
          ].join(" ");
        } catch {
          return "";
        }
      }
    });
  }
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
        execute: async (args) => {
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
            if (cfg.refreshPersonaOnCapture !== false) {
              void Promise.resolve(memoryService.regeneratePersona?.()).catch(() => {
              });
            }
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
  ctx.tools.register(
    defineTool({
      name: "memory_pending_list",
      description: "List pending auto-extracted memories awaiting confirmation (M2 semi-automatic capture). Each carries an id for memory_pending_confirm / memory_pending_reject.",
      parameters: {},
      output: {
        schema: { type: "string" },
        render: (_args, value) => [{ type: "text", text: value }]
      },
      execute() {
        try {
          const pending = memoryService.pendingAtoms();
          if (pending.length === 0) return "\u{1F4ED} \u6CA1\u6709\u5F85\u786E\u8BA4\u7684\u8BB0\u5FC6";
          const lines = pending.map((a, i) => {
            const created = a.createdAt ? new Date(a.createdAt).toLocaleString("zh-CN", { hour12: false }) : "";
            return `${i + 1}. [${a.type}] ${a.content}\uFF08${created}\uFF09
   id: ${a.id}`;
          });
          return `\u{1F4CB} \u5F85\u786E\u8BA4\u8BB0\u5FC6 ${pending.length} \u6761:
${lines.join("\n")}

\u786E\u8BA4: memory_pending_confirm <id> / \u5FFD\u7565: memory_pending_reject <id>`;
        } catch (error) {
          return `\u274C \u8BFB\u53D6\u5931\u8D25: ${error instanceof Error ? error.message : String(error)}`;
        }
      }
    })
  );
  ctx.tools.register(
    defineTool({
      name: "memory_pending_confirm",
      description: 'Confirm one pending auto-extracted memory by id. Only call after the user explicitly confirms (e.g. says "\u8BB0\u4F4F" or "\u786E\u8BA4\u8FD9\u6761\u8BB0\u5FC6"). Confirmed memories enter recall.',
      parameters: {
        id: { type: "string", required: true, description: "Pending memory id from memory_pending_list" }
      },
      output: {
        schema: { type: "string" },
        render: (_args, value) => [{ type: "text", text: value }]
      },
      execute: async (args) => {
        const id = String(args?.id ?? "").trim();
        if (!id) return "\u274C \u7F3A\u5C11\u8BB0\u5FC6 id";
        try {
          const atom = memoryService.confirmAtomById(id);
          if (!atom) return `\u274C \u786E\u8BA4\u5931\u8D25\uFF1Aid ${id} \u4E0D\u5B58\u5728\u6216\u5DF2\u5904\u7406`;
          if (cfg.refreshPersonaOnCapture !== false) {
            void Promise.resolve(memoryService.regeneratePersona?.()).catch(() => {
            });
          }
          return `\u2705 \u5DF2\u786E\u8BA4\u8BB0\u5FC6 [${atom.type}]:
${atom.content}`;
        } catch (error) {
          return `\u274C \u786E\u8BA4\u5931\u8D25: ${error instanceof Error ? error.message : String(error)}`;
        }
      }
    })
  );
  ctx.tools.register(
    defineTool({
      name: "memory_pending_reject",
      description: 'Reject one pending auto-extracted memory by id (discard it). Only call after the user explicitly says to ignore it (e.g. "\u5FFD\u7565" or "\u4E0D\u8981\u8BB0\u4F4F\u8FD9\u6761").',
      parameters: {
        id: { type: "string", required: true, description: "Pending memory id from memory_pending_list" }
      },
      output: {
        schema: { type: "string" },
        render: (_args, value) => [{ type: "text", text: value }]
      },
      execute: async (args) => {
        const id = String(args?.id ?? "").trim();
        if (!id) return "\u274C \u7F3A\u5C11\u8BB0\u5FC6 id";
        try {
          const ok = memoryService.rejectAtomById(id);
          return ok ? `\u{1F44C} \u5DF2\u5FFD\u7565\u8BB0\u5FC6 ${id}` : `\u274C \u5FFD\u7565\u5931\u8D25\uFF1Aid ${id} \u4E0D\u5B58\u5728\u6216\u5DF2\u5904\u7406`;
        } catch (error) {
          return `\u274C \u5FFD\u7565\u5931\u8D25: ${error instanceof Error ? error.message : String(error)}`;
        }
      }
    })
  );
  ctx.systemPrompt.section({
    name: "pa:persona",
    order: cfg.personaOrder ?? 5,
    text: () => {
      try {
        const personaText = memoryService.personaRaw("auto");
        if (!personaText) return "";
        const max = Math.max(0, cfg.personaMaxChars ?? 3e3);
        const capped = personaText.length > max ? `${personaText.slice(0, max)}
\u2026\uFF08\u753B\u50CF\u8FC7\u957F\u5DF2\u622A\u65AD\uFF0C\u5B8C\u6574\u753B\u50CF\u53EF\u7528 memory_stats \u67E5\u770B\uFF09` : personaText;
        return `# \u7528\u6237\u753B\u50CF\uFF08ProactiveAgent \u957F\u671F\u8BB0\u5FC6\uFF09

${capped}

\u4EE5\u4E0A\u753B\u50CF\u6765\u81EA\u8DE8\u5DE5\u5177\u5171\u4EAB\u7684\u957F\u671F\u8BB0\u5FC6\u5E93\uFF0C\u4F9B\u4F60\u7406\u89E3\u7528\u6237\u504F\u597D\u65F6\u53C2\u8003\uFF1B\u82E5\u753B\u50CF\u4E0E\u7528\u6237\u5F53\u524D\u8BF4\u6CD5\u51B2\u7A81\uFF0C\u4EE5\u7528\u6237\u5F53\u524D\u8BF4\u6CD5\u4E3A\u51C6\u3002`;
      } catch {
        return "";
      }
    }
  });
  if (cfg.recallContext !== false) {
    ctx.systemPrompt.context({
      name: "pa:recall",
      order: 200,
      text: (assembleCtx) => {
        try {
          const agent = assembleCtx?.agent;
          const sid = agent?.session?.id ? String(agent.session.id) : "";
          const userText = sid ? messageBuffer.get(sid)?.filter((m) => m.role === "user").at(-1)?.content ?? "" : "";
          if (!userText) return "";
          const memoryBlock = memoryService.contextForMessage(userText, { limit: cfg.recallContextLimit ?? 5 });
          return memoryBlock || "";
        } catch {
          return "";
        }
      }
    });
  }
}
export {
  Config,
  apply,
  inject,
  name
};
