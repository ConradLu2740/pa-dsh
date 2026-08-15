// packages/dsh-proactive-core/src/plugin.ts
import z from "@deepseek-ai/schemastery";

// node_modules/.pnpm/@proactive-agent+core@0.9.2/node_modules/@proactive-agent/core/dist/index.js
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, normalize, resolve } from "node:path";
import { realpathSync } from "node:fs";
import { homedir } from "node:os";
import { existsSync as existsSync2, mkdirSync as mkdirSync2 } from "node:fs";
import { join as join2 } from "node:path";
import { homedir as homedir2 } from "node:os";
import { writeFileSync as writeFileSync2, renameSync as renameSync2, existsSync as existsSync3, copyFileSync, readFileSync as readFileSync2, unlinkSync } from "node:fs";
import { existsSync as existsSync4, mkdirSync as mkdirSync3, readFileSync as readFileSync3, writeFileSync as writeFileSync3 } from "node:fs";
import { join as join3 } from "node:path";
import { randomUUID } from "node:crypto";
import {
  existsSync as existsSync5,
  mkdirSync as mkdirSync4,
  readFileSync as readFileSync4,
  readdirSync as readdirSync2,
  renameSync as renameSync3,
  statSync,
  unlinkSync as unlinkSync2,
  writeFileSync as writeFileSync4
} from "node:fs";
import { join as join4 } from "node:path";
import { existsSync as existsSync6, readFileSync as readFileSync5 } from "node:fs";
import { join as join5, dirname as dirname2 } from "node:path";
import { existsSync as existsSync7 } from "node:fs";
import { join as join6 } from "node:path";
import { homedir as homedir3 } from "node:os";
import { randomUUID as randomUUID2 } from "node:crypto";
import { mkdirSync as mkdirSync5 } from "node:fs";
import { dirname as dirname3 } from "node:path";
import { randomUUID as randomUUID3 } from "node:crypto";
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
function isStopToken(token) {
  return STOP_WORDS.has(token);
}
function tokenize(text) {
  const tokens = [];
  for (const m of text.matchAll(WORD_RE)) {
    const w = m[0]?.toLowerCase() ?? "";
    if (w.length >= 2) tokens.push(w);
  }
  const chars = text.split("").filter((c) => CJK_RE.test(c));
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const next = chars[i + 1];
    if (ch) tokens.push(ch);
    if (ch && next) tokens.push(ch + next);
  }
  return tokens;
}
function queryTerms(query) {
  const raw = tokenize(query);
  const filtered = raw.filter((t) => !isStopToken(t));
  return [...new Set(filtered)];
}
function expandedQueryTerms(query) {
  const terms = queryTerms(query);
  const expanded = [...terms];
  for (const term of terms) {
    const syns = SYNONYM_EXPANSIONS[term];
    if (syns) expanded.push(...syns);
  }
  return [...new Set(expanded)];
}
var CJK_RE;
var WORD_RE;
var STOP_WORDS;
var SYNONYM_EXPANSIONS;
var init_tokens = __esm({
  "src/memory/tokens.ts"() {
    "use strict";
    CJK_RE = /[\u4e00-\u9fff\u3400-\u4dbf]/;
    WORD_RE = /[A-Za-z0-9_]+/g;
    STOP_WORDS = /* @__PURE__ */ new Set([
      // 中文功能词
      "\u7684",
      "\u4E86",
      "\u662F",
      "\u6211",
      "\u4F60",
      "\u4ED6",
      "\u5979",
      "\u5B83",
      "\u6211\u4EEC",
      "\u4F60\u4EEC",
      "\u4ED6\u4EEC",
      "\u5728",
      "\u6709",
      "\u548C",
      "\u4E0E",
      "\u53CA",
      "\u6216",
      "\u4E5F",
      "\u90FD",
      "\u5F88",
      "\u5C31",
      "\u8FD8",
      "\u53C8",
      "\u628A",
      "\u88AB",
      "\u8BA9",
      "\u7ED9",
      "\u5BF9",
      "\u4ECE",
      "\u5411",
      "\u5230",
      "\u53BB",
      "\u6765",
      "\u7528",
      "\u60F3",
      "\u5417",
      "\u5462",
      "\u5427",
      "\u554A",
      "\u54E6",
      "\u5440",
      "\u561B",
      "\u4EC0\u4E48",
      "\u600E\u4E48",
      "\u600E\u6837",
      "\u5982\u4F55",
      "\u4E3A\u4EC0\u4E48",
      "\u54EA",
      "\u54EA\u4E9B",
      "\u8C01",
      "\u54EA\u4E2A",
      "\u4E00\u4E2A",
      "\u8FD9\u4E2A",
      "\u90A3\u4E2A",
      "\u53EF\u4EE5",
      "\u80FD",
      "\u4F1A",
      "\u8981",
      "\u5E2E",
      "\u8BF7",
      "\u8BF7\u95EE",
      "\u4E00\u4E0B",
      "\u770B\u770B",
      "\u5E2E\u6211",
      "\u5199",
      "\u505A",
      "\u8BF4",
      "\u77E5\u9053",
      "\u8BB0\u5F97",
      "\u89C9\u5F97",
      "\u5E94\u8BE5",
      "\u53EF\u80FD",
      "\u5927\u6982",
      "\u73B0\u5728",
      "\u4ECA\u5929",
      // 中文单字量词/虚词（tokenize 会同时输出单字，需单独过滤）
      "\u4E00",
      "\u4E24",
      "\u51E0",
      "\u4E2A",
      "\u79CD",
      "\u4E9B",
      "\u8FD9",
      "\u90A3",
      "\u6BCF",
      "\u5404",
      "\u53EA",
      "\u4E0B",
      "\u6B21",
      "\u4E0A",
      "\u91CC",
      "\u4E2D",
      "\u5916",
      "\u524D",
      "\u540E",
      "\u8FB9",
      "\u5904",
      "\u65F6",
      "\u5019",
      "\u8D77",
      "\u8BF7",
      "\u5E2E",
      "\u5199",
      "\u505A",
      // 时间/高频名词单字（避免“今天股票行情”靠单字叠加突破门槛）
      "\u4ECA",
      "\u65E5",
      "\u5929",
      "\u6628",
      "\u660E",
      "\u80A1",
      "\u7968",
      "\u884C",
      "\u60C5",
      "\u6DA8",
      "\u8DCC",
      "\u76D8",
      // 时间双字词
      "\u4ECA\u65E5",
      "\u6628\u5929",
      "\u660E\u5929",
      "\u6628\u5929",
      "\u80A1\u7968",
      "\u884C\u60C5",
      "\u80A1\u5E02",
      "\u5927\u76D8",
      // 闲聊意图词（“今天天气怎么样”不该命中“天气小程序”项目记忆；项目名仍有小程序/程序等词可召回）
      "\u5929\u6C14",
      // 英文功能词
      "the",
      "a",
      "an",
      "is",
      "are",
      "was",
      "were",
      "to",
      "of",
      "in",
      "on",
      "for",
      "with",
      "and",
      "or",
      "but",
      "i",
      "you",
      "he",
      "she",
      "it",
      "we",
      "they",
      "me",
      "my",
      "your",
      "this",
      "that",
      "what",
      "how",
      "why",
      "when",
      "can",
      "could",
      "would",
      "should",
      "do",
      "does",
      "did",
      "have",
      "has"
    ]);
    SYNONYM_EXPANSIONS = {
      "\u7F16\u7A0B": ["typescript", "rust", "python", "golang", "java", "javascript", "\u8BED\u8A00", "\u4EE3\u7801", "\u6280\u672F\u6808"],
      "\u8BED\u8A00": ["typescript", "rust", "python", "golang", "java", "javascript", "\u4EE3\u7801", "\u6280\u672F\u6808"],
      "\u6280\u672F\u6808": ["typescript", "rust", "python", "golang", "java", "javascript", "\u7F16\u7A0B", "\u8BED\u8A00"],
      "\u540D\u5B57": ["\u59D3\u540D", "conrad", "\u53EB"],
      "\u59D3\u540D": ["\u540D\u5B57", "conrad", "\u53EB"],
      "\u9879\u76EE": ["proma", "proactive", "\u5F00\u53D1"],
      "\u5F00\u53D1": ["proma", "proactive", "\u9879\u76EE"]
    };
  }
});
function indexSignature(atoms) {
  if (atoms.length === 0) return "0:";
  const first = atoms[0]?.id ?? "";
  const last = atoms[atoms.length - 1]?.id ?? "";
  return `${atoms.length}:${first}:${last}`;
}
function buildInvertedIndex(atoms) {
  const postings = /* @__PURE__ */ new Map();
  for (const atom of atoms) {
    if (!atom.confirmed || atom.metadata?.archived === true) continue;
    const tokens = new Set(tokenize(`${atom.content} ${atom.type}`.toLowerCase()));
    for (const t of tokens) {
      if (t.length < 2) continue;
      let set = postings.get(t);
      if (!set) {
        set = /* @__PURE__ */ new Set();
        postings.set(t, set);
      }
      set.add(atom.id);
    }
  }
  return {
    postings,
    coveredCount: atoms.length,
    firstId: atoms[0]?.id,
    lastId: atoms[atoms.length - 1]?.id,
    builtAt: Date.now()
  };
}
function getIndexFor(atoms) {
  const sig = indexSignature(atoms);
  if (cachedSignature !== sig || !cachedIndex) {
    cachedIndex = buildInvertedIndex(atoms);
    cachedSignature = sig;
  }
  return cachedIndex;
}
function resetIndexCache() {
  cachedSignature = void 0;
  cachedIndex = void 0;
}
function lookupCandidates(index, terms) {
  const out = /* @__PURE__ */ new Set();
  for (const term of terms) {
    const ids = index.postings.get(term);
    if (ids) for (const id of ids) out.add(id);
  }
  return out;
}
var cachedSignature;
var cachedIndex;
var init_inverted_index = __esm({
  "src/memory/inverted-index.ts"() {
    "use strict";
    init_tokens();
  }
});
function configDir() {
  const override = process.env.PROACTIVE_DATA_DIR?.trim() || process.env.PROMA_CONFIG_DIR?.trim();
  if (override) {
    if (!existsSync(override)) mkdirSync(override, { recursive: true });
    return override;
  }
  const dir = join(homedir(), ".proma-proactive");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}
