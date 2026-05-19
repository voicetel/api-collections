#!/usr/bin/env node
// Builds Postman + Bruno collections from the VoiceTel OpenAPI spec.
//
// Inputs:
//   ../v2.2.json (OpenAPI 3.1 spec, relative to repo root)
//
// Outputs:
//   ./voicetel-api.postman_collection.json
//   ./voicetel-api.postman_environment.json
//   ./bruno/<Folder>/<n>-<request>.bru
//   ./bruno/environments/production.bru
//   ./bruno/bruno.json

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
function resolveSpec() {
  if (process.env.VOICETEL_SPEC) return process.env.VOICETEL_SPEC;
  const local = resolve(repoRoot, 'spec', 'v2.2.json');
  if (existsSync(local)) return local;
  return resolve(repoRoot, '..', 'v2.2.json');
}
const specPath = resolveSpec();

const spec = JSON.parse(readFileSync(specPath, 'utf8'));

// ---- helpers --------------------------------------------------------------

const RATE_LIMITED_OPS = new Set([
  'accountGet',       // account/info
  'accountCdr',
  'accountRecurringCharges',
  'accountPayments',
  'accountRegistration',
  'accountApiKey',
]);

const DELETE_WITH_BODY_OPS = new Set([
  'aclDelete',
  'numbersMessagingCampaignUnassign',
  'numbersMessagingCampaignBulkUnassign',
]);

// Friendly request names per operationId.
const FRIENDLY_NAMES = {
  // Account
  accountGet: 'Account · Get info',
  accountPut: 'Account · Update',
  accountSubaccountCreate: 'Account · Create sub-account',
  accountCreate: 'Account · Sign up (top-level)',
  accountApiKey: 'Account · Login (get API key)',
  accountCdr: 'Account · CDR (call detail records)',
  accountCredits: 'Account · Credits balance',
  accountRecurringCharges: 'Account · Recurring charges',
  accountPayments: 'Account · Payments',
  accountRegistration: 'Account · Registration status',
  accountRecovery: 'Account · Password recovery',
  // ACL
  aclList: 'ACL · List',
  aclCreate: 'ACL · Add entry',
  aclDelete: 'ACL · Remove entry',
  // Authentication
  authGet: 'Auth · Get policy',
  authPut: 'Auth · Update policy',
  // e911
  e911QueryAll: 'e911 · List records',
  e911Create: 'e911 · Create record',
  e911QueryRecord: 'e911 · Get record',
  e911ProvisionAddress: 'e911 · Provision address on DN',
  e911RecordDelete: 'e911 · Delete record',
  e911Validate: 'e911 · Validate address',
  // Gateways
  gatewaysList: 'Gateways · List',
  gatewaysCreate: 'Gateways · Create',
  gatewaysGet: 'Gateways · Get',
  gatewaysPut: 'Gateways · Update',
  gatewaysDelete: 'Gateways · Delete',
  gatewaysNumbers: 'Gateways · List assigned numbers',
  // iNumbering
  inventorySearch: 'Inventory · Search available numbers',
  inventoryCoverage: 'Inventory · Coverage (rate centers / NPAs)',
  orderCreate: 'Orders · Place order',
  portList: 'Ports · List',
  portSubmit: 'Ports · Submit port-in',
  portGet: 'Ports · Get',
  portAvailability: 'Ports · Availability check',
  // Lookups
  cnamLookup: 'Lookup · CNAM',
  lrnLookup: 'Lookup · LRN',
  // Messaging
  messageSend: 'Messages · Send',
  messageHistory: 'Messages · History',
  messagingBrandCreate: 'Messaging · Create brand (10DLC)',
  messagingCampaignCreate: 'Messaging · Create campaign (10DLC)',
  messagingCampaignStatus: 'Messaging · Campaign status',
  numbersMessagingList: 'Messaging · List SMS-enabled numbers',
  // Numbers
  numbersList: 'Numbers · List',
  numbersCreate: 'Numbers · Create / order',
  numbersGet: 'Numbers · Get',
  numbersMove: 'Numbers · Move to sub-account',
  numbersDelete: 'Numbers · Delete (release)',
  numbersRelease: 'Numbers · Release',
  numbersRoute: 'Numbers · Set route (gateway)',
  numbersCnam: 'Numbers · Set CNAM',
  numbersLidb: 'Numbers · Set LIDB',
  numbersForwardSet: 'Numbers · Set forwarding',
  numbersForwardDelete: 'Numbers · Delete forwarding',
  numbersFaxGet: 'Numbers · Get fax config',
  numbersFaxSet: 'Numbers · Set fax config',
  numbersFaxDelete: 'Numbers · Delete fax config',
  numbersSmsGet: 'Numbers · Get SMS config',
  numbersSmsSet: 'Numbers · Set SMS config',
  numbersSmsDelete: 'Numbers · Delete SMS config',
  numbersMessagingGet: 'Numbers · Get messaging config',
  numbersMessagingPatch: 'Numbers · Patch messaging config',
  numbersMessagingCampaignAssign: 'Numbers · Assign 10DLC campaign',
  numbersMessagingCampaignUnassign: 'Numbers · Unassign 10DLC campaign',
  numbersMessagingCampaignBulkUnassign: 'Numbers · Bulk unassign 10DLC campaign',
  numbersTranslation: 'Numbers · Set translation',
  numbersPortOutPinUpdate: 'Numbers · Update port-out PIN',
  // Support
  ticketsList: 'Support · List tickets',
  ticketsCreate: 'Support · Create ticket',
  ticketsGet: 'Support · Get ticket',
  ticketsPut: 'Support · Update ticket',
  ticketsDelete: 'Support · Delete ticket',
  supportTicketMessages: 'Support · List ticket messages',
  supportTicketReplyCreate: 'Support · Reply to ticket',
};

