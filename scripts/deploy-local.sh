#!/usr/bin/env bash
# deploy-local.sh —— 本地开发部署：构建 + 热替换到 dsh profile
#
# 为什么需要：profile 依赖是 npm 包（^0.1.x），不是 file: 链接。
# 改源码后只跑 build.mjs 不会影响 dsh 实际加载的包，
# 必须把 lib 覆盖到 ~/.dsh/profiles/web/node_modules/@proactive-agent/*/lib/。
# 覆盖后重启 dsh 生效。正式发布仍走 npm（scripts/publish.sh）。
set -euo pipefail

cd "$(dirname "$0")/.."

echo "▶ 构建全部插件..."
node scripts/build.mjs

DEST="$HOME/.dsh/profiles/web/node_modules/@proactive-agent"
if [ ! -d "$DEST" ]; then
  echo "✗ 未找到 profile node_modules: $DEST"
  exit 1
fi

echo "▶ 热替换 lib 到 $DEST"
for pkg in dsh-proactive-core dsh-proactive-memory dsh-proactive-suggest dsh-proactive-injector dsh-proactive-daily dsh-proactive-skills; do
  src="packages/$pkg/lib/index.js"
  dst="$DEST/$pkg/lib/index.js"
  if [ -f "$src" ]; then
    cp "$src" "$dst"
    echo "  ✓ $pkg"
  else
    echo "  - $pkg 跳过（无构建产物）"
  fi
done

echo ""
echo "▶ 重启 dsh web..."
pkill -f "dsh.*web" 2>/dev/null || true
sleep 2
cd "$(dirname "$0")/../.."
nohup ./run-dsh.sh > /tmp/dsh-deploy.log 2>&1 &
sleep 6
curl -s -o /dev/null -w "  dsh web HTTP %{http_code}\n" http://localhost:8080 || echo "  ✗ dsh 未响应，检查 .dsh-run/dsh-web.log"