function isEscapeGlobal() {
  return process.env.PROACTIVE_SCOPE?.trim() === "global";
}
function isSingleLayerMode() {
  return !!process.env.PROMA_MEMORY_DIR?.trim();
}
function normalizeGitRemote(url) {
  const s = url.trim();
  if (!s) return void 0;
  if (/^\.{0,2}\//.test(s) || /^file:\/\//i.test(s)) return void 0;
  let rest = s;
  rest = rest.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
  rest = rest.replace(/^[^@/]+@/, "");
  const hostMatch = rest.match(/^([^:/]+)/);
  const host = hostMatch ? hostMatch[1].toLowerCase() : "";
  let path = rest.slice(host.length).replace(/^[:/]+/, "");
  path = path.replace(/^(\d+)\//, "");
  path = path.replace(/\/+$/, "");
  path = path.replace(/\.git$/, "");
  path = path.replace(/\/+/g, "-").replace(/-+/g, "-");
  if (!host || !path) return void 0;
  return `${host}-${path}`;
}
function sanitizeKeyPart(s) {
  const ascii = s.replace(/[^a-zA-Z0-9._-]/g, "-");
  const hasNonAscii = ascii !== s || /[\u0080-\uFFFF]/.test(s);
  if (!hasNonAscii) {
    return ascii.replace(/-+/g, "-").slice(0, 60);
  }
  const prefix = ascii.replace(/-+/g, "-").slice(0, 40) || "non-ascii";
  return `${prefix}-${sha256Hex(s).slice(0, 8)}`.slice(0, 60);
}
function sha256Hex(input) {
  return createHash("sha256").update(input).digest("hex");
}
function pathHash(absRoot) {
  try {
    const real = realpathSync(absRoot);
    return sha256Hex(normalize(real)).slice(0, 12);
  } catch {
    return sha256Hex(normalize(absRoot)).slice(0, 12);
  }
}
function findProjectRoot(startDir = process.cwd()) {
  let dir = resolve(startDir);
  for (let i = 0; i <= MAX_UP; i++) {
    if (existsSync(join(dir, ".mcp.json"))) return dir;
    if (existsSync(join(dir, ".git"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return resolve(startDir);
}
function gitRemote(projectRoot) {
  try {
    const out = execFileSync("git", ["remote", "-v"], { cwd: projectRoot, encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] });
    const remotes = [];
    for (const line of out.split("\n")) {
      const m = line.match(/^(\S+)\s+(\S+)\s+\((fetch|push)\)/);
      if (m) remotes.push(`${m[1]}	${m[2]}`);
    }
    if (remotes.length === 0) return void 0;
    const byName = /* @__PURE__ */ new Map();
    for (const r of remotes) {
      const [name2, url2] = r.split("	");
      if (!byName.has(name2)) byName.set(name2, url2);
    }
    const pick = (names) => {
      for (const n of names) {
        const v = byName.get(n);
        if (v !== void 0) return v;
      }
      return void 0;
    };
    const url = pick(["origin", "upstream"]);
    if (url) return url;
    const sorted = [...byName.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    return sorted[0]?.[1];
  } catch {
    return void 0;
  }
}
function nearestPackageName(startDir) {
  let dir = resolve(startDir);
  for (let i = 0; i <= MAX_UP; i++) {
    const pkg = join(dir, "package.json");
    if (existsSync(pkg)) {
      try {
        const data = JSON.parse(readFileSync(pkg, "utf-8"));
        if (data.name) return { name: data.name, root: dir };
      } catch {
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return {};
}
function ensureProjectMeta(identity) {
  try {
    if (identity.key === GLOBAL_KEY) return;
    const root = getProjectsRootDir();
    const metaPath = join(root, identity.key, "meta.json");
    if (existsSync(metaPath)) return;
    mkdirSync(dirname(metaPath), { recursive: true });
    const now = Date.now();
    writeFileSync(
      metaPath,
      JSON.stringify(
        { displayName: identity.displayName, identitySource: identity.identitySource, root: identity.root ?? null, firstSeenAt: now, updatedAt: now },
        null,
        2
      ) + "\n",
      "utf-8"
    );
    ensureTopIndex();
  } catch {
  }
}
function getTopIndexPath() {
  return join(configDir(), "index.json");
}
function readTopIndex() {
  try {
    if (!existsSync(getTopIndexPath())) return void 0;
    const raw = readFileSync(getTopIndexPath(), "utf-8");
    return JSON.parse(raw);
  } catch {
    return void 0;
  }
}
function writeTopIndex(index) {
  mkdirSync(configDir(), { recursive: true });
  writeFileSync(getTopIndexPath(), JSON.stringify(index, null, 2) + "\n", "utf-8");
}
function ensureTopIndex() {
  if (readTopIndex()?.schemaVersion === 2) return;
  writeTopIndex({ schemaVersion: 2, defaultScope: "project", projects: [] });
}
function getProjectsRootDir() {
  return join(configDir(), "projects");
}
function resolveProjectKey(opts = {}) {
  if (cachedIdentity) return cachedIdentity;
  const identity = resolveProjectKeyUncached(opts);
  cachedIdentity = identity;
  ensureProjectMeta(identity);
  return identity;
}
function resolveProjectKeyUncached(opts) {
  if (opts.explicit) return { key: sanitizeKeyPart(opts.explicit), displayName: opts.explicit, identitySource: "env" };
  if (process.env.PROACTIVE_PROJECT?.trim()) {
    const name2 = process.env.PROACTIVE_PROJECT.trim();
    return { key: sanitizeKeyPart(name2), displayName: name2, identitySource: "env" };
  }
  if (isEscapeGlobal() || isSingleLayerMode()) {
    return { key: GLOBAL_KEY, displayName: "global", identitySource: "global" };
  }
  const startDir = opts.cwd ?? process.cwd();
  const projectRoot = findProjectRoot(startDir);
  const remote = gitRemote(projectRoot);
  if (remote) {
    const norm = normalizeGitRemote(remote);
    if (norm) {
      return { key: `remote:${sanitizeKeyPart(norm)}`, displayName: norm, identitySource: "git-remote", root: projectRoot };
    }
  }
  const pkg = nearestPackageName(startDir);
  if (pkg.name && pkg.root) {
    const clean = sanitizeKeyPart(pkg.name);
    const suffix = pathHash(pkg.root).slice(0, 4);
    return { key: `name:${clean}-${suffix}`, displayName: pkg.name, identitySource: "package-name", root: pkg.root };
  }
  return { key: `path:${pathHash(projectRoot)}`, displayName: projectRoot, identitySource: "path-hash", root: projectRoot };
}
function currentLayerKey() {
  if (isEscapeGlobal() || isSingleLayerMode()) return GLOBAL_KEY;
  return resolveProjectKey().key;
}
function getProjectMemoryRootDir(key) {
  if (isEscapeGlobal() || isSingleLayerMode()) return join(configDir(), "memory");
  const k = key ?? resolveProjectKey().key;
  return join(getProjectsRootDir(), k, "memory");
}
function getGlobalDir() {
  return join(configDir(), "global");
}
function getGlobalMemoryRootDir() {
  return join(getGlobalDir(), "memory");
}
function getProjectSuggestionsPath(key) {
  if (isEscapeGlobal() || isSingleLayerMode()) return join(configDir(), "suggestions.json");
  const k = key ?? resolveProjectKey().key;
  return join(getProjectsRootDir(), k, "suggestions.json");
}
function getGlobalSuggestionsPath() {
  return join(getGlobalDir(), "suggestions.json");
}
var GLOBAL_KEY;
var cachedIdentity;
var MAX_UP;
var init_project = __esm({
  "src/project.ts"() {
    "use strict";
    GLOBAL_KEY = "__global__";
    cachedIdentity = null;
    MAX_UP = 5;
  }
});
function getConfigDir() {
  const override = process.env.PROACTIVE_DATA_DIR?.trim() || process.env.PROMA_CONFIG_DIR?.trim();
  if (override) {
    if (!existsSync2(override)) {
      mkdirSync2(override, { recursive: true });
    }
    return override;
  }
  const dir = join2(homedir2(), ".proma-proactive");
  if (!existsSync2(dir)) {
    mkdirSync2(dir, { recursive: true });
  }
  return dir;
}
function getMemoryRootDir() {
  const memOverride = process.env.PROMA_MEMORY_DIR?.trim();
  if (memOverride) return memOverride;
  if (isEscapeGlobal()) return join2(getConfigDir(), "memory");
  if (isSingleLayerMode()) return join2(getConfigDir(), "memory");
  return getProjectMemoryRootDir();
}
function getMemoryIndexPath() {
  return join2(getMemoryRootDir(), "index.json");
}
function getPersonaPath() {
  return join2(getMemoryRootDir(), "profile.md");
}
function getMemoryAtomsDir() {
  return join2(getMemoryRootDir(), "atoms");
}
function getMemoryScenesDir() {
  return join2(getMemoryRootDir(), "scenes");
}
function getCorrectionsPath() {
  return join2(getMemoryRootDir(), "corrections.json");
}
function getMemoryLogDir() {
  return join2(getMemoryRootDir(), "memory_log");
}
function getSuggestionsPath() {
  if (isEscapeGlobal() || isSingleLayerMode()) return join2(getConfigDir(), "suggestions.json");
  return getProjectSuggestionsPath();
}
function getProjectKeyPublic(opts) {
  return resolveProjectKey(opts).key;
}
var init_paths = __esm({
  "src/paths.ts"() {
    "use strict";
    init_project();
    init_project();
  }
});
function writeJsonFileAtomic(filePath, data, skipBackup = false) {
  const tmpPath = filePath + ".tmp";
  const bakPath = filePath + ".bak";
  if (!skipBackup && existsSync3(filePath)) {
    try {
      copyFileSync(filePath, bakPath);
    } catch {
    }
  }
  writeFileSync2(tmpPath, JSON.stringify(data, null, 2), "utf-8");
  renameSync2(tmpPath, filePath);
}
function writeTextFileAtomic(filePath, content) {
  const tmpPath = filePath + ".tmp";
  writeFileSync2(tmpPath, content, "utf-8");
  renameSync2(tmpPath, filePath);
}
function readJsonFileSafe(filePath) {
  const tmpPath = filePath + ".tmp";
  const bakPath = filePath + ".bak";
  if (existsSync3(filePath)) {
    try {
      const raw = readFileSync2(filePath, "utf-8");
      if (raw.trim().length > 0) {
        return JSON.parse(raw);
      }
    } catch {
      console.warn(`[\u6570\u636E\u6062\u590D] \u4E3B\u7D22\u5F15\u6587\u4EF6\u635F\u574F: ${filePath}`);
    }
  }
  if (existsSync3(tmpPath)) {
    try {
      const raw = readFileSync2(tmpPath, "utf-8");
      if (raw.trim().length > 0) {
        const parsed = JSON.parse(raw);
        renameSync2(tmpPath, filePath);
        console.log(`[\u6570\u636E\u6062\u590D] \u4ECE .tmp \u6587\u4EF6\u6062\u590D: ${filePath}`);
        return parsed;
      }
    } catch {
    }
    try {
      unlinkSync(tmpPath);
    } catch {
    }
  }
  if (existsSync3(bakPath)) {
    try {
      const raw = readFileSync2(bakPath, "utf-8");
      if (raw.trim().length > 0) {
        const parsed = JSON.parse(raw);
        writeJsonFileAtomic(filePath, parsed, true);
        console.log(`[\u6570\u636E\u6062\u590D] \u4ECE .bak \u6587\u4EF6\u6062\u590D: ${filePath}`);
        return parsed;
      }
    } catch {
      console.error(`[\u6570\u636E\u6062\u590D] .bak \u6587\u4EF6\u4E5F\u635F\u574F: ${bakPath}`);
    }
  }
  return null;
}
var init_safe_file = __esm({
  "src/safe-file.ts"() {
    "use strict";
  }
});
function getTtlDays(type) {
  if (isTtlDisabled()) return null;
  const override = Number(process.env.PROACTIVE_TTL_DAYS);
  if (Number.isFinite(override) && override > 0) return override;
  return DEFAULT_TTL_DAYS[type] ?? null;
}
function isTtlDisabled() {
  const v = process.env.PROACTIVE_TTL_OFF?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}
function isExpired(atom, now = Date.now()) {
  const days = getTtlDays(atom.type);
  if (!days || days <= 0) return false;
  const base = atom.updatedAt || atom.createdAt;
  return now - base > days * 24 * 36e5;
}
function archivePath() {
  return join3(getMemoryRootDir(), "archive", "archive.jsonl");
}
function appendArchive(entry) {
  const p = archivePath();
  mkdirSync3(join3(getMemoryRootDir(), "archive"), { recursive: true });
  const line = JSON.stringify(entry);
  const content = (existsSync4(p) ? readFileSync3(p, "utf-8") : "") + line + "\n";
  writeFileSync3(p, content, "utf-8");
}
function readArchivedCount() {
  try {
    const p = archivePath();
    if (!existsSync4(p)) return 0;
    return readFileSync3(p, "utf-8").split("\n").filter((l) => l.trim()).length;
  } catch {
    return 0;
  }
}
function archiveExpiredAtoms(opts = {}) {
  const now = opts.now ?? Date.now();
  const dryRun = opts.dryRun ?? false;
  const atoms = readAllAtoms({ includeUnconfirmed: false });
  let archived = 0;
  let expiredCount = 0;
  for (const atom of atoms) {
    if (!isExpired(atom, now)) continue;
    expiredCount += 1;
    if (!dryRun) {
      appendArchive({ archivedAt: now, atom });
      deleteAtom(atom.id);
      archived += 1;
    }
  }
  if (!dryRun) writeLastArchiveAt(now);
  return { archived, expiredCount, dryRun, at: now };
}
function lastArchiveAtPath() {
  return join3(getMemoryRootDir(), "archive", ".last-archive");
}
function writeLastArchiveAt(ts) {
  try {
    const p = lastArchiveAtPath();
    mkdirSync3(join3(getMemoryRootDir(), "archive"), { recursive: true });
    writeFileSync3(p, String(ts), "utf-8");
  } catch {
  }
}
function archivedToday(now = Date.now()) {
  try {
    const p = lastArchiveAtPath();
    if (!existsSync4(p)) return false;
    const last = Number(readFileSync3(p, "utf-8"));
    if (!Number.isFinite(last)) return false;
    const d = new Date(now);
    const l = new Date(last);
    return d.getFullYear() === l.getFullYear() && d.getMonth() === l.getMonth() && d.getDate() === l.getDate();
  } catch {
    return false;
  }
}
function maybeArchiveExpired(now = Date.now()) {
  if (isTtlDisabled()) return { archived: 0, expiredCount: 0, dryRun: false, at: now };
  if (archivedToday(now)) return { archived: 0, expiredCount: 0, dryRun: false, at: now };
  return archiveExpiredAtoms({ now });
}
var DEFAULT_TTL_DAYS;
var init_ttl = __esm({
  "src/memory/ttl.ts"() {
    "use strict";
    init_store();
    init_paths();
    DEFAULT_TTL_DAYS = {
      fact: 365,
      preference: null,
      correction: null,
      sop: null,
      todo_context: 90,
      event: 30
    };
  }
});
function localDateKey(ts = Date.now()) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function fingerprintContent(content) {
  return content.toLowerCase().replace(/[\s，。！？、；：""''（）《》【】,.!?;:"'()<>\[\]]/g, "").replace(new RegExp(`(?:${FINGERPRINT_STRIP})`, "g"), "").slice(0, 120);
}
function generateAtomId() {
  return `atom_${Date.now()}_${randomUUID().slice(0, 8)}`;
}
function generateCorrectionId() {
  return `corr_${Date.now()}_${randomUUID().slice(0, 8)}`;
}
function isDuplicate(a, b) {
  if (a.fingerprint && b.fingerprint && a.fingerprint === b.fingerprint) return true;
  const ac = a.content.toLowerCase();
  const bc = b.content.toLowerCase();
  if (ac.length === 0 || bc.length === 0) return false;
  const short = ac.length <= bc.length ? ac : bc;
  const long = ac.length <= bc.length ? bc : ac;
  if (short.length / long.length < 0.6) return false;
  return long.includes(short) || short.includes(long);
}
function ensureMemoryDirs() {
  for (const dir of [getMemoryRootDir(), getMemoryAtomsDir(), getMemoryScenesDir(), getMemoryLogDir()]) {
    if (!existsSync5(dir)) mkdirSync4(dir, { recursive: true });
  }
}
function readIndex() {
  const key = currentLayerKey();
  if (memoryIndexCache.has(key)) return memoryIndexCache.get(key);
  const data = readJsonFileSafe(getMemoryIndexPath());
  if (!data || typeof data.version !== "number") {
    const fresh = { version: INDEX_VERSION, lastExtractionAt: 0, enabled: true, extractionMode: "llm", personaInjectionEnabled: true };
    memoryIndexCache.set(key, fresh);
    return fresh;
  }
  if (data.version > INDEX_VERSION) {
    memoryIndexCache.set(key, data);
    return data;
  }
  const norm = {
    version: INDEX_VERSION,
    lastExtractionAt: data.lastExtractionAt ?? 0,
    enabled: data.enabled ?? true,
    extractionMode: data.extractionMode ?? "llm",
    personaInjectionEnabled: data.personaInjectionEnabled ?? true
  };
  memoryIndexCache.set(key, norm);
  return norm;
}
function writeIndex(index) {
  const key = currentLayerKey();
  try {
    ensureMemoryDirs();
    memoryIndexCache.set(key, index);
    writeJsonFileAtomic(getMemoryIndexPath(), index);
  } catch (error) {
    memoryIndexCache.delete(key);
    console.error("[Memory] \u5199\u5165\u7D22\u5F15\u5931\u8D25:", error);
    throw new Error("\u5199\u5165\u8BB0\u5FC6\u7D22\u5F15\u5931\u8D25");
  }
}
function isMemoryEnabled() {
  return readIndex().enabled;
}
function setMemoryEnabled(enabled) {
  const index = readIndex();
  index.enabled = enabled;
  writeIndex(index);
}
function getExtractionMode() {
  return readIndex().extractionMode ?? "llm";
}
function setExtractionMode(mode) {
  const index = readIndex();
  index.extractionMode = mode;
  writeIndex(index);
}
function isPersonaInjectionEnabled() {
  return readIndex().personaInjectionEnabled ?? true;
}
function setPersonaInjectionEnabled(enabled) {
  const index = readIndex();
  index.personaInjectionEnabled = enabled;
  writeIndex(index);
}
function getLastExtractionAt() {
  return readIndex().lastExtractionAt;
}
function markExtractionCompleted(at = Date.now()) {
  const index = readIndex();
  index.lastExtractionAt = at;
  writeIndex(index);
}
function writeAtom(atom, opts = {}) {
  ensureMemoryDirs();
  const now = Date.now();
  const full = {
    ...atom,
    id: atom.id ?? generateAtomId(),
    createdAt: now,
    updatedAt: now,
    confirmed: atom.confirmed ?? atom.type !== "correction",
    fingerprint: atom.fingerprint ?? fingerprintContent(atom.content),
    scope: opts.scope ?? "project"
  };
  const atomsDir = opts.scope === "global" ? getGlobalAtomsDir() : getMemoryAtomsDir();
  if (!existsSync5(atomsDir)) mkdirSync4(atomsDir, { recursive: true });
  const filePath = join4(atomsDir, localDateKey() + ".jsonl");
  const line = JSON.stringify(full);
  const content = (existsSync5(filePath) ? readFileSync4(filePath, "utf-8") : "") + line + "\n";
  const tmpPath = filePath + ".tmp";
  writeFileSync4(tmpPath, content, "utf-8");
  try {
    renameSync3(tmpPath, filePath);
  } catch (error) {
    console.error("[Memory] \u5199\u5165 atom \u5931\u8D25:", error);
    throw new Error("\u5199\u5165\u8BB0\u5FC6\u6761\u76EE\u5931\u8D25");
  }
  resetIndexCache();
  return full;
}
function readLayerAtoms(layerRoot, opts = {}) {
  if (!existsSync5(layerRoot)) return [];
  const atoms = [];
  for (const file of readdirSync2(layerRoot)) {
    if (!file.endsWith(".jsonl")) continue;
    const filePath = join4(layerRoot, file);
    try {
      const raw = readFileSync4(filePath, "utf-8");
      for (const line of raw.split("\n")) {
        if (!line.trim()) continue;
        try {
          const atom = JSON.parse(line);
          if (!opts.includeUnconfirmed && !atom.confirmed) continue;
          atoms.push(atom);
        } catch {
        }
      }
    } catch {
    }
  }
  return atoms.sort((a, b) => b.createdAt - a.createdAt);
}
function readAllAtoms(opts = {}) {
  const scope = opts.scope ?? "auto";
  if (isSingleLayerMode() || isEscapeGlobal()) {
    return readLayerAtoms(getMemoryAtomsDir(), opts).map((a) => ({ ...a, scope: "project" }));
  }
  if (scope === "global") {
    return readLayerAtoms(getGlobalAtomsDir(), opts).map((a) => ({ ...a, scope: "global" }));
  }
  if (scope === "project") {
    return readLayerAtoms(getMemoryAtomsDir(), opts).map((a) => ({ ...a, scope: "project" }));
  }
  const projectAtoms = readLayerAtoms(getMemoryAtomsDir(), opts).map((a) => ({ ...a, scope: "project" }));
  const globalAtoms = readLayerAtoms(getGlobalAtomsDir(), opts).map((a) => ({ ...a, scope: "global" }));
  const seen = /* @__PURE__ */ new Set();
  const merged = [];
  for (const a of [...projectAtoms, ...globalAtoms]) {
    const fp = a.fingerprint ?? fingerprintContent(a.content);
    if (seen.has(fp)) continue;
    seen.add(fp);
    merged.push(a);
  }
  return merged.sort((a, b) => b.createdAt - a.createdAt);
}
function getGlobalAtomsDir() {
  return join4(getGlobalMemoryRootDir(), "atoms");
}
function getAtomById(id) {
  return readAllAtoms({ includeUnconfirmed: true }).find((a) => a.id === id);
}
function writeAtomWithDedup(atom, opts = {}) {
  const confirmed = atom.confirmed ?? true;
  const scope = opts.scope ?? "project";
  const candidateFingerprint = fingerprintContent(atom.content);
  const layerAtoms = readLayerAtoms(scope === "global" ? getGlobalAtomsDir() : getMemoryAtomsDir(), { includeUnconfirmed: true });
  for (const prev of layerAtoms) {
    const prevFingerprint = prev.fingerprint ?? fingerprintContent(prev.content);
    if (isDuplicate(
      { ...prev, fingerprint: prevFingerprint },
      { ...atom, fingerprint: candidateFingerprint, id: "", createdAt: 0, updatedAt: 0, confirmed: true }
    )) {
      const updated = {
        ...prev,
        content: atom.content.length > prev.content.length ? atom.content : prev.content,
        priority: Math.max(prev.priority, atom.priority ?? 50),
        updatedAt: Date.now(),
        sessionId: atom.sessionId ?? prev.sessionId,
        workspaceSlug: atom.workspaceSlug ?? prev.workspaceSlug,
        scope,
        metadata: { ...prev.metadata ?? {}, ...atom.metadata ?? {} }
      };
      updateAtomById(prev.id, updated, scope);
      return { deduplicated: true, atom: updated, source: scope };
    }
  }
  if (!confirmed) {
    const otherScope = scope === "global" ? "project" : "global";
    const otherAtoms = readLayerAtoms(otherScope === "global" ? getGlobalAtomsDir() : getMemoryAtomsDir(), { includeUnconfirmed: true });
    for (const prev of otherAtoms) {
      const prevFingerprint = prev.fingerprint ?? fingerprintContent(prev.content);
      if (isDuplicate(
        { ...prev, fingerprint: prevFingerprint },
        { ...atom, fingerprint: candidateFingerprint, id: "", createdAt: 0, updatedAt: 0, confirmed: true }
      )) {
        return { deduplicated: true, atom: prev, source: otherScope };
      }
    }
  }
  return { deduplicated: false, atom: writeAtom({ ...atom, scope }, { scope }) };
}
function listPendingAtoms() {
  return readAllAtoms({ includeUnconfirmed: true }).filter((a) => !a.confirmed).sort((a, b) => b.createdAt - a.createdAt);
}
function listAtomsPaged(opts = {}) {
  const { page = 1, pageSize = 20, type = "all", sort = "newest", confirmed } = opts;
  const safePage = Math.max(1, Math.floor(page));
  const safeSize = Math.min(Math.max(1, Math.floor(pageSize)), 100);
  let atoms = readAllAtoms({ includeUnconfirmed: true });
  if (confirmed !== void 0) atoms = atoms.filter((a) => a.confirmed === confirmed);
  if (type !== "all") atoms = atoms.filter((a) => a.type === type);
  atoms = [...atoms].sort(
    (a, b) => sort === "priority" ? (b.priority ?? 0) - (a.priority ?? 0) || b.createdAt - a.createdAt : b.createdAt - a.createdAt
  );
  const total = atoms.length;
  const totalPages = Math.max(1, Math.ceil(total / safeSize));
  const start = (safePage - 1) * safeSize;
  return { atoms: atoms.slice(start, start + safeSize), total, page: safePage, pageSize: safeSize, totalPages };
}
function confirmAtom(id) {
  const atom = getAtomById(id);
  if (!atom) return void 0;
  const updated = { ...atom, confirmed: true, updatedAt: Date.now() };
  updateAtomById(id, updated, atom.scope === "global" ? "global" : "project");
  return updated;
}
function deleteAtom(id) {
  const target = getAtomById(id);
  const atomsDir = target?.scope === "global" ? getGlobalAtomsDir() : getMemoryAtomsDir();
  const files = existsSync5(atomsDir) ? readdirSync2(atomsDir).filter((f) => f.endsWith(".jsonl")) : [];
  for (const file of files) {
    const filePath = join4(atomsDir, file);
    const lines = readFileSync4(filePath, "utf-8").split("\n");
    const kept = lines.filter((line) => {
      if (!line?.trim()) return false;
      try {
        const parsed = JSON.parse(line);
        return parsed.id !== id;
      } catch {
        return true;
      }
    });
    if (kept.length !== lines.length) {
      const tmpPath = filePath + ".tmp";
      writeFileSync4(tmpPath, kept.join("\n"), "utf-8");
      renameSync3(tmpPath, filePath);
      resetIndexCache();
      return true;
    }
  }
  return false;
}
function updateAtomById(id, atom, scope) {
  ensureMemoryDirs();
  const atomsDir = scope === "global" ? getGlobalAtomsDir() : getMemoryAtomsDir();
  const files = existsSync5(atomsDir) ? readdirSync2(atomsDir).filter((f) => f.endsWith(".jsonl")) : [];
  for (const file of files) {
    const filePath = join4(atomsDir, file);
    const lines = readFileSync4(filePath, "utf-8").split("\n");
    let changed = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line?.trim()) continue;
      try {
        const parsed = JSON.parse(line);
        if (parsed.id === id) {
          lines[i] = JSON.stringify(atom);
          changed = true;
          break;
        }
      } catch {
      }
    }
    if (changed) {
      const tmpPath = filePath + ".tmp";
      writeFileSync4(tmpPath, lines.join("\n"), "utf-8");
      renameSync3(tmpPath, filePath);
      resetIndexCache();
      return atom;
    }
  }
  return writeAtom(atom, { scope });
}
function readAllScenes() {
  if (!existsSync5(getMemoryScenesDir())) return [];
  const scenes2 = [];
  for (const file of readdirSync2(getMemoryScenesDir())) {
    if (!file.endsWith(".md")) continue;
    try {
      const data = readJsonFileSafe(join4(getMemoryScenesDir(), file));
      if (data?.scene) scenes2.push(data.scene);
    } catch {
    }
  }
  return scenes2.sort((a, b) => b.updatedAt - a.updatedAt);
}
function readPersonaRaw(scope) {
  const filePath = scope === "global" ? globalPersonaPath() : getPersonaPath();
  if (!existsSync5(filePath)) return void 0;
  try {
    return readFileSync4(filePath, "utf-8");
  } catch {
    return void 0;
  }
}
function globalPersonaPath() {
  return join4(getGlobalMemoryRootDir(), "profile.md");
}
function writePersona(markdown, scope) {
  ensureMemoryDirs();
  const body = markdown.trim();
  const header = `<!-- persona-version: 2 (src traceability) -->

`;
  const content = body.startsWith("<!-- persona-version:") ? body : header + body;
  const filePath = scope === "global" ? globalPersonaPath() : getPersonaPath();
  if (scope === "global") {
    const dir = getGlobalMemoryRootDir();
    if (!existsSync5(dir)) mkdirSync4(dir, { recursive: true });
  }
  writeTextFileAtomic(filePath, content);
}
function isPersonaTraceable() {
  const raw = readPersonaRaw();
  if (!raw) return false;
  return /persona-version:\s*2/.test(raw);
}
function deletePersona(scope) {
  const filePath = scope === "global" ? globalPersonaPath() : getPersonaPath();
  if (!existsSync5(filePath)) return false;
  try {
    unlinkSync2(filePath);
    return true;
  } catch {
    return false;
  }
}
function parsePersonaProfile(raw) {
  if (!raw) return { preferences: [], interactionRules: [], evolution: [], updatedAt: 0 };
  const preferences = [];
  const interactionRules = [];
  const evolution = [];
  let section = "";
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (/^#{1,3}\s+/.test(trimmed)) {
      section = trimmed.replace(/^#{1,3}\s+/, "");
      continue;
    }
    if (!trimmed.startsWith("- ") && !trimmed.startsWith("* ")) continue;
    const item = trimmed.replace(/^[-*]\s+/, "").trim();
    if (!item) continue;
    if (/偏好|preference|喜欢|偏好/i.test(section)) preferences.push(item);
    else if (/交互|协议|规则|protocol|rule|interaction/i.test(section)) interactionRules.push(item);
    else if (/演进|轨迹|evolution|阶段/i.test(section)) evolution.push(item);
  }
  let name2;
  let summary;
  const lines = raw.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i]?.trim() ?? "";
    const next = lines[i + 1]?.trim();
    if (!name2 && /^#+\s*用户/.test(t) && next && !next.startsWith("#")) {
      name2 = next.slice(0, 40);
    }
    if (!summary && /^#+\s*一句话/.test(t) && next && !next.startsWith("#")) {
      summary = next.slice(0, 120);
    }
  }
  return { name: name2, summary, preferences, interactionRules, evolution, updatedAt: Date.now() };
}
function readCorrections(scope) {
  const key = scope === "global" ? GLOBAL_KEY : currentLayerKey();
  if (correctionsCache.has(key)) return correctionsCache.get(key);
  const data = readJsonFileSafe(correctionsPathForScope(scope));
  if (!data || !Array.isArray(data.corrections)) {
    const fresh = { version: CORRECTIONS_VERSION, corrections: [] };
    correctionsCache.set(key, fresh);
    return fresh;
  }
  data.corrections = data.corrections.filter(isValidCorrection).slice(0, MAX_CORRECTIONS);
  correctionsCache.set(key, data);
  return data;
}
function correctionsPathForScope(scope) {
  if (scope === "global") {
    return join4(getGlobalMemoryRootDir(), "corrections.json");
  }
  return getCorrectionsPath();
}
function isValidCorrection(r) {
  if (!r || typeof r !== "object") return false;
  const rec = r;
  return typeof rec.id === "string" && rec.id.length > 0 && typeof rec.rule === "string" && (rec.status === "pending" || rec.status === "active" || rec.status === "rejected" || rec.status === "superseded");
}
function writeCorrections(index, scope) {
  const key = scope === "global" ? GLOBAL_KEY : currentLayerKey();
  try {
    correctionsCache.set(key, index);
    writeJsonFileAtomic(correctionsPathForScope(scope), index);
  } catch (error) {
    correctionsCache.delete(key);
    console.error("[Memory] \u5199\u5165 corrections \u5931\u8D25:", error);
    throw new Error("\u5199\u5165\u884C\u4E3A\u7EA0\u6B63\u5931\u8D25");
  }
}
function addCorrection(input) {
  ensureMemoryDirs();
  const scope = input.scope;
  const index = readCorrections(scope);
  const correction = {
    id: generateCorrectionId(),
    raw: input.raw,
    rule: input.rule,
    sessionId: input.sessionId,
    createdAt: Date.now(),
    status: "pending"
  };
  index.corrections.unshift(correction);
  writeCorrections(index, scope);
  return correction;
}
function listCorrections(status, scope) {
  const index = readCorrections(scope);
  const list = status ? index.corrections.filter((c) => c.status === status) : index.corrections;
  return [...list].sort((a, b) => b.createdAt - a.createdAt);
}
function updateCorrectionStatus(id, status, scope) {
  const index = readCorrections(scope);
  const target = index.corrections.find((c) => c.id === id);
  if (!target) return void 0;
  target.status = status;
  writeCorrections(index, scope);
  return target;
}
function clearAllMemory() {
  if (existsSync5(getMemoryAtomsDir())) {
    for (const file of readdirSync2(getMemoryAtomsDir())) {
      if (file.endsWith(".jsonl")) {
        try {
          unlinkSync2(join4(getMemoryAtomsDir(), file));
        } catch {
        }
      }
    }
  }
  writeCorrections({ version: 1, corrections: [] });
  const profilePath = join4(getMemoryRootDir(), "profile.md");
  if (existsSync5(profilePath)) {
    try {
      unlinkSync2(profilePath);
    } catch {
    }
  }
  resetIndexCache();
}
function getMemoryStats() {
  ensureMemoryDirs();
  const atoms = readAllAtoms({ includeUnconfirmed: true });
  const confirmed = atoms.filter((a) => a.confirmed);
  const byType = {
    fact: 0,
    preference: 0,
    correction: 0,
    sop: 0,
    todo_context: 0,
    event: 0
  };
  for (const a of confirmed) {
    if (byType[a.type] !== void 0) byType[a.type] += 1;
  }
  return {
    atomCount: confirmed.length,
    byType,
    sceneCount: readAllScenes().length,
    pendingCorrections: listCorrections("pending").length,
    pendingAtoms: atoms.filter((a) => !a.confirmed).length,
    personaExists: !!readPersonaRaw(),
    rootDir: getMemoryRootDir(),
    lastExtractionAt: getLastExtractionAt(),
    // M9：归档数（惰性 require 避免与 ttl 的循环依赖；跟随 getGlobalAtomsDir 模式）
    archivedCount: (() => {
      try {
        return readArchivedCount();
      } catch {
        return 0;
      }
    })()
  };
}
function appendMemoryLog(entry) {
  ensureMemoryDirs();
  const filePath = join4(getMemoryLogDir(), `${localDateKey()}.md`);
  const line = `- ${(/* @__PURE__ */ new Date()).toISOString()} ${entry}
`;
  const content = (existsSync5(filePath) ? readFileSync4(filePath, "utf-8") : "") + line;
  writeFileSync4(filePath, content, "utf-8");
}
function readMemoryLogRecent(days = 7, maxEntries = 50) {
  const entries = [];
  const logDir = getMemoryLogDir();
  if (!existsSync5(logDir)) return entries;
  const todayKey = localDateKey();
  for (let i = 0; i < days; i += 1) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1e3);
    const dateKey = localDateKey(d.getTime());
    const filePath = join4(logDir, `${dateKey}.md`);
    if (!existsSync5(filePath)) continue;
    let content = "";
    try {
      content = readFileSync4(filePath, "utf-8");
    } catch {
      continue;
    }
    for (const line of content.split("\n")) {
      const match = line.match(/^\s*-\s+(\S+)\s+(.+)$/);
      if (!match) continue;
      entries.push({ at: match[1], text: match[2].trim(), date: dateKey });
      if (entries.length >= maxEntries) return entries;
    }
  }
  return entries;
}
function getMemoryActivity() {
  const entries = readMemoryLogRecent(30, 200);
  const latestLogAt = entries[0] ? new Date(entries[0].at).getTime() : 0;
  let latestAtomAt = 0;
  const atomsDir = getMemoryAtomsDir();
  if (existsSync5(atomsDir)) {
    try {
      for (const name2 of readdirSync2(atomsDir)) {
        if (!name2.endsWith(".jsonl")) continue;
        try {
          latestAtomAt = Math.max(latestAtomAt, statSync(join4(atomsDir, name2)).mtimeMs);
        } catch {
        }
      }
    } catch {
    }
  }
  const lastUpdatedAt = Math.max(latestLogAt, latestAtomAt);
  const daysSinceLastUpdate = lastUpdatedAt > 0 ? Math.max(0, Math.floor((Date.now() - lastUpdatedAt) / (24 * 60 * 60 * 1e3))) : 0;
  const todayKey = localDateKey();
  let todayEntries = 0;
  const todayLogPath = join4(getMemoryLogDir(), `${todayKey}.md`);
  if (existsSync5(todayLogPath)) {
    try {
      const content = readFileSync4(todayLogPath, "utf-8");
      todayEntries = content.split("\n").filter((l) => /^\s*-\s+\S+\s+/.test(l)).length;
    } catch {
    }
  }
  return { lastUpdatedAt, daysSinceLastUpdate, todayEntries, recentEntries: entries.slice(0, 3) };
}
var INDEX_VERSION;
var FINGERPRINT_STRIP;
var memoryIndexCache;
var correctionsCache;
var CORRECTIONS_VERSION;
var MAX_CORRECTIONS;
var init_store = __esm({
  "src/memory/store.ts"() {
    "use strict";
    init_inverted_index();
    init_paths();
    init_project();
    init_safe_file();
    init_ttl();
    INDEX_VERSION = 1;
    FINGERPRINT_STRIP = "\u4F5C\u4E3A|\u4F7F\u7528|\u91C7\u7528|\u8FDB\u884C|\u9700\u8981|\u5E0C\u671B|\u60F3\u8981|\u5F00\u59CB|\u6253\u7B97|\u5173\u4E8E|\u4EE5\u53CA|\u5E76\u4E14|\u800C\u4E14|\u4F46\u662F|\u56E0\u4E3A|\u6240\u4EE5|\u7136\u540E|\u4E00\u4E2A|\u4E00\u4E9B|\u6211\u4EEC|\u4F60\u4EEC|\u4ED6\u4EEC|\u7684|\u4E86|\u662F|\u548C|\u4E0E|\u53CA|\u6216|\u5728|\u7528|\u505A|\u5B83|\u4ED6|\u5979|\u8FD9|\u90A3|\u4F1A|\u8981|\u80FD|\u53EF\u4EE5|\u5E94\u8BE5|\u53EF\u80FD|\u5927\u6982|\u73B0\u5728|\u4ECA\u5929|\u5E2E|\u8BF7|\u6211|\u4F60";
    memoryIndexCache = /* @__PURE__ */ new Map();
    correctionsCache = /* @__PURE__ */ new Map();
    CORRECTIONS_VERSION = 1;
    MAX_CORRECTIONS = 300;
  }
});
function loadDotEnv(filePath) {
  const result = {};
  if (!existsSync6(filePath)) return result;
  try {
    const raw = readFileSync5(filePath, "utf-8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx <= 0) continue;
      const key = trimmed.slice(0, idx).trim();
      let value = trimmed.slice(idx + 1).trim();
      if (value.startsWith('"') && value.endsWith('"') || value.startsWith("'") && value.endsWith("'")) {
        value = value.slice(1, -1);
      }
      if (key) result[key] = value;
    }
  } catch {
  }
  return result;
}
function findDotEnvUpwards(startDir) {
  let dir = startDir;
  for (let depth = 0; depth < 5; depth++) {
    const env = loadDotEnv(join5(dir, ".env"));
    if (Object.keys(env).length > 0) return env;
    const parent = dirname2(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return {};
}
function getMemoryLlmConfig() {
  if (process.env.PROMA_MEMORY_LLM_DISABLED === "1") return void 0;
  const envVars = process.env;
  const projectEnv = findDotEnvUpwards(process.cwd());
  const homeEnv = loadDotEnv(join5(getConfigDir(), ".env"));
  const sources = [
    { name: "env", vars: envVars },
    { name: "project", vars: projectEnv },
    { name: "home", vars: homeEnv }
  ];
  return resolveMemoryLlmConfig(sources);
}
function resolveMemoryLlmConfig(sources) {
  const primary = sources.find((s) => {
    const key = s.vars[CONFIG_KEYS.apiKey];
    return !!key && key.trim() !== "" && !key.includes("\u5728\u6B64\u586B\u5165");
  });
  if (!primary) return void 0;
  const apiKey = (primary.vars[CONFIG_KEYS.apiKey] ?? "").trim();
  const baseUrlRaw = primary.vars[CONFIG_KEYS.baseUrl]?.trim() || "https://api.deepseek.com/v1";
  const model = primary.vars[CONFIG_KEYS.model]?.trim() || "deepseek-chat";
  if (!isSafeBaseUrl(baseUrlRaw)) return void 0;
  return { apiKey, baseUrl: baseUrlRaw, model };
}
function isSafeBaseUrl(url) {
  if (/[\u0000-\u001f\u007f]/.test(url)) return false;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") {
    const host = parsed.hostname;
    if (host !== "localhost" && host !== "127.0.0.1" && host !== "::1") return false;
  }
  if (parsed.username || parsed.password) return false;
  return true;
}
function isMemoryLlmConfigured() {
  return !!getMemoryLlmConfig();
}
function formatExtractionMessages(messages, maxMessages = 20) {
  const recent = messages.slice(-maxMessages);
  const lines = recent.map((m) => `${m.role === "user" ? "\u7528\u6237" : "\u52A9\u624B"}: ${m.content.slice(0, 800)}`);
  return lines.join("\n");
}
function isInstructionText(content) {
  const t = content.trim();
  if (!t) return false;
  if (!INSTRUCTION_PREFIX.test(t)) return false;
  if (t.length > 40) return true;
  return CODE_HINT.test(t);
}
function parseExtractionResponse(raw) {
  if (!raw) return [];
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) text = fence[1]?.trim() ?? "";
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end <= start) return [];
  const jsonStr = text.slice(start, end + 1);
  try {
    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) return [];
    const result = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const content = typeof item.content === "string" ? item.content.trim() : "";
      if (!content) continue;
      const type = ["fact", "preference", "correction", "sop", "todo_context", "event"].includes(item.type) ? item.type : "fact";
      const priority = typeof item.priority === "number" && Number.isFinite(item.priority) ? Math.min(100, Math.max(0, Math.round(item.priority))) : 50;
      if (isInstructionText(content)) continue;
      result.push({ content, type, priority });
    }
    return result;
  } catch {
    return [];
  }
}
async function callLlm(systemPrompt, userText, opts = {}) {
  const config = getMemoryLlmConfig();
  if (!config) return null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 3e4);
    const response = await fetch(`${config.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userText }
        ],
        temperature: opts.temperature ?? 0.2,
        max_tokens: opts.maxTokens ?? 4096
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.warn("[Memory] LLM \u8BF7\u6C42\u5931\u8D25:", response.status, errText.slice(0, 200));
      return null;
    }
    const data = await response.json();
    return data.choices?.[0]?.message?.content ?? null;
  } catch (error) {
    console.warn("[Memory] LLM \u8C03\u7528\u5F02\u5E38:", error instanceof Error ? error.message : error);
    return null;
  }
}
async function extractCandidates(messages) {
  const config = getMemoryLlmConfig();
  if (!config) return [];
  const inputText = formatExtractionMessages(messages);
  if (!inputText.trim()) return [];
  const raw = await callLlm(EXTRACT_SYSTEM_PROMPT, inputText, { temperature: 0.2, maxTokens: 4096 });
  if (!raw) return [];
  const candidates = parseExtractionResponse(raw);
  return candidates.slice(0, 10);
}
async function extractFromMessages(messages) {
  return extractCandidates(messages);
}
var CONFIG_KEYS;
var EXTRACT_SYSTEM_PROMPT;
var INSTRUCTION_PREFIX;
var CODE_HINT;
var init_extractor = __esm({
  "src/memory/extractor.ts"() {
    "use strict";
    init_paths();
    CONFIG_KEYS = {
      apiKey: "MEMORY_LLM_API_KEY",
      baseUrl: "MEMORY_LLM_BASE_URL",
      model: "MEMORY_LLM_MODEL"
    };
    EXTRACT_SYSTEM_PROMPT = `\u4F60\u662F\u957F\u671F\u8BB0\u5FC6\u63D0\u53D6\u5668\u3002\u4ECE\u5BF9\u8BDD\u4E2D\u63D0\u53D6\u503C\u5F97\u957F\u671F\u8BB0\u4F4F\u7684\u7ED3\u6784\u5316\u8BB0\u5FC6\u3002

\u89C4\u5219\uFF1A
1. \u53EA\u63D0\u53D6\u5BF9\u8BDD\u4E2D"\u660E\u786E\u51FA\u73B0"\u7684\u4FE1\u606F\uFF0C\u7981\u6B62\u63A8\u6D4B\u3001\u7F16\u9020\u6216\u8865\u5145\u5E38\u8BC6\u3002
2. \u6BCF\u6761\u8BB0\u5FC6\u5FC5\u987B\u81EA\u5305\u542B\u3001\u7B80\u6D01\u3001\u53EF\u72EC\u7ACB\u7406\u89E3\uFF08\u4E00\u53E5\u8BDD\uFF0C\u901A\u5E38 10-60 \u5B57\uFF09\u3002
3. \u7C7B\u578B\u53EA\u80FD\u662F\u4EE5\u4E0B\u4E4B\u4E00\uFF1A
   - fact: \u5BA2\u89C2\u4E8B\u5B9E\uFF08\u7528\u6237\u8EAB\u4EFD\u3001\u9879\u76EE\u4FE1\u606F\u3001\u6280\u672F\u9009\u578B\u3001\u73AF\u5883\u7B49\uFF09
   - preference: \u7528\u6237\u504F\u597D\uFF08\u559C\u6B22\u7684\u8BED\u8A00/\u5DE5\u5177/\u98CE\u683C/\u5DE5\u4F5C\u65B9\u5F0F\uFF09
   - correction: \u884C\u4E3A\u7EA0\u6B63\uFF08\u7528\u6237\u6307\u51FA Agent \u7684\u9519\u8BEF\u6216\u6539\u8FDB\u8981\u6C42\uFF09
   - sop: \u53EF\u590D\u7528\u6D41\u7A0B\uFF08\u91CD\u590D\u51FA\u73B0\u7684\u6B65\u9AA4\u3001\u7EA6\u5B9A\uFF09
   - todo_context: \u4EFB\u52A1\u4E0A\u4E0B\u6587\uFF08\u6B63\u5728\u8FDB\u884C\u6216\u8BA1\u5212\u7684\u5DE5\u4F5C\uFF09
   - event: \u7ED3\u6784\u5316\u4E8B\u4EF6\uFF08\u201CX \u65F6\u95F4\u505A\u4E86 Y / \u9879\u76EE\u8FDB\u5165 Z \u72B6\u6001 / \u53D1\u5E03\u4E86\u67D0\u7248\u672C\u201D\uFF0C\u6709\u65F6\u95F4\u6027\uFF0C\u5C3D\u91CF\u5E26\u4E0A\u65F6\u95F4\u4E0E\u4E3B\u4F53\uFF09
4. \u91CD\u8981\u5EA6 priority 0-100\uFF1A\u5F71\u54CD\u540E\u7EED\u5DE5\u4F5C\u7684\u5173\u952E\u7EA6\u675F\u7ED9 80+\uFF0C\u666E\u901A\u80CC\u666F 50\uFF0C\u7410\u788E 30 \u4EE5\u4E0B\u3002
5. \u4E00\u6761\u6D88\u606F\u6700\u591A\u8F93\u51FA 3 \u6761\u8BB0\u5FC6\uFF1B\u65E0\u503C\u5F97\u8BB0\u5FC6\u7684\u5185\u5BB9\u65F6\u8F93\u51FA\u7A7A\u6570\u7EC4\u3002
6. \u8F93\u51FA\u5FC5\u987B\u662F\u5408\u6CD5 JSON \u6570\u7EC4\uFF0C\u683C\u5F0F\uFF1A[{"content": "...", "type": "fact", "priority": 60}]
7. \u53EA\u8F93\u51FA JSON \u6570\u7EC4\u672C\u8EAB\uFF0C\u4E0D\u8981\u8F93\u51FA\u4EFB\u4F55\u89E3\u91CA\u3001\u524D\u540E\u7F00\u6216 markdown \u56F4\u680F\u3002`;
    INSTRUCTION_PREFIX = /^(?:请|帮我|帮|麻烦|运行|执行|继续|开发|创建|新建|修复|添加|实现|使用|调用|写|用|替换|修改|删除|重构|优化)/;
    CODE_HINT = /[（(][^）)]*[0-9][^）)]*[）)]|\.(?:serve|listen|create|read|write|run)\(|memory_|端口|路由|server|API|目录|命令|路径|\/\w+\//;
  }
});
var embedding_exports = {};
__export(embedding_exports, {
  LOCAL_EMBEDDING_MODEL: () => LOCAL_EMBEDDING_MODEL,
  cosineSimilarity: () => cosineSimilarity,
  getEmbeddingMode: () => getEmbeddingMode,
  getEmbeddingProvider: () => getEmbeddingProvider,
  isLocalEmbeddingReady: () => isLocalEmbeddingReady
});
function getEmbeddingMode() {
  const mode = process.env.PROMA_MEMORY_EMBEDDING?.trim().toLowerCase();
  if (mode === "local") return "local";
  if (mode === "api") return "api";
  return "off";
}
function isLocalEmbeddingReady() {
  return existsSync7(LOCAL_EMBEDDING_MODEL);
}
async function importLlama() {
  const candidates = [
    "node-llama-cpp",
    join6("/Users/moxianbao/.proma/agent-workspaces/tencentdb/workspace-files/TencentDB-Agent-Memory/node_modules/node-llama-cpp", "dist", "index.js")
  ];
  for (const mod of candidates) {
    try {
      return await import(mod);
    } catch {
    }
  }
  throw new Error("node-llama-cpp \u672A\u5B89\u88C5\uFF0C\u65E0\u6CD5\u4F7F\u7528\u672C\u5730 embedding");
}
async function initLocalEmbedding() {
  if (!isLocalEmbeddingReady()) {
    console.warn("[Memory] \u672C\u5730 embedding \u6A21\u578B\u4E0D\u5B58\u5728:", LOCAL_EMBEDDING_MODEL);
    return null;
  }
  if (localContext) return localContext;
  if (localInitPromise) return localInitPromise;
  localInitPromise = (async () => {
    try {
      const { getLlama, resolveModelFile, LlamaLogLevel } = await importLlama();
      const llama = await getLlama({ logLevel: LlamaLogLevel.error, gpu: false });
      const resolvedPath = await resolveModelFile(LOCAL_EMBEDDING_MODEL);
      const model = await llama.loadModel({ modelPath: resolvedPath });
      localContext = await model.createEmbeddingContext();
      console.log("[Memory] \u672C\u5730 embedding \u5C31\u7EEA (embeddinggemma-300m, 768d)");
      return localContext;
    } catch (error) {
      console.warn("[Memory] \u672C\u5730 embedding \u521D\u59CB\u5316\u5931\u8D25:", error instanceof Error ? error.message : error);
      return null;
    }
  })();
  return localInitPromise;
}
async function apiEmbed(texts) {
  const config = getMemoryLlmConfig();
  if (!config) return null;
  try {
    const resp = await fetch(`${config.baseUrl.replace(/\/+$/, "")}/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({ model: process.env.MEMORY_EMBEDDING_MODEL ?? "text-embedding-3-small", input: texts })
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.data?.map((d) => d.embedding) ?? null;
  } catch {
    return null;
  }
}
function getEmbeddingProvider() {
  const mode = getEmbeddingMode();
  if (mode === "off") return null;
  if (cachedProvider !== void 0) return cachedProvider;
  if (mode === "local") {
    if (!isLocalEmbeddingReady()) {
      console.warn("[Memory] \u672C\u5730 embedding \u6A21\u578B\u7F3A\u5931\uFF0C\u964D\u7EA7\u4E3A keyword \u53EC\u56DE");
      cachedProvider = null;
      return null;
    }
    cachedProvider = {
      async embed(text) {
        const ctx = await initLocalEmbedding();
        if (!ctx) return null;
        try {
          const trimmed = text.slice(0, LOCAL_MAX_INPUT_CHARS);
          const result = await ctx.getEmbeddingFor(trimmed);
          return Array.isArray(result) ? result : Array.from(result.vector ?? []);
        } catch {
          return null;
        }
      },
      async embedBatch(texts) {
        return Promise.all(texts.map((t) => this.embed(t)));
      },
      ready: () => true,
      dimensions: LOCAL_DIMENSIONS
    };
    return cachedProvider;
  }
  if (mode === "api") {
    cachedProvider = {
      async embed(text) {
        const result = await apiEmbed([text]);
        return result?.[0] ?? null;
      },
      async embedBatch(texts) {
        const result = await apiEmbed(texts);
        return result ?? texts.map(() => null);
      },
      ready: () => !!getMemoryLlmConfig(),
      dimensions: 1536
    };
    return cachedProvider;
  }
  return null;
}
function cosineSimilarity(a, b) {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
var LOCAL_EMBEDDING_MODEL;
var LOCAL_DIMENSIONS;
var LOCAL_MAX_INPUT_CHARS;
var localContext;
var localInitPromise;
var cachedProvider;
var init_embedding = __esm({
  "src/memory/embedding.ts"() {
    "use strict";
    init_extractor();
    LOCAL_EMBEDDING_MODEL = join6(
      homedir3(),
      ".node-llama-cpp",
      "models",
      "hf_ggml-org_embeddinggemma-300m-qat-Q8_0.gguf"
    );
    LOCAL_DIMENSIONS = 768;
    LOCAL_MAX_INPUT_CHARS = 500;
    localContext = null;
    localInitPromise = null;
    cachedProvider = void 0;
  }
});
function parseRewriteResponse(raw) {
  if (!raw) return [];
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) text = fence[1]?.trim() ?? text;
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end <= start) return [];
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((q) => typeof q === "string" && q.trim().length >= 2).filter((q) => !/未明确|需更多|无法|不确定|需要提供/.test(q)).map((q) => q.trim()).slice(0, 3);
  } catch {
    return [];
  }
}
function ruleExpandQuery(query) {
  const extra = [];
  for (const { pattern, expansions } of RULE_SYNONYMS) {
    if (pattern.test(query)) {
      extra.push(...expansions);
    }
  }
  return [...new Set(extra)].slice(0, 5);
}
async function rewriteQuery(query) {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const cached = cache.get(trimmed);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.queries;
  }
  if (trimmed.length < 4) return [trimmed];
  const ruleExtra = ruleExpandQuery(trimmed);
  try {
    const raw = await callLlm(REWRITE_SYSTEM_PROMPT, trimmed, { temperature: 0.2, maxTokens: 512, timeoutMs: 15e3 });
    const queries = raw ? parseRewriteResponse(raw) : [];
    const combined = [.../* @__PURE__ */ new Set([trimmed, ...queries, ...ruleExtra])].slice(0, 5);
    if (combined.length > 1) {
      if (cache.size >= MAX_CACHE_SIZE) cache.clear();
      cache.set(trimmed, { queries: combined, expiresAt: Date.now() + CACHE_TTL_MS });
      return combined;
    }
    return [trimmed];
  } catch {
    const combined = [.../* @__PURE__ */ new Set([trimmed, ...ruleExtra])].slice(0, 5);
    return combined.length > 1 ? combined : [trimmed];
  }
}
var REWRITE_SYSTEM_PROMPT;
var cache;
var CACHE_TTL_MS;
var MAX_CACHE_SIZE;
var RULE_SYNONYMS;
var init_query_rewriter = __esm({
  "src/memory/query-rewriter.ts"() {
    "use strict";
    init_extractor();
    REWRITE_SYSTEM_PROMPT = `\u4F60\u662F\u68C0\u7D22\u67E5\u8BE2\u6539\u5199\u5668\u3002\u628A\u7528\u6237\u7684\u81EA\u7136\u8BED\u8A00\u95EE\u53E5\u6539\u5199\u4E3A 2-3 \u4E2A\u68C0\u7D22\u67E5\u8BE2\uFF0C\u7528\u4E8E\u5728\u957F\u671F\u8BB0\u5FC6\u4E2D\u7CBE\u786E\u68C0\u7D22\u3002

\u89C4\u5219\uFF1A
1. \u8F93\u51FA\u5FC5\u987B ONLY \u662F JSON \u5B57\u7B26\u4E32\u6570\u7EC4\uFF0C\u4E0D\u8981\u4EFB\u4F55\u5176\u4ED6\u6587\u5B57\u3001\u89E3\u91CA\u6216 markdown \u56F4\u680F\u3002
2. \u683C\u5F0F\u4E25\u683C\u5982\uFF1A["\u5206\u6BB5\u9501","ShopGo \u8BA2\u5355\u62C6\u5206\u9501"]
3. \u6539\u5199\u76EE\u6807\uFF1A\u63D0\u53D6\u95EE\u53E5\u4E2D\u7684\u5173\u952E\u5B9E\u4F53 + \u540C\u4E49\u8BCD/\u4E0B\u4F4D\u8BCD\uFF08\u5982"\u9501"\u2192"\u5206\u6BB5\u9501/\u5206\u5E03\u5F0F\u9501/\u5168\u5C40\u9501"\uFF09\u3002
4. \u67E5\u8BE2\u8981\u77ED\uFF083-12 \u5B57\uFF09\uFF0C\u76F4\u63A5\u53EF\u68C0\u7D22\uFF0C\u4E0D\u8981\u5305\u542B\u7591\u95EE\u8BCD\uFF08\u4EC0\u4E48/\u600E\u4E48/\u4E3A\u4EC0\u4E48/\u662F\u5426\uFF09\u3002
5. \u7B2C\u4E00\u4E2A\u67E5\u8BE2\u4FDD\u7559\u539F\u95EE\u53E5\u6838\u5FC3\u5B9E\u4F53\uFF0C\u540E\u7EED\u67E5\u8BE2\u8865\u5145\u540C\u4E49/\u8FD1\u4E49/\u4E0B\u4F4D\u8BCD\u8868\u8FBE\u3002
6. \u7981\u6B62\u8F93\u51FA\u89E3\u91CA\u6027\u53E5\u5B50\uFF0C\u7981\u6B62\u8F93\u51FA"\u672A\u660E\u786E/\u9700\u66F4\u591A\u4E0A\u4E0B\u6587"\u4E4B\u7C7B\u7684\u5185\u5BB9\uFF1B\u53EA\u8F93\u51FA\u67E5\u8BE2\u8BCD\u3002

\u793A\u4F8B\uFF1A
\u7528\u6237\u95EE\uFF1AShopGo \u8BA2\u5355\u62C6\u5206\u7528\u4EC0\u4E48\u9501\uFF1F
\u8F93\u51FA\uFF1A["ShopGo\u8BA2\u5355\u62C6\u5206\u9501","\u8BA2\u5355\u62C6\u5206 \u5206\u5E03\u5F0F\u9501","\u5206\u6BB5\u9501"]`;
    cache = /* @__PURE__ */ new Map();
    CACHE_TTL_MS = 10 * 60 * 1e3;
    MAX_CACHE_SIZE = 200;
    RULE_SYNONYMS = [
      { pattern: /锁/, expansions: ["\u5206\u6BB5\u9501", "\u5206\u5E03\u5F0F\u9501", "\u5168\u5C40\u9501", "\u9501\u7C7B\u578B"] },
      { pattern: /语言|技术栈|用什么(?:语言|技术)/, expansions: ["typescript", "rust", "golang", "python", "java"] },
      { pattern: /编辑器/, expansions: ["prosemirror", "editor"] },
      { pattern: /压测|性能测试/, expansions: ["k6", "\u538B\u6D4B\u811A\u672C"] },
      { pattern: /缓存/, expansions: ["\u7F13\u5B58key", "\u7F13\u5B58\u9694\u79BB", "cache"] },
      { pattern: /并行|并发/, expansions: ["worker", "worker_threads", "\u5E76\u53D1\u63A7\u5236"] },
      { pattern: /工作习惯|工作方式/, expansions: ["lint", "\u6D4B\u8BD5", "\u63D0\u4EA4"] },
      { pattern: /编辑器/, expansions: ["prosemirror", "\u7F16\u8F91\u5668"] }
    ];
  }
});
function scoreAtom(atom, terms, docFreq, totalDocs) {
  const text = `${atom.content} ${atom.type} ${atom.metadata?.tags ?? ""}`.toLowerCase();
  const tokens = tokenize(text);
  const tf = /* @__PURE__ */ new Map();
  for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
  const avgLen = Math.max(1, tokens.length);
  let score = 0;
  const matched = [];
  for (const term of terms) {
    const freq = tf.get(term) ?? 0;
    if (freq === 0) continue;
    const df = docFreq.get(term) ?? 1;
    const idf = Math.log(1 + (totalDocs - df + 0.5) / (df + 0.5));
    const k1 = 1.2;
    const b = 0.75;
    const tfNorm = freq * (k1 + 1) / (freq + k1 * (1 - b + b * (avgLen / Math.max(1, totalDocs))));
    const charWeight = term.length === 1 && CJK_RE.test(term) ? 0.15 : 1;
    score += idf * tfNorm * charWeight;
    matched.push(term);
  }
  return { score, matched };
}
function hasRecallIntent(query) {
  const lower = query.toLowerCase();
  return RECALL_INTENT_WORDS.some((w) => lower.includes(w));
}
function normalizeScore(score, maxScore) {
  if (maxScore <= 0) return 0;
  return score / maxScore;
}
function ruleBoost(atom) {
  let boost = 0;
  if (atom.type === "fact" && /我叫|我是|名字|姓名|独立开发者|从事|负责|做.*开发/.test(atom.content)) {
    boost += 0.15;
  } else if (atom.type === "preference") {
    boost += 0.08;
  }
  if ((atom.priority ?? 0) >= 70) boost += 0.05;
  return boost;
}
function timeDecay(atom, now = Date.now()) {
  if (STABLE_TYPES.has(atom.type)) return 1;
  const days = Math.max(0, (now - atom.createdAt) / 864e5);
  if (atom.type === "event") {
    const eventHalfLife = Number(process.env.EVENT_HALF_LIFE_DAYS) > 0 ? Number(process.env.EVENT_HALF_LIFE_DAYS) : EVENT_HALF_LIFE_DAYS;
    return Math.pow(0.5, days / eventHalfLife);
  }
  const halfLife = Number(process.env.MEMORY_HALF_LIFE_DAYS) > 0 ? Number(process.env.MEMORY_HALF_LIFE_DAYS) : MEMORY_HALF_LIFE_DAYS;
  return Math.pow(0.5, days / halfLife);
}
function searchMemoriesByKeyword(request) {
  const started = Date.now();
  const query = request.query.trim();
  const limit = Math.min(Math.max(request.limit ?? DEFAULT_RECALL_LIMIT, 1), MAX_RECALL_LIMIT);
  maybeArchiveExpired();
  const allAtoms = readAllAtoms({ includeUnconfirmed: request.includeUnconfirmed === true, scope: request.scope ?? "auto" });
  if (!query) {
    const hits2 = allAtoms.slice(0, limit).map((atom) => ({
      atom,
      score: 1,
      matchedTerms: []
    }));
    return { query, hits: hits2, strategy: "latest", durationMs: Date.now() - started };
  }
  const terms = expandedQueryTerms(query);
  if (terms.length === 0) {
    const hits2 = allAtoms.slice(0, limit).map((atom) => ({
      atom,
      score: 0.5,
      matchedTerms: []
    }));
    return { query, hits: hits2, strategy: "latest", durationMs: Date.now() - started };
  }
  const effectiveMinScore = terms.length <= 1 ? RECALL_MIN_SCORE * 0.3 : RECALL_MIN_SCORE;
  const totalDocs = Math.max(1, allAtoms.length);
  const index = getIndexFor(allAtoms);
  const candidateIds = lookupCandidates(index, terms);
  const scoredSource = candidateIds.size > 0 ? allAtoms.filter((a) => candidateIds.has(a.id)) : allAtoms;
  const docFreq = /* @__PURE__ */ new Map();
  for (const atom of scoredSource) {
    const tokens = new Set(tokenize(`${atom.content} ${atom.type}`.toLowerCase()));
    for (const t of tokens) docFreq.set(t, (docFreq.get(t) ?? 0) + 1);
  }
  const scored = scoredSource.map((atom) => ({ atom, ...scoreAtom(atom, terms, docFreq, totalDocs) })).filter((r) => r.score > 0).sort((a, b) => b.score * timeDecay(b.atom) + ruleBoost(b.atom) - (a.score * timeDecay(a.atom) + ruleBoost(a.atom)) || b.atom.createdAt - a.atom.createdAt);
  const maxScore = scored.length > 0 ? scored[0].score : 0;
  let hits = scored.map((r) => {
    const hasStrongTerm = r.matched.some((t) => t.length >= 2);
    let score = normalizeScore(r.score, maxScore);
    if (!hasStrongTerm) score *= 0.1;
    if (r.atom.scope === "global") score *= SHARED_PENALTY;
    return {
      atom: r.atom,
      score,
      rawScore: r.score,
      // 保留绝对分供 hybrid 真相关判断
      matchedTerms: r.matched,
      scope: r.atom.scope
    };
  }).filter((h) => h.score >= effectiveMinScore).slice(0, limit);
  if (hits.length === 0 && hasRecallIntent(query) && allAtoms.length > 0) {
    const sorted = [...allAtoms].sort((a, b) => {
      const boostDiff = ruleBoost(b) - ruleBoost(a);
      if (boostDiff !== 0) return boostDiff;
      const factDiff = (b.type === "fact" ? 1 : 0) - (a.type === "fact" ? 1 : 0);
      if (factDiff !== 0) return factDiff;
      return (b.priority ?? 0) - (a.priority ?? 0) || b.createdAt - a.createdAt;
    });
    hits = sorted.slice(0, Math.min(limit, 3)).map((atom) => ({
      atom,
      score: 0.5,
      matchedTerms: []
    }));
    return { query, hits, strategy: "fallback", durationMs: Date.now() - started };
  }
  return { query, hits, strategy: "keyword", durationMs: Date.now() - started };
}
function truncateAtom(atom) {
  if (atom.content.length <= MAX_RECALL_ATOM_CHARS) return atom.content;
  return `${atom.content.slice(0, MAX_RECALL_ATOM_CHARS)}\u2026\uFF08\u5DF2\u622A\u65AD\uFF09`;
}
function formatRecallContext(result) {
  if (result.hits.length === 0) return "";
  const lines = result.hits.map((hit) => {
    const tag = hit.atom.type;
    const time = new Date(hit.atom.createdAt).toISOString().slice(0, 10);
    const strength = hit.score >= 0.6 ? "rel=high" : hit.score >= 0.3 ? "rel=mid" : "rel=low";
    const shared = hit.scope === "global" || hit.atom.scope === "global" ? " [shared]" : "";
    return `- [${tag}|${time}|${strength}${shared}] ${truncateAtom(hit.atom)}`;
  });
  let block = lines.join("\n");
  if (block.length > MAX_RECALL_BLOCK_CHARS) {
    block = block.slice(0, MAX_RECALL_BLOCK_CHARS) + "\n\u2026\uFF08\u8BB0\u5FC6\u5185\u5BB9\u8F83\u591A\uFF0C\u5DF2\u622A\u65AD\uFF1B\u53EF\u7528 memory_search \u5DE5\u5177\u68C0\u7D22\u66F4\u591A\uFF09";
  }
  return block;
}
function buildMemoryContextForMessage(userText, opts = {}) {
  const result = searchMemoriesByKeyword({ query: userText, limit: opts.limit ?? DEFAULT_RECALL_LIMIT });
  if (result.hits.length === 0) return "";
  const body = formatRecallContext(result);
  if (!body) return "";
  return `<memory_context strategy="${result.strategy}" durationMs="${result.durationMs}">
${body}
</memory_context>`;
}
function rrfMerge(lists, k = 60) {
  const merged = /* @__PURE__ */ new Map();
  for (const list of lists) {
    list.forEach((item, rank) => {
      const existing = merged.get(item.atom.id);
      const contribution = 1 / (k + rank + 1);
      if (existing) {
        existing.score += contribution;
        existing.sources += 1;
      } else {
        merged.set(item.atom.id, { atom: item.atom, score: contribution, sources: 1 });
      }
    });
  }
  return merged;
}
async function searchMemoriesHybrid(request) {
  const started = Date.now();
  const query = request.query.trim();
  const limit = Math.min(Math.max(request.limit ?? DEFAULT_RECALL_LIMIT, 1), MAX_RECALL_LIMIT);
  const allAtoms = readAllAtoms({ includeUnconfirmed: request.includeUnconfirmed === true, scope: request.scope ?? "auto" });
  if (!query || allAtoms.length === 0) {
    const hits2 = allAtoms.slice(0, limit).map((atom) => ({
      atom,
      score: 1,
      matchedTerms: []
    }));
    return { query, hits: hits2, strategy: "latest", durationMs: Date.now() - started };
  }
  const kwResult = searchMemoriesByKeyword({ query, limit: Math.max(limit, 10), includeUnconfirmed: request.includeUnconfirmed });
  const kwIds = new Set(kwResult.hits.map((r) => r.atom.id));
  const kwList = kwResult.hits.filter((h) => (h.rawScore ?? h.score) >= 1).map((h) => ({ atom: h.atom, score: h.score }));
  const rwHitIdsAll = /* @__PURE__ */ new Set();
  const rwRealIds = /* @__PURE__ */ new Set();
  let rwList = [];
  try {
    if (kwList.length > 0) {
      const rewritten = await rewriteQuery(query);
      if (rewritten.length > 1) {
        const rwSeen = /* @__PURE__ */ new Set();
        for (const rw of rewritten) {
          if (rw === query || rwSeen.has(rw)) continue;
          rwSeen.add(rw);
          const rwResult = searchMemoriesByKeyword({ query: rw, limit: Math.max(limit, 8), includeUnconfirmed: request.includeUnconfirmed });
          for (const h of rwResult.hits) {
            rwHitIdsAll.add(h.atom.id);
            if ((h.rawScore ?? h.score) >= 1) rwRealIds.add(h.atom.id);
            if ((h.rawScore ?? h.score) < 1) continue;
            rwList.push({ atom: h.atom, score: h.score * 0.8 });
          }
        }
        const seen = /* @__PURE__ */ new Set();
        rwList = rwList.filter((r) => {
          if (seen.has(r.atom.id)) return false;
          seen.add(r.atom.id);
          return true;
        }).sort((a, b) => b.score - a.score).slice(0, Math.max(limit, 8));
      }
    }
  } catch (error) {
    console.warn("[Memory] \u67E5\u8BE2\u6539\u5199\u5931\u8D25\uFF0C\u8DF3\u8FC7\u8865\u5145\u53EC\u56DE:", error instanceof Error ? error.message : error);
  }
  const kwPlusRwIds = /* @__PURE__ */ new Set([...kwIds, ...rwList.map((r) => r.atom.id)]);
  const provider = getEmbeddingProvider();
  let embList = [];
  if (provider && kwList.length > 0) {
    const queryVec = await provider.embed(query);
    if (queryVec) {
      const batch = await provider.embedBatch(allAtoms.slice(0, 80).map((a) => a.content.slice(0, 200)));
      const scored = [];
      for (let i = 0; i < batch.length; i++) {
        const vec = batch[i];
        if (!vec) continue;
        const sim = cosineSimilarity(queryVec, vec);
        if (sim > 0.68) scored.push({ atom: allAtoms[i], score: sim });
      }
      embList = scored.filter((r) => !kwPlusRwIds.has(r.atom.id)).sort((a, b) => b.score - a.score).slice(0, Math.max(limit, 15));
    }
  }
  const ruleKwIds = new Set(kwResult.hits.map((h) => h.atom.id));
  const ruleList = kwList.length > 0 ? [...allAtoms].map((atom) => ({ atom, score: ruleBoost(atom) })).filter((r) => r.score >= 0.08 && ruleKwIds.has(r.atom.id)).sort((a, b) => b.score - a.score).slice(0, Math.max(limit, 5)) : [];
  const merged = rrfMerge([kwList, rwList, embList, ruleList]);
  const maxScore = merged.size > 0 ? Math.max(...[...merged.values()].map((v) => v.score)) : 0;
  const kwHitIds = new Set(kwList.map((r) => r.atom.id));
  const rwHitIds = rwRealIds;
  const embHitIds = new Set(embList.map((r) => r.atom.id));
  const sourceWeight = /* @__PURE__ */ new Map();
  for (const item of merged.values()) {
    let w = 0;
    if (kwHitIds.has(item.atom.id)) w = Math.max(w, 1);
    if (rwHitIds.has(item.atom.id)) w = Math.max(w, 1.15);
    if (embHitIds.has(item.atom.id)) w = Math.max(w, 0.4);
    if (ruleBoost(item.atom) > 0) w = Math.max(w, 0.2);
    sourceWeight.set(item.atom.id, w);
  }
  const hits = [...merged.values()].map((item) => {
    const w = sourceWeight.get(item.atom.id) ?? 0;
    const rrfNorm = maxScore > 0 ? item.score / maxScore : 0;
    const finalScore = w + rrfNorm * 0.3;
    return {
      atom: item.atom,
      score: finalScore,
      matchedTerms: []
    };
  }).sort((a, b) => b.score - a.score).slice(0, limit);
  let filtered = hits.filter((h) => h.score >= 0.35);
  if (filtered.length > 1) {
    const clusterKey = (atom) => {
      const content = atom.content.toLowerCase();
      const project = ["codelens", "shopgo", "docflow", "proma"].find((p) => content.includes(p)) ?? "";
      const enWords = content.match(/[a-z][a-z0-9_]{2,}/g) ?? [];
      const noise = /用户|已经|完成|需要|要求|实现|使用|做了|计划|准备|今天|今日|支持|用于|增加|添加|优化|解决|处理|避免|进行|开始|正在|问题|性能|功能|项目|方案|代码|方式|方法|时候|可以|会|要|能|到|和|与|在|把|被|让|给/;
      const zhWords = (content.match(/[\u4e00-\u9fff]{2,4}/g) ?? []).filter((w) => !noise.test(w)).sort((a, b) => b.length - a.length).slice(0, 2);
      const entities = [.../* @__PURE__ */ new Set([...enWords.slice(0, 2), ...zhWords])].join("|");
      return `${project}:${entities}`;
    };
    const seenCluster = /* @__PURE__ */ new Map();
    const kept = [];
    for (const h of filtered) {
      const key = clusterKey(h.atom);
      const existing = seenCluster.get(key);
      if (existing !== void 0 && existing >= 2) {
        h.score = 0.1;
      } else if (existing !== void 0) {
        seenCluster.set(key, existing + 1);
        kept.push(h);
      } else {
        seenCluster.set(key, 1);
        kept.push(h);
      }
    }
    filtered = kept.filter((h) => h.score >= 0.35).sort((a, b) => b.score - a.score).slice(0, limit);
  }
  const hasRealKw = kwResult.hits.some((h) => (h.rawScore ?? h.score) >= 1);
  if (filtered.length === 0 && hasRealKw) {
    return kwResult;
  }
  return { query, hits: filtered, strategy: "hybrid", durationMs: Date.now() - started };
}
var DEFAULT_RECALL_LIMIT;
var MAX_RECALL_LIMIT;
var MAX_RECALL_ATOM_CHARS;
var MAX_RECALL_BLOCK_CHARS;
var RECALL_MIN_SCORE;
var SHARED_PENALTY;
var RECALL_INTENT_WORDS;
var MEMORY_HALF_LIFE_DAYS;
var EVENT_HALF_LIFE_DAYS;
var STABLE_TYPES;
var init_recall = __esm({
  "src/memory/recall.ts"() {
    "use strict";
    init_store();
    init_embedding();
    init_query_rewriter();
    init_tokens();
    init_inverted_index();
    init_ttl();
    init_tokens();
    DEFAULT_RECALL_LIMIT = 5;
    MAX_RECALL_LIMIT = 20;
    MAX_RECALL_ATOM_CHARS = 300;
    MAX_RECALL_BLOCK_CHARS = 2e3;
    RECALL_MIN_SCORE = 0.12;
    SHARED_PENALTY = 0.8;
    RECALL_INTENT_WORDS = ["\u8BB0\u5F97", "\u56DE\u5FC6", "\u8BA4\u8BC6", "\u77E5\u9053", "\u8FD8\u8BB0\u5F97", "\u6211\u662F\u8C01", "\u6211\u53EB\u4EC0\u4E48", "\u6211\u7684\u540D\u5B57", "\u4E0A\u6B21", "\u4E4B\u524D", "\u524D\u9762"];
    MEMORY_HALF_LIFE_DAYS = 30;
    EVENT_HALF_LIFE_DAYS = 14;
    STABLE_TYPES = /* @__PURE__ */ new Set(["correction", "sop"]);
  }
});
var DEFAULT_DND_CONFIG;
var init_types = __esm({
  "src/suggest/types.ts"() {
    "use strict";
    DEFAULT_DND_CONFIG = {
      enabled: false,
      startMin: 22 * 60 + 30,
      endMin: 8 * 60
    };
  }
});
function extractSignals(userMessages) {
  const signals = [];
  for (let i = 0; i < userMessages.length; i++) {
    const text = userMessages[i] ?? "";
    const cleanText = text.replace(/[，。！？\s]/g, "");
    const isPureRejection = cleanText.length <= 12 && NEGATIVE_PATTERNS.some((re) => re.test(text));
    if (isPureRejection) {
      continue;
    }
    for (const re of CORRECTION_PATTERNS) {
      const match = text.match(re);
      if (match) {
        const raw = match[0].trim();
        if (raw.length < 6) continue;
        if (POSTPONE_PHRASES.some((p) => p.test(raw))) continue;
        if (/每天|每周|每月|每日|定期|每\d+[天周月日小时分钟]|按时|自动执行|定时任务|周期(?:性)?(?:地)?(?:检查|监控|汇总|备份|生成|报告|整理|更新)/.test(raw)) {
          continue;
        }
        signals.push({
          kind: "correction",
          raw,
          rule: raw,
          messageIndex: i,
          confidence: 0.95
          // 用户明确表达纠正，高置信
        });
        break;
      }
    }
    for (const re of AUTOMATION_PATTERNS) {
      const match = text.match(re);
      if (match) {
        signals.push({
          kind: "automation",
          raw: match[0].trim(),
          messageIndex: i,
          confidence: 0.85
        });
        break;
      }
    }
    for (const re of FOLLOWUP_PATTERNS) {
      const match = text.match(re);
      if (match) {
        const raw = match[0].trim();
        if (POSTPONE_PHRASES.some((p) => p.test(raw))) continue;
        signals.push({
          kind: "followup",
          raw,
          messageIndex: i,
          confidence: 0.8
        });
        break;
      }
    }
    for (const re of TODO_PATTERNS) {
      const match = text.match(re);
      if (match) {
        const raw = match[0].trim();
        if (raw.length < 4) continue;
        if (/^待办(?:应用|功能|模块|系统|项目|全栈|页面|界面|页|组件|仓库|官网|站点|页面)/.test(raw)) continue;
        signals.push({
          kind: "todo",
          raw,
          messageIndex: i,
          confidence: 0.72
        });
        break;
      }
    }
  }
  const repeatIntents = detectRepeatIntents(userMessages);
  signals.push(...repeatIntents);
  return signals;
}
function detectRepeatIntents(userMessages) {
  const intentCounts = /* @__PURE__ */ new Map();
  for (let i = 0; i < userMessages.length; i++) {
    const text = userMessages[i] ?? "";
    const intentMatch = text.match(/(?:帮我|请|麻烦|能不能|可以)([^，。！？\n]{2,24})/);
    if (!intentMatch) continue;
    const intentGroup = intentMatch[1];
    if (!intentGroup) continue;
    const intent = intentGroup.trim();
    if (intent.length < 2 || intent.length > 24) continue;
    if (/^(这个|那个|一下|看看|什么|怎么|为什么)$/.test(intent)) continue;
    const intentKey = intent.slice(0, 2);
    if (WEAK_INTENT_KEYS.includes(intentKey)) continue;
    if (/^(一下|这个|那个|帮我)$/.test(intentKey)) continue;
    const existing = intentCounts.get(intentKey);
    if (existing) {
      existing.count += 1;
      existing.indexes.push(i);
    } else {
      intentCounts.set(intentKey, { count: 1, indexes: [i], intent: intentGroup, intentKey });
    }
  }
  const signals = [];
  for (const [key, entry] of intentCounts) {
    if (entry.count >= 2 && entry.indexes.length >= 2) {
      signals.push({
        kind: "repeat",
        intent: entry.intent ?? key,
        intentKey: entry.intentKey ?? key,
        count: entry.count,
        messageIndexes: entry.indexes,
        // 重复次数越多越可信，但封顶 0.9
        confidence: Math.min(0.6 + (entry.count - 2) * 0.1, 0.9)
      });
    }
  }
  return signals;
}
function normalizeRule(raw) {
  let rule = raw;
  const LEADERS = [
    /^请记住/,
    /^我希望你/,
    /^我希望/,
    /^我更喜欢/,
    /^我更倾向/,
    /^以后/,
    /^下次/,
    /^记住/,
    /^麻烦(?:你)?/
  ];
  let changed = true;
  while (changed) {
    changed = false;
    for (const re of LEADERS) {
      if (re.test(rule)) {
        rule = rule.replace(re, "").trim();
        changed = true;
      }
    }
  }
  if (!rule) rule = raw;
  rule = rule.replace(/[。！？]+$/, "");
  return rule;
}
function isMeaningfulRule(rule) {
  const trimmed = rule.trim();
  if (trimmed.length < 2) return false;
  if (/^(这样|那样|再说|再聊|再说吧|而已|罢了|好了|算了|没事|这个|那个|一下)$/.test(trimmed)) return false;
  return true;
}
var CORRECTION_PATTERNS;
var FOLLOWUP_PATTERNS;
var AUTOMATION_PATTERNS;
var TODO_PATTERNS;
var NEGATIVE_PATTERNS;
var POSTPONE_PHRASES;
var WEAK_INTENT_KEYS;
var init_signals = __esm({
  "src/suggest/signals.ts"() {
    "use strict";
    CORRECTION_PATTERNS = [
      /(?:以后|下次|记住|请记住|别再|不要|别再这样|希望你不要)[^。！？\n]{2,60}/,
      /(?:不要|别)[^。！？\n]{0,20}(?:这样|这么做|用这种方式)[^。！？\n]{0,40}/,
      /(?:我更喜欢|我更希望|我希望你(?:以后|下次))[^。！？\n]{2,60}/,
      // 英文纠正（保守：明确祈使/偏好，避免把普通讨论当纠正）
      /(?:please\s+(?:always|never|remember\s+to|don'?t|do\s+not))[^.!?\n]{2,80}/i,
      /(?:from\s+now\s+on\s*,\s*(?:please\s+)?(?:use|always|never|do))[^.!?\n]{2,80}/i,
      /(?:i\s+(?:prefer|would\s+like\s+you\s+to|want\s+you\s+to))[^.!?\n]{2,80}/i
    ];
    FOLLOWUP_PATTERNS = [
      /(?:明天|稍后|过一会|过会儿|晚点|等会|待会|之后|回头|下次再)[^。！？\n]{0,30}(?:继续|做|弄|处理|看|说|再|提醒|提交|完成|弄完|整理|写|弄好)/,
      /(?:继续|做|弄|处理|看|说|提醒)(?:明天|稍后|过一会|过会儿|晚点|等会|待会|之后|回头)/,
      // 英文跟进（保守：明确 remind/continue/tomorrow/later）
      /(?:remind\s+me|remember\s+to|continue|finish|follow\s+up)\b[^.!?\n]{0,50}\b(?:tomorrow|later|next\s+(?:week|time|monday|tuesday|wednesday|thursday|friday|saturday|sunday))/i,
      /\b(?:tomorrow|later|next\s+(?:week|time|monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b[^.!?\n]{0,40}(?:continue|do|handle|finish|send|submit|work\s+on)/i
    ];
    AUTOMATION_PATTERNS = [
      /(?:每天|每周|每月|定期|每天都要|每天自动)[^。！？\n]{2,50}/,
      /(?:帮我盯|关注|跟进|监控|检查)[^。！？\n]{2,50}(?:每天|每周|状态|进展|更新)/,
      // 英文自动化（保守：every day/week/month 明确周期；结尾允许无后续内容）
      /(?:every\s+(?:day|week|month|monday|tuesday|wednesday|thursday|friday|saturday|sunday|morning|evening))[^.!?\n]{0,80}/i,
      /(?:daily|weekly|monthly|regularly|automatically)\b[^.!?\n]{0,80}/i
    ];
    TODO_PATTERNS = [
      /(?:还差|还没|没做完|未完|剩下|待办|还没完成|待会再|回头再|之后再)[^。！？\n]{0,40}/,
      /(?:这个任务|这件事|这个功能)(?:还没|未完|没做完|差一点|还差)/,
      // 英文未完成（保守）
      /(?:not\s+(?:done|finished|complete|yet)|still\s+(?:need|needs|missing|pending)|todo|unfinished)\b[^.!?\n]{0,40}/i
    ];
    NEGATIVE_PATTERNS = [
      /(?:不用|不需要|别管|算了|不用了|没事|就这样|到此为止)/,
      /(?:no\s+need|never\s+mind|forget\s+it|skip\s+it|don'?t\s+bother|that'?s\s+fine|enough)\b/i
    ];
    POSTPONE_PHRASES = [
      /(?:再说|再聊|再看|再讨论|改天|回头再说|以后再说|以后聊|以后看|晚点再说|等会再说)/,
      /(?:talk\s+(?:later|about\s+it\s+later)|discuss\s+later|later\s+then|another\s+time)\b/i
    ];
    WEAK_INTENT_KEYS = ["\u770B\u770B", "\u4E00\u4E0B", "\u8FD9\u4E2A", "\u90A3\u4E2A", "\u5E2E\u6211", "\u7ED9\u6211", "\u5E2E\u6211\u641E", "\u5F04\u4E0B"];
  }
});
function cnToNum(s) {
  if (/^\d+$/.test(s)) return Number(s);
  const hit = CN_NUM[s];
  if (hit !== void 0) return hit;
  if (/^十/.test(s) && s.length === 2) {
    return 10 + cnToNum(s[1]);
  }
  return void 0;
}
function hourWithMeridiem(hour, meridiem) {
  if (!meridiem) return hour;
  if (meridiem === "\u4E0A\u5348" || meridiem === "\u65E9\u4E0A" || meridiem === "\u51CC\u6668") {
    if (hour === 12) return 0;
    return hour;
  }
  if (meridiem === "\u4E0B\u5348" || meridiem === "\u665A\u4E0A") {
    if (hour === 12) return 12;
    if (hour < 12) return hour + 12;
    return hour;
  }
  return hour;
}
function daysUntilWeekday(target, from) {
  const current = from.getDay();
  let delta = target - current;
  if (delta <= 0) delta += 7;
  return delta;
}
function dayAt(from, offsetDays) {
  const d = new Date(from);
  d.setDate(d.getDate() + offsetDays);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
function parseChineseTime(text, now = /* @__PURE__ */ new Date()) {
  let m = text.match(/(每天|每日)(上午|早上|凌晨|下午|晚上)?\s*([0-9一二两三四五六七八九十]+)\s*(?:点|时)/);
  if (m) {
    const hour = cnToNum(m[3]);
    if (hour !== void 0) {
      const h = hourWithMeridiem(hour, m[2]);
      return { cron: `${h} 0 * * *`, label: `\u6BCF\u5929 ${h}:00` };
    }
  }
  if (/(每天|每日)/.test(text)) {
    return { cron: "9 0 * * *", label: "\u6BCF\u5929 09:00" };
  }
  m = text.match(/每周([一二三四五六日天])(上午|早上|凌晨|下午|晚上)?\s*([0-9一二两三四五六七八九十]+)?\s*(?:点|时)?/);
  if (m) {
    const wd = CN_WEEKDAY[m[1]];
    if (wd !== void 0) {
      const hour = m[3] ? cnToNum(m[3]) : 9;
      if (hour !== void 0) {
        const h = hourWithMeridiem(hour, m[2]);
        return { cron: `${h} 0 * * ${wd}`, label: `\u6BCF\u5468${m[1]} ${h}:00` };
      }
    }
  }
  m = text.match(/每月([0-9一二两三四五六七八九十]+)(?:日|号)?(上午|早上|凌晨|下午|晚上)?\s*([0-9一二两三四五六七八九十]+)?\s*(?:点|时)?/);
  if (m) {
    const day = cnToNum(m[1]);
    if (day !== void 0 && day >= 1 && day <= 31) {
      const hour = m[3] ? cnToNum(m[3]) : 9;
      if (hour !== void 0) {
        const h = hourWithMeridiem(hour, m[2]);
        return { cron: `${h} 0 ${day} * *`, label: `\u6BCF\u6708${day}\u65E5 ${h}:00` };
      }
    }
  }
  m = text.match(/(今晚|明天|后天)(上午|早上|凌晨|下午|晚上)?\s*([0-9一二两三四五六七八九十]+)\s*(?:点|时)/);
  if (m) {
    const hour = cnToNum(m[3]);
    if (hour !== void 0) {
      const offset = m[1] === "\u4ECA\u665A" ? 0 : m[1] === "\u660E\u5929" ? 1 : 2;
      const h = hourWithMeridiem(hour, m[2]);
      const base = dayAt(now, offset);
      return { dueAt: base + h * 36e5, label: `${m[1]} ${h}:00` };
    }
  }
  if (/今晚/.test(text)) {
    return { dueAt: dayAt(now, 0) + 21 * 36e5, label: "\u4ECA\u665A 21:00" };
  }
  if (/后天/.test(text)) {
    return { dueAt: dayAt(now, 2) + 9 * 36e5, label: "\u540E\u5929 09:00" };
  }
  if (/明天/.test(text)) {
    return { dueAt: dayAt(now, 1) + 9 * 36e5, label: "\u660E\u5929 09:00" };
  }
  m = text.match(/下周([一二三四五六日天])/);
  if (m) {
    const wd = CN_WEEKDAY[m[1]];
    if (wd !== void 0) {
      const delta = daysUntilWeekday(wd, now);
      const base = dayAt(now, delta);
      return { dueAt: base + 9 * 36e5, label: `\u4E0B${m[1]} 09:00` };
    }
  }
  return void 0;
}
function parseEnHour(s) {
  const m = s.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!m) return void 0;
  let h = Number(m[1]);
  if (h > 23) return void 0;
  const meridiem = m[3]?.toLowerCase();
  if (meridiem === "pm" && h < 12) h += 12;
  if (meridiem === "am" && h === 12) h = 0;
  return h;
}
function parseEnglishTime(text, now = /* @__PURE__ */ new Date()) {
  const lower = text.toLowerCase();
  let m = lower.match(/every\s+(day|week|month)(?:\s+at\s+([0-9]{1,2}(?::[0-9]{2})?\s*(?:am|pm)?))?/);
  if (m) {
    const hour = m[2] ? parseEnHour(m[2]) : 9;
    if (hour !== void 0) {
      if (m[1] === "day") return { cron: `${hour} 0 * * *`, label: `every day ${hour}:00` };
      if (m[1] === "week") return { cron: `${hour} 0 * * 1`, label: `every week (Mon) ${hour}:00` };
      if (m[1] === "month") return { cron: `${hour} 0 1 * *`, label: `every month (1st) ${hour}:00` };
    }
  }
  m = lower.match(/every\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+at\s+([0-9]{1,2}(?::[0-9]{2})?\s*(?:am|pm)?))?/);
  if (m) {
    const wd = EN_WEEKDAY[m[1]];
    const hour = m[2] ? parseEnHour(m[2]) : 9;
    if (wd !== void 0 && hour !== void 0) {
      return { cron: `${hour} 0 * * ${wd}`, label: `every ${m[1]} ${hour}:00` };
    }
  }
  m = lower.match(/\b(daily|weekly|monthly)\b/);
  if (m) {
    if (m[1] === "daily") return { cron: "9 0 * * *", label: "every day 09:00" };
    if (m[1] === "weekly") return { cron: "9 0 * * 1", label: "every week (Mon) 09:00" };
    if (m[1] === "monthly") return { cron: "9 0 1 * *", label: "every month (1st) 09:00" };
  }
  m = lower.match(/(tomorrow|tonight)(?:\s+at\s+([0-9]{1,2}(?::[0-9]{2})?\s*(?:am|pm)?))?/);
  if (m) {
    if (m[1] === "tomorrow") {
      const hour = m[2] ? parseEnHour(m[2]) : 9;
      if (hour !== void 0) return { dueAt: dayAt(now, 1) + hour * 36e5, label: `tomorrow ${hour}:00` };
    }
    if (m[1] === "tonight") {
      const hour = m[2] ? parseEnHour(m[2]) : 21;
      if (hour !== void 0) return { dueAt: dayAt(now, 0) + hour * 36e5, label: `tonight ${hour}:00` };
    }
  }
  m = lower.match(/next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+at\s+([0-9]{1,2}(?::[0-9]{2})?\s*(?:am|pm)?))?/);
  if (m) {
    const wd = EN_WEEKDAY[m[1]];
    const hour = m[2] ? parseEnHour(m[2]) : 9;
    if (wd !== void 0 && hour !== void 0) {
      const delta = daysUntilWeekday(wd, now);
      return { dueAt: dayAt(now, delta) + hour * 36e5, label: `next ${m[1]} ${hour}:00` };
    }
  }
  return void 0;
}
function parseTimeExpression(text, now = /* @__PURE__ */ new Date()) {
  const t = text.trim();
  if (!t) return void 0;
  if (/[\u4e00-\u9fff]/.test(t)) return parseChineseTime(t, now);
  return parseEnglishTime(t, now);
}
var CN_NUM;
var CN_WEEKDAY;
var EN_WEEKDAY;
var init_time_parse = __esm({
  "src/suggest/time-parse.ts"() {
    "use strict";
    CN_NUM = {
      \u96F6: 0,
      \u4E00: 1,
      \u4E8C: 2,
      \u4E24: 2,
      \u4E09: 3,
      \u56DB: 4,
      \u4E94: 5,
      \u516D: 6,
      \u4E03: 7,
      \u516B: 8,
      \u4E5D: 9,
      \u5341: 10,
      \u5341\u4E00: 11,
      \u5341\u4E8C: 12,
      \u5341\u4E09: 13,
      \u5341\u56DB: 14,
      \u5341\u4E94: 15,
      \u5341\u516D: 16,
      \u5341\u4E03: 17,
      \u5341\u516B: 18,
      \u5341\u4E5D: 19,
      \u4E8C\u5341: 20,
      \u4E8C\u5341\u4E00: 21,
      \u4E8C\u5341\u4E8C: 22,
      \u4E8C\u5341\u4E09: 23,
      \u4E8C\u5341\u56DB: 24
    };
    CN_WEEKDAY = {
      \u4E00: 1,
      \u4E8C: 2,
      \u4E09: 3,
      \u56DB: 4,
      \u4E94: 5,
      \u516D: 6,
      \u65E5: 0,
      \u5929: 0
    };
    EN_WEEKDAY = {
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
      sunday: 0
    };
  }
});
function applyRules(ctx) {
  const matches = [];
  const signals = extractSignals(ctx.userMessages);
  for (const signal of signals) {
    const match = signalToCandidate(signal, ctx);
    if (match) matches.push(match);
  }
  return matches;
}
function signalToCandidate(signal, ctx) {
  switch (signal.kind) {
    case "correction": {
      const rule = normalizeRule(signal.raw);
      if (!isMeaningfulRule(rule)) return void 0;
      const existing = ctx.existingCorrectionRules.some(
        (r) => r === rule || r.includes(rule) || rule.includes(r)
      );
      if (existing) return void 0;
      return {
        candidate: {
          duplicateKey: `correction:${rule.slice(0, 30)}`,
          kind: "correction",
          title: "\u8BB0\u4F4F\u8FD9\u4E2A\u7EA0\u6B63",
          reason: "\u4F60\u521A\u521A\u7EA0\u6B63\u4E86\u52A9\u624B\u7684\u884C\u4E3A\uFF0C\u5EFA\u8BAE\u628A\u8FD9\u6761\u89C4\u5219\u5199\u5165\u957F\u671F\u8BB0\u5FC6\uFF0C\u4EE5\u540E\u4E0D\u518D\u72AF\u540C\u6837\u7684\u9519\u3002",
          evidence: signal.raw,
          rawConfidence: signal.confidence,
          action: {
            type: "memory_correction",
            raw: signal.raw,
            rule
          }
        }
      };
    }
    case "followup": {
      const time = parseTimeExpression(signal.raw);
      return {
        candidate: {
          duplicateKey: `followup:${signal.raw.slice(0, 24)}`,
          kind: "followup",
          title: time ? `\u521B\u5EFA\u8DDF\u8FDB\u63D0\u9192\uFF08${time.label}\uFF09` : "\u521B\u5EFA\u8DDF\u8FDB\u63D0\u9192",
          reason: time ? `\u4F60\u63D0\u5230\u4E86\u7A0D\u540E\u7EE7\u7EED\uFF0C\u5DF2\u8BC6\u522B\u65F6\u95F4 ${time.label}\uFF0C\u5EFA\u8BAE\u521B\u5EFA\u8DDF\u8FDB\u63D0\u9192\uFF0C\u5230\u70B9\u81EA\u52A8\u63D0\u793A\u4F60\u7EE7\u7EED\u8FD9\u4E2A\u4EFB\u52A1\u3002` : "\u4F60\u63D0\u5230\u4E86\u7A0D\u540E\u7EE7\u7EED\uFF0C\u5EFA\u8BAE\u521B\u5EFA\u4E00\u4E2A\u8DDF\u8FDB\u63D0\u9192\uFF0C\u5230\u65F6\u95F4\u81EA\u52A8\u63D0\u793A\u4F60\u7EE7\u7EED\u8FD9\u4E2A\u4EFB\u52A1\u3002",
          evidence: signal.raw,
          rawConfidence: signal.confidence,
          action: {
            type: "open_automation_create",
            automationTitle: "\u8DDF\u8FDB\u63D0\u9192",
            suggestedPrompt: `\u63D0\u9192\u6211\uFF1A${signal.raw}`,
            ...time?.cron ? { cron: time.cron } : {},
            ...time?.dueAt ? { dueAt: time.dueAt } : {}
          }
        }
      };
    }
    case "automation": {
      const title = automationTitleFromRaw(signal.raw);
      const existing = ctx.existingAutomationTitles.some(
        (t) => t === title || t.includes(title) || title.includes(t)
      );
      if (existing) return void 0;
      const time = parseTimeExpression(signal.raw);
      return {
        candidate: {
          duplicateKey: `automation:${title}`,
          kind: "automation",
          title: time ? `\u5F00\u542F\u5B9A\u65F6\u4EFB\u52A1\uFF08${time.label}\uFF09` : "\u5F00\u542F\u5B9A\u65F6\u4EFB\u52A1",
          reason: time ? `\u4F60\u8868\u8FBE\u7684\u662F\u5468\u671F\u6027\u9700\u6C42\uFF0C\u5DF2\u8BC6\u522B\u5468\u671F ${time.label}\uFF0C\u5EFA\u8BAE\u521B\u5EFA\u5B9A\u65F6\u4EFB\u52A1\uFF0C\u8BA9\u52A9\u624B\u65E0\u4EBA\u503C\u5B88\u5730\u81EA\u52A8\u5904\u7406\u3002` : "\u4F60\u8868\u8FBE\u7684\u662F\u5468\u671F\u6027/\u957F\u671F\u5173\u6CE8\u7684\u9700\u6C42\uFF0C\u5EFA\u8BAE\u521B\u5EFA\u4E00\u4E2A\u5B9A\u65F6\u4EFB\u52A1\uFF0C\u8BA9\u52A9\u624B\u65E0\u4EBA\u503C\u5B88\u5730\u81EA\u52A8\u5904\u7406\u3002",
          evidence: signal.raw,
          rawConfidence: signal.confidence,
          action: {
            type: "open_automation_create",
            automationTitle: title,
            suggestedPrompt: `${title}\uFF08\u5B9A\u671F\u81EA\u52A8\u6267\u884C\uFF09`,
            ...time?.cron ? { cron: time.cron } : {}
          }
        }
      };
    }
    case "repeat": {
      if (signal.count < REPEAT_THRESHOLD) return void 0;
      const title = `\u5B9A\u671F${signal.intentKey ?? signal.intent.slice(0, 2)}`;
      const existing = ctx.existingAutomationTitles.some(
        (t) => t === title || t.includes(signal.intent) || signal.intent.includes(t)
      );
      if (existing) return void 0;
      return {
        candidate: {
          duplicateKey: `automation:${title}`,
          kind: "automation",
          title: "\u628A\u91CD\u590D\u64CD\u4F5C\u53D8\u6210\u5B9A\u65F6\u4EFB\u52A1",
          reason: `\u4F60\u5728\u672C\u6B21\u4F1A\u8BDD\u4E2D${signal.count}\u6B21\u8981\u6C42"${signal.intent}"\uFF0C\u5EFA\u8BAE\u521B\u5EFA\u4E00\u4E2A\u5B9A\u65F6\u4EFB\u52A1\u81EA\u52A8\u5B8C\u6210\uFF0C\u7701\u53BB\u91CD\u590D\u64CD\u4F5C\u3002`,
          evidence: `\u91CD\u590D\u51FA\u73B0 ${signal.count} \u6B21\uFF1A"${signal.intent}"`,
          rawConfidence: signal.confidence,
          action: {
            type: "open_automation_create",
            automationTitle: title,
            suggestedPrompt: `\u5B9A\u671F\u6267\u884C\uFF1A${signal.intent}`
          }
        }
      };
    }
    case "todo": {
      return {
        candidate: {
          duplicateKey: `todo:${signal.raw.slice(0, 20)}`,
          kind: "todo",
          title: "\u628A\u672A\u5B8C\u6210\u4EFB\u52A1\u8BB0\u4E0B\u6765",
          reason: "\u4F60\u63D0\u5230\u4E86\u672A\u5B8C\u6210\u7684\u4E8B\u9879\uFF0C\u5EFA\u8BAE\u521B\u5EFA\u4E00\u4E2A Todo \u8BB0\u5F55\uFF0C\u907F\u514D\u9057\u6F0F\u3002",
          evidence: signal.raw,
          rawConfidence: signal.confidence,
          action: {
            type: "open_todo_create",
            title: signal.raw.slice(0, 120),
            notes: "\u7531 ProactiveAgent \u4E3B\u52A8\u5EFA\u8BAE\u521B\u5EFA\uFF1B\u8BF7\u786E\u8BA4\u5185\u5BB9\u548C\u622A\u6B62\u65F6\u95F4\u3002"
          }
        }
      };
    }
    default:
      return void 0;
  }
}
function buildSkillCandidate(sopCount) {
  if (sopCount < SOP_CANDIDATE_THRESHOLD) return void 0;
  return {
    duplicateKey: `skill:sop-candidates`,
    kind: "skill",
    title: "\u628A\u5E38\u7528\u6D41\u7A0B\u6C89\u6DC0\u4E3A Skill",
    reason: `\u957F\u671F\u8BB0\u5FC6\u4E2D\u5DF2\u79EF\u7D2F ${sopCount} \u6761\u53EF\u590D\u7528\u6D41\u7A0B\uFF08SOP\uFF09\uFF0C\u5EFA\u8BAE\u628A\u5B83\u4EEC\u6574\u7406\u6210 Skill\uFF0C\u4EE5\u540E\u4E00\u53E5\u8BDD\u5373\u53EF\u590D\u7528\u3002`,
    evidence: `${sopCount} \u6761 SOP \u5019\u9009`,
    rawConfidence: 0.75,
    action: {
      type: "open_skill_creator",
      topic: "SOP \u6D41\u7A0B\u6C89\u6DC0"
    }
  };
}
function automationTitleFromRaw(raw) {
  let title = raw.replace(/^(每天自动|每天都要|每天|每周|每月|定期)/, "").replace(/^(帮我|请|麻烦|能不能|可以)/, "").replace(/(帮我)?(盯|关注|跟进|监控|检查)(一下)?/, "").replace(/[，。！？\n]+$/, "").trim();
  if (!title) title = raw.slice(0, 20);
  return title.length > 24 ? title.slice(0, 24) : title;
}
var SOP_CANDIDATE_THRESHOLD;
var REPEAT_THRESHOLD;
var init_rules = __esm({
  "src/suggest/rules.ts"() {
    "use strict";
    init_signals();
    init_time_parse();
    SOP_CANDIDATE_THRESHOLD = 3;
    REPEAT_THRESHOLD = 2;
  }
});
function defaultTypeWeights() {
  return {
    correction: 1,
    followup: 1,
    automation: 1,
    skill: 0.8,
    // Skill 建议偏打扰，初始略低
    todo: 0.9
    // Todo 建议初始略低（但必须 ≥ 0.72×0.9=0.648 > 0.6 阈值，避免死锁）
  };
}
function evaluateSuggestions(input, index, opts = DEFAULT_SUGGEST_OPTIONS) {
  const suppressed = [];
  const userMessages = input.messages.filter((m) => m.role === "user" && typeof m.content === "string" && m.content.trim().length > 0).map((m) => m.content);
  if (userMessages.length === 0) return { candidates: [], suppressed };
  const lastUserMsg = userMessages[userMessages.length - 1] ?? "";
  if (NEGATIVE_PATTERNS.some((re) => re.test(lastUserMsg))) {
    return { candidates: [], suppressed };
  }
  const ctx = {
    userMessages,
    existingAutomationTitles: input.existingAutomationTitles ?? [],
    existingCorrectionRules: input.existingCorrectionRules ?? [],
    sopCandidateCount: input.sopCandidateCount ?? 0
  };
  const ruleMatches = applyRules(ctx);
  const candidates = ruleMatches.map((m) => m.candidate);
  const skillCandidate = buildSkillCandidate(ctx.sopCandidateCount);
  if (skillCandidate) candidates.push(skillCandidate);
  const existingSession = input.existingSessionSuggestions ?? [];
  const alreadySuggestedKeys = new Set(existingSession.map((r) => r.duplicateKey));
  const neverKeys = new Set(index.records.filter((r) => r.status === "never").map((r) => r.duplicateKey));
  const scored = [];
  const seenKeys = /* @__PURE__ */ new Set();
  for (const candidate of candidates) {
    if (alreadySuggestedKeys.has(candidate.duplicateKey)) {
      suppressed.push({ candidate, reason: "\u540C\u4F1A\u8BDD\u5DF2\u5EFA\u8BAE\u8FC7" });
      continue;
    }
    if (neverKeys.has(candidate.duplicateKey)) {
      suppressed.push({ candidate, reason: "\u7528\u6237\u5DF2\u9009\u62E9\u4E0D\u518D\u5EFA\u8BAE\u8FD9\u7C7B" });
      continue;
    }
    if (seenKeys.has(candidate.duplicateKey)) {
      suppressed.push({ candidate, reason: "\u91CD\u590D\u5019\u9009" });
      continue;
    }
    seenKeys.add(candidate.duplicateKey);
    const weight = typeWeight(index, candidate.kind);
    const effective = candidate.rawConfidence * weight;
    if (effective < opts.threshold) {
      suppressed.push({
        candidate,
        reason: `\u7F6E\u4FE1\u5EA6\u4E0D\u8DB3(raw=${candidate.rawConfidence.toFixed(2)}, weight=${weight.toFixed(2)}, effective=${effective.toFixed(2)})`
      });
      continue;
    }
    scored.push({ candidate, effective });
  }
  scored.sort((a, b) => b.effective - a.effective);
  const top = scored.slice(0, opts.maxPerEvaluation).map((s) => s.candidate);
  return { candidates: top, suppressed };
}
function typeWeight(index, kind) {
  const w = index.typeWeights?.[kind];
  if (typeof w === "number" && w > 0) return w;
  return 1;
}
var DEFAULT_SUGGEST_OPTIONS;
var init_engine = __esm({
  "src/suggest/engine.ts"() {
    "use strict";
    init_rules();
    init_signals();
    DEFAULT_SUGGEST_OPTIONS = {
      /** 置信度阈值：raw × weight ≥ 0.6 才建议 */
      threshold: 0.6,
      /** 单次评估最多 1 条（低频优先，避免连环打扰） */
      maxPerEvaluation: 1,
      /** 同会话最多 2 条 */
      maxPerSession: 2
    };
  }
});
function readIndex2() {
  const key = currentLayerKey();
  if (suggestionsCache.has(key)) return suggestionsCache.get(key);
  const data = readJsonFileSafe(getSuggestionsPath());
  if (!data) {
    const fresh = { version: INDEX_VERSION2, records: [], typeWeights: defaultTypeWeights(), enabled: true };
    suggestionsCache.set(key, fresh);
    return fresh;
  }
  if (!data.typeWeights || typeof data.typeWeights !== "object") data.typeWeights = defaultTypeWeights();
  if (typeof data.enabled !== "boolean") data.enabled = true;
  if (!Array.isArray(data.records)) data.records = [];
  if (!data.dnd || typeof data.dnd !== "object") data.dnd = { ...DEFAULT_DND_CONFIG };
  data.analysis = sanitizeAnalysisState(data.analysis);
  data.records = data.records.filter(isValidSuggestionRecord).map(sanitizeSuggestionRecord).slice(0, MAX_RECORDS);
  const inferredScope = key === GLOBAL_KEY ? "global" : "project";
  data.records = data.records.map((r) => ({ ...r, scope: r.scope ?? inferredScope }));
  suggestionsCache.set(key, data);
  return data;
}
function isValidSuggestionRecord(r) {
  if (!r || typeof r !== "object") return false;
  const rec = r;
  return typeof rec.id === "string" && rec.id.length > 0 && typeof rec.createdAt === "number" && typeof rec.title === "string" && (rec.status === "suggested" || rec.status === "accepted" || rec.status === "ignored" || rec.status === "never");
}
function sanitizeSuggestionRecord(r) {
  return {
    ...r,
    title: r.title.slice(0, 200),
    reason: r.reason?.slice(0, 500),
    evidence: r.evidence?.slice(0, 500),
    duplicateKey: r.duplicateKey?.slice(0, 200)
  };
}
function sanitizeAnalysisState(value) {
  if (!value || typeof value !== "object") return { status: "idle" };
  const raw = value;
  const validStatuses = /* @__PURE__ */ new Set(["idle", "running", "succeeded", "empty", "unavailable", "failed"]);
  const status = typeof raw.status === "string" && validStatuses.has(raw.status) ? raw.status : "idle";
  return {
    status,
    ...typeof raw.startedAt === "number" && Number.isFinite(raw.startedAt) ? { startedAt: raw.startedAt } : {},
    ...typeof raw.completedAt === "number" && Number.isFinite(raw.completedAt) ? { completedAt: raw.completedAt } : {},
    ...typeof raw.added === "number" && Number.isInteger(raw.added) && raw.added >= 0 && raw.added <= 3 ? { added: raw.added } : {},
    ...typeof raw.message === "string" && raw.message.length <= 200 ? { message: raw.message } : {}
  };
}
function writeIndex2() {
  const key = currentLayerKey();
  const index = suggestionsCache.get(key);
  if (!index) return;
  index.version = INDEX_VERSION2;
  mkdirSync5(dirname3(getSuggestionsPath()), { recursive: true });
  writeJsonFileAtomic(getSuggestionsPath(), index);
}
function readSuggestionsIndex() {
  return readIndex2();
}
function suggestionsEnabled() {
  return readIndex2().enabled;
}
function setSuggestionsEnabled(enabled) {
  const index = readIndex2();
  index.enabled = enabled;
  writeIndex2();
}
function getAnalysisState() {
  const state = { ...readIndex2().analysis ?? { status: "idle" } };
  if (state.status === "running" && (!state.startedAt || Date.now() - state.startedAt > 12e4)) {
    const recovered = {
      status: "failed",
      startedAt: state.startedAt,
      completedAt: Date.now(),
      message: "\u4E0A\u6B21\u5206\u6790\u672A\u5B8C\u6210\uFF0C\u8BF7\u91CD\u65B0\u8FD0\u884C"
    };
    setAnalysisState(recovered);
    return recovered;
  }
  return state;
}
function setAnalysisState(state) {
  const index = readIndex2();
  index.analysis = { ...state };
  writeIndex2();
}
function persistSuggestion(candidate, sessionId) {
  const index = readIndex2();
  const record = {
    ...candidate,
    id: randomUUID2(),
    sessionId,
    status: "suggested",
    createdAt: Date.now()
  };
  index.records.unshift(record);
  if (index.records.length > MAX_RECORDS) {
    index.records.length = MAX_RECORDS;
  }
  writeIndex2();
  return record;
}
function recordFeedback(suggestionId, feedback, layer) {
  if (feedback !== "accepted" && feedback !== "ignored" && feedback !== "never") return void 0;
  if (layer && layer !== (currentLayerKey() === GLOBAL_KEY ? "global" : "project")) {
    return recordFeedbackInLayer(suggestionId, feedback, layer);
  }
  const index = readIndex2();
  const record = index.records.find((r) => r.id === suggestionId);
  if (!record) return void 0;
  record.status = feedback === "never" ? "never" : feedback;
  record.feedbackAt = Date.now();
  const weight = typeWeightValue(index, record.kind);
  switch (feedback) {
    case "accepted":
      index.typeWeights[record.kind] = Math.min(2, weight * 1.2);
      break;
    case "ignored":
      index.typeWeights[record.kind] = Math.max(0.2, weight * 0.8);
      break;
    case "never":
      index.typeWeights[record.kind] = Math.max(0.2, weight * 0.5);
      break;
  }
  writeIndex2();
  return record;
}
function recordFeedbackInLayer(suggestionId, feedback, layer) {
  const targetPath = layer === "global" ? getGlobalSuggestionsPath() : getProjectSuggestionsPath();
  const data = readJsonFileSafe(targetPath);
  if (!data) return void 0;
  const record = data.records.find((r) => r.id === suggestionId);
  if (!record) return void 0;
  record.status = feedback === "never" ? "never" : feedback;
  record.feedbackAt = Date.now();
  const weight = data.typeWeights?.[record.kind] ?? 1;
  switch (feedback) {
    case "accepted":
      data.typeWeights[record.kind] = Math.min(2, weight * 1.2);
      break;
    case "ignored":
      data.typeWeights[record.kind] = Math.max(0.2, weight * 0.8);
      break;
    case "never":
      data.typeWeights[record.kind] = Math.max(0.2, weight * 0.5);
      break;
  }
  mkdirSync5(dirname3(targetPath), { recursive: true });
  writeJsonFileAtomic(targetPath, data);
  return record;
}
function listSuggestions(status) {
  const index = readIndex2();
  if (!status) return index.records;
  return index.records.filter((r) => r.status === status);
}
function deleteSuggestion(id) {
  const index = readIndex2();
  const before = index.records.length;
  index.records = index.records.filter((r) => r.id !== id);
  writeIndex2();
  return index.records.length < before;
}
function clearSuggestions() {
  const index = readIndex2();
  index.records = [];
  writeIndex2();
}
function getSuggestion(id) {
  return readIndex2().records.find((r) => r.id === id);
}
function getSuggestionAcrossLayers(id) {
  const local = getSuggestion(id);
  if (local) return { record: local, layer: currentLayerKey() === GLOBAL_KEY ? "global" : "project" };
  const otherKey = currentLayerKey() === GLOBAL_KEY ? getProjectKeyPublic() : GLOBAL_KEY;
  const saved = currentLayerKey();
  try {
    const data = readIndexForLayer(otherKey);
    const found = data.records.find((r) => r.id === id);
    if (found) return { record: found, layer: otherKey === GLOBAL_KEY ? "global" : "project" };
  } finally {
  }
  return void 0;
}
function readIndexForLayer(key) {
  if (suggestionsCache.has(key)) return suggestionsCache.get(key);
  const savedPath = getSuggestionsPath();
  const targetPath = key === GLOBAL_KEY ? getGlobalSuggestionsPath() : getProjectSuggestionsPath(key);
  const data = readJsonFileSafe(targetPath);
  const fresh = data ?? { version: INDEX_VERSION2, records: [], typeWeights: defaultTypeWeights(), enabled: true };
  if (data) {
    if (!fresh.typeWeights || typeof fresh.typeWeights !== "object") fresh.typeWeights = defaultTypeWeights();
    if (typeof fresh.enabled !== "boolean") fresh.enabled = true;
    if (!Array.isArray(fresh.records)) fresh.records = [];
    if (!fresh.dnd || typeof fresh.dnd !== "object") fresh.dnd = { ...DEFAULT_DND_CONFIG };
    fresh.analysis = sanitizeAnalysisState(fresh.analysis);
    fresh.records = fresh.records.filter(isValidSuggestionRecord).map(sanitizeSuggestionRecord).slice(0, MAX_RECORDS);
    const inferredScope = key === GLOBAL_KEY ? "global" : "project";
    fresh.records = fresh.records.map((r) => ({ ...r, scope: r.scope ?? inferredScope }));
  }
  suggestionsCache.set(key, fresh);
  return fresh;
}
function isTypeSilenced(kind) {
  const index = readIndex2();
  const recent = index.records.filter((r) => r.kind === kind).slice(0, SILENCE_AFTER_IGNORES);
  if (recent.length < SILENCE_AFTER_IGNORES) return false;
  return recent.every((r) => r.status === "ignored");
}
function getHighIgnoreDuplicateKeys(minHits = 2) {
  const index = readIndex2();
  const counts = /* @__PURE__ */ new Map();
  for (const r of index.records) {
    if (r.status !== "ignored" && r.status !== "never") continue;
    if (!r.duplicateKey) continue;
    counts.set(r.duplicateKey, (counts.get(r.duplicateKey) ?? 0) + 1);
  }
  const result = [];
  for (const [key, count] of counts) {
    if (count >= minHits) result.push(key);
  }
  return result;
}
function typeWeights() {
  return { ...readIndex2().typeWeights };
}
function getDndConfig() {
  const cfg = readIndex2().dnd;
  if (!cfg || typeof cfg !== "object") return { ...DEFAULT_DND_CONFIG };
  return {
    enabled: !!cfg.enabled,
    startMin: typeof cfg.startMin === "number" ? clampMinute(cfg.startMin) : DEFAULT_DND_CONFIG.startMin,
    endMin: typeof cfg.endMin === "number" ? clampMinute(cfg.endMin) : DEFAULT_DND_CONFIG.endMin
  };
}
function setDndConfig(cfg) {
  const index = readIndex2();
  index.dnd = {
    enabled: !!cfg.enabled,
    startMin: clampMinute(cfg.startMin),
    endMin: clampMinute(cfg.endMin)
  };
  writeIndex2();
}
function clampMinute(v) {
  if (!Number.isFinite(v)) return 0;
  return Math.min(1439, Math.max(0, Math.round(v)));
}
function isInDnd(now = Date.now(), cfg) {
  const config = cfg ?? getDndConfig();
  if (!config.enabled) return false;
  const d = new Date(now);
  const curMin = d.getHours() * 60 + d.getMinutes();
  if (config.startMin < config.endMin) {
    return curMin >= config.startMin && curMin < config.endMin;
  }
  if (config.startMin > config.endMin) {
    return curMin >= config.startMin || curMin < config.endMin;
  }
  return false;
}
function suggestionStats() {
  const index = readIndex2();
  const startOfDay = /* @__PURE__ */ new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startMs = startOfDay.getTime();
  const today = index.records.filter((r) => (r.feedbackAt ?? r.createdAt) >= startMs);
  return {
    suggestedCount: index.records.filter((r) => r.status === "suggested").length,
    todayAccepted: today.filter((r) => r.status === "accepted").length,
    todayIgnored: today.filter((r) => r.status === "ignored").length,
    todayNever: today.filter((r) => r.status === "never").length,
    typeWeights: { ...index.typeWeights }
  };
}
function suggestionRoiStats(days = 7) {
  const index = readIndex2();
  const since = Date.now() - days * 24 * 36e5;
  const recent = index.records.filter((r) => (r.feedbackAt ?? r.createdAt) >= since);
  const funnel = {
    suggested: recent.filter((r) => r.status === "suggested").length,
    accepted: recent.filter((r) => r.status === "accepted").length,
    ignored: recent.filter((r) => r.status === "ignored").length,
    never: recent.filter((r) => r.status === "never").length
  };
  const feedbackTotal = funnel.accepted + funnel.ignored + funnel.never;
  const acceptRate = feedbackTotal > 0 ? funnel.accepted / feedbackTotal : 0;
  const sufficient = feedbackTotal >= 5;
  const shouldReduceBudget2 = sufficient && acceptRate < 0.3;
  const byTypeMap = /* @__PURE__ */ new Map();
  for (const r of recent) {
    const entry = byTypeMap.get(r.kind) ?? { suggested: 0, accepted: 0 };
    entry.suggested += 1;
    if (r.status === "accepted") entry.accepted += 1;
    byTypeMap.set(r.kind, entry);
  }
  const kindOrder = ["correction", "followup", "automation", "skill", "todo"];
  const byType = kindOrder.filter((k) => byTypeMap.has(k)).map((k) => {
    const e = byTypeMap.get(k);
    const total = e.suggested;
    return {
      kind: k,
      suggested: e.suggested,
      accepted: e.accepted,
      rate: total > 0 ? e.accepted / total : 0
    };
  });
  return {
    funnel,
    byType,
    acceptRate,
    disturbRate: 1 - acceptRate,
    sufficient,
    shouldReduceBudget: shouldReduceBudget2,
    days
  };
}
function shouldReduceBudget() {
  return suggestionRoiStats().shouldReduceBudget;
}
function typeWeightValue(index, kind) {
  const w = index.typeWeights?.[kind];
  if (typeof w === "number" && w > 0) return w;
  return 1;
}
var INDEX_VERSION2;
var MAX_RECORDS;
var SILENCE_AFTER_IGNORES;
var suggestionsCache;
var init_feedback = __esm({
  "src/suggest/feedback.ts"() {
    "use strict";
    init_safe_file();
    init_paths();
    init_project();
    init_types();
    init_engine();
    INDEX_VERSION2 = 1;
    MAX_RECORDS = 500;
    SILENCE_AFTER_IGNORES = 3;
    suggestionsCache = /* @__PURE__ */ new Map();
  }
});
function getAutomationTitles() {
  try {
    return automationTitlesProvider() ?? [];
  } catch {
    return [];
  }
}
function notifySuggestionsChangedProvider() {
  try {
    suggestionsChangedListener?.();
  } catch {
  }
}
function getActionExecutor() {
  try {
    return actionExecutorProvider?.() ?? null;
  } catch {
    return null;
  }
}
var automationTitlesProvider;
var suggestionsChangedListener;
var actionExecutorProvider;
var init_provider = __esm({
  "src/provider.ts"() {
    "use strict";
    automationTitlesProvider = () => [];
    suggestionsChangedListener = null;
    actionExecutorProvider = null;
  }
});
async function executeSuggestionAction(action, ctx = {}) {
  const host = ctx.host ?? "agent";
  const executor = getActionExecutor();
  try {
    switch (action.type) {
      case "memory_correction": {
        return {
          ok: true,
          executed: true,
          message: "\u7EA0\u6B63\u89C4\u5219\u5DF2\u5199\u5165\u957F\u671F\u8BB0\u5FC6\uFF08\u5305\u542B\u7528\u6237\u753B\u50CF\u56DE\u6D41\uFF09\u3002"
        };
      }
      case "open_automation_create": {
        if (executor?.createAutomation) {
          const result = await executor.createAutomation({
            title: action.automationTitle,
            prompt: action.suggestedPrompt,
            cron: action.cron,
            dueAt: action.dueAt
          });
          return {
            ok: result.ok,
            executed: result.ok,
            refId: result.refId,
            message: result.ok ? `\u2705 \u5DF2\u521B\u5EFA\u5B9A\u65F6\u4EFB\u52A1${result.refId ? ` #${result.refId}` : ""}\uFF1A${action.automationTitle}` : result.message
          };
        }
        const timeHint = action.cron ? `\uFF08\u5468\u671F ${action.cron}\uFF09` : action.dueAt ? "\uFF08\u5355\u6B21\u65F6\u95F4\uFF09" : "";
        return {
          ok: true,
          executed: false,
          message: `\u5EFA\u8BAE\u521B\u5EFA\u5B9A\u65F6\u4EFB\u52A1\u300C${action.automationTitle}\u300D${timeHint}\u3002\u5F53\u524D ${host} \u5BBF\u4E3B\u672A\u63A5\u5165\u81EA\u52A8\u521B\u5EFA\uFF0C\u8BF7\u5728\u5BBF\u4E3B\u4E2D\u6267\u884C\uFF1A${action.suggestedPrompt}`
        };
      }
      case "open_todo_create": {
        if (executor?.createTodo) {
          const result = await executor.createTodo({
            title: action.title,
            notes: action.notes,
            dueAt: action.dueAt
          });
          return {
            ok: result.ok,
            executed: result.ok,
            refId: result.refId,
            message: result.ok ? `\u2705 \u5DF2\u521B\u5EFA\u5F85\u529E${result.refId ? ` #${result.refId}` : ""}\uFF1A${action.title}` : result.message
          };
        }
        return {
          ok: true,
          executed: false,
          message: `\u5EFA\u8BAE\u521B\u5EFA\u5F85\u529E\u300C${action.title}\u300D\u3002\u5F53\u524D ${host} \u5BBF\u4E3B\u672A\u63A5\u5165 Todo \u7CFB\u7EDF\uFF0C\u8BF7\u5728\u5BBF\u4E3B\u4E2D\u624B\u52A8\u521B\u5EFA\u3002`
        };
      }
      case "open_skill_creator": {
        return {
          ok: true,
          executed: false,
          message: `\u5EFA\u8BAE\u6C89\u6DC0 Skill\u300C${action.topic}\u300D\u3002\u8BF7\u5728\u5BBF\u4E3B\u4E2D\u6253\u5F00 Skill \u521B\u5EFA\u6D41\u7A0B\u3002`
        };
      }
      case "open_memory_board":
        return {
          ok: true,
          executed: false,
          message: "\u5EFA\u8BAE\u6253\u5F00\u8BB0\u5FC6\u9762\u677F\u67E5\u770B/\u7BA1\u7406\u8BB0\u5FC6\u3002"
        };
      default:
        return { ok: false, executed: false, message: "\u672A\u77E5\u5EFA\u8BAE\u52A8\u4F5C" };
    }
  } catch (error) {
    return {
      ok: false,
      executed: false,
      message: `\u52A8\u4F5C\u6267\u884C\u5931\u8D25\uFF1A${error instanceof Error ? error.message : String(error)}`
    };
  }
}
var init_actions = __esm({
  "src/suggest/actions.ts"() {
    "use strict";
    init_provider();
  }
});
function toCardStatus(status) {
  switch (status) {
    case "accepted":
      return "accepted";
    case "ignored":
      return "dismissed";
    case "never":
      return "resolved";
    default:
      return "pending";
  }
}
function confidenceToPriority(rawConfidence) {
  if (rawConfidence >= 0.8) return "urgent";
  if (rawConfidence >= 0.5) return "normal";
  return "low";
}
function actionToTarget(action) {
  if (!action) return void 0;
  switch (action.type) {
    case "memory_correction":
      return { kind: "memory", id: correctionTargetId(action.raw, action.rule) };
    case "open_automation_create":
      return { kind: "automation", id: action.automationTitle };
    case "open_todo_create":
      return { kind: "todo", id: action.title };
    case "open_memory_board":
      return { kind: "memory", id: "board" };
    case "open_skill_creator":
      return { kind: "skill", id: action.topic };
    default:
      return void 0;
  }
}
function correctionTargetId(raw, rule) {
  const base = rule || raw;
  return base.length > 120 ? base.slice(0, 120) : base;
}
function allowedActionsFor(status) {
  if (status === "accepted" || status === "resolved") return [];
  if (status === "dismissed") return ["open"];
  return ["accept", "dismiss", "open"];
}
function toActionCard(record) {
  const status = toCardStatus(record.status);
  const target = actionToTarget(record.action);
  return {
    id: record.id,
    source: "suggestion",
    // SuggestionRecord 无 projectId；如 scope 存在可映射为 projectId 的占位，
    // 但 MVP 不引入新持久化字段，保持 undefined
    title: record.title,
    summary: record.reason,
    priority: confidenceToPriority(record.rawConfidence),
    allowedActions: allowedActionsFor(status),
    target,
    privacy: "local-only",
    status,
    duplicateKey: record.duplicateKey,
    evidence: record.evidence,
    createdAt: record.createdAt,
    feedbackAt: record.feedbackAt
  };
}
function toActionCards(records) {
  return records.map(toActionCard);
}
var init_action_card = __esm({
  "src/suggest/action-card.ts"() {
    "use strict";
  }
});
var analyst_exports = {};
__export(analyst_exports, {
  analystAvailable: () => analystAvailable,
  parseAnalystResponse: () => parseAnalystResponse,
  runWorkPatternAnalysis: () => runWorkPatternAnalysis,
  runWorkPatternAnalysisDetailed: () => runWorkPatternAnalysisDetailed,
  validateAnalystCandidate: () => validateAnalystCandidate,
  validateAnalystCandidates: () => validateAnalystCandidates
});
function buildAnalysisInput() {
  const atoms = recentAtoms(60);
  if (atoms.length === 0) return "\uFF08\u6682\u65E0\u8BB0\u5FC6\uFF09";
  const sections = [];
  sections.push("\u8FD1\u671F\u8BB0\u5FC6\u6761\u76EE\uFF1A");
  for (const atom of atoms.slice(0, 40)) {
    sections.push(`- [${atom.type}] ${atom.content.slice(0, 100)}`);
  }
  const p = persona();
  if (p.summary || p.preferences.length > 0) {
    sections.push("\n\u7528\u6237\u753B\u50CF\uFF1A");
    if (p.summary) sections.push(`- \u5B9A\u4F4D: ${p.summary}`);
    for (const pref of p.preferences.slice(0, 8)) sections.push(`- \u504F\u597D: ${pref}`);
  }
  const scenes2 = hotScenesSummary(3);
  if (scenes2) {
    sections.push("\n\u8FD1\u671F\u70ED\u70B9\u573A\u666F\uFF08\u4E3B\u9898+\u70ED\u5EA6\uFF09\uFF1A");
    sections.push(scenes2);
  }
  const activeCorrections = corrections("active");
  if (activeCorrections.length > 0) {
    sections.push("\n\u5DF2\u751F\u6548\u884C\u4E3A\u89C4\u5219\uFF1A");
    for (const c of activeCorrections.slice(0, 5)) sections.push(`- ${c.rule}`);
  }
  const automations = getAutomationTitles();
  if (automations.length > 0) {
    sections.push(`
\u5DF2\u6709\u5B9A\u65F6\u4EFB\u52A1\uFF1A${automations.join("\u3001")}`);
  }
  return sections.join("\n");
}
function parseAnalystResponse(raw) {
  if (!raw || raw.trim().length === 0) return [];
  let text = raw.trim();
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch?.[1]) text = fenceMatch[1].trim();
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return [];
  const jsonText = text.slice(start, end + 1);
  try {
    const parsed = JSON.parse(jsonText);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => {
      return !!item && typeof item === "object";
    });
  } catch {
    return [];
  }
}
function safeStr(v) {
  if (typeof v === "string") {
    const s = v.trim();
    return s.length > 0 ? s : null;
  }
  if (typeof v === "number" || typeof v === "boolean") {
    const s = String(v).trim();
    return s.length > 0 ? s : null;
  }
  if (Array.isArray(v)) {
    for (const item of v) {
      const s = safeStr(item);
      if (s) return s;
    }
    return null;
  }
  return null;
}
function validateAnalystCandidate(raw) {
  if (!raw || typeof raw !== "object") return null;
  const kind = raw.kind;
  if (typeof kind !== "string" || !ALLOWED_KINDS.includes(kind)) return null;
  const title = safeStr(raw.title);
  const reason = safeStr(raw.reason);
  const evidence = safeStr(raw.evidence);
  const duplicateKey = safeStr(raw.duplicateKey);
  if (!title || !reason || !evidence || !duplicateKey) return null;
  if (title.length > 40 || reason.length > 200 || evidence.length > 200) return null;
  if (duplicateKey.length > 200) return null;
  const action = raw.action;
  const actionType = action?.type;
  if (!actionType) return null;
  if (kind === "automation") {
    if (actionType !== "open_automation_create") return null;
    const automationTitle = safeStr(action.automationTitle);
    const suggestedPrompt = safeStr(action.suggestedPrompt);
    if (!automationTitle || !suggestedPrompt) return null;
    if (automationTitle.length > 100 || suggestedPrompt.length > 1e3) return null;
    return {
      kind,
      title,
      reason,
      evidence,
      duplicateKey,
      rawConfidence: 0.7,
      // LLM 分析产出的候选默认中等置信（需用户确认）
      action: { type: "open_automation_create", automationTitle, suggestedPrompt }
    };
  }
  if (kind === "skill") {
    if (actionType !== "open_skill_creator") return null;
    const topic = safeStr(action.topic);
    if (!topic) return null;
    if (topic.length > 100) return null;
    return {
      kind,
      title,
      reason,
      evidence,
      duplicateKey,
      rawConfidence: 0.65,
      action: { type: "open_skill_creator", topic }
    };
  }
  if (kind === "todo") {
    if (actionType !== "open_todo_create") return null;
    const todoTitle = safeStr(action.todoTitle);
    const todoNotes = safeStr(action.todoNotes);
    if (!todoTitle || todoTitle.length > 200 || (todoNotes?.length ?? 0) > 500) return null;
    return {
      kind,
      title,
      reason,
      evidence,
      duplicateKey,
      rawConfidence: 0.6,
      action: { type: "open_todo_create", title: todoTitle, ...todoNotes ? { notes: todoNotes } : {} }
    };
  }
  return null;
}
function validateAnalystCandidates(raw) {
  const result = [];
  const seen = /* @__PURE__ */ new Set();
  for (const item of raw) {
    const candidate = validateAnalystCandidate(item);
    if (!candidate) continue;
    if (seen.has(candidate.duplicateKey)) continue;
    seen.add(candidate.duplicateKey);
    result.push(candidate);
    if (result.length >= MAX_CANDIDATES) break;
  }
  return result;
}
async function runWorkPatternAnalysisDetailed() {
  if (!isMemoryLlmConfigured()) return { status: "unavailable", candidates: [], error: "\u5C1A\u672A\u914D\u7F6E\u7528\u4E8E\u5206\u6790\u7684 LLM" };
  const input = buildAnalysisInput();
  if (input === "\uFF08\u6682\u65E0\u8BB0\u5FC6\uFF09") return { status: "empty", candidates: [], error: "\u8FD8\u6CA1\u6709\u8DB3\u591F\u7684\u5DF2\u786E\u8BA4\u8BB0\u5FC6\u53EF\u4F9B\u5206\u6790" };
  try {
    const response = await callLlm(
      ANALYST_PROMPT,
      input,
      { temperature: 0.2, maxTokens: 4096, timeoutMs: 6e4 }
    );
    if (!response) return { status: "empty", candidates: [] };
    const candidates = validateAnalystCandidates(parseAnalystResponse(response));
    return candidates.length > 0 ? { status: "succeeded", candidates } : { status: "empty", candidates: [] };
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    const errorLabel = message.includes("timeout") || message.includes("timed out") ? "\u5206\u6790\u8BF7\u6C42\u8D85\u65F6\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5" : "\u5206\u6790\u670D\u52A1\u6682\u65F6\u4E0D\u53EF\u7528\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5";
    console.warn("[Analyst] \u5DE5\u4F5C\u6A21\u5F0F\u5206\u6790\u5931\u8D25:", error instanceof Error ? error.message : error);
    return { status: "failed", candidates: [], error: errorLabel };
  }
}
async function runWorkPatternAnalysis() {
  return (await runWorkPatternAnalysisDetailed()).candidates;
}
function analystAvailable() {
  return isMemoryLlmConfigured();
}
var ALLOWED_KINDS;
var MAX_CANDIDATES;
var ANALYST_PROMPT;
var init_analyst = __esm({
  "src/suggest/analyst.ts"() {
    "use strict";
    init_extractor();
    init_service2();
    init_provider();
    ALLOWED_KINDS = ["automation", "skill", "todo"];
    MAX_CANDIDATES = 3;
    ANALYST_PROMPT = `\u4F60\u662F\u4E00\u4F4D\u5DE5\u4F5C\u6A21\u5F0F\u5206\u6790\u52A9\u624B\u3002\u8BF7\u5206\u6790\u7528\u6237\u7684\u957F\u671F\u8BB0\u5FC6\uFF0C\u53D1\u73B0**\u91CD\u590D\u51FA\u73B0\u7684\u5DE5\u4F5C\u6A21\u5F0F**\uFF0C\u5E76\u7ED9\u51FA\u53EF\u6267\u884C\u7684\u5EFA\u8BAE\u3002

\u8F93\u5165\uFF1A
- \u8FD1\u671F\u8BB0\u5FC6\u6761\u76EE\uFF08fact/preference/correction/sop/todo_context \u7C7B\u578B\uFF09
- \u7528\u6237\u753B\u50CF\uFF08persona\uFF09
- \u5DF2\u751F\u6548\u7684\u884C\u4E3A\u7EA0\u6B63\u89C4\u5219
- \u5DF2\u5B58\u5728\u7684\u5B9A\u65F6\u4EFB\u52A1\u540D\u79F0\uFF08\u907F\u514D\u91CD\u590D\u63A8\u8350\uFF09

\u4EFB\u52A1\uFF1A
1. \u8BC6\u522B**\u91CD\u590D\u6A21\u5F0F**\uFF1A\u540C\u4E00\u7C7B\u64CD\u4F5C\u53CD\u590D\u51FA\u73B0\uFF08\u5982"\u6BCF\u6B21\u53D1\u7248\u524D\u68C0\u67E5\u6E05\u5355""\u6BCF\u5468\u8981\u624B\u52A8\u6C47\u603B"\uFF09
2. \u8BC6\u522B**\u53EF\u6C89\u6DC0\u7684\u6D41\u7A0B**\uFF08SOP\uFF09\uFF1A\u591A\u6B65\u9AA4\u64CD\u4F5C\u91CD\u590D \u22652 \u6B21
3. \u8BC6\u522B**\u503C\u5F97\u81EA\u52A8\u5316\u7684\u65E5\u5E38**\uFF1A\u5B9A\u671F/\u5468\u671F\u6027\u5DE5\u4F5C
4. \u8BC6\u522B**\u5F85\u786E\u8BA4\u7684\u504F\u597D**\uFF1A\u7528\u6237\u53CD\u590D\u8868\u8FBE\u4F46\u672A\u56FA\u5316\u7684\u89C4\u5219

\u8F93\u51FA\u683C\u5F0F\uFF08\u4E25\u683C JSON \u6570\u7EC4\uFF0C\u4E0D\u8981\u8F93\u51FA\u5176\u4ED6\u5185\u5BB9\uFF09\uFF1A
[
  {
    "kind": "automation" | "skill" | "todo",
    "title": "\u7B80\u77ED\u6807\u9898\uFF08\u226420 \u5B57\uFF09",
    "reason": "\u5EFA\u8BAE\u7406\u7531\uFF08\u4E00\u53E5\uFF0C\u89E3\u91CA\u4E3A\u4EC0\u4E48\u503C\u5F97\u505A\uFF09",
    "evidence": "\u8BC1\u636E\uFF08\u57FA\u4E8E\u54EA\u4E9B\u8BB0\u5FC6\u6761\u76EE\uFF09",
    "duplicateKey": "\u53BB\u91CD\u952E\uFF08\u5982 automation:\u6BCF\u5468\u53D1\u7248\u68C0\u67E5\uFF09",
    "action": {
      "type": "open_automation_create" | "open_skill_creator" | "open_todo_create",
      "automationTitle": "\uFF08automation \u7C7B\u578B\uFF09\u5EFA\u8BAE\u7684\u5B9A\u65F6\u4EFB\u52A1\u6807\u9898",
      "suggestedPrompt": "\uFF08automation \u7C7B\u578B\uFF09\u5B9A\u65F6\u4EFB\u52A1\u6267\u884C\u63D0\u793A\u8BCD",
      "topic": "\uFF08skill \u7C7B\u578B\uFF09Skill \u4E3B\u9898",
      "todoTitle": "\uFF08todo \u7C7B\u578B\uFF09\u5EFA\u8BAE\u521B\u5EFA\u7684 Todo \u6807\u9898",
      "todoNotes": "\uFF08todo \u7C7B\u578B\uFF0C\u53EF\u9009\uFF09\u8865\u5145\u8BF4\u660E"
    }
  }
]

\u7EA6\u675F\uFF1A
- \u53EA\u8F93\u51FA\u786E\u6709\u8BC1\u636E\u7684\u6A21\u5F0F\uFF0C\u4E0D\u786E\u5B9A\u5C31\u8F93\u51FA []
- \u4E0D\u8981\u91CD\u590D\u5DF2\u6709\u5B9A\u65F6\u4EFB\u52A1\uFF08\u89C1\u8F93\u5165\uFF09
- kind=automation \u65F6 action.type=open_automation_create\uFF1Bkind=skill \u65F6 open_skill_creator\uFF1Bkind=todo \u65F6 open_todo_create
- \u6BCF\u4E2A\u5019\u9009\u5FC5\u987B\u80FD\u56DE\u7B54"\u4E3A\u4EC0\u4E48\u73B0\u5728\u503C\u5F97\u505A"
`;
  }
});
var service_exports = {};
__export(service_exports, {
  clearAllSuggestions: () => clearAllSuggestions,
  dndActive: () => dndActive,
  evaluateNow: () => evaluateNow,
  evaluateSessionSuggestions: () => evaluateSessionSuggestions,
  getActionCardById: () => getActionCardById,
  getDnd: () => getDnd,
  getSuggestionAnalysisState: () => getSuggestionAnalysisState,
  getSuggestionById: () => getSuggestionById,
  getSuggestionRoiStats: () => getSuggestionRoiStats,
  getSuggestionStats: () => getSuggestionStats,
  getSuppressedSuggestionKeys: () => getSuppressedSuggestionKeys,
  getTypeWeights: () => getTypeWeights,
  groupSuggestionsByKind: () => groupSuggestionsByKind,
  handleSuggestionFeedback: () => handleSuggestionFeedback,
  listActionCards: () => listActionCards,
  listSuggestionsForUI: () => listSuggestionsForUI,
  removeSuggestion: () => removeSuggestion,
  runAnalysisAndPersist: () => runAnalysisAndPersist,
  runAnalysisAndPersistDetailed: () => runAnalysisAndPersistDetailed,
  setEnabledState: () => setEnabledState,
  shouldReduceSuggestionBudget: () => shouldReduceSuggestionBudget,
  suggestionsEnabledState: () => suggestionsEnabledState,
  updateDnd: () => updateDnd
});
function suggestionsEnabledState() {
  return suggestionsEnabled();
}
function setEnabledState(enabled) {
  setSuggestionsEnabled(enabled);
}
function getDnd() {
  return getDndConfig();
}
function updateDnd(cfg) {
  setDndConfig(cfg);
}
function dndActive(now) {
  return isInDnd(now);
}
async function evaluateNow(ctx) {
  if (!suggestionsEnabled()) return [];
  if (isInDnd()) return [];
  try {
    if (ctx.trigger === "session_start") {
      return listSuggestions("suggested").slice(0, 5);
    }
    const messages = ctx.messages ?? [];
    if (messages.length === 0) return [];
    const existing = listSuggestions("suggested");
    const existingForSession = existing.filter((r) => r.sessionId === ctx.sessionId);
    if (existingForSession.length >= DEFAULT_SUGGEST_OPTIONS.maxPerSession) return [];
    const input = {
      messages: messages.map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content })),
      sessionId: ctx.sessionId,
      existingSessionSuggestions: existingForSession,
      existingAutomationTitles: loadAutomationTitles(),
      existingCorrectionRules: loadCorrectionRules(),
      sopCandidateCount: loadSopCandidateCount()
    };
    const isMid = ctx.trigger === "session_mid" || ctx.trigger === "timer";
    const opts = isMid ? { ...DEFAULT_SUGGEST_OPTIONS, maxPerEvaluation: 1, threshold: 0.8 } : DEFAULT_SUGGEST_OPTIONS;
    if (shouldReduceBudget()) {
      opts.threshold = Math.max(opts.threshold, 0.9);
    }
    const result = evaluateSuggestions(input, readSuggestionsIndex(), opts);
    if (result.candidates.length === 0) return [];
    const candidate = result.candidates[0];
    if (!candidate) return [];
    if (isTypeSilenced(candidate.kind)) return [];
    if (isMid && ctx.suppressIfQuiet !== false) {
      if (candidate.kind !== "correction" && candidate.kind !== "automation") return [];
    }
    const record = persistSuggestion(candidate, ctx.sessionId);
    notifySuggestionsChanged();
    return [record];
  } catch (error) {
    console.warn("[Suggestion] evaluateNow \u8BC4\u4F30\u5931\u8D25:", error instanceof Error ? error.message : error);
    return [];
  }
}
async function evaluateSessionSuggestions(messages, ctx = {}) {
  return evaluateNow({ trigger: "session_end", messages, sessionId: ctx.sessionId });
}
function listSuggestionsForUI(status) {
  return listSuggestions(status);
}
function getSuggestionById(id) {
  return getSuggestion(id);
}
function listActionCards(status) {
  const records = listSuggestions();
  const cards = toActionCards(records);
  return status ? cards.filter((c) => c.status === status) : cards;
}
function getActionCardById(id) {
  const record = getSuggestion(id) ?? getSuggestionAcrossLayers(id)?.record;
  return record ? toActionCard(record) : void 0;
}
async function handleSuggestionFeedback(id, feedback, ctx = {}) {
  if (!suggestionsEnabled()) return { ok: false, error: "\u4E3B\u52A8\u5EFA\u8BAE\u5DF2\u5173\u95ED" };
  const across = getSuggestionAcrossLayers(id);
  if (!across) return { ok: false, error: "\u5EFA\u8BAE\u4E0D\u5B58\u5728" };
  const { record, layer } = across;
  let result;
  if (feedback === "accepted" && record.action.type === "memory_correction") {
    try {
      const correction = proposeCorrection({ raw: record.action.raw, rule: record.action.rule, sessionId: record.sessionId });
      if (correction?.id) {
        confirmCorrection(correction.id);
        console.log("[Suggestion] \u53CD\u9988\u56DE\u6D41\u95ED\u73AF: correction \u5EFA\u8BAE\u5DF2\u63A5\u53D7 \u2192 atom \u5199\u5165 + persona \u5237\u65B0");
      }
      result = { ok: true, executed: true, message: "\u7EA0\u6B63\u89C4\u5219\u5DF2\u5199\u5165\u957F\u671F\u8BB0\u5FC6\uFF08\u5305\u542B\u7528\u6237\u753B\u50CF\u56DE\u6D41\uFF09\u3002" };
    } catch (error) {
      console.warn("[Suggestion] \u5199\u5165\u7EA0\u6B63\u5019\u9009\u5931\u8D25:", error instanceof Error ? error.message : error);
      result = { ok: false, executed: false, message: `\u5199\u5165\u7EA0\u6B63\u89C4\u5219\u5931\u8D25\uFF1A${error instanceof Error ? error.message : String(error)}` };
    }
  } else if (feedback === "accepted") {
    result = await executeSuggestionAction(record.action, ctx);
  }
  recordFeedback(id, feedback, layer);
  return { ok: true, result };
}
function groupSuggestionsByKind(records) {
  const order = ["correction", "followup", "automation", "skill", "todo"];
  const groups = /* @__PURE__ */ new Map();
  for (const r of records) {
    const list = groups.get(r.kind) ?? [];
    list.push(r);
    groups.set(r.kind, list);
  }
  const result = [];
  for (const kind of order) {
    const items = groups.get(kind);
    if (items && items.length > 0) result.push({ kind, items });
  }
  return result;
}
function getSuggestionStats() {
  return suggestionStats();
}
function getSuggestionRoiStats(days = 7) {
  return suggestionRoiStats(days);
}
function shouldReduceSuggestionBudget() {
  return shouldReduceBudget();
}
function removeSuggestion(id) {
  return deleteSuggestion(id);
}
function clearAllSuggestions() {
  clearSuggestions();
  notifySuggestionsChanged();
}
function getTypeWeights() {
  return typeWeights();
}
function getSuppressedSuggestionKeys() {
  return getHighIgnoreDuplicateKeys(2);
}
async function runAnalysisAndPersistDetailed() {
  if (analysisInFlight) return analysisInFlight;
  const startedAt = Date.now();
  setAnalysisState({ status: "running", startedAt });
  const run = (async () => {
    try {
      if (!suggestionsEnabled()) {
        const result2 = { status: "unavailable", added: 0, message: "\u4E3B\u52A8\u5EFA\u8BAE\u5DF2\u5173\u95ED" };
        setAnalysisState({ ...result2, startedAt, completedAt: Date.now() });
        return result2;
      }
      const { runWorkPatternAnalysisDetailed: runWorkPatternAnalysisDetailed2 } = await Promise.resolve().then(() => (init_analyst(), analyst_exports));
      const analysis = await runWorkPatternAnalysisDetailed2();
      if (analysis.status === "unavailable" || analysis.status === "failed") {
        const result2 = { status: analysis.status, added: 0, message: analysis.error };
        setAnalysisState({ ...result2, startedAt, completedAt: Date.now() });
        return result2;
      }
      if (analysis.status === "empty") {
        const result2 = { status: "empty", added: 0, message: analysis.error };
        setAnalysisState({ ...result2, startedAt, completedAt: Date.now() });
        return result2;
      }
      const existing = listSuggestions();
      const existingKeys = new Set(existing.map((r) => r.duplicateKey));
      let added = 0;
      for (const candidate of analysis.candidates) {
        if (existingKeys.has(candidate.duplicateKey)) continue;
        persistSuggestion(candidate, void 0);
        existingKeys.add(candidate.duplicateKey);
        added += 1;
      }
      if (added > 0) notifySuggestionsChanged();
      const result = added > 0 ? { status: "succeeded", added } : { status: "empty", added: 0, message: "\u6CA1\u6709\u53D1\u73B0\u65B0\u7684\u53EF\u6C89\u6DC0\u6A21\u5F0F" };
      setAnalysisState({ ...result, startedAt, completedAt: Date.now() });
      console.log(`[Analyst] \u5DE5\u4F5C\u6A21\u5F0F\u5206\u6790\u5B8C\u6210: ${analysis.candidates.length} \u5019\u9009, \u65B0\u589E ${added} \u6761\u5EFA\u8BAE`);
      return result;
    } catch (error) {
      const result = { status: "failed", added: 0, message: "\u5206\u6790\u670D\u52A1\u6682\u65F6\u4E0D\u53EF\u7528\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5" };
      setAnalysisState({ ...result, startedAt, completedAt: Date.now() });
      console.warn("[Analyst] \u5206\u6790\u6301\u4E45\u5316\u5931\u8D25:", error instanceof Error ? error.message : error);
      return result;
    }
  })();
  analysisInFlight = run;
  void run.then(
    () => {
      if (analysisInFlight === run) analysisInFlight = null;
    },
    () => {
      if (analysisInFlight === run) analysisInFlight = null;
    }
  );
  return run;
}
async function runAnalysisAndPersist() {
  return (await runAnalysisAndPersistDetailed()).added;
}
function getSuggestionAnalysisState() {
  return getAnalysisState();
}
function loadAutomationTitles() {
  try {
    return getAutomationTitles();
  } catch {
    return [];
  }
}
function loadCorrectionRules() {
  try {
    return corrections("pending").map((c) => c.rule);
  } catch {
    return [];
  }
}
function loadSopCandidateCount() {
  try {
    return recentAtoms(100).filter((a) => a.type === "sop").length;
  } catch {
    return 0;
  }
}
function notifySuggestionsChanged() {
  notifySuggestionsChangedProvider();
}
var analysisInFlight;
var init_service = __esm({
  "src/suggest/service.ts"() {
    "use strict";
    init_feedback();
    init_engine();
    init_provider();
    init_actions();
    init_action_card();
    init_service2();
    analysisInFlight = null;
  }
});
function atomTopicTerms(atom) {
  const tokens = tokenize(`${atom.content} ${atom.metadata?.tags ?? ""}`.toLowerCase());
  const meaningful = tokens.filter((t) => t.length >= 2);
  return [...new Set(meaningful)];
}
function clusterAtomsToScenes(atoms, opts = {}) {
  const minShared = opts.minShared ?? SCENE_MERGE_MIN_SHARED;
  const scenes2 = [];
  const sorted = [...atoms].sort((a, b) => b.createdAt - a.createdAt);
  for (const atom of sorted) {
    const terms = atomTopicTerms(atom);
    if (terms.length === 0) continue;
    let bestIdx = -1;
    let bestShared = 0;
    for (let i = 0; i < scenes2.length; i++) {
      const shared = terms.filter((t) => scenes2[i].terms.includes(t)).length;
      if (shared > bestShared) {
        bestShared = shared;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0 && bestShared >= minShared && scenes2[bestIdx].atomIds.length < SCENE_MAX_ATOMS) {
      const scene = scenes2[bestIdx];
      scene.atomIds.push(atom.id);
      scene.terms = [.../* @__PURE__ */ new Set([...scene.terms, ...terms])];
    } else {
      scenes2.push({ title: atom.content.slice(0, 24), atomIds: [atom.id], terms });
    }
  }
  return scenes2;
}
function sceneHeat(scene, atomsById, now = Date.now()) {
  const members = scene.atomIds.map((id) => atomsById.get(id)).filter((a) => !!a);
  if (members.length === 0) return 0;
  const sumDecay = members.reduce((sum, a) => sum + timeDecay(a, now), 0);
  let heat = Math.min(100, Math.round(sumDecay * 20));
  const suppressedKeys = getSuppressedSuggestionKeys();
  if (suppressedKeys.length > 0) {
    const sceneText = scene.title.toLowerCase();
    const hit = suppressedKeys.some((key) => {
      const keyWords = tokenize(key).filter((t) => t.length >= 2);
      return keyWords.some((k) => sceneText.includes(k));
    });
    if (hit) heat = Math.round(heat * 0.5);
  }
  return heat;
}
function hotScenes(opts = {}) {
  const windowDays = opts.windowDays ?? SCENE_WINDOW_DAYS;
  const limit = Math.min(opts.limit ?? SCENE_MAX_SCENES, SCENE_MAX_SCENES);
  const now = opts.now ?? Date.now();
  const atoms = readAllAtoms({ includeUnconfirmed: false }).filter((a) => a.type !== "todo_context").filter((a) => now - a.createdAt <= windowDays * 864e5);
  if (atoms.length === 0) return [];
  const clusters = clusterAtomsToScenes(atoms);
  const atomsById = new Map(atoms.map((a) => [a.id, a]));
  return clusters.map((c) => {
    const members = c.atomIds.map((id) => atomsById.get(id)).filter((a) => !!a);
    const heat = sceneHeat(c, atomsById, now);
    const updatedAt = members.reduce((max, a) => Math.max(max, a.updatedAt), members[0]?.updatedAt ?? now);
    return {
      id: `scene_${randomUUID3().slice(0, 8)}`,
      title: c.title,
      atomIds: c.atomIds,
      heat,
      createdAt: now,
      updatedAt
    };
  }).sort((a, b) => b.heat - a.heat || b.updatedAt - a.updatedAt).slice(0, limit);
}
var SCENE_WINDOW_DAYS;
var SCENE_MERGE_MIN_SHARED;
var SCENE_MAX_ATOMS;
var SCENE_MAX_SCENES;
var init_scene = __esm({
  "src/memory/scene.ts"() {
    "use strict";
    init_store();
    init_recall();
    init_service();
    SCENE_WINDOW_DAYS = 7;
    SCENE_MERGE_MIN_SHARED = 2;
    SCENE_MAX_ATOMS = 30;
    SCENE_MAX_SCENES = 8;
  }
});
function detectPersonaOverload(markdown) {
  const text = markdown?.trim();
  if (!text) return { overloaded: false, lineCount: 0, sectionCount: 0, hint: "" };
  const bodyLines = text.split("\n").map((l) => l.trim()).filter((l) => l !== "" && !l.startsWith("<!-- persona-version:"));
  const sectionCount = bodyLines.filter((l) => /^##\s+/.test(l)).length;
  const lineCount = bodyLines.length;
  const overloaded = lineCount > 45 || sectionCount > 6;
  const hint = overloaded ? `\u753B\u50CF\u5DF2\u8D85\u8F7D\uFF08${lineCount} \u884C / ${sectionCount} \u4E2A\u7AE0\u8282\uFF09\u3002\u5EFA\u8BAE\u5728\u672C\u6B21\u66F4\u65B0\u4E2D\uFF1A1) \u5408\u5E76\u91CD\u590D\u7ED3\u8BBA\uFF1B2) \u628A\u540C\u8BED\u4E49\u6761\u76EE\u5408\u5E76\u4E3A\u4E00\u6761\uFF1B3) \u8FC7\u65F6\u5185\u5BB9\u5220\u9664\u6216\u6807\u6CE8\u5F85\u786E\u8BA4\uFF1B4) \u82E5\u51FA\u73B0\u591A\u4E2A\u72EC\u7ACB\u4E3B\u9898\uFF0C\u6309\u300C\u6F14\u8FDB\u8F68\u8FF9/\u957F\u671F\u504F\u597D/\u4EA4\u4E92\u534F\u8BAE\u300D\u5206\u8282\u5F52\u6863\uFF0C\u907F\u514D\u65E0\u9650\u8FFD\u52A0\u3002` : "";
  return { overloaded, lineCount, sectionCount, hint };
}
function detectPersonaOverloadByLayer(globalRaw, projectRaw) {
  const layers = [detectPersonaOverload(globalRaw), detectPersonaOverload(projectRaw)];
  const merged = layers.reduce(
    (acc, cur) => ({
      overloaded: acc.overloaded || cur.overloaded,
      lineCount: Math.max(acc.lineCount, cur.lineCount),
      sectionCount: Math.max(acc.sectionCount, cur.sectionCount),
      hint: cur.hint || acc.hint
    }),
    { overloaded: false, lineCount: 0, sectionCount: 0, hint: "" }
  );
  return merged;
}
function formatAtomsForPersona(atoms, maxAtoms = 40) {
  const lines = atoms.slice(0, maxAtoms).map((a, i) => {
    return `${i + 1}. [${a.type}|pri=${a.priority}] ${a.content}\uFF08\u6765\u6E90: ${new Date(a.createdAt).toISOString().slice(0, 10)}\uFF0Cid: ${a.id}\uFF09`;
  });
  return lines.join("\n");
}
async function generatePersona(opts = {}) {
  const atoms = readAllAtoms({ includeUnconfirmed: false }).filter((a) => a.type !== "todo_context").sort((a, b) => b.priority - a.priority);
  if (atoms.length === 0) return void 0;
  const atomText = formatAtomsForPersona(atoms, opts.maxAtoms);
  const existingText = opts.existing?.trim();
  const overload = detectPersonaOverload(existingText);
  const overloadInstruction = overload.overloaded ? `

\u26A0\uFE0F \u73B0\u6709\u753B\u50CF\u5DF2\u8D85\u8F7D\uFF08${overload.lineCount} \u884C / ${overload.sectionCount} \u4E2A\u7AE0\u8282\uFF09\u3002\u8BF7\u5728\u5408\u5E76\u65F6\u4E3B\u52A8\u7CBE\u7B80\uFF1A\u5408\u5E76\u91CD\u590D\u6761\u76EE\u3001\u5220\u9664\u8FC7\u65F6\u5185\u5BB9\u3001\u63A7\u5236\u603B\u884C\u6570\u5728 45 \u884C\u4EE5\u5185\u3002` : "";
  const userText = existingText ? `\u5DF2\u6709 persona\uFF1A
---
${existingText}
---

\u65B0\u8BB0\u5FC6\u6761\u76EE\uFF1A
${atomText}

\u8BF7\u5408\u5E76\u66F4\u65B0 persona\uFF0C\u4FDD\u7559\u7A33\u5B9A\u5185\u5BB9\uFF0C\u53EA\u66F4\u65B0\u6709\u8BC1\u636E\u7684\u53D8\u5316\u3002${overloadInstruction}` : `\u8BB0\u5FC6\u6761\u76EE\uFF1A
${atomText}

\u8BF7\u751F\u6210\u521D\u59CB persona\u3002`;
  const raw = await callLlm(PERSONA_SYSTEM_PROMPT, userText, { temperature: 0.3, maxTokens: 4096 });
  if (!raw) return void 0;
  const cleaned = cleanPersonaMarkdown(raw);
  return cleaned || void 0;
}
function cleanPersonaMarkdown(raw) {
  let text = raw.trim();
  const fence = text.match(/```(?:markdown|md)?\s*([\s\S]*?)```/);
  if (fence) text = fence[1]?.trim() ?? text;
  const hashIndex = text.indexOf("#");
  if (hashIndex > 0 && hashIndex < 200) {
    text = text.slice(hashIndex).trim();
  }
  return text;
}
function buildPersonaFromRules() {
  const atoms = readAllAtoms({ includeUnconfirmed: false });
  if (atoms.length === 0) return void 0;
  const lines = ["# \u7528\u6237\u753B\u50CF", "", "## \u7528\u6237", ""];
  const nameAtom = atoms.find((a) => /叫|姓名|名字|我是/i.test(a.content) && a.type === "fact");
  lines.push(nameAtom ? extractName(nameAtom.content) : "\u7528\u6237");
  lines.push("", "## \u4E00\u53E5\u8BDD\u5B9A\u4F4D", "");
  const fact = atoms.find((a) => a.type === "fact");
  lines.push(fact ? fact.content.slice(0, 40) : "\uFF08\u5F85 LLM \u751F\u6210\uFF09");
  lines.push("", "## \u957F\u671F\u504F\u597D", "");
  const prefs = atoms.filter((a) => a.type === "preference").slice(0, 5);
  if (prefs.length > 0) for (const p of prefs) lines.push(`- ${p.content.slice(0, 50)}\uFF08src: ${p.id}\uFF09`);
  else lines.push("- \uFF08\u6682\u65E0\u660E\u786E\u504F\u597D\uFF09");
  lines.push("", "## \u4EA4\u4E92\u534F\u8BAE", "");
  const corrections2 = atoms.filter((a) => a.type === "correction").slice(0, 3);
  if (corrections2.length > 0) for (const c of corrections2) lines.push(`- ${c.content.slice(0, 60)}\uFF08src: ${c.id}\uFF09`);
  else lines.push("- \uFF08\u6682\u65E0\u660E\u786E\u4EA4\u4E92\u534F\u8BAE\uFF09");
  lines.push("", "## \u6F14\u8FDB\u8F68\u8FF9", "", "- \uFF08\u6682\u65E0\uFF09");
  return lines.join("\n");
}
function extractName(content) {
  const match = content.match(/(?:叫|姓名是|名字是|我是)\s*([\u4e00-\u9fffA-Za-z][\u4e00-\u9fffA-Za-z0-9_]{0,20})/);
  if (match?.[1]) return match[1];
  return content.slice(0, 20);
}
function extractPersonaSources(markdown) {
  const lines = markdown.split("\n");
  const result = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("- ")) continue;
    const srcMatch = trimmed.match(/（src:\s*([^）]+)）\s*$/);
    let text = trimmed.replace(/^- /, "").trim();
    const sources = [];
    if (srcMatch && srcMatch[1]) {
      text = trimmed.slice(0, srcMatch.index ?? trimmed.length).replace(/^- /, "").trim();
      sources.push(...srcMatch[1].split(",").map((s) => s.trim()).filter((s) => s.startsWith("atom_")));
    }
    result.push({ text, sources });
  }
  return result;
}
var PERSONA_SYSTEM_PROMPT;
var init_persona = __esm({
  "src/memory/persona.ts"() {
    "use strict";
    init_extractor();
    init_store();
    PERSONA_SYSTEM_PROMPT = `\u4F60\u662F\u7528\u6237\u753B\u50CF\u6784\u5EFA\u5668\u3002\u57FA\u4E8E\u300C\u957F\u671F\u8BB0\u5FC6\u6761\u76EE\uFF08L1 atoms\uFF09\u300D\u6784\u5EFA\u6216\u66F4\u65B0\u7528\u6237\u7684\u957F\u671F\u753B\u50CF\uFF08persona\uFF09\u3002

\u89C4\u5219\uFF1A
1. \u53EA\u4F7F\u7528\u63D0\u4F9B\u7684\u8BB0\u5FC6\u6761\u76EE\u4E2D"\u660E\u786E\u51FA\u73B0"\u7684\u4FE1\u606F\uFF0C\u7981\u6B62\u63A8\u6D4B\u3001\u7F16\u9020\u3001\u8865\u5E38\u8BC6\u3002
2. \u8F93\u51FA\u5FC5\u987B\u662F Markdown \u683C\u5F0F\uFF0C\u7ED3\u6784\u5982\u4E0B\uFF1A

# \u7528\u6237\u753B\u50CF

## \u7528\u6237
<\u79F0\u547C/\u59D3\u540D\uFF1B\u672A\u77E5\u5219\u5199"\u7528\u6237">

## \u4E00\u53E5\u8BDD\u5B9A\u4F4D
<\u4E00\u53E5\u8BDD\u6982\u62EC\u7528\u6237\u8EAB\u4EFD/\u5DE5\u4F5C\u91CD\u70B9\uFF0C30 \u5B57\u5185>

## \u957F\u671F\u504F\u597D
- <\u504F\u597D1>
- <\u504F\u597D2>

## \u4EA4\u4E92\u534F\u8BAE
- <\u7528\u6237\u5E0C\u671B Agent \u5982\u4F55\u5DE5\u4F5C\uFF0C\u5982"\u5148\u8C03\u7814\u518D\u52A8\u624B"\u3001"\u4F18\u5148\u4E2D\u6587"\uFF1B\u65E0\u5219\u5199"\uFF08\u6682\u65E0\u660E\u786E\u4EA4\u4E92\u534F\u8BAE\uFF09">

## \u6F14\u8FDB\u8F68\u8FF9
- <\u91CD\u8981\u9636\u6BB5/\u53D8\u5316\uFF0C\u5982"2026-08\uFF1A\u5F00\u59CB\u505A proactive memory">\uFF1B\u65E0\u5219\u5199"\uFF08\u6682\u65E0\uFF09"

3. \u504F\u597D/\u534F\u8BAE\u6BCF\u6761 10-40 \u5B57\uFF0C\u76F4\u63A5\u53EF\u6267\u884C\uFF0C\u4E0D\u8981\u6A21\u68F1\u4E24\u53EF\u3002
4. \u5982\u679C\u63D0\u4F9B\u5DF2\u6709 persona\uFF0C\u5408\u5E76\u65F6\u4FDD\u7559\u7A33\u5B9A\u5185\u5BB9\uFF0C\u53EA\u66F4\u65B0\u6709\u8BC1\u636E\u652F\u6491\u7684\u53D8\u5316\u3002
5. **\u8BC1\u636E\u6EAF\u6E90\uFF08\u5FC5\u987B\uFF09**\uFF1A\u6BCF\u6761\u504F\u597D/\u534F\u8BAE/\u5B9A\u4F4D/\u6F14\u8FDB\u6761\u76EE\u672B\u5C3E\u8FFD\u52A0\u300C\uFF08src: atom_xxx,atom_yyy\uFF09\u300D,
   src \u5FC5\u987B\u662F\u8F93\u5165\u8BB0\u5FC6\u6761\u76EE\u6807\u53F7\uFF08\u5982 [1] \u5BF9\u5E94 id: atom_xxx\uFF09\u3002\u5982\u679C\u67D0\u6761\u7ED3\u8BBA\u65E0\u6CD5\u5BF9\u5E94\u4EFB\u4F55\u8F93\u5165\u6761\u76EE\uFF0C\u6807\u6CE8\u300C\uFF08src: \u672A\u77E5\uFF09\u300D\u3002
   \u4E0D\u8981\u628A src \u5F53\u6210\u753B\u50CF\u5185\u5BB9\u672C\u8EAB\uFF0C\u5B83\u662F\u7528\u4E8E\u6EAF\u6E90\u7684\u884C\u5185\u6807\u6CE8\u3002
6. \u53EA\u8F93\u51FA Markdown \u672C\u8EAB\uFF0C\u4E0D\u8981\u989D\u5916\u89E3\u91CA\u3002`;
  }
});
var service_exports2 = {};
__export(service_exports2, {
  DEFAULT_RECALL_LIMIT_: () => DEFAULT_RECALL_LIMIT_,
  atomById: () => atomById,
  atomsPaged: () => atomsPaged,
  captureCandidate: () => captureCandidate,
  captureCandidates: () => captureCandidates,
  clearAllMemoryState: () => clearAllMemoryState,
  confirmAtomById: () => confirmAtomById,
  confirmCorrection: () => confirmCorrection,
  contextForMessage: () => contextForMessage,
  corrections: () => corrections,
  daysSinceLastMemoryUpdate: () => daysSinceLastMemoryUpdate,
  ensurePersona: () => ensurePersona,
  extractAndCapture: () => extractAndCapture,
  extractFromConversation: () => extractFromConversation,
  extractionMode: () => extractionMode,
  getHotScenes: () => getHotScenes,
  hotScenesSummary: () => hotScenesSummary,
  isLlmConfigured: () => isLlmConfigured,
  memoryActivity: () => memoryActivity,
  memoryEnabled: () => memoryEnabled,
  memoryReviewOpportunity: () => memoryReviewOpportunity,
  mergePersonaRaw: () => mergePersonaRaw,
  pendingAtoms: () => pendingAtoms,
  persona: () => persona,
  personaInjectionEnabled: () => personaInjectionEnabled,
  personaOverloadHint: () => personaOverloadHint,
  personaRaw: () => personaRaw,
  personaSources: () => personaSources,
  personaTraceable: () => personaTraceable,
  proposeCorrection: () => proposeCorrection,
  recentAtoms: () => recentAtoms,
  regeneratePersona: () => regeneratePersona,
  rejectAtomById: () => rejectAtomById,
  rejectCorrection: () => rejectCorrection,
  removePersona: () => removePersona,
  savePersona: () => savePersona,
  scenes: () => scenes,
  search: () => search,
  searchAsText: () => searchAsText,
  searchAsync: () => searchAsync,
  setEnabled: () => setEnabled,
  setExtractionModeState: () => setExtractionModeState,
  setPersonaInjectionEnabledState: () => setPersonaInjectionEnabledState,
  stats: () => stats,
  undoCorrection: () => undoCorrection,
  updatePersona: () => updatePersona,
  workingMemory: () => workingMemory
});
function memoryEnabled() {
  return isMemoryEnabled();
}
function extractionMode() {
  return getExtractionMode();
}
function setExtractionModeState(mode) {
  setExtractionMode(mode);
  appendMemoryLog(`\u63D0\u53D6\u6A21\u5F0F\u5207\u6362\u4E3A: ${mode}`);
}
function personaInjectionEnabled() {
  return isPersonaInjectionEnabled();
}
function setPersonaInjectionEnabledState(enabled) {
  setPersonaInjectionEnabled(enabled);
  appendMemoryLog(enabled ? "\u5F00\u542F persona \u753B\u50CF\u6CE8\u5165" : "\u5173\u95ED persona \u753B\u50CF\u6CE8\u5165\uFF08\u4E0D\u518D\u968F\u7CFB\u7EDF\u63D0\u793A\u53D1\u9001\uFF09");
}
function removePersona() {
  const ok = deletePersona();
  if (ok) appendMemoryLog("\u7528\u6237\u5220\u9664 persona \u753B\u50CF");
  return ok;
}
function clearAllMemoryState() {
  clearAllMemory();
  appendMemoryLog("\u7528\u6237\u6E05\u7A7A\u5168\u90E8\u8BB0\u5FC6");
}
function setEnabled(enabled) {
  setMemoryEnabled(enabled);
  appendMemoryLog(enabled ? "\u8BB0\u5FC6\u529F\u80FD\u5DF2\u542F\u7528" : "\u8BB0\u5FC6\u529F\u80FD\u5DF2\u5173\u95ED");
}
function stats() {
  return getMemoryStats();
}
function memoryActivity() {
  return getMemoryActivity();
}
function daysSinceLastMemoryUpdate() {
  return getMemoryActivity().daysSinceLastUpdate;
}
function memoryReviewOpportunity(reviewIntervalDays = 3) {
  const activity = getMemoryActivity();
  if (activity.lastUpdatedAt === 0) return void 0;
  if (activity.daysSinceLastUpdate < reviewIntervalDays) return void 0;
  return {
    daysSince: activity.daysSinceLastUpdate,
    reviewDue: true,
    message: `\u8BB0\u5FC6\u5DF2\u6709 ${activity.daysSinceLastUpdate} \u5929\u6CA1\u6709\u66F4\u65B0\u4E86\u2014\u2014\u5EFA\u8BAE\u505A\u4E00\u6B21\u4E3B\u52A8\u590D\u67E5\uFF1A\u786E\u8BA4\u8FD1\u671F\u884C\u4E3A\u89C4\u5219\u3001\u6E05\u7406\u8FC7\u65F6\u8BB0\u5FC6\u3001\u5FC5\u8981\u65F6\u66F4\u65B0\u753B\u50CF\uFF08persona\uFF09\u3002`
  };
}
function contextForMessage(userText, opts = {}) {
  if (!isMemoryEnabled()) return "";
  try {
    return buildMemoryContextForMessage(userText, opts);
  } catch (error) {
    console.error("[Memory] \u6784\u5EFA\u56DE\u5FC6\u4E0A\u4E0B\u6587\u5931\u8D25:", error);
    return "";
  }
}
function search(request) {
  return searchMemoriesByKeyword(request);
}
async function searchAsync(request) {
  const providerReady = (await Promise.resolve().then(() => (init_embedding(), embedding_exports))).getEmbeddingProvider();
  if (providerReady) {
    return searchMemoriesHybrid(request);
  }
  return searchMemoriesByKeyword(request);
}
function searchAsText(request) {
  const result = searchMemoriesByKeyword(request);
  if (result.hits.length === 0) return "\u672A\u627E\u5230\u76F8\u5173\u8BB0\u5FC6\u3002";
  return formatRecallContext(result) || "\u672A\u627E\u5230\u76F8\u5173\u8BB0\u5FC6\u3002";
}
function captureCandidate(candidate, ctx = {}, opts = {}) {
  if (!isMemoryEnabled()) throw new Error("\u8BB0\u5FC6\u529F\u80FD\u5DF2\u5173\u95ED");
  const result = writeAtomWithDedup(
    {
      content: candidate.content.trim(),
      type: candidate.type,
      priority: candidate.priority ?? 50,
      sessionId: ctx.sessionId,
      workspaceSlug: ctx.workspaceSlug,
      confirmed: opts.confirmed ?? true
    },
    { scope: ctx.scope, forceScope: opts.forceScope }
  );
  appendMemoryLog(`\u624B\u52A8\u6C89\u6DC0: [${result.atom.type}] ${result.atom.content.slice(0, 60)}${result.deduplicated ? "\uFF08\u5408\u5E76\u5DF2\u6709" + (result.source ? "\uFF0C\u6E90\u81EA" + result.source + "\u5C42" : "") + "\uFF09" : ""}${result.atom.confirmed ? "" : "\uFF08\u5F85\u786E\u8BA4\uFF09"}`);
  return { stored: !result.deduplicated, deduplicated: result.deduplicated, atom: result.atom };
}
function captureCandidates(candidates, ctx = {}, opts = {}) {
  let storedCount = 0;
  let deduplicatedCount = 0;
  const atoms = [];
  for (const candidate of candidates) {
    if (!candidate.content?.trim()) continue;
    try {
      const result = captureCandidate(candidate, ctx, opts);
      atoms.push(result.atom);
      if (result.stored) storedCount += 1;
      else deduplicatedCount += 1;
    } catch (error) {
      console.warn("[Memory] \u5199\u5165\u5019\u9009\u5931\u8D25:", candidate.content.slice(0, 40), error);
    }
  }
  if (storedCount > 0 || deduplicatedCount > 0) {
    appendMemoryLog(`\u81EA\u52A8\u63D0\u53D6: \u65B0\u589E ${storedCount} \u6761\uFF0C\u5408\u5E76\u53BB\u91CD ${deduplicatedCount} \u6761${opts.confirmed ? "" : "\uFF08\u5F85\u786E\u8BA4\uFF09"}`);
  }
  return { storedCount, deduplicatedCount, atoms };
}
function proposeCorrection(input) {
  if (!isMemoryEnabled()) throw new Error("\u8BB0\u5FC6\u529F\u80FD\u5DF2\u5173\u95ED");
  const rule = (input.rule ?? "").trim();
  if (!rule || rule.length < 2 || rule.length > 500) {
    console.warn("[Memory] \u62D2\u7EDD\u975E\u6CD5\u7EA0\u6B63\u89C4\u5219\uFF08\u957F\u5EA6\u5F02\u5E38\uFF09:", rule.slice(0, 40));
    throw new Error("\u7EA0\u6B63\u89C4\u5219\u5185\u5BB9\u4E0D\u5408\u6CD5");
  }
  const correction = addCorrection({ raw: (input.raw ?? "").trim().slice(0, 1e3), rule, sessionId: input.sessionId, scope: input.scope });
  appendMemoryLog(`\u65B0\u589E\u884C\u4E3A\u7EA0\u6B63\u5019\u9009: ${correction.rule.slice(0, 60)}`);
  return correction;
}
function corrections(status) {
  return listCorrections(status);
}
function confirmCorrection(id) {
  const correction = updateCorrectionStatus(id, "active");
  if (!correction) return false;
  appendMemoryLog(`\u884C\u4E3A\u7EA0\u6B63\u5DF2\u751F\u6548: ${correction.rule.slice(0, 60)}`);
  writeAtom({
    content: correction.rule,
    type: "correction",
    priority: 80,
    confirmed: true,
    sessionId: correction.sessionId,
    metadata: { correctionId: correction.id }
  });
  void ensurePersona().catch(() => void 0);
  return true;
}
function rejectCorrection(id) {
  return !!updateCorrectionStatus(id, "rejected");
}
function undoCorrection(id) {
  const correction = updateCorrectionStatus(id, "rejected");
  if (!correction) return false;
  appendMemoryLog(`\u64A4\u9500\u884C\u4E3A\u7EA0\u6B63: ${correction.rule.slice(0, 60)}`);
  const atom = readAllAtoms({ includeUnconfirmed: true }).find(
    (a) => a.type === "correction" && a.metadata?.correctionId === id
  );
  if (atom) deleteAtom(atom.id);
  void ensurePersona().catch(() => void 0);
  return true;
}
function pendingAtoms() {
  return listPendingAtoms();
}
function atomsPaged(opts = {}) {
  return listAtomsPaged(opts);
}
function confirmAtomById(id) {
  const atom = confirmAtom(id);
  if (atom) {
    appendMemoryLog(`\u786E\u8BA4\u8BB0\u5FC6: [${atom.type}] ${atom.content.slice(0, 60)}`);
    if (atom.type === "correction" || atom.type === "preference" || atom.type === "sop") {
      void ensurePersona().catch(() => void 0);
    }
  }
  return atom;
}
function rejectAtomById(id) {
  const ok = deleteAtom(id);
  if (ok) appendMemoryLog(`\u62D2\u7EDD\u8BB0\u5FC6: ${id}`);
  return ok;
}
function personaRaw(scope = "auto") {
  if (scope === "global") return readPersonaRaw("global");
  if (scope === "project") return readPersonaRaw("project");
  return mergePersonaRaw(readPersonaRaw("global"), readPersonaRaw("project"));
}
function mergePersonaRaw(globalRaw, projectRaw) {
  const g = globalRaw?.trim();
  const p = projectRaw?.trim();
  if (!g && !p) return void 0;
  if (g && !p) return g;
  if (!g && p) return p;
  const sections = /* @__PURE__ */ new Map();
  const order = [];
  const semanticKey = (item) => item.replace(/（scope: [^）]+）/g, "").replace(/（src: [^）]+）/g, "").replace(/\s+\[src:[^\]]+\]$/g, "").replace(/\s+（scope: [^）]+）$/g, "").trim();
  const addSection = (raw, scopeLabel) => {
    let current = "general";
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (/^#{1,3}\s+/.test(t)) {
        current = t.replace(/^#{1,3}\s+/, "");
        if (!sections.has(current)) {
          sections.set(current, []);
          order.push(current);
        }
        continue;
      }
      if (!t || !t.startsWith("- ")) continue;
      const item = t;
      const existing = sections.get(current) ?? [];
      const dup = existing.some((x) => semanticKey(x) === semanticKey(item));
      if (dup) continue;
      existing.push(`${item}\uFF08scope: ${scopeLabel}\uFF09`);
    }
  };
  addSection(p, "project");
  addSection(g, "global");
  const out = [];
  for (const sec of order) {
    const lines = sections.get(sec) ?? [];
    for (const l of lines) out.push(l);
  }
  return out.join("\n") + "\n";
}
function personaSources() {
  const raw = personaRaw();
  if (!raw) return [];
  return extractPersonaSources(raw);
}
function personaTraceable() {
  return isPersonaTraceable();
}
function personaOverloadHint() {
  return detectPersonaOverloadByLayer(readPersonaRaw("global"), readPersonaRaw("project"));
}
async function regeneratePersona() {
  return ensurePersona();
}
function persona() {
  return parsePersonaProfile(personaRaw());
}
function updatePersona(markdown) {
  writePersona(markdown, "global");
  appendMemoryLog("\u7528\u6237\u753B\u50CF\u5DF2\u66F4\u65B0\uFF08global\uFF09");
}
function savePersona(markdown, scope = "project") {
  writePersona(markdown, scope);
  appendMemoryLog(`\u7528\u6237\u624B\u52A8\u7F16\u8F91 persona \u753B\u50CF\uFF08${scope}\uFF09`);
}
async function ensurePersona() {
  const existing = readPersonaRaw();
  const forceRegenerate = existing ? !isPersonaTraceable() : false;
  try {
    if (isMemoryLlmConfigured()) {
      const markdown = await generatePersona({ existing });
      if (markdown) {
        writePersona(markdown);
        appendMemoryLog(forceRegenerate ? "\u7528\u6237\u753B\u50CF\u5DF2\u91CD\u751F\u6210\uFF08\u6EAF\u6E90\u7248\u672C\uFF09" : existing ? "\u7528\u6237\u753B\u50CF\u5DF2\u589E\u91CF\u66F4\u65B0" : "\u7528\u6237\u753B\u50CF\u5DF2\u751F\u6210");
        return true;
      }
    }
    if (!existing || forceRegenerate) {
      const fallback = buildPersonaFromRules();
      if (fallback) {
        writePersona(fallback);
        appendMemoryLog(forceRegenerate ? "\u7528\u6237\u753B\u50CF\u5DF2\u91CD\u751F\u6210\uFF08\u89C4\u5219\u7248\u515C\u5E95\uFF0C\u6EAF\u6E90\u7248\u672C\uFF09" : "\u7528\u6237\u753B\u50CF\u5DF2\u751F\u6210\uFF08\u89C4\u5219\u7248\u515C\u5E95\uFF09");
        return true;
      }
    }
    return false;
  } catch (error) {
    console.warn("[Memory] persona \u751F\u6210\u5931\u8D25:", error instanceof Error ? error.message : error);
    return false;
  }
}
function recentAtoms(limit = 20) {
  return readAllAtoms({ includeUnconfirmed: false }).slice(0, limit);
}
function workingMemory(limit = 5) {
  const atoms = readAllAtoms({ includeUnconfirmed: false });
  const tasks = atoms.filter((a) => a.type === "todo_context").sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || b.createdAt - a.createdAt).slice(0, limit);
  if (tasks.length === 0) return { items: [] };
  return {
    items: tasks.map((t) => t.content),
    updatedAt: tasks[0]?.createdAt
  };
}
function atomById(id) {
  return getAtomById(id);
}
function scenes() {
  return readAllScenes();
}
function getHotScenes(opts = {}) {
  return hotScenes(opts);
}
function hotScenesSummary(limit = 3) {
  try {
    const scenes2 = getHotScenes({ limit });
    if (scenes2.length === 0) return "";
    return scenes2.map((s) => `- [${s.title}] heat=${s.heat} atoms=${s.atomIds.length}`).join("\n");
  } catch {
    return "";
  }
}
async function extractFromConversation(input) {
  const candidates = [];
  let correctionCount = 0;
  const mode_ = getExtractionMode();
  if (mode_ === "off") {
    return { storedCount: 0, deduplicatedCount: 0, atoms: [], corrections: 0, mode: "none" };
  }
  const messages = (input.messages ?? []).filter(
    (m) => m && typeof m.content === "string" && m.content.trim().length > 0
  );
  if (messages.length === 0) {
    return { storedCount: 0, deduplicatedCount: 0, atoms: [], corrections: 0, mode: "none" };
  }
  let mode = "none";
  if (mode_ === "llm" && isMemoryLlmConfigured()) {
    try {
      const llmCandidates = await extractFromMessages(messages);
      if (llmCandidates.length > 0) {
        candidates.push(...llmCandidates);
        mode = "llm";
      }
    } catch (error) {
      console.warn("[Memory] LLM \u63D0\u53D6\u5931\u8D25\uFF0C\u56DE\u9000\u89C4\u5219\u7248:", error instanceof Error ? error.message : error);
    }
  }
  if (mode_ === "rule" || candidates.length === 0) {
    for (const msg of messages) {
      if (msg.role !== "user") continue;
      const text = msg.content.trim();
      if (text.length < 4) continue;
      const correctionMatch = text.match(/(?:以后|下次|记住|别再|不要|请记住)[^。！？\n]{2,80}/);
      if (correctionMatch) {
        const raw = correctionMatch[0].trim();
        proposeCorrection({ raw, rule: raw, sessionId: input.sessionId, scope: input.scope });
        correctionCount += 1;
        mode = "rule";
      }
      const prefMatch = text.match(/(?:我喜欢|我偏好|我更倾向|用|使用)[^。！？\n]{2,80}/);
      if (prefMatch) {
        candidates.push({ content: prefMatch[0].trim(), type: "preference", priority: 60 });
        mode = "rule";
      }
    }
  }
  const result = captureCandidates(
    candidates,
    { sessionId: input.sessionId, workspaceSlug: input.workspaceSlug, scope: input.scope },
    { confirmed: false }
  );
  if (result.storedCount > 0 || correctionCount > 0) {
    markExtractionCompleted();
    void ensurePersona().catch(() => void 0);
  }
  return { ...result, corrections: correctionCount, mode };
}
async function extractAndCapture(messages, ctx = {}) {
  if (!isMemoryEnabled()) return { storedCount: 0, corrections: 0, mode: "none" };
  const result = await extractFromConversation({
    messages,
    sessionId: ctx.sessionId,
    workspaceSlug: ctx.workspaceSlug
  });
  if (result.storedCount > 0 || result.corrections > 0) {
    console.log(`[Memory] \u4E3B\u52A8\u8BB0\u5FC6\u6355\u83B7\u5B8C\u6210: ${result.storedCount} \u6761\u65B0\u589E, ${result.corrections} \u6761\u7EA0\u6B63, mode=${result.mode}`);
  }
  return { storedCount: result.storedCount, corrections: result.corrections, mode: result.mode };
}
function isLlmConfigured() {
  return isMemoryLlmConfigured();
}
var DEFAULT_RECALL_LIMIT_;
var init_service2 = __esm({
  "src/memory/service.ts"() {
    "use strict";
    init_store();
    init_scene();
    init_recall();
    init_extractor();
    init_persona();
    DEFAULT_RECALL_LIMIT_ = DEFAULT_RECALL_LIMIT;
  }
});
init_service2();
init_service();
init_provider();
init_paths();
init_provider();
init_service2();
init_project();
init_ttl();

