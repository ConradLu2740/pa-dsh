#!/usr/bin/env node
/**
 * pa-dsh 构建脚本：把每个插件包的 src/plugin.ts bundle 成 lib/index.js。
 * - @proactive-agent/core 打进包内（自包含，dsh profile 只需装本包）
 * - @deepseek-ai/* 全部 external（运行时由 dsh 提供）
 */
import { build } from 'esbuild'
import { readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pkgsDir = join(root, 'packages')

const targets = readdirSync(pkgsDir).filter((d) =>
  existsSync(join(pkgsDir, d, 'src', 'plugin.ts')),
)

let failed = false
for (const pkg of targets) {
  const entry = join(pkgsDir, pkg, 'src', 'plugin.ts')
  const outfile = join(pkgsDir, pkg, 'lib', 'index.js')
  console.log(`\n▶ building ${pkg}`)
  try {
    await build({
      entryPoints: [entry],
      outfile,
      bundle: true,
      platform: 'node',
      format: 'esm',
      target: 'node18',
      external: ['@deepseek-ai/*'],
      sourcemap: false,
      logLevel: 'info',
    })
    console.log(`✔ ${pkg} → lib/index.js`)
  } catch (e) {
    failed = true
    console.error(`✘ ${pkg} 构建失败:`, e.message)
  }
}

if (failed) process.exit(1)
console.log('\n全部构建完成')
