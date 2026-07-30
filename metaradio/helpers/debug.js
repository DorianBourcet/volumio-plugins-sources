'use strict';

// Volumio runs off an SD card, so the plugin must not journal on every poll: a scrape
// happens for each playing station every few seconds, and dumping payloads there wears
// the card out while burying the error lines that actually matter.
//
// Payload traces are therefore opt-in:
//   METARADIO_DEBUG=1     -> traces on, HTTP bodies truncated
//   METARADIO_DEBUG=full  -> traces on, HTTP bodies in full (for API shape discovery)
// Error traces are never gated.

var MAX_BODY_LENGTH = 500;

var level = String(process.env.METARADIO_DEBUG || '').toLowerCase();
var enabled = level === '1' || level === 'true' || level === 'yes' || level === 'full';
var full = level === 'full';

function debugLog() {
  if (!enabled) { return; }
  console.log.apply(console, arguments);
}

// Shorten an HTTP body for logging. The `node -e` discovery loop documented in
// CLAUDE.md runs outside the Volumio process, so use METARADIO_DEBUG=full there.
function truncate(body) {
  if (typeof body !== 'string' || full || body.length <= MAX_BODY_LENGTH) {
    return body;
  }
  return body.slice(0, MAX_BODY_LENGTH) + '… [truncated, ' + body.length + ' chars total]';
}

module.exports = {
  enabled: enabled,
  debugLog: debugLog,
  truncate: truncate,
};
