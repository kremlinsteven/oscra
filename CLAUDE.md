# OSCRA — internal notes (portable context)

Non-custodial trading workspace on Robinhood Chain: recurring buys (DCA plans) and copied trades (follows of a signal desk)
run from the user's wallet through OscraRunbook under user-written limits; rule-based trade review; $OSCRA staking
(OscraKeel: USDG fee share, holder fee discount, advisory polls).

## Identity
- Name OSCRA (all caps, as the owner writes it), ticker $OSCRA, domain oscra.xyz, X https://x.com/oscra (@oscra).
- Slogan "Automate With Control. Trade With Confidence." · Tagline "Oscra: Non-custodial trading automation. AI review. Visible controls. Your assets stay yours."
- Single source: src/config/brand.ts. Port 5120 (brief said 4930 = taken). Folder 2026/oktober/16/oscra (brief said oneleft: wrong).
- Internal repo git@github-oscra:kremlinsteven/oscra.git (deploy key made by the lead). Public repo: none yet -> BRAND.github
  empty, GitHub links hidden; ../public prepared locally without remote (identity OSCRA Team <team@oscra.xyz>).
- DOMAIN_LIVE = false: oscra.xyz registered 15 Oct 2026 (Namecheap) but no DNS yet. Flip to true once it points at Vercel.
- Reference: ../referensi/RECON.txt (never name it in the repo). Mode "1:1 but new layout + copy": same routes/sections/visual
  language, own grids, all copy fresh (5-gram overlap 0 of 9,245, ../referensi/qa/ngram.mjs).

## CA
`const CA` in src/config/brand.ts (placeholder). Placeholder -> navbar pill "At launch" (disabled), footer/token "Contract address
coming soon". Real CA (0x + 40 hex; check name/symbol on-chain) switches on copy, explorer link, Pons button, token facts and
the Keel deploy step. Then `npx tsc --noEmit`.

## Routes
Indexable (17, sitemap): / /ai-review /dca-bots /copy-trading /features /pricing /token /contracts /about /contact /faq /help
/connect-guide /changelog /privacy /terms /risk. Noindex: /app, /app/dca, /app/copy, /app/review, /app/stake; /deploy (404 unless
Host is localhost). API: /api/rpc (hardened read relay, post-14-Oct FRAGLE/ORVIO version; targets USDG, lane assets + feeds,
OSCRA contracts, CA), /api/chain (snapshot, 8 s single-flight), /api/review?lane=N (5 min cache per lane, single-flight).

## Live vs practice
- Live always: block, gas, block pace, Chainlink prices of 10 lanes, review (OKX ETH-USDT 4H; Chainlink rounds for stocks),
  wallet balances/allowances, wallet connect (Valtora structure, own styling).
- Runbook empty -> practice: src/lib/practice.ts mirrors OscraRunbook rules + error names (tests in practice.test.ts),
  book in localStorage os1.practice.<wallet|guest>, 10,000 practice USDG, +1 h / +1 day clock, practice desk you post for.
- Runbook set (src/config/contracts.ts) -> same screens send real txs (eth_call dry run first, explorer links), read plans,
  follows, holdings, ideas from chain. Keel set -> /app/stake live (stake, claim, polls; titles from PollOpened logs).
- No exchange API keys anywhere (not accepted, not stored). No invented performance numbers; examples are labelled.
- No audit wording, no deposit caps (owner decisions 7 Oct). No AI product names in copy.

