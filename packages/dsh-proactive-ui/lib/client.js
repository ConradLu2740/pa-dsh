/**
 * @proactive-agent/dsh-proactive-ui — 客户端插件（S2b 最小原型）
 *
 * 目标：验证 dsh 客户端 slot 机制全链路
 *   exports["./client"] + dsh.client 声明 + __ModuleLoader__.load + conversationEvents + slots.inject('conversation.chat.turnTail')
 *
 * 原型卡片：turn 结束后在助手消息下方显示一行 PA 状态摘要。
 * 最小验证：不注册自定义事件（rc.6 第三方事件注册面受限，S2a 已知），
 * 只用官方已知事件（turn/start、assistant/message）驱动卡片挂载与卸载。
 *
 * 数据源说明：本原型是机制验证，卡片内容为占位摘要；真实建议/待确认数据
 * 同步到客户端需要服务端事件通道（P0 S2a 已转向 durable 事件方向，等 dsh
 * 正式版第三方事件注册面开放后再接）。
 */
window.__ModuleLoader__.load({
  id: '@proactive-agent/dsh-proactive-ui',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    const NS = 'pa-ui'

    /** 每个 turn 的状态摘要（占位：验证卡片能按 turn 挂载/卸载） */
    const definition = {
      kind: 'pa-status',
      match: (event) => {
        if (event.type === 'turn/start') {
          return { id: String(event.data.turn), role: 'start' }
        }
        if (event.type === 'assistant/message' && event.data?.message) {
          return { id: String(event.data.turn ?? ''), role: 'update' }
        }
        return null
      },
      start: (_context, match) => {
        if (match.event.type !== 'turn/start') throw new Error('pa-status start requires turn/start')
        return { turn: match.event.data.turn, seq: match.event.seq ?? 0 }
      },
      update: (state, event) => {
        if (event.type === 'assistant/message') {
          const seq = event.seq ?? event.data?.seq ?? state.seq
          return { ...state, seq: Math.max(state.seq ?? 0, seq ?? 0) }
        }
        return state
      },
      finish: (state) => state,
    }

    /** 选择器：决定卡片是否挂载（原型：turn 有助手消息就显示） */
    function selectPaStatus(owner) {
      const turn = owner?.turn
      if (!turn) return null
      return {
        turn: turn.number ?? turn.turn ?? null,
        seq: owner.seq ?? null,
      }
    }

    const inject = ['slots', 'locale', 'conversationEvents']

    function apply(ctx) {
      ctx.conversationEvents.register(definition)
      ctx.slots.inject('conversation.chat.turnTail', () => ctx.slots.register({
        name: 'conversation.chat.turnTail',
        select: selectPaStatus,
        locale: NS,
      }, PaStatusCard))
    }

    /** 最小卡片组件（无 React 依赖的纯函数渲染占位；验证 slot 挂载） */
    function PaStatusCard(props) {
      const match = props?.match
      return {
        title: 'PA',
        kind: 'other',
        content: [
          {
            type: 'text',
            text: `PA 记忆/建议状态（S2b 原型）· turn ${match?.turn ?? '-'}${match?.seq != null ? ` · seq ${match.seq}` : ''}`,
          },
        ],
      }
    }

    exports.PaStatusCard = PaStatusCard
    exports.apply = apply
    exports.inject = inject
    return module.exports
  },
})
