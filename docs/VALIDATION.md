# Validation record

Checked on 8 October 2026, using Node.js 24.13.0 and Transformers.js 4.3.1 on Windows.

## Automated checks

- `npm test`: **8 tests passed** (vector math, semantic order, feedback blending, caching/filtering, keyword baseline, validation, HTTP endpoints, and model-loading response).
- `node --check public/app.js` and `node --check src/server.js`: passed.
- `npm run evaluate`: actual quantized MiniLM model loaded successfully from the project's local model cache.

## Real-model smoke evaluation

All eight manually labeled queries returned an expected relevant article at rank 1.

| Measure | Result |
| --- | --- |
| Semantic Hit@3 | 1.000 |
| Semantic MRR | 1.000 |
| Keyword Hit@3 | 1.000 |

These are illustrative results on eight authored queries and 24 sample articles. The keyword baseline also reached Hit@3 = 1.000; these results **do not demonstrate a comparative accuracy advantage** for embeddings. They verify that the real model and ranking pipeline work on this small corpus. A larger held-out dataset is required for meaningful quality claims.

## Browser checks

Verified natural-language recommendations, the comparison dialog, bookmark creation and Saved view, the full-article reader, preferences surviving reload, and likes changing the profile score. For the query “storing sunshine to power homes after dark,” the solar-storage story ranked first at cosine similarity 0.494; liking it increased its profile similarity to 0.650. Category filtering returned only the three Climate articles; result-count selection and the mobile algorithm-explanation dialog worked. Desktop (1280 px) and phone (390 px) layouts were inspected, with no horizontal overflow on the phone layout. No browser warnings or errors were observed during these flows.