// Tag → display folder name (preserves your 10-folder layout).
const FOLDER_FOR_TAG = {
  Account: 'Account',
  ACL: 'ACL',
  Authentication: 'Authentication',
  e911: 'e911',
  Gateways: 'Gateways',
  iNumbering: 'iNumbering',
  Lookups: 'Lookups',
  Messaging: 'Messaging',
  Numbers: 'Numbers',
  Support: 'Support',
};

const FOLDER_DESCRIPTIONS = {
  Account:
    'Account-wide endpoints — sign up, log in, retrieve CDRs and credits, manage sub-accounts, and view billing history.',
  ACL:
    'API IP allow-list. Restrict which source IPs may use a given API key. Empty list ⇒ any IP allowed.',
  Authentication:
    'Authentication policy — fetch and update password/IP/key rotation settings on the account.',
  e911:
    'Emergency-911 address provisioning. Validate addresses, create records, provision DNs to addresses.',
  Gateways:
    'Outbound SIP gateways. Each number on the account is routed to one of these gateways.',
  iNumbering:
    'Inventory, ordering, and number-portability (LNP) — search inventory, place orders, manage port-ins.',
  Lookups:
    'On-demand CNAM and LRN dips. Billed per query.',
  Messaging:
    'SMS / MMS history and outbound send, plus 10DLC brand and campaign management.',
  Numbers:
    'Per-number configuration — routing, CNAM, LIDB, fax, forwarding, SMS, 10DLC campaigns, translations.',
  Support:
    'Support tickets — create, list, update, and reply.',
};

function escapeBruValue(s) {
  // Bruno scalar values are written as-is on a single line.
  if (s == null) return '';
  return String(s).replace(/\r?\n/g, ' ');
}

