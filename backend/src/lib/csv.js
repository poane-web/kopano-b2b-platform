'use strict';

/**
 * RFC4180-ish CSV parser. Does not use naive comma-split.
 * Handles quoted fields, escaped quotes, and CRLF.
 */
function parseCsv(text, { maxRows = 500 } = {}) {
  if (typeof text !== 'string') throw Object.assign(new Error('Invalid CSV'), { code: 'INVALID_CSV' });
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += c;
      i += 1;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (c === ',') {
      row.push(field.trim());
      field = '';
      i += 1;
      continue;
    }
    if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field.trim());
      field = '';
      if (row.some((cell) => cell !== '')) rows.push(row);
      row = [];
      i += 1;
      if (rows.length > maxRows + 1) {
        const err = new Error(`Too many rows (max ${maxRows})`);
        err.code = 'ROW_LIMIT';
        throw err;
      }
      continue;
    }
    field += c;
    i += 1;
  }
  if (inQuotes) {
    const err = new Error('Unterminated quoted field');
    err.code = 'MALFORMED_CSV';
    throw err;
  }
  row.push(field.trim());
  if (row.some((cell) => cell !== '')) rows.push(row);

  if (!rows.length) return { headers: [], records: [] };

  const headers = rows[0].map((h) => h.toLowerCase().replace(/\s+/g, '_'));
  const records = [];
  for (let r = 1; r < rows.length; r++) {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = rows[r][idx] !== undefined ? rows[r][idx] : '';
    });
    obj.__line = r + 1;
    records.push(obj);
  }
  return { headers, records };
}

const REQUIRED_HEADERS = ['title', 'rrp', 'groupprice', 'targetunits'];

function validateCatalogRow(row) {
  const errors = [];
  const title = (row.title || row.product_name || '').trim();
  if (!title || title.length < 2) errors.push('title required');
  if (title.length > 255) errors.push('title too long');

  const rrp = Number(String(row.rrp || row.retail_price || '').replace(/[^0-9.]/g, ''));
  const groupPrice = Number(String(row.groupprice || row.group_price || row.unit_price || '').replace(/[^0-9.]/g, ''));
  const target = parseInt(String(row.targetunits || row.target_units || row.target || ''), 10);

  if (!Number.isFinite(rrp) || rrp <= 0) errors.push('rrp must be a positive number');
  if (!Number.isFinite(groupPrice) || groupPrice <= 0) errors.push('groupPrice must be a positive number');
  if (Number.isFinite(rrp) && Number.isFinite(groupPrice) && groupPrice > rrp) {
    errors.push('groupPrice cannot exceed rrp');
  }
  if (!Number.isInteger(target) || target < 1 || target > 100000) {
    errors.push('targetUnits must be an integer 1–100000');
  }

  const category = (row.category || 'other').toLowerCase();
  const allowed = ['retail', 'beauty', 'food', 'construction', 'other'];
  if (!allowed.includes(category)) errors.push('invalid category');

  return {
    ok: errors.length === 0,
    errors,
    value: {
      title,
      rrp: Math.round(rrp * 100) / 100,
      groupPrice: Math.round(groupPrice * 100) / 100,
      targetUnits: target,
      category,
      unit: (row.unit || 'units').slice(0, 50),
      description: (row.description || '').slice(0, 2000),
    },
  };
}

module.exports = { parseCsv, validateCatalogRow, REQUIRED_HEADERS };
