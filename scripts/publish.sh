#!/usr/bin/env bash
# =============================================================================
# PA→dsh 插件发布脚本（在【用户终端】运行）
#
# 为什么要在用户终端跑：npm 账号 2FA 是 WebAuthn（指纹），publish 时会弹浏览器
# 授权（"Press ENTER to open in the browser..."），只有交互终端能完成。
#
# 用法:
#   bash scripts/publish.sh            # 默认 patch 版本
#   bash scripts/publish.sh minor      # minor 版本
#   bash scripts/publish.sh major      # major 版本
#
# 流程: 构建 → 提升版本（6 包同步 + consumer 的 core peerDependency 同步）
#       → 逐个 npm publish --access public（每个包按 Enter + 浏览器指纹授权）
# =============================================================================
set -e
cd "$(dirname "$0")/.."

TYPE="${1:-patch}"
case "$TYPE" in
  patch|minor|major) ;;
  *) echo "❌ 版本类型必须是 patch|minor|major"; exit 1 ;;
esac

echo ">>> 1/3 构建所有插件"
node scripts/build.mjs

echo ">>> 2/3 提升版本号（$TYPE，7 包同步：6 服务端 + UI 客户端）"
for d in packages/dsh-proactive-*; do
  # dsh-proactive-ui 是纯客户端包（无 src/plugin.ts，不参与 build），版本照提
  (cd "$d" && npm version "$TYPE" --no-git-tag-version --no-commit-hooks >/dev/null)
done

# 同步 consumer 包的 peerDependency: @proactive-agent/dsh-proactive-core
CORE_VERSION=$(node -p "require('./packages/dsh-proactive-core/package.json').version")
echo ">>> 同步 consumer 的 core peerDependency 到 ^$CORE_VERSION"
for d in dsh-proactive-memory dsh-proactive-suggest dsh-proactive-injector dsh-proactive-daily dsh-proactive-skills; do
  node -e "
    const fs = require('fs');
    const p = 'packages/$d/package.json';
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    j.peerDependencies['@proactive-agent/dsh-proactive-core'] = '^$CORE_VERSION';
    fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n');
  "
done
echo "    core 版本: $CORE_VERSION"

echo ">>> 3/3 发布（每个包可能弹浏览器授权，按 Enter 打开浏览器 → 指纹确认）"
for d in dsh-proactive-core dsh-proactive-memory dsh-proactive-suggest dsh-proactive-injector dsh-proactive-daily dsh-proactive-skills dsh-proactive-ui; do
  echo ">>> 发布 $d"
  (cd "packages/$d" && npm publish --access public)
done

echo ">>> 同步 bundle 聚合包 peerDependencies（指向新版本）"
BUNDLE_DIR=packages/dsh
for pkg in dsh-proactive-core dsh-proactive-memory dsh-proactive-suggest dsh-proactive-injector dsh-proactive-daily dsh-proactive-skills dsh-proactive-ui; do
  VER=$(node -p "require('./packages/$pkg/package.json').version")
  node -e "
    const fs = require('fs');
    const p = '$BUNDLE_DIR/package.json';
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    j.peerDependencies['@proactive-agent/$pkg'] = '^$VER';
    fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n');
  "
done

echo ">>> 发布 bundle 聚合包 @proactive-agent/dsh（无构建产物，版本同步）"
(cd packages/dsh && npm version "$TYPE" --no-git-tag-version --no-commit-hooks >/dev/null && npm publish --access public)

echo ""
echo "✅ 全部发布完成。接下来升级 dsh profile:"
UI_VERSION=$(node -p "require('./packages/dsh-proactive-ui/package.json').version")
echo "   cd ~/.dsh/profiles/web && pnpm add @proactive-agent/dsh-proactive-core@^$CORE_VERSION @proactive-agent/dsh-proactive-memory@^$CORE_VERSION @proactive-agent/dsh-proactive-suggest@^$CORE_VERSION @proactive-agent/dsh-proactive-injector@^$CORE_VERSION @proactive-agent/dsh-proactive-daily@^$CORE_VERSION @proactive-agent/dsh-proactive-skills@^$CORE_VERSION @proactive-agent/dsh-proactive-ui@^$UI_VERSION"
echo "   然后重启 dsh: pkill -f 'dsh.*web'; cd workspace-files && ./run-dsh.sh"