// Walk a schema example or generate one from `properties`/`example`.
function exampleFromSchema(schema, depth = 0) {
  if (!schema || depth > 6) return null;
  if (schema.$ref) {
    const refName = schema.$ref.replace('#/components/schemas/', '');
    const target = spec.components?.schemas?.[refName];
    return exampleFromSchema(target, depth + 1);
  }
  if (schema.example !== undefined) return schema.example;
  if (schema.examples && Array.isArray(schema.examples) && schema.examples.length) {
    return schema.examples[0];
  }
  if (schema.default !== undefined) return schema.default;
  if (schema.enum && schema.enum.length) return schema.enum[0];
  if (schema.type === 'object' || schema.properties) {
    const out = {};
    const props = schema.properties || {};
    const required = new Set(schema.required || []);
    for (const [k, v] of Object.entries(props)) {
      // Include required fields plus those with an explicit example for richer body.
      if (required.has(k) || v.example !== undefined || v.default !== undefined) {
        const val = exampleFromSchema(v, depth + 1);
        if (val !== null && val !== undefined) out[k] = val;
      }
    }
    return out;
  }
  if (schema.type === 'array') {
    const item = exampleFromSchema(schema.items, depth + 1);
    return item === null || item === undefined ? [] : [item];
  }
  if (schema.type === 'integer' || schema.type === 'number') return 0;
  if (schema.type === 'boolean') return false;
  if (schema.type === 'string') {
    if (schema.format === 'date') return '2026-01-01';
    if (schema.format === 'date-time') return '2026-01-01T00:00:00Z';
    if (schema.format === 'email') return 'name@example.com';
    return '';
  }
  return null;
}

function requestBodyExample(operation) {
  const content = operation.requestBody?.content?.['application/json'];
  if (!content) return null;
  if (content.example !== undefined) return content.example;
  if (content.examples) {
    const first = Object.values(content.examples)[0];
    if (first?.value !== undefined) return first.value;
  }
  return exampleFromSchema(content.schema);
}

function postmanUrl(pathTemplate, query) {
  const segments = pathTemplate
    .split('/')
    .filter(Boolean)
    .map((seg) => (seg.startsWith('{') ? `:${seg.slice(1, -1)}` : seg));
  const variable = [];
  for (const seg of pathTemplate.split('/').filter(Boolean)) {
    if (seg.startsWith('{')) {
      const name = seg.slice(1, -1);
      variable.push({ key: name, value: `<${name}>`, description: `Path parameter: ${name}` });
    }
  }
  return {
    raw: `{{baseUrl}}/${segments.join('/')}${query.length ? '?' + query.map((q) => `${q.key}=${encodeURIComponent(q.value)}`).join('&') : ''}`,
    host: ['{{baseUrl}}'],
    path: segments,
    query: query.length ? query : undefined,
    variable: variable.length ? variable : undefined,
  };
}

function descriptionFor(op, method, path, opId) {
  const lines = [];
  if (op.summary) lines.push(`**${op.summary}**`);
  if (op.description) lines.push(op.description);

  if (RATE_LIMITED_OPS.has(opId)) {
    lines.push('');
    lines.push('⚠️ Rate-limited (6/hr/IP).');
  }

  if (method === 'DELETE') {
    if (DELETE_WITH_BODY_OPS.has(opId)) {
      lines.push('');
      lines.push('Returns **200 OK** with a JSON body (not 204).');
    } else {
      lines.push('');
      lines.push('Returns **204 No Content** on success — no response body.');
    }
  }

  // Endpoint-specific extras
  if (opId === 'messageSend') {
    lines.push('');
    lines.push('Note: the JSON body uses the wire field names `fromNumber` and `toNumber`.');
  }
  if (opId === 'ticketsGet' || opId === 'supportTicketMessages' || opId === 'supportTicketReplyCreate' || opId === 'ticketsPut' || opId === 'ticketsDelete') {
    lines.push('');
    lines.push('Note: `:id` here is the support ticket **sequence integer** (e.g. `1015`), not a phone number.');
  }
  if (opId === 'numbersLidb') {
    lines.push('');
    lines.push('Note: LIDB spelling — path is `/lidb`, operationId `numbersLidb`.');
  }
  if (opId === 'portAvailability') {
    lines.push('');
    lines.push('v2.2.10: response includes `localRoutingNumber` and `rateCenterTier`.');
  }
  if (opId === 'accountApiKey') {
    lines.push('');
    lines.push('This is the **only** endpoint that does NOT require an Authorization header.');
    lines.push('On success this collection automatically stores the returned API key as the `apiKey` collection variable, so every other request authenticates via `Authorization: Bearer {{apiKey}}` from then on.');
  }

  lines.push('');
  lines.push(`OperationId: \`${opId}\``);

  return lines.join('\n');
}

