# Current — Personalized News Recommendation Using Semantic Embeddings

A complete local web application for **Project 41**, based on the supplied project table.

- **Background:** Keyword-based recommendation may fail to understand the actual interests of users.
- **Objective:** Recommend articles according to the semantic similarity between user interests and news content.
- **Main technique:** Embeddings + Semantic Similarity + Recommendation System.

## Run the project

Requires **Node.js 20 or later** and npm. Python, a GPU, paid APIs, and API keys are not required.

```sh
npm install
npm start
```

Open **http://localhost:3000**. On Windows PowerShell, use `npm.cmd` if script execution policy blocks `npm`.

The first launch downloads the public MiniLM tokenizer and quantized ONNX model from Hugging Face. Keep the terminal open and wait until the app says **Semantic engine ready**. Model files are cached in `.cache/models/` inside this project. Subsequent launches reuse them. The server processes interests locally; it does not call a hosted inference API.

If port 3000 is already in use, choose another port in PowerShell:

```powershell
$env:PORT = '3001'
npm.cmd start
```

## Use it

1. Select topics or describe an interest in your own words, such as **“storing sunshine to power homes after dark.”**
2. Select **Build my feed** to rank articles by cosine similarity.
3. Filter by category or change the number of results.
4. Open a title to read the article. Bookmark it to keep it in **Saved**.
5. Like stories to add a feedback signal to your next profile. On the personalized feed, likes trigger a refresh immediately.
6. Select **Compare methods** to compare the semantic ranking with a keyword-overlap baseline.
7. Select **Behind your feed** for the algorithm explanation.

**Explore** works while the model loads. Preferences, likes, and bookmarks are stored in this browser's local storage. They are not accounts and are not synchronized between devices. **Reset interests & likes** preserves bookmarks.

## How recommendations work

1. Encode each article's title, summary, and tags with `Xenova/all-MiniLM-L6-v2` using Transformers.js and ONNX CPU inference.
2. Mean-pool token representations and L2-normalize them to obtain **384-dimensional semantic vectors**.
3. Encode each selected topic description and the user's free-text interest using the same model.
4. Average and normalize the interest vectors. If the user has liked articles, blend **80% interest profile + 20% liked-article profile**, then normalize again. With only likes, use the liked-article profile alone.
5. Compute cosine similarity between the profile and each article. Apply the category filter and return the highest-scoring articles.
6. Explain each result using its closest individual interest. This explanation is distinct from the combined profile used for ranking.

Cosine similarity ranges from **−1 to 1**. It is not an accuracy, confidence, or enjoyment probability. The system returns the closest available matches even for unfamiliar topics; low scores should be interpreted cautiously. Liked articles remain eligible for recommendation.

Article embeddings are held in memory for the running server. Up to 100 interest-vector sets are cached in memory. There is no claim that these are trained user-specific embeddings: MiniLM is pretrained, and this application performs inference and content-based ranking.

## Dataset

`data/articles.json` contains **24 original, fictional educational sample articles** across Technology, Climate, Science, Health, Business, Sports, and Culture. They are clearly labeled in the interface. The project **does not fetch live news** or claim that the sample stories describe current events.

To use a real corpus, replace or extend `data/articles.json` with articles you have permission to use, then restart the server to rebuild the index. Each record needs:

```json
{
  "id": "unique-id",
  "title": "Article title",
  "category": "Technology",
  "summary": "A concise, representative article summary.",
  "body": "Full reading text. Separate paragraphs with \n\n.",
  "tags": ["machine learning", "computing"],
  "readMinutes": 3
}
```

Use one of the seven existing categories, unique IDs, and nonempty title/summary fields. Keep summaries concise: the model has a limited input context, and long input can be truncated. Full bodies are shown in the reader but are not embedded. Editing a corpus may change all rankings. A production ingestion service, publisher links, article provenance, duplicate handling, and freshness ranking would be additional work.

## Verification

```sh
npm test
npm run evaluate
```

`npm test` runs deterministic vector/ranking tests and HTTP API tests without downloading the model. It checks profile blending, category filters, limits, cached queries, input validation, static-file boundaries, and loading-state responses.

`npm run evaluate` uses the **real model** with eight manually labeled queries. It prints semantic Hit@3, mean reciprocal rank (MRR), and keyword Hit@3. It exits nonzero if fewer than six queries retrieve an expected article in the top three. This is a small illustrative regression check, **not a held-out benchmark or proof of real-world recommendation quality**.

## Structure

```text
data/articles.json          Sample corpus
public/index.html           Accessible, responsive interface
public/styles.css           Visual design and mobile layouts
public/app.js               UI, browser persistence, API integration
src/embeddings.js           Actual MiniLM model and local cache
src/recommender.js          Profile construction and ranking
src/server.js               Local HTTP server and JSON API
scripts/evaluate.js         Real-model smoke evaluation
test/                       Deterministic and HTTP tests
docs/PROJECT_REPORT.md      Academic project explanation and demo plan
```

## API

- `GET /api/health`: model status, model name, dimensions, and article count.
- `GET /api/articles`: corpus and categories.
- `POST /api/recommend`: personalized ranking and keyword comparison.

Example request:

```json
{
  "interests": ["clean urban transport"],
  "likedIds": ["n02"],
  "category": "All",
  "limit": 12
}
```

Limits: 12 interests, 300 characters each, known article IDs, a known category or `All`, and 1–50 results. Requests over 16 KiB are rejected. Invalid profiles receive HTTP 400; a loading or failed model receives HTTP 503. No keyword fallback is silently substituted for embeddings.

## Troubleshooting

- **Model unavailable:** Check internet access to Hugging Face, read the terminal error, and restart `npm start`. Explore and saved stories remain available without inference.
- **Empty feed:** Add an interest or like a story, then build the feed.
- **No saved stories:** Bookmarks belong to the specific browser and origin; changing the port creates a separate browser-storage scope.
- **Changes did not apply:** Refresh the feed after editing interests. To change server code or the dataset, restart the server, or use `npm run dev` for server-code changes.
- **Restricted environment:** Dependency/model downloads need network access; HTTP tests need permission to connect to localhost.

The server binds only to `127.0.0.1`. This is a local academic project, not a production multi-user service.

## References

- [MiniLM ONNX model and usage](https://huggingface.co/Xenova/all-MiniLM-L6-v2)
- [Base model and limitations](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2)
- [Sentence Transformers: semantic textual similarity](https://www.sbert.net/docs/sentence_transformer/usage/semantic_textual_similarity.html)
- [Sentence-BERT paper](https://arxiv.org/abs/1908.10084)

The application code is MIT licensed. Model weights and dependencies retain their own licenses; the MiniLM model repository lists Apache-2.0.
