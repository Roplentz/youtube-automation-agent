# FisioTube-AI 2.0 — Scientific Core

Development branch for scientific evidence integration into YouTube Automation Agent.

## Safety defaults
- No automated publishing or channel OAuth configuration in this phase.
- No paid AI or media API calls without explicit approval.
- Do not deploy the upstream scheduler in production until reviewed.
- All health claims require traceable sources and human editorial approval.
- Never commit API keys, patient data, or OAuth tokens.

## Phase 1 acceptance criteria
1. Search PubMed with explicit query, dates and result limits.
2. Save PMID, DOI, title, abstract, publication date and retrieval time.
3. Label unsupported or unverified claims, never fabricate citations.
4. Generate draft scripts only; publishing disabled.
5. Add unit tests, dependency audit and cost controls before deployment.

Upstream: https://github.com/darkzOGx/youtube-automation-agent
License: MIT. Preserve upstream copyright and license notices.

## Phase 2 — Conteúdo 2.0 (experimental)
Vertical explainer videos where on-screen panels are triggered by words in the presenter's speech.
1. Storyboard contract (`fisiotube/conteudo20/storyboard.js`) carries scientific references from Phase 1; every on-screen claim must cite a PMID present in `references`.
2. Deterministic sync (`sync.js`) maps trigger words to timestamps from a local transcript; missing triggers are reported, never invented.
3. Local renderer (`conteudo20/render/`, Python + ffmpeg); no paid APIs.
4. Render gate: refuses while any scene lacks `revisado: true` or any claim lacks a source.
5. Output is always a draft; publishing remains disabled.

### Phase 2.1 — Format v2 (alternating screen types)
Scene-by-scene Reels that rotate seven screen types (hook, footage, kinetic typography, object card, evidence card, icon split, final words) for footage without synced narration. `roteiro_v2.js` validates the script (an evidence card must cite a PMID listed in `references`) and gates rendering on human review; `render/render_v2.py` renders locally with an original generated soundtrack. Same locks: no publishing, no paid APIs, drafts only.

### Phase 2.2 — Evidence, design and data (Nov 2026)
- PubMed filters (dates, study types), study year/journal/design, evidence level A–D with reviewer override, `referencias` and `conferir` commands; DOI taken from the article itself.
- Retention checks in `validate-v2` (hook ≤ 3 s, total ≤ 60 s, send-oriented CTA).
- HTML/CSS cards captured with Playwright, shared design tokens (`fisiotube/design/tokens.json`), `dados` screen (icon array, effect with 95% CI, before/after).
- Review gate repeated inside the Python renderers; FisioTube tests run in CI.

### Phase 2.3 — Avatar Reels and b-roll (Nov 2026)
- Reels can be voiced and presented by the author's cloned voice and avatar; the talking-head video enters the same pipeline as a recording.
- `corrigir` fixes Whisper splits and storyboard-defined `correcoes_transcricao` before sync and captions.
- Animated b-roll (`camera_substituta`): crossfade, slow zoom, sliding label; AI clips labelled as illustration.
- Worked example: `fisiotube/conteudo20/exemplo/ozempic/`.
