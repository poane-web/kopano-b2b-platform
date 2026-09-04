'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { money, mulQty, feeBps, addMoney, subMoney, toThebe } = require('../src/lib/money');

describe('money (thebe integer arithmetic)', () => {
  it('rounds to two decimals', () => {
    assert.equal(money(10.005), 10.01);
    assert.equal(money('185.00'), 185);
  });

  it('multiplies unit price by quantity without float drift', () => {
    assert.equal(mulQty(0.1, 3), 0.3);
    assert.equal(mulQty(185, 2), 370);
    assert.equal(toThebe(mulQty(19.99, 3)), 5997);
  });

  it('computes bps fees from integer thebe', () => {
    assert.equal(feeBps(100, 300), 3);
    assert.equal(feeBps(370, 300), 11.1);
  });

  it('adds and subtracts in thebe', () => {
    assert.equal(addMoney(370, 11.1, 15), 396.1);
    assert.equal(subMoney(240, 185), 55);
  });
});
