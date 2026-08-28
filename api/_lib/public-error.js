/**
 * Keep internal Node / infra errors out of API JSON shown to organisers and the public.
 * Intentional client errors (status 4xx with a human message) still pass through.
 */

const INTERNAL_MESSAGE_RE =
  /Cannot find module|Require stack|\/var\/task\/|ENOENT|ECONNREFUSED|ECONNRESET|ETIMEDOUT|EAI_AGAIN|at Object\.|at Module\.|node:internal|TypeError:|ReferenceError:|SyntaxError:|supabase\.co\/rest|JWT|api[_-]?key|secret|stack trace/i;

const { captureServerException } = require('./sentry');

const GENERIC =
  'Something went wrong on our side. Please try again in a moment. If it keeps happening, email hi@thenetworkeruk.com.';

function looksInternalMessage(message) {
  const raw = String(message || '').trim();
  if (!raw) return true;
  if (raw.length > 280) return true;
  return INTERNAL_MESSAGE_RE.test(raw);
}

/**
 * @param {Error & { status?: number, code?: string }} err
 * @param {{ code?: string, fallback?: string }} [opts]
 * @returns {{ status: number, error: string, message: string }}
 */
function publicErrorPayload(err, opts) {
  opts = opts || {};
  const status = Number(err && err.status) || 500;
  const code = String((err && err.code) || opts.code || 'server_error').trim() || 'server_error';
  const raw = String((err && err.message) || '').trim();
  const clientFacing = status >= 400 && status < 500 && raw && !looksInternalMessage(raw);
  return {
    status,
    error: code,
    message: clientFacing ? raw : opts.fallback || GENERIC,
  };
}

/**
 * Respond with a sanitised error body. Logs the real message for 5xx.
 * @param {*} res
 * @param {(res: *, status: number, body: object) => *} json
 * @param {Error & { status?: number, code?: string }} err
 * @param {{ code?: string, fallback?: string, logLabel?: string, extra?: object }} [opts]
 */
function jsonPublicError(res, json, err, opts) {
  opts = opts || {};
  const payload = publicErrorPayload(err, { code: opts.code, fallback: opts.fallback });
  if (payload.status >= 500) {
    console.error(
      opts.logLabel || '[api]',
      opts.code || payload.error,
      err && err.message ? err.message : err
    );
    captureServerException(err, {
      logLabel: opts.logLabel,
      extra: Object.assign({ code: opts.code || payload.error }, opts.extra || {}),
    });
  }
  return json(
    res,
    payload.status,
    Object.assign({ error: payload.error, message: payload.message }, opts.extra || {})
  );
}

module.exports = {
  GENERIC_PUBLIC_ERROR: GENERIC,
  looksInternalMessage,
  publicErrorPayload,
  jsonPublicError,
};
