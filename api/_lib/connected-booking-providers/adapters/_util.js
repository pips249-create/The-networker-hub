function dig(obj, paths) {
  for (const path of paths) {
    let cur = obj;
    let ok = true;
    for (const key of path) {
      if (cur == null || typeof cur !== 'object') {
        ok = false;
        break;
      }
      cur = cur[key];
    }
    if (ok && cur != null && cur !== '') return cur;
  }
  return null;
}

function normalizeEmail(raw) {
  const email = String(raw || '').trim().toLowerCase();
  return email.includes('@') ? email : '';
}

function normalizeOrderId(provider, raw) {
  const id = String(raw || '').trim();
  if (!id) return '';
  const prefix = String(provider || 'ext').replace(/_/g, '-');
  if (id.startsWith(prefix + '-') || id.startsWith(provider + '-')) return id;
  return prefix + '-' + id;
}

module.exports = { dig, normalizeEmail, normalizeOrderId };
