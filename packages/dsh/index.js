/**
 * @proactive-agent/dsh — bundle 聚合包（官方 dsh.bundle 形态）
 *
 * 本包不包含插件实现，只声明配置层（cordis.patch.yml），
 * 由官方 dsh plugin add 安装时自动应用。实现分散在 6 个细粒度包。
 * 用户也可逐个安装细粒度包并手写 patch（高级用法）。
 */
export const name = 'proactive-agent-dsh-bundle'

export function apply() {
  // bundle 包无运行时逻辑；层由 cordis.patch.yml 声明
}