## Contracts (contracts/, Foundry + forge-std only)
OscraWire (lib + interfaces), OscraRunbook(USDG, SwapRouter02, 10 lanes, 20, 10, 250,000e18) 5.60M gas, OscraKeel(CA, USDG,
500,000e18) 1.63M gas, bind 74k. No owner. Names unique across 2026/**. Thresholds assume 1B supply (src/config/lanes.ts).
Deploy: http://localhost:5120/deploy -> Runbook now -> paste DEPLOYED into src/config/contracts.ts -> verify-deployment MATCH
-> Blockscout kit + tools/explorer-verify -> after CA: Keel + Bind (same wallet) -> verify with --keel --keel-tx --token ->
remove src/app/deploy + src/components/deploy -> push. Details: ../referensi/CONTRACTS.txt, ../referensi/REVIEW.txt.
verify-lib hardened 15 Oct (lead request): creation tx mandatory, every immutable asserted (unknown name = FAIL), stored lanes
read back, sink checked, fail closed; 11 tests in scripts/verify-lib.test.mjs.
Tests: `cd contracts && ./setup.sh && forge test --no-match-path 'test/fork/*'` (49) ·
`forge test --match-path 'test/fork/*' --fork-url https://robinhood.drpc.org --evm-version cancun` (4; the official RPC host is
DNS-hijacked from this Mac) · `npm test` (33). E2E: ../referensi/e2e/fork-up.sh (anvil :8580) -> build-e2e.sh (:5121) ->
e2e.mjs (12). No keeper built; an optional bot could call runPlan/mirror on due items for the tips.

## Env (names only; values belong to the owner)
Required: none. Optional: ROBINHOOD_RPC_URL, NEXT_PUBLIC_ROBINHOOD_RPC_URL (private RPC), NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
(cloud.reown.com), KV_REST_API_URL=https://kv.kingfx.app + KV_REST_API_TOKEN (kv-gateway project `oscra`, not registered yet;
code prefix "oscra:"). Never on Vercel: NEXT_PUBLIC_OSCRA_TEST_CONTRACTS, NEXT_DIST_DIR, STORE_KEY_PREFIX.

## Run
`../referensi/build.sh` (shared build lock, build, restart `next start -p 5120`). Never next dev.
QA (../referensi/qa): check-layout.mjs (24 routes x 6 widths + signed in: 0 problems), wallet-qa.mjs (32), seo-check.mjs (all
pass), ngram.mjs (0). `npm test`, `npx tsc --noEmit`, `npx eslint src scripts`.

## Assets
Owner's files (2026/oktober/16/assets/OSCRA_{PNG,JPG,BANNER}) since 15 Oct. Regenerate everything with
`node referensi/tools/brand.cjs` (from the oscra folder): public/brand/{mark,mark-160,banner}.webp, favicon.ico (16/32/48 on a
dark plate, helmet trimmed), icon.png, apple-icon.png, OG/Twitter = centre crop of the banner. Mark.tsx = plain <img>
(multi-colour 3D render; no mask). Accent lime #c4f01e sampled from the helmet; olive #3d5600 for text on light.

## SEO keyword map
Brand queries: "oscra", "oscra trading", "$OSCRA", "oscra token". Category: non-custodial trading workspace; keywords: DCA bot,
copy trading, trade review, Robinhood Chain, stock tokens, self-custody.

## Open questions for the owner
CA; GitHub public repo + "OSCRA Team" account; point oscra.xyz at Vercel (then DOMAIN_LIVE=true); $OSCRA supply (thresholds
assume 1B); fee 0.20% / 0.10% and the market list OK?; "AI review" is rule-based today (no LLM wired; an assistant summary needs
a paid API + key: say if wanted); exchange connections (Binance/OKX API keys) deliberately not built: confirm on-chain scope;
"AI Agents" route of the reference replaced by Copy Trading (owner product); keeper bot wanted (hot wallet + ETH)?

## Status (15 Oct 2026, end of build session)
- Internal: main, not pushed (the lead pushes). Public: ../public main 180e857 (OSCRA Team <team@oscra.xyz>), no remote;
  built from zero (33 routes = internal), forge 49/49, npm test 33/33, artifacts --check identical, audit five points clean.
- Server: http://localhost:5120 (next start) left running. Anvil fork and the e2e server are stopped.
- X statements: 2026/oktober/16/statement/oscra.txt (10, 182-237 chars, 5-gram overlap 0).
- Nothing deployed. Next: owner deploys OscraRunbook from /deploy (no token needed), pastes the address, verify-deployment.
