import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { Recommender, validateRequest } from './recommender.js';
import { createEmbedder, MODEL_ID } from './embeddings.js';

export const articles = JSON.parse(await readFile(new URL('../data/articles.json', import.meta.url), 'utf8'));

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

async function readJson(req) {
  let data = '';
  for await (const chunk of req) {
    data += chunk;
    if (Buffer.byteLength(data) > 16_384) throw new Error('Request is too large.');
  }
  try { return JSON.parse(data); } catch { throw new Error('Request must contain valid JSON.'); }
}

export function createApp({ recommender, state }) {
  const assets = new Map([
    ['/', ['index.html', 'text/html']],
    ['/styles.css', ['styles.css', 'text/css']],
    ['/app.js', ['app.js', 'text/javascript']],
    ['/favicon.svg', ['favicon.svg', 'image/svg+xml']],
  ]);
  return http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'");
    try {
      const url = new URL(req.url, 'http://localhost');
      if (req.method === 'GET' && url.pathname === '/api/health') {
        return json(res, 200, { ...state, model: MODEL_ID, articleCount: articles.length, dimensions: 384 });
      }
      if (req.method === 'GET' && url.pathname === '/api/articles') {
        return json(res, 200, { articles, categories: [...new Set(articles.map(a => a.category))] });
      }
      if (req.method === 'POST' && url.pathname === '/api/recommend') {
        if (state.status !== 'ready') return json(res, 503, { error: state.status === 'error' ? 'The embedding model could not load. Check the server terminal and restart.' : 'The embedding model is still loading. Please try again shortly.' });
        let input;
        try { input = validateRequest(await readJson(req), articles); }
        catch (error) { return json(res, 400, { error: error.message }); }
        return json(res, 200, await recommender.recommend(input));
      }
      if (req.method === 'GET' && assets.has(url.pathname)) {
        const [name, type] = assets.get(url.pathname);
        const content = await readFile(new URL(`../public/${name}`, import.meta.url));
        res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8` });
        return res.end(content);
      }
      return json(res, 404, { error: 'Not found.' });
    } catch (error) {
      console.error(error);
      if (!res.headersSent) json(res, 500, { error: 'Something went wrong while processing your request.' });
      else res.end();
    }
  });
}

async function main() {
  const state = { status: 'loading', message: 'Loading the semantic model. The first run downloads model files.' };
  let embed;
  const recommender = new Recommender(articles, texts => embed(texts));
  const port = Number(process.env.PORT || 3000);
  const server = createApp({ recommender, state });
  server.listen(port, '127.0.0.1', () => console.log(`\n  Current — Personalized News\n  Open http://localhost:${port}\n  Loading ${MODEL_ID}…\n`));
  server.on('error', error => { console.error(error.message); process.exitCode = 1; });
  try {
    embed = await createEmbedder();
    await recommender.initialize();
    state.status = 'ready';
    state.message = 'Semantic recommendations are ready.';
    console.log(`Ready: ${articles.length} articles indexed with 384-dimensional embeddings.`);
  } catch (error) {
    state.status = 'error';
    state.message = 'Model unavailable. Check your internet connection and restart the server. You can still explore the sample stories.';
    console.error('Model loading failed:', error);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
