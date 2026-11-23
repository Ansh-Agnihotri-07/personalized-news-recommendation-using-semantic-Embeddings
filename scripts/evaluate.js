import { readFile } from 'node:fs/promises';
import { createEmbedder } from '../src/embeddings.js';
import { Recommender } from '../src/recommender.js';

// Manually labeled toy queries: a reproducible smoke evaluation, not a benchmark.
const cases = [
  { query: 'storing sunshine to power homes after dark', relevant: ['n02', 'n16'] },
  { query: 'discovering worlds orbiting distant stars', relevant: ['n04', 'n24'] },
  { query: 'using machine learning on a personal computer', relevant: ['n01', 'n10', 'n23'] },
  { query: 'understanding batting and bowling statistics', relevant: ['n21'] },
  { query: 'protecting underwater habitats from rising temperatures', relevant: ['n17'] },
  { query: 'preserving old photographs and community memories', relevant: ['n22'] },
  { query: 'making websites usable with a keyboard and screen reader', relevant: ['n18'] },
  { query: 'helping neighborhood shops accept cashless transactions', relevant: ['n06'] },
];

const articles = JSON.parse(await readFile(new URL('../data/articles.json', import.meta.url), 'utf8'));
console.log('Loading the real MiniLM model. The first run downloads model files.');
const embed = await createEmbedder();
try {
  const engine = new Recommender(articles, embed);
  await engine.initialize();
  let hits = 0, reciprocalRanks = 0, keywordHits = 0;
  for (const item of cases) {
    const result = await engine.recommend({ interests: [item.query], limit: 24 });
    const rank = result.articles.findIndex(a => item.relevant.includes(a.id)) + 1;
    const hit = rank > 0 && rank <= 3;
    hits += Number(hit);
    reciprocalRanks += rank ? 1 / rank : 0;
    keywordHits += Number(result.keywordArticles.slice(0, 3).some(a => item.relevant.includes(a.id)));
    console.log(`${hit ? 'PASS' : 'MISS'} | relevant rank ${rank} | ${item.query}\n       Top: ${result.articles[0].title} (${result.articles[0].score.toFixed(3)})`);
  }
  console.log(`\nToy evaluation (${cases.length} hand-labeled queries / ${articles.length} sample articles):`);
  console.log(`Semantic Hit@3: ${(hits / cases.length).toFixed(3)}`);
  console.log(`Semantic MRR:   ${(reciprocalRanks / cases.length).toFixed(3)}`);
  console.log(`Keyword Hit@3:  ${(keywordHits / cases.length).toFixed(3)}`);
  console.log('These illustrative results do not establish real-world accuracy.');
  if (hits < 6) process.exitCode = 1;
} finally { await embed.dispose(); }