function postmanQueryFor(op) {
  return (op.parameters || [])
    .filter((p) => p.in === 'query')
    .map((p) => ({
      key: p.name,
      value: p.schema?.example !== undefined ? String(p.schema.example) : (p.example !== undefined ? String(p.example) : ''),
      description: p.description,
      disabled: !p.required,
    }));
}

function postmanHeadersFor(op, hasBody) {
  const out = [];
  if (hasBody) out.push({ key: 'Content-Type', value: 'application/json' });
  for (const p of op.parameters || []) {
    if (p.in === 'header') {
      out.push({
        key: p.name,
        value: p.schema?.example !== undefined ? String(p.schema.example) : '',
        description: p.description,
        disabled: !p.required,
      });
    }
  }
  return out;
}

// ---- collect all operations ----------------------------------------------

const operations = []; // {tag, opId, method, path, op}
for (const [path, item] of Object.entries(spec.paths)) {
  for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
    const op = item[method];
    if (!op) continue;
    const tag = (op.tags && op.tags[0]) || 'Untagged';
    operations.push({ tag, opId: op.operationId, method: method.toUpperCase(), path, op });
  }
}

// Stable order: alpha-tag, then by path, then by method.
const METHOD_ORDER = { GET: 0, POST: 1, PUT: 2, PATCH: 3, DELETE: 4 };
operations.sort((a, b) => {
  return (
    a.tag.localeCompare(b.tag) ||
    a.path.localeCompare(b.path) ||
    METHOD_ORDER[a.method] - METHOD_ORDER[b.method]
  );
});

// ---- Postman collection ---------------------------------------------------

const folders = new Map(); // tag → {name, description, item: []}
for (const tag of Object.keys(FOLDER_FOR_TAG)) {
  folders.set(tag, {
    name: FOLDER_FOR_TAG[tag],
    description: FOLDER_DESCRIPTIONS[tag],
    item: [],
  });
}

for (const { tag, opId, method, path, op } of operations) {
  const folder = folders.get(tag);
  if (!folder) {
    console.error(`Unknown tag: ${tag} for ${opId}`);
    process.exit(1);
  }

  const bodyExample = ['POST', 'PUT', 'PATCH'].includes(method) ? requestBodyExample(op) : null;
  const hasBody = bodyExample !== null && bodyExample !== undefined;
  const headers = postmanHeadersFor(op, hasBody);
  const query = postmanQueryFor(op);
  const url = postmanUrl(path, query);

  const item = {
    name: FRIENDLY_NAMES[opId] || `${tag} · ${opId}`,
    request: {
      method,
      header: headers,
      url,
      description: descriptionFor(op, method, path, opId),
    },
    response: [],
  };

  if (hasBody) {
    item.request.body = {
      mode: 'raw',
      raw: JSON.stringify(bodyExample, null, 2),
      options: { raw: { language: 'json' } },
    };
  }

  if (opId === 'accountApiKey') {
    // Override auth for this single endpoint, and add a test script that saves apiKey.
    item.request.auth = { type: 'noauth' };
    item.event = [
      {
        listen: 'test',
        script: {
          type: 'text/javascript',
          exec: [
            "// Auto-save the returned API key into the collection variable `apiKey`.",
            "// All other endpoints inherit bearer auth and read {{apiKey}}.",
            "try {",
            "  const json = pm.response.json();",
            "  const key = json && json.data && (json.data.apikey || json.data.apiKey);",
            "  if (key) {",
            "    pm.collectionVariables.set('apiKey', key);",
            "    console.log('Saved apiKey (' + key.slice(0, 6) + '…) to collection variables.');",
            "  } else {",
            "    console.warn('No apikey field in response.');",
            "  }",
            "} catch (e) {",
            "  console.warn('Could not parse api-key response:', e.message);",
            "}",
          ],
        },
      },
    ];
  }

  folder.item.push(item);
}

