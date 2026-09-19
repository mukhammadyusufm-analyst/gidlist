// Run: node --experimental-strip-types packages/core/src/format-date.check.ts
import assert from 'node:assert/strict';

import { formatDate } from './format-date.ts';

const d = new Date('2026-09-19T03:12:00Z');
const tz = { timeZone: 'Asia/Tashkent' } as const; // 08:12 on a Saturday

assert.equal(formatDate(d, 'uz', { ...tz, dateStyle: 'long' }), '19-sentabr, 2026');
assert.equal(formatDate(d, 'uz', { ...tz, day: 'numeric', month: 'short', year: 'numeric' }), '19-sen, 2026');
assert.equal(formatDate(d, 'uz', { ...tz, day: 'numeric', month: 'short' }), '19-sen');
assert.equal(formatDate(d, 'uz', { ...tz, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }), 'shanba, 19-sentabr, 2026');
assert.equal(formatDate(d, 'uz', { ...tz, month: 'long', year: 'numeric' }), 'Sentabr, 2026');
assert.equal(formatDate(d, 'uz', { ...tz, month: 'long' }), 'Sentabr');
assert.equal(formatDate(d, 'uz', { ...tz, weekday: 'short' }), 'Shan');
assert.equal(formatDate(d, 'uz', { ...tz, dateStyle: 'medium', timeStyle: 'short' }), '19-sen, 2026, 08:12');
assert.equal(formatDate(d, 'uz', { ...tz, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }), '19-sen, 08:12');
assert.equal(formatDate(d, 'uz', { ...tz, hour: '2-digit', minute: '2-digit' }), '08:12');
assert.equal(formatDate(d, 'uz', tz), '19/09/2026');
assert.equal(formatDate(d, 'en', { ...tz, dateStyle: 'long' }), 'September 19, 2026');
console.log('format-date: ok');
