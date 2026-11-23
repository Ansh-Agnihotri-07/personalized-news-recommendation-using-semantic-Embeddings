export function normalize(vector) {
  const length = Math.hypot(...vector);
  return length ? vector.map(value => value / length) : vector.map(() => 0);
}

export function cosine(a, b) {
  if (a.length !== b.length) throw new Error('Embedding dimensions must match.');
  const denominator = Math.hypot(...a) * Math.hypot(...b);
  if (!denominator) return 0;
  return Math.max(-1, Math.min(1, a.reduce((sum, value, i) => sum + value * b[i], 0) / denominator));
}

export function centroid(vectors) {
  if (!vectors.length) return [];
  return normalize(vectors[0].map((_, i) => vectors.reduce((sum, vector) => sum + vector[i], 0) / vectors.length));
}

export function articleText(article) {
  return `${article.title}. ${article.summary} ${article.tags.join(', ')}`;
}

const stopWords = new Set('a an and are as at be by for from how i in is it me my of on or that the this to with about want read interested'.split(' '));
export function keywords(text) {
  return new Set((text.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).filter(word => word.length > 2 && !stopWords.has(word)));
}

export function keywordScore(query, article) {
  const terms = keywords(query);
  const content = keywords(articleText(article));
  return terms.size ? [...terms].filter(term => content.has(term)).length / terms.size : 0;
}

export function validateRequest(body, articles) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Send a JSON object.');
  const interests = body.interests ?? [];
  if (!Array.isArray(interests) || interests.length > 12 || interests.some(s => typeof s !== 'string' || !s.trim() || s.length > 300)) {
    throw new Error('Use up to 12 interests, each between 1 and 300 characters.');
  }
  const knownIds = new Set(articles.map(article => article.id));
  const likedIds = body.likedIds ?? [];
  if (!Array.isArray(likedIds) || likedIds.length > articles.length || likedIds.some(id => !knownIds.has(id))) {
    throw new Error('Liked articles must belong to the current collection.');
  }
  const category = body.category ?? 'All';
  if (category !== 'All' && !articles.some(article => article.category === category)) throw new Error('Unknown category.');
  const limit = body.limit ?? 12;
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new Error('Limit must be an integer between 1 and 50.');
  const cleanInterests = [...new Set(interests.map(s => s.trim()))];
  if (!cleanInterests.length && !likedIds.length) throw new Error('Add an interest or like an article to personalize your feed.');
  return { interests: cleanInterests, likedIds: [...new Set(likedIds)], category, limit };
}

export class Recommender {
  constructor(articles, embed) {
    this.articles = articles;
    this.embed = embed;
    this.vectors = [];
    this.queryCache = new Map();
  }

  async initialize() {
    this.vectors = await this.embed(this.articles.map(articleText));
  }

  async recommend(input) {
    const { interests, likedIds, category, limit } = validateRequest(input, this.articles);
    const cacheKey = JSON.stringify(interests);
    let interestVectors = this.queryCache.get(cacheKey);
    if (!interestVectors) {
      interestVectors = interests.length ? await this.embed(interests) : [];
      if (this.queryCache.size >= 100) this.queryCache.delete(this.queryCache.keys().next().value);
      this.queryCache.set(cacheKey, interestVectors);
    }
    const likedVectors = this.articles.flatMap((article, i) => likedIds.includes(article.id) ? [this.vectors[i]] : []);
    const interestProfile = centroid(interestVectors);
    const likedProfile = centroid(likedVectors);
    const profile = interestProfile.length && likedProfile.length
      ? normalize(interestProfile.map((value, i) => 0.8 * value + 0.2 * likedProfile[i]))
      : interestProfile.length ? interestProfile : likedProfile;

    const candidates = this.articles.flatMap((article, i) => {
      if (category !== 'All' && article.category !== category) return [];
      const matches = interestVectors.map((vector, j) => ({ interest: interests[j], similarity: cosine(vector, this.vectors[i]) }));
      matches.sort((a, b) => b.similarity - a.similarity);
      return [{
        ...article,
        score: cosine(profile, this.vectors[i]),
        matchedInterest: matches[0]?.interest ?? 'Your liked stories',
        interestSimilarity: matches[0]?.similarity ?? cosine(likedProfile, this.vectors[i]),
        keywordScore: keywordScore(interests.join(' '), article),
      }];
    });
    candidates.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
    return {
      articles: candidates.slice(0, limit),
      keywordArticles: [...candidates].sort((a, b) => b.keywordScore - a.keywordScore || a.id.localeCompare(b.id)).slice(0, 5),
      total: candidates.length,
      profile: { interests, likedCount: likedIds.length, dimensions: profile.length, interestWeight: interestProfile.length ? likedProfile.length ? 0.8 : 1 : 0 },
    };
  }
}
