// The published spec omits operationId on some operations. Request names,
// file names, and coverage checks key off operationId, so those operations get
// a stable fallback here. An operationId published in the spec always wins.

const FALLBACK_OPERATION_IDS = {
  'GET /v2.2/messaging/health': 'messagingHealth',
  'GET /v2.2/messaging/health/alerts': 'messagingHealthAlertsGet',
  'PUT /v2.2/messaging/health/alerts': 'messagingHealthAlertsPut',
  'POST /v2.2/messaging/health/check': 'messagingHealthCheck',
  'GET /v2.2/messaging/health/samples': 'messagingHealthSamples',
};

export function operationIdFor(op, method, path) {
  if (op.operationId) return op.operationId;
  const fallback = FALLBACK_OPERATION_IDS[`${method.toUpperCase()} ${path}`];
  if (!fallback) {
    throw new Error(`No operationId for ${method.toUpperCase()} ${path}; add one to scripts/operation-ids.mjs`);
  }
  return fallback;
}
