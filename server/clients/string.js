import { createCache } from '../cache.js';

const cache = createCache(1000 * 60 * 60);
const BASE = 'https://string-db.org/api/json/network';

export async function getInteractionPartners(geneSymbol, limit = 10) {
  const cacheKey = `string:${geneSymbol.toLowerCase()}:${limit}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const url = `${BASE}?identifiers=${encodeURIComponent(geneSymbol)}&species=9606&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`STRING request failed: ${res.status}`);
  }
  const data = await res.json();
  const partners = [];
  const seen = new Set();
  for (const edge of data) {
    const target = edge.preferredName_A.toUpperCase() === geneSymbol.toUpperCase()
      ? edge.preferredName_B
      : edge.preferredName_A;
    if (target.toUpperCase() === geneSymbol.toUpperCase()) continue;
    if (seen.has(target)) continue;
    seen.add(target);
    partners.push({ partnerName: target, score: edge.score });
  }
  cache.set(cacheKey, partners);
  return partners;
}
