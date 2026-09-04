'use strict';

/** Amounts are rounded to thebe (1/100 BWP) and combined as integers. */

function toThebe(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.round(v * 100);
}

function fromThebe(thebe) {
  const t = Number(thebe);
  if (!Number.isFinite(t)) return 0;
  return Math.round(t) / 100;
}

function money(n) {
  return fromThebe(toThebe(n));
}

function mulQty(unit, qty) {
  return fromThebe(toThebe(unit) * Number(qty || 0));
}

function feeBps(amount, bps) {
  return fromThebe(Math.round((toThebe(amount) * Number(bps || 0)) / 10000));
}

function addMoney(...parts) {
  return fromThebe(parts.reduce((sum, p) => sum + toThebe(p), 0));
}

function subMoney(a, b) {
  return fromThebe(toThebe(a) - toThebe(b));
}

module.exports = { money, toThebe, fromThebe, mulQty, feeBps, addMoney, subMoney };
