// Checks every internal href/src in every .html file resolves to a file.
// Usage: node scripts/check-links.mjs   (built-ins only)
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const skip = new Set([".git", "node_modules", "design-reference", "scripts"]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (skip.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith(".html")) out.push(p);
  }
  return out;
}

function resolveTarget(fromFile, url) {
  const clean = url.split("#")[0].split("?")[0];
  const base = clean.startsWith("/") ? join(root, clean) : join(dirname(fromFile), clean);
  if (existsSync(base) && statSync(base).isFile()) return base;
  if (existsSync(join(base, "index.html"))) return join(base, "index.html");
  return null;
}

const idCache = new Map();
function hasId(file, id) {
  if (!idCache.has(file)) {
    const ids = new Set();
    for (const m of readFileSync(file, "utf8").matchAll(/\sid="([^"]+)"/g)) ids.add(m[1]);
    idCache.set(file, ids);
  }
  return idCache.get(file).has(id);
}

let bad = 0, total = 0;
for (const file of walk(root)) {
  const html = readFileSync(file, "utf8");
  for (const m of html.matchAll(/\s(?:href|src)="([^"]*)"/g)) {
    const url = m[1];
    if (!url || /^(https?:|mailto:|tel:|data:|javascript:)/.test(url)) continue;
    total++;
    const [path, frag] = [url.split("#")[0], url.includes("#") ? url.split("#")[1] : ""];
    const target = path === "" ? file : resolveTarget(file, path);
    const rel = file.slice(root.length + 1);
    if (!target) { bad++; console.log(`BROKEN  ${rel}: ${url}`); continue; }
    if (frag && target.endsWith(".html") && !hasId(target, frag)) {
      bad++; console.log(`NO ANCHOR  ${rel}: ${url}`);
    }
  }
}
console.log(`${total} internal links checked, ${bad} problem(s)`);
process.exit(bad ? 1 : 0);
