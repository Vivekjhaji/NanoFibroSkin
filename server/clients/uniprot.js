import { createCache } from '../cache.js';

const cache = createCache(1000 * 60 * 60);
const BASE = 'https://rest.uniprot.org/uniprotkb/search';

export async function getProteinInfo(geneSymbol) {
  const cacheKey = `protein:${geneSymbol.toLowerCase()}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const query = `gene:${geneSymbol} AND organism_id:9606 AND reviewed:true`;
  const url = `${BASE}?query=${encodeURIComponent(query)}&fields=accession,gene_names,protein_name&format=json&size=1`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`UniProt request failed: ${res.status}`);
  }
  const data = await res.json();
  const entry = data.results?.[0];
  if (!entry) {
    cache.set(cacheKey, null);
    return null;
  }
  const info = {
    accession: entry.primaryAccession,
    proteinName: entry.proteinDescription?.recommendedName?.fullName?.value ?? 'Unknown',
    geneName: entry.genes?.[0]?.geneName?.value ?? geneSymbol,
  };
  cache.set(cacheKey, info);
  return info;
}