// packages/dsh-proactive-core/src/plugin.ts
var name = "proactive-core";
var inject = [];
var Config = z.object({
  /** 是否把 dsh 宿主凭据桥接为 MEMORY_LLM_*（core 提取/分析用）；显式 env 优先 */
  bridgeLlmCredentials: z.boolean().default(true),
  /** 桥接来源 ref（默认 DEEPSEEK_API_KEY，dsh 模型路由的标准凭据） */
  llmApiKeyRef: z.string().default("DEEPSEEK_API_KEY"),
  /** 桥接 baseUrl（dsh 官方 DeepSeek 兼容端点；留空则不覆盖 MEMORY_LLM_BASE_URL） */
  llmBaseUrl: z.string().default(""),
  /** 桥接 model（留空则不覆盖 MEMORY_LLM_MODEL，此时需宿主侧有默认路由） */
  llmModel: z.string().default("")
});
function apply(ctx, config) {
  const cfg = { ...config };
  ctx.provide("paCore", { memoryService: service_exports2, suggestService: service_exports });
  if (cfg.bridgeLlmCredentials !== false) {
    const apiKeyRef = cfg.llmApiKeyRef || "DEEPSEEK_API_KEY";
    void (async () => {
      try {
        if (process.env.MEMORY_LLM_API_KEY) return;
        const creds = ctx.credentials;
        if (!creds?.resolve) return;
        const resolved = await creds.resolve(apiKeyRef);
        if (resolved?.value) {
          process.env.MEMORY_LLM_API_KEY = resolved.value;
          ctx.logger?.info?.(`[proactive-core] LLM \u51ED\u636E\u6865\u63A5: ${apiKeyRef} \u2192 MEMORY_LLM_API_KEY\uFF08\u8BB0\u5FC6\u63D0\u53D6/\u5206\u6790\u542F\u7528 LLM \u6A21\u5F0F\uFF09`);
          if (cfg.llmBaseUrl && !process.env.MEMORY_LLM_BASE_URL) {
            process.env.MEMORY_LLM_BASE_URL = cfg.llmBaseUrl;
          }
          if (cfg.llmModel && !process.env.MEMORY_LLM_MODEL) {
            process.env.MEMORY_LLM_MODEL = cfg.llmModel;
          }
        } else {
          ctx.logger?.info?.("[proactive-core] \u672A\u627E\u5230\u5BBF\u4E3B LLM \u51ED\u636E\uFF0C\u8BB0\u5FC6\u63D0\u53D6\u4FDD\u6301 rule \u964D\u7EA7\u6A21\u5F0F");
        }
      } catch (error) {
        ctx.logger?.warn?.("[proactive-core] LLM \u51ED\u636E\u6865\u63A5\u5931\u8D25\uFF08\u4E0D\u5F71\u54CD\u5F15\u64CE\u542F\u52A8\uFF09:", error instanceof Error ? error.message : error);
      }
    })();
  }
}
export {
  Config,
  apply,
  inject,
  name
};