const collection = {
  info: {
    _postman_id: 'voicetel-api-v2-2',
    name: 'VoiceTel API (v2.2.10)',
    description: [
      '# VoiceTel API — Official Postman Collection',
      '',
      `Version: **${spec.info.version}** · Spec: OpenAPI 3.1 · Host: \`https://api.voicetel.com\``,
      '',
      'This collection covers every endpoint of the VoiceTel REST API, grouped into the same 10 resource families used by the official SDKs (Python, Go, TypeScript, Java, PHP, C#, Scala, Swift, Lua).',
      '',
      '## Auth model',
      '',
      'Every endpoint expects `Authorization: Bearer <apiKey>` **except** `POST /v2.2/account/api-key`, which exchanges a username/password for an API key. This collection has that endpoint configured with **No auth**; on a successful response a Postman test script automatically saves `data.apikey` into the `apiKey` collection variable, so the rest of the collection is wired up automatically.',
      '',
      '## Rate-limited endpoints (6 requests/hour/IP)',
      '',
      '- `GET /v2.2/account`',
      '- `GET /v2.2/account/cdr`',
      '- `GET /v2.2/account/recurring-charges`',
      '- `GET /v2.2/account/payments`',
      '- `GET /v2.2/account/registration`',
      '- `POST /v2.2/account/api-key`',
      '',
      '## Documentation',
      '',
      '- API reference: https://voicetel.com/docs/api/v2.2/',
      '- Playground: https://voicetel.com/docs/api/v2.2/playground/',
      '- Get credentials: https://voicetel.com/docs/api/v2.2/credentials/',
    ].join('\n'),
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    contact: { name: 'VoiceTel', email: 'support@voicetel.com', url: 'https://voicetel.com' },
    version: spec.info.version,
  },
  auth: {
    type: 'bearer',
    bearer: [{ key: 'token', value: '{{apiKey}}', type: 'string' }],
  },
  item: [...folders.values()],
  variable: [
    { key: 'baseUrl', value: 'https://api.voicetel.com', type: 'string' },
    { key: 'username', value: '', type: 'string' },
    { key: 'password', value: '', type: 'string' },
    { key: 'apiKey', value: '', type: 'string' },
  ],
};

writeFileSync(
  resolve(repoRoot, 'voicetel-api.postman_collection.json'),
  JSON.stringify(collection, null, 2) + '\n',
  'utf8'
);

// ---- Postman environment --------------------------------------------------

const env = {
  id: 'voicetel-production',
  name: 'VoiceTel · Production',
  values: [
    { key: 'baseUrl', value: 'https://api.voicetel.com', type: 'default', enabled: true },
    { key: 'username', value: '', type: 'default', enabled: true },
    { key: 'password', value: '', type: 'secret', enabled: true },
    { key: 'apiKey', value: '', type: 'secret', enabled: true },
  ],
  _postman_variable_scope: 'environment',
  _postman_exported_using: 'voicetel/api-collections',
};

writeFileSync(
  resolve(repoRoot, 'voicetel-api.postman_environment.json'),
  JSON.stringify(env, null, 2) + '\n',
  'utf8'
);

// ---- Bruno collection -----------------------------------------------------

const brunoRoot = resolve(repoRoot, 'bruno');

