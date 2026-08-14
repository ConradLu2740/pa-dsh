#!/usr/bin/env node
/**
 * repro-corrupt-session.mjs
 *
 * Build a minimal-but-valid dsh session log (zstd JSONL), then corrupt it in a
 * way that reproduces "a single corrupted session log wedges the whole
 * workspace in a loader reload loop".
 *
 * DeepSeek Harness (dsh) 0.1.0-rc.6 stores each session as
 * `~/.dsh/sessions/<projectKey>/<sessionId>/session.jsonl.zstd`:
 *   - frame 0  = the header line, compressed as ONE independently decodable
 *                checksummed zstd frame;
 *   - frames 1..N = event rows, each row compressed as its own frame
 *                ("one line per frame" is a valid encoding; the scanner only
 *                requires that every frame's plaintext is a run of newline
 *                terminated JSONL records).
 *
 * The corruption modes below target the two documented failure paths:
 *   - `seq-gap`     (default): a third-party plugin "notification" written
 *                   after the session was already ended, carrying a stale seq.
 *                   The JSONL scanner (`SessionLogScanner.consumeEventLine`)
 *                   throws `corrupt session log: seq gap in committed region`
 *                   once it reaches the turn/end that follows the gap.
 *   - `torn-header` : truncate the first frame mid-header. `readFirstZstdLine`
 *                   / `assertZstdHeaderFrame` reject the artifact at listing.
 *   - `torn-tail`   : truncate the final frame mid-block (torn final frame).
 *
 * Usage:
 *   node repro-corrupt-session.mjs [--mode seq-gap|torn-header|torn-tail]
 *                                  [--session-id <id>] [--cwd <dir>] [--dry-run]
 *   node repro-corrupt-session.mjs --cleanup
 *
 * Run with the same Node that ships zstd in node:zlib (Node >= 22.15 / 24).
 * Requires the dsh runtime to understand the format; see README notes in
 * docs/dsh-issues-draft.md.
 */
