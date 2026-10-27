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