// Wipe & recreate request folders (but keep environments/).
for (const tag of Object.keys(FOLDER_FOR_TAG)) {
  const dir = resolve(brunoRoot, FOLDER_FOR_TAG[tag]);
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
}
mkdirSync(resolve(brunoRoot, 'environments'), { recursive: true });

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function bruQueryBlock(query) {
  if (!query.length) return '';
  const lines = ['query {'];
  for (const q of query) {
    const prefix = q.disabled ? '~' : '';
    lines.push(`  ${prefix}${q.key}: ${escapeBruValue(q.value)}`);
  }
  lines.push('}');
  return lines.join('\n');
}

function bruHeaderBlock(headers) {
  if (!headers.length) return '';
  const lines = ['headers {'];
  for (const h of headers) {
    const prefix = h.disabled ? '~' : '';
    lines.push(`  ${prefix}${h.key}: ${escapeBruValue(h.value)}`);
  }
  lines.push('}');
  return lines.join('\n');
}

function bruPathParams(pathTemplate) {
  const params = [];
  for (const seg of pathTemplate.split('/').filter(Boolean)) {
    if (seg.startsWith('{')) params.push(seg.slice(1, -1));
  }
  return params;
}

function bruPathBlock(pathTemplate) {
  const params = bruPathParams(pathTemplate);
  if (!params.length) return '';
  const lines = ['params:path {'];
  for (const p of params) lines.push(`  ${p}: <${p}>`);
  lines.push('}');
  return lines.join('\n');
}

function bruUrl(pathTemplate, query) {
  const url =
    `{{baseUrl}}/` +
    pathTemplate
      .split('/')
      .filter(Boolean)
      .map((seg) => (seg.startsWith('{') ? `:${seg.slice(1, -1)}` : seg))
      .join('/');
  if (!query.length) return url;
  const qp = query
    .filter((q) => !q.disabled)
    .map((q) => `${q.key}=${q.value}`)
    .join('&');
  return qp ? `${url}?${qp}` : url;
}

let bruIndex = 0;
const folderSeqs = new Map(); // tag → counter
for (const tag of Object.keys(FOLDER_FOR_TAG)) folderSeqs.set(tag, 0);

for (const { tag, opId, method, path, op } of operations) {
  const folderName = FOLDER_FOR_TAG[tag];
  const seq = folderSeqs.get(tag) + 1;
  folderSeqs.set(tag, seq);
  bruIndex++;

  const friendly = FRIENDLY_NAMES[opId] || `${tag} ${opId}`;
  const fileSlug = slugify(opId);
  const filePath = resolve(brunoRoot, folderName, `${String(seq).padStart(2, '0')}-${fileSlug}.bru`);

  const bodyExample = ['POST', 'PUT', 'PATCH'].includes(method) ? requestBodyExample(op) : null;
  const hasBody = bodyExample !== null && bodyExample !== undefined;
  const headers = postmanHeadersFor(op, hasBody);
  const query = postmanQueryFor(op);
  const url = bruUrl(path, query);

  const blocks = [];

  // meta
  blocks.push(
    [
      'meta {',
      `  name: ${friendly}`,
      `  type: http`,
      `  seq: ${seq}`,
      '}',
    ].join('\n')
  );

  // method block (named after the HTTP verb)
  const methodKey = method.toLowerCase();
  const methodBlockLines = [
    `${methodKey} {`,
    `  url: ${url}`,
    `  body: ${hasBody ? 'json' : 'none'}`,
    `  auth: ${opId === 'accountApiKey' ? 'none' : 'inherit'}`,
    '}',
  ];
  blocks.push(methodBlockLines.join('\n'));

  // params:path
  const pathBlock = bruPathBlock(path);
  if (pathBlock) blocks.push(pathBlock);

  // query
  const queryBlock = bruQueryBlock(query);
  if (queryBlock) blocks.push(queryBlock);

  // headers
  const headerBlock = bruHeaderBlock(headers);
  if (headerBlock) blocks.push(headerBlock);

  // body
  if (hasBody) {
    blocks.push(`body:json {\n${JSON.stringify(bodyExample, null, 2)}\n}`);
  }

  // post-response script for accountApiKey
  if (opId === 'accountApiKey') {
    const script = [
      'script:post-response {',
      '  // Auto-save the returned API key into the apiKey collection variable.',
      '  // All other requests inherit bearer auth and read {{apiKey}}.',
      "  try {",
      "    const data = res.getBody() && res.getBody().data;",
      "    const key = data && (data.apikey || data.apiKey);",
      "    if (key) {",
      "      bru.setVar('apiKey', key);",
      "      console.log('Saved apiKey (' + key.slice(0, 6) + '…) to collection variables.');",
      "    } else {",
      "      console.warn('No apikey field in response.');",
      "    }",
      "  } catch (e) {",
      "    console.warn('Could not parse api-key response:', e.message);",
      "  }",
      '}',
    ].join('\n');
    blocks.push(script);
  }

  // docs
  const docs = descriptionFor(op, method, path, opId);
  blocks.push(`docs {\n${docs}\n}`);

  writeFileSync(filePath, blocks.join('\n\n') + '\n', 'utf8');
}

