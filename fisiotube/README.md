# FisioTube scientific core — experimental

Standalone CommonJS module for the upstream Node.js application. No extra npm dependencies. Requires Node.js 18+ with built-in fetch.

Run offline tests: `node --test fisiotube/scientific-core.test.js`.

Example (network access required):
```js
const core = require('./fisiotube/scientific-core');
(async () => {
  const ids = await core.searchPubMed('transcutaneous electrical nerve stimulation hypertension randomized trial',{maxResults:5});
  const articles = await core.fetchPubMedArticles(ids);
  const draft = core.createDraft('TENS e hipertensão',articles);
  console.log(JSON.stringify(draft,null,2));
})();
```

## Boundaries
- Does not generate videos, incur paid API charges or publish content.
- PubMed search is a retrieval tool, not scientific appraisal.
- Abstract text may be incomplete; no claim is considered scientifically verified automatically.
- Rate-limit requests to NCBI in production and comply with its API policy.
- No changes to existing server routes, scheduler, Supabase or deployment.
