#!/usr/bin/env bash
# publish-rest.sh —— 补发 P1 剩余包（版本已在 package.json，不提升）
# 用法: bash scripts/publish-rest.sh
set -e
cd "$(dirname "$0")/.."

echo ">>> 1/2 补发剩余 5 个服务端包 + UI 客户端包（版本已定）"
for d in dsh-proactive-suggest dsh-proactive-injector dsh-proactive-daily dsh-proactive-skills dsh-proactive-ui; do
  VER=$(node -p "require('./packages/$d/package.json').version")
  echo ">>> 发布 $d@$VER"
  (cd "packages/$d" && npm publish --access public)
done

echo ">>> 2/2 同步 bundle peerDependencies 并发布"
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
BUNDLE_VER=$(node -p "require('./packages/dsh/package.json').version")
echo ">>> 发布 @proactive-agent/dsh@$BUNDLE_VER"
(cd packages/dsh && npm publish --access public)

echo ""
echo "✅ 补发完成。请告诉 Proma 验证 registry 版本 + 升级 profile"
