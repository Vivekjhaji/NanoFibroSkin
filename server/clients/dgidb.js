import { createCache } from '../cache.js';

const cache = createCache(1000 * 60 * 60);
const ENDPOINT = 'https://dgidb.org/api/graphql';

async function runQuery(query) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) {
    throw new Error(`DGIdb request failed: ${res.status}`);
  }
  const json = await res.json();
  if (json.errors) {
    throw new Error(`DGIdb query error: ${JSON.stringify(json.errors)}`);
  }
  return json.data;
}

function flattenInteractions(nodes, partnerKey) {
  const interactions = [];
  for (const node of nodes) {
    for (const interaction of node.interactions ?? []) {
      const partner = interaction[partnerKey];
      if (!partner) continue;
      interactions.push({
        partnerName: partner.name,
        interactionTypes: (interaction.interactionTypes ?? []).map((t) => t.type),
        score: interaction.interactionScore ?? 0,
        sources: (interaction.interactionClaims ?? []).map((claim) => ({
          sourceDbName: claim.source?.sourceDbName ?? 'unknown',
          pmids: (claim.publications ?? []).map((p) => p.pmid).filter(Boolean),
        })),
      });
    }
  }
  return interactions;
}

export async function getInteractionsForDrug(drugName) {
  const cacheKey = `drug:${drugName.toLowerCase()}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const query = `{
    drugs(names: ["${drugName.replace(/"/g, '')}"]) {
      nodes {
        name
        interactions {
          gene { name }
          interactionScore
          interactionTypes { type }
          interactionClaims {
            source { sourceDbName }
            publications { pmid }
          }
        }
      }
    }
  }`;
  const data = await runQuery(query);
  const result = flattenInteractions(data.drugs.nodes, 'gene');
  cache.set(cacheKey, result);
  return result;
}

export async function getInteractionsForGene(geneSymbol) {
  const cacheKey = `gene:${geneSymbol.toLowerCase()}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const query = `{
    genes(names: ["${geneSymbol.replace(/"/g, '')}"]) {
      nodes {
        name
        interactions {
          drug { name }
          interactionScore
          interactionTypes { type }
          interactionClaims {
            source { sourceDbName }
            publications { pmid }
          }
        }
      }
    }
  }`;
  const data = await runQuery(query);
  const result = flattenInteractions(data.genes.nodes, 'drug');
  cache.set(cacheKey, result);
  return result;
}
