'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { normalizePhone, validatePin } = require('../src/lib/phone');
const { parseCsv, validateCatalogRow } = require('../src/lib/csv');

describe('phone normalization', () => {
  it('accepts +2677xxxxxxx', () => {
    assert.equal(normalizePhone('+26771234567'), '+26771234567');
  });
  it('accepts 071234567 style', () => {
    assert.equal(normalizePhone('071234567'), '+26771234567');
  });
  it('accepts 8-digit local', () => {
    assert.equal(normalizePhone('71234567'), '+26771234567');
  });
  it('rejects invalid', () => {
    assert.equal(normalizePhone('123'), null);
    assert.equal(normalizePhone('+27123456789'), null);
  });
  it('validates PIN', () => {
    assert.equal(validatePin('1234'), true);
    assert.equal(validatePin('12'), false);
  });
});

describe('csv parser', () => {
  it('handles quoted commas', () => {
    const { records } = parseCsv('title,rrp,groupPrice,targetUnits\n"Oil, 20L",100,80,10\n');
    assert.equal(records[0].title, 'Oil, 20L');
  });
  it('rejects bad prices', () => {
    const v = validateCatalogRow({ title: 'X', rrp: '-1', groupprice: '0', targetunits: '2' });
    assert.equal(v.ok, false);
  });
});
