import test from 'node:test';
import assert from 'node:assert/strict';
import { cosine, normalize, centroid, keywordScore, validateRequest, Recommender } from '../src/recommender.js';

const articles = [
  { id: 'solar', title: 'Solar power', summary: 'Storing renewable electricity', tags: ['energy'], category: 'Climate' },
  { id: 'space', title: 'Distant worlds', summary: 'Looking at stars', tags: ['astronomy'], category: 'Science' },
  { id: 'mixed', title: 'Satellite energy', summary: 'Panels in orbit', tags: ['science'], category: 'Science' },
];
const vectors = [[1, 0], [0, 1], normalize([1, 1])];

test('cosine handles same, orthogonal, opposite and zero vectors', () => {
  assert.equal(cosine([2, 0], [9, 0]), 1);
  assert.equal(cosine([1, 0], [0, 1]), 0);
  assert.equal(cosine([1, 0], [-1, 0]), -1);
  assert.equal(cosine([0, 0], [1, 0]), 0);
  assert.throws(() => cosine([1], [1, 2]), /dimensions/);
  assert.deepEqual(centroid([]), []);
});

test('ranking uses semantic vectors and returns a closest-interest explanation', async () => {
  const engine = new Recommender(articles, async texts => texts.length === 3 ? vectors : [[1, 0]]);
  await engine.initialize();
  const result = await engine.recommend({ interests: ['clean electricity'] });
  assert.deepEqual(result.articles.map(a => a.id), ['solar', 'mixed', 'space']);
  assert.equal(result.articles[0].matchedInterest, 'clean electricity');
  assert.equal(result.articles[0].score, 1);
  assert.equal(result.profile.dimensions, 2);
});

test('likes blend into the interest profile without replacing stated interests', async () => {
  const engine = new Recommender(articles, async texts => texts.length === 3 ? vectors : [[1, 0]]);
  await engine.initialize();
  const result = await engine.recommend({ interests: ['energy'], likedIds: ['space'] });
  assert.equal(result.articles[0].id, 'solar');
  assert.ok(result.articles.find(a => a.id === 'space').score > 0);
  assert.equal(result.profile.interestWeight, 0.8);
  const likedOnly = await engine.recommend({ interests: [], likedIds: ['space'] });
  assert.equal(likedOnly.articles[0].id, 'space');
  assert.equal(likedOnly.profile.interestWeight, 0);
});

test('filters, limits and cached queries preserve ranked results', async () => {
  let calls = 0;
  const engine = new Recommender(articles, async texts => { calls++; return texts.length === 3 ? vectors : [[1, 0]]; });
  await engine.initialize();
  const result = await engine.recommend({ interests: ['energy'], category: 'Science', limit: 1 });
  assert.equal(result.total, 2);
  assert.equal(result.articles.length, 1);
  assert.equal(result.articles[0].id, 'mixed');
  await engine.recommend({ interests: ['energy'] });
  assert.equal(calls, 2);
});

test('keyword baseline uses query overlap rather than embedding scores', () => {
  assert.equal(keywordScore('solar energy', articles[0]), 1);
  assert.equal(keywordScore('the solar moon', articles[0]), 0.5);
  assert.equal(keywordScore('photovoltaics', articles[0]), 0);
  assert.equal(keywordScore('the and', articles[0]), 0);
});

test('request validation rejects malformed profiles and unknown article IDs', () => {
  for (const request of [null, [], {}, { interests: 'space' }, { interests: [' '] }, { interests: [9] }, { interests: ['x'.repeat(301)] }, { likedIds: ['missing'] }, { interests: ['space'], category: 'Unknown' }, { interests: ['space'], limit: 0 }]) {
    assert.throws(() => validateRequest(request, articles));
  }
  assert.deepEqual(validateRequest({ interests: [' space ', 'space'] }, articles).interests, ['space']);
});
