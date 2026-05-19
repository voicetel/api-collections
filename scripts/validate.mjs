#!/usr/bin/env node
// Validates that the Postman + Bruno collections cover every operationId
// declared in the OpenAPI spec. Exits non-zero if anything is missing.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
import { existsSync } from 'node:fs';
function resolveSpec() {
  if (process.env.VOICETEL_SPEC) return process.env.VOICETEL_SPEC;
  const local = resolve(repoRoot, 'spec', 'v2.2.json');
  if (existsSync(local)) return local;
  return resolve(repoRoot, '..', 'v2.2.json');
}
const specPath = resolveSpec();

const spec = JSON.parse(readFileSync(specPath, 'utf8'));

// ---- gather expected operationIds from the spec ---------------------------
const expected = new Set();
for (const [path, item] of Object.entries(spec.paths)) {
  for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
    if (item[method]?.operationId) expected.add(item[method].operationId);
  }
}

// ---- gather operationIds from Postman collection --------------------------
const postman = JSON.parse(
  readFileSync(resolve(repoRoot, 'voicetel-api.postman_collection.json'), 'utf8')
);

const postmanOps = new Set();
function walkPostman(items) {
  for (const it of items) {
    if (it.item) walkPostman(it.item);
    if (it.request) {
      const d = it.request.description || '';
      // We embed `OperationId: \`<id>\`` in each description for round-trips.
      const m = d.match(/OperationId:\s*`([A-Za-z0-9_]+)`/);
      if (m) postmanOps.add(m[1]);
    }
  }
}
walkPostman(postman.item || []);

// ---- gather operationIds from Bruno .bru files ----------------------------
const bruDir = resolve(repoRoot, 'bruno');
const brunoOps = new Set();

function walkDir(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) {
      walkDir(full);
    } else if (full.endsWith('.bru') && !full.endsWith('folder.bru') && !full.endsWith('collection.bru')) {
      const txt = readFileSync(full, 'utf8');
      // Same convention — `OperationId: \`<id>\`` in docs block.
      const m = txt.match(/OperationId:\s*`([A-Za-z0-9_]+)`/);
      if (m) brunoOps.add(m[1]);
    }
  }
}
walkDir(bruDir);

// ---- compare --------------------------------------------------------------
function diff(setA, setB) {
  return [...setA].filter((x) => !setB.has(x)).sort();
}

const missingFromPostman = diff(expected, postmanOps);
const extraInPostman = diff(postmanOps, expected);
const missingFromBruno = diff(expected, brunoOps);
const extraInBruno = diff(brunoOps, expected);

console.log(`Spec operationIds:    ${expected.size}`);
console.log(`Postman operationIds: ${postmanOps.size}`);
console.log(`Bruno operationIds:   ${brunoOps.size}`);

let failed = false;
if (missingFromPostman.length) {
  failed = true;
  console.error(`\nMissing from Postman (${missingFromPostman.length}):`);
  for (const op of missingFromPostman) console.error(`  - ${op}`);
}
if (extraInPostman.length) {
  failed = true;
  console.error(`\nExtra in Postman (${extraInPostman.length}):`);
  for (const op of extraInPostman) console.error(`  - ${op}`);
}
if (missingFromBruno.length) {
  failed = true;
  console.error(`\nMissing from Bruno (${missingFromBruno.length}):`);
  for (const op of missingFromBruno) console.error(`  - ${op}`);
}
if (extraInBruno.length) {
  failed = true;
  console.error(`\nExtra in Bruno (${extraInBruno.length}):`);
  for (const op of extraInBruno) console.error(`  - ${op}`);
}

if (failed) {
  console.error('\nValidation FAILED.');
  process.exit(1);
}

console.log('\nAll operations covered. Validation OK.');
