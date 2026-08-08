// Minimal concurrency limiter: process items in fixed-size batches instead
// of firing every call at once. Avoids bursting past keyless rate limits on
// upstream public APIs (PubChem/DGIdb/UniProt/STRING).
export async function mapWithConcurrency(items, limit, fn) {
  const results = [];
  for (let i = 0; i < items.length; i += limit) {
    const batch = items.slice(i, i + limit);
    results.push(...(await Promise.all(batch.map(fn))));
  }
  return results;
}