import { zstdCompressSync, constants } from 'node:zlib'
import { randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'

const ZSTD_CHECKSUM = { params: { [constants.ZSTD_c_checksumFlag]: 1 } }

const DEFAULT_CWD = '/Users/moxianbao/deepseek/workspace'
const SESSION_ROOT = join(homedir(), '.dsh', 'sessions')

// ---------------------------------------------------------------------------
// dsh path helpers (mirrors packages/session/session-persistence-jsonl/src/format.ts)
// ---------------------------------------------------------------------------
function encodeSegment(raw) {
  if (raw.length === 0) throw new Error('cannot encode an empty path segment')
  if (raw === '.') return '~002E'
  if (raw === '..') return '~002E~002E'
  let out = ''
  for (let i = 0; i < raw.length; i++) {
    const code = raw.charCodeAt(i)
    const ch = String.fromCharCode(code)
    if (ch !== '~' && /^[A-Za-z0-9._-]$/.test(ch)) out += ch
    else out += '~' + code.toString(16).toUpperCase().padStart(4, '0')
  }
  return out
}

function projectKey(cwd) {
  let readable = ''
  let separatorRun = false
  for (let i = 0; i < cwd.length; i++) {
    const code = cwd.charCodeAt(i)
    const ch = String.fromCharCode(code)
    if (ch === '/' || ch === '\\' || ch === ':') {
      if (!separatorRun) readable += '-'
      separatorRun = true
    } else if (ch !== '~' && /^[A-Za-z0-9._-]$/.test(ch)) {
      readable += ch
      separatorRun = false
    } else {
      readable += '~' + code.toString(16).toUpperCase().padStart(4, '0')
      separatorRun = false
    }
  }
  const slug = readable.replace(/^-+/, '') || 'root'
  return `--${slug.slice(0, 251)}--`
}

function sessionDir(cwd, id) {
  return join(SESSION_ROOT, projectKey(cwd), encodeSegment(id))
}

// ---------------------------------------------------------------------------
// Minimal valid session builder
// ---------------------------------------------------------------------------
function headerLine(id, cwd, createdAt) {
  return JSON.stringify({
    type: 'session',
    version: 0,
    id,
    createdAt,
    cwd,
    delegationDepth: 0,
    agentPreset: 'standard',
  })
}

/** A minimal-but-valid session: policy events + one completed turn + end-seed. */
function buildValidEvents(startTime, id) {
  const t = startTime
  return [
    { type: 'permission/preset', seq: 0, time: t, data: { preset: 'workspace-write' } },
    { type: 'sandbox/mode', seq: 1, time: t, data: { mode: 'workspace-write' } },
    { type: 'approval/policy', seq: 2, time: t, data: { policy: 'ask' } },
    { type: 'turn/start', seq: 3, time: t, data: { turn: 1 } },
    { type: 'user/message', seq: 4, time: t, data: { content: [{ type: 'text', text: 'hello' }], source: { kind: 'user' }, role: 'user', id: `msg-${id}` }, surfaceOp: 'append' },
    { type: 'turn/end', seq: 5, time: t, data: { turn: 1, reason: { kind: 'completed' } } },
    { type: 'session/end-seed', seq: 6, time: t, data: {} },
  ]
}

/**
 * Corrupt tail for the `seq-gap` mode: a plugin notification written after the
 * session ended, carrying a stale seq (skips seq 7). The gap itself is raised
 * on the `user/message` line; the scanner throws once it reaches the following
 * `turn/end` line.
 */
function buildSeqGapTail(t) {
  return [
    { type: 'user/message', seq: 8, time: t, data: { content: [{ type: 'text', text: '[PA suggestion] (notification appended after session ended)' }], source: { kind: 'plugin', plugin: '@proactive-agent/dsh-proactive-injector' }, role: 'user', id: 'msg-notification' }, surfaceOp: 'append' },
    { type: 'turn/end', seq: 9, time: t, data: { turn: 1, reason: { kind: 'interrupted' } } },
    { type: 'session/end-seed', seq: 10, time: t, data: {} },
  ]
}

// ---------------------------------------------------------------------------
// Encoding: one line per checksummed zstd frame
// ---------------------------------------------------------------------------
function encodeOneLinePerFrame(header, events) {
  const lines = [header, ...events.map((e) => JSON.stringify(e))]
  const frames = lines.map((line) => zstdCompressSync(Buffer.from(line + '\n'), ZSTD_CHECKSUM))
  return Buffer.concat(frames)
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const args = { mode: 'seq-gap', sessionId: null, cwd: DEFAULT_CWD, dryRun: false, cleanup: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--mode') args.mode = argv[++i]
    else if (a === '--session-id') args.sessionId = argv[++i]
    else if (a === '--cwd') args.cwd = argv[++i]
    else if (a === '--dry-run') args.dryRun = true
    else if (a === '--cleanup') args.cleanup = true
    else if (a === '--help' || a === '-h') { printHelp(); process.exit(0) }
    else throw new Error(`unknown argument: ${a}`)
  }
  return args
}

function printHelp() {
  console.log(`repro-corrupt-session.mjs — build a corrupt dsh session log

  --mode <seq-gap|corrupt-header|torn-header|torn-tail>  corruption mode (default: seq-gap)
  --session-id <id>                        override the session id
  --cwd <dir>                              session cwd (default: ${DEFAULT_CWD})
  --dry-run                                print the plan and bytes without writing
  --cleanup                                remove all session-repro-* test sessions
  --help                                   this help
`)
}

function cleanup() {
  const project = join(SESSION_ROOT, projectKey(DEFAULT_CWD))
  if (!existsSync(project)) return 0
  let removed = 0
  for (const entry of readdirSync(project)) {
    if (entry.startsWith('session-repro-')) {
      rmSync(join(project, entry), { recursive: true, force: true })
      removed += 1
      console.log('removed', join(project, entry))
    }
  }
  console.log(`cleanup: removed ${removed} repro session dir(s) under ${project}`)
  return removed
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.cleanup) { cleanup(); return }

  const id = args.sessionId ?? `session-repro-${randomUUID().slice(0, 8)}`
  const createdAt = Date.now()
  const header = headerLine(id, args.cwd, createdAt)
  const validEvents = buildValidEvents(createdAt, id)

  let events = validEvents
  if (args.mode === 'seq-gap') {
    events = [...validEvents, ...buildSeqGapTail(createdAt + 1000)]
  } else if (args.mode !== 'torn-header' && args.mode !== 'torn-tail' && args.mode !== 'corrupt-header') {
    throw new Error(`unknown mode: ${args.mode}`)
  }

  let bytes = encodeOneLinePerFrame(header, events)
  const dir = sessionDir(args.cwd, id)
  const path = join(dir, 'session.jsonl.zstd')

  if (args.mode === 'corrupt-header') {
    // First frame holds TWO lines (header + junk) instead of exactly one header
    // line. `assertZstdHeaderFrame` rejects it, so `sessionPersistence.list()`
    // throws during boot and wedges the loader.
    const headerFrame = zstdCompressSync(Buffer.from(header + '\n' + JSON.stringify(validEvents[0]) + '\n'), ZSTD_CHECKSUM)
    const rest = validEvents.slice(1).map((e) => zstdCompressSync(Buffer.from(JSON.stringify(e) + '\n'), ZSTD_CHECKSUM))
    bytes = Buffer.concat([headerFrame, ...rest])
  } else if (args.mode === 'torn-header') {
    bytes = bytes.subarray(0, 40)
  } else if (args.mode === 'torn-tail') {
    bytes = bytes.subarray(0, bytes.length - 8)
  }

  console.log(`mode      : ${args.mode}`)
  console.log(`session id: ${id}`)
  console.log(`cwd       : ${args.cwd}`)
  console.log(`project   : ${projectKey(args.cwd)}`)
  console.log(`path      : ${path}`)
  console.log(`events    : ${events.length} event rows (valid prefix seq 0..6, then corrupt tail)`)
  console.log(`bytes     : ${bytes.length}`)

  if (args.dryRun) return

  mkdirSync(dir, { recursive: true, mode: 0o700 })
  writeFileSync(path, bytes, { mode: 0o600 })
  console.log('written.')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
