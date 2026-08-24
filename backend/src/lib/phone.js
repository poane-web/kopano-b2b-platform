'use strict';

/** Normalize Botswana mobile numbers to +267XXXXXXXX */
function normalizePhone(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let p = raw.replace(/[\s\-()]/g, '');
  if (p.startsWith('00')) p = '+' + p.slice(2);
  if (p.startsWith('+267')) {
    // already international
  } else if (p.startsWith('267') && p.length >= 11) {
    p = '+' + p;
  } else if (p.startsWith('0') && p.length === 9) {
    p = '+267' + p.slice(1);
  } else if (/^\d{8}$/.test(p)) {
    p = '+267' + p;
  } else {
    return null;
  }
  if (!/^\+267[67]\d{7}$/.test(p)) return null;
  return p;
}

function validatePin(pin) {
  return typeof pin === 'string' && /^\d{4,6}$/.test(pin);
}

module.exports = { normalizePhone, validatePin };
