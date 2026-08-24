'use strict';

function money(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.round(v * 100) / 100;
}

function toThebe(n) {
  return Math.round(money(n) * 100);
}

function fromThebe(thebe) {
  return money(thebe / 100);
}

module.exports = { money, toThebe, fromThebe };
