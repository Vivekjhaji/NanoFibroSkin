import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCache } from '../server/cache.js';

test('stores and retrieves a value', () => {
  const cache = createCache(10000);
  cache.set('a', 1);
  assert.equal(cache.get('a'), 1);
});

test('returns undefined for missing key', () => {
  const cache = createCache(10000);
  assert.equal(cache.get('missing'), undefined);
});

test('expires values after ttl', async () => {
  const cache = createCache(10);
  cache.set('a', 1);
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(cache.get('a'), undefined);
});

test('has() reflects expiry', async () => {
  const cache = createCache(10);
  cache.set('a', 1);
  assert.equal(cache.has('a'), true);
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(cache.has('a'), false);
});
