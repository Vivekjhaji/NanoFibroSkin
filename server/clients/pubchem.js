import { createCache } from '../cache.js';

const cache = createCache(1000 * 60 * 60); // 1 hour
const BASE = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug';

export async function getCid(compoundName) {
  const cacheKey = `cid:${compoundName.toLowerCase()}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const url = `${BASE}/compound/name/${encodeURIComponent(compoundName)}/cids/JSON`;
  const res = await fetch(url);
  if (res.status === 404) {
    cache.set(cacheKey, null);
    return null;
  }
  if (!res.ok) {
    throw new Error(`PubChem request failed: ${res.status}`);
  }
  const data = await res.json();
  const cid = data.IdentifierList?.CID?.[0] ?? null;
  cache.set(cacheKey, cid);
  return cid;
}