// folder.bru per resource — gives Bruno a folder description
for (const tag of Object.keys(FOLDER_FOR_TAG)) {
  const folderName = FOLDER_FOR_TAG[tag];
  const description = FOLDER_DESCRIPTIONS[tag];
  const content = [
    'meta {',
    `  name: ${folderName}`,
    `  seq: ${Object.keys(FOLDER_FOR_TAG).indexOf(tag) + 1}`,
    '}',
    '',
    'docs {',
    description,
    '}',
    '',
  ].join('\n');
  writeFileSync(resolve(brunoRoot, folderName, 'folder.bru'), content, 'utf8');
}

// bruno.json
const brunoJson = {
  version: '1',
  name: 'VoiceTel API (v2.2.10)',
  type: 'collection',
  ignore: ['node_modules', '.git'],
  auth: {
    mode: 'bearer',
    bearer: {
      token: '{{apiKey}}',
    },
  },
  meta: {
    contact: { name: 'VoiceTel', email: 'support@voicetel.com', url: 'https://voicetel.com' },
    apiVersion: spec.info.version,
  },
};
writeFileSync(resolve(brunoRoot, 'bruno.json'), JSON.stringify(brunoJson, null, 2) + '\n', 'utf8');

// collection.bru (root-level metadata + auth)
const collectionBru = [
  'auth {',
  '  mode: bearer',
  '}',
  '',
  'auth:bearer {',
  '  token: {{apiKey}}',
  '}',
  '',
  'vars {',
  '  baseUrl: https://api.voicetel.com',
  '}',
  '',
  'docs {',
  '# VoiceTel API — Bruno Collection',
  '',
  `Version ${spec.info.version}. All endpoints are documented at https://voicetel.com/docs/api/v2.2/.`,
  '',
  'Bearer auth is wired at the collection level. After a successful `Account · Login (get API key)` the `apiKey` variable is auto-populated by the post-response script.',
  '}',
  '',
].join('\n');
writeFileSync(resolve(brunoRoot, 'collection.bru'), collectionBru, 'utf8');

// environments/production.bru
const prodEnv = [
  'vars {',
  '  baseUrl: https://api.voicetel.com',
  '  username: ',
  '}',
  '',
  'vars:secret [',
  '  password,',
  '  apiKey',
  ']',
  '',
].join('\n');
writeFileSync(resolve(brunoRoot, 'environments', 'production.bru'), prodEnv, 'utf8');

console.log(`Wrote Postman collection with ${operations.length} operations.`);
console.log(`Wrote Bruno collection with ${operations.length} operations under ${Object.keys(FOLDER_FOR_TAG).length} folders.`);
