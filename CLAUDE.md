# OSCRA — internal notes (portable context)

## SOLANA (current, 16 Oct 2026)
Owner order 16 Oct: OSCRA moved from Robinhood Chain to Solana, and then (same day, final) NO smart contract at all.
Everything below the "history" line is the old Robinhood Chain build, kept for reference only.

What it is now: non-custodial trading workspace on Solana. No OSCRA program, no vault, no server wallet, no key env.
- Recurring buys (REAL): Jupiter Recurring API (lite-api.jup.ag/recurring/v1 createOrder / execute / cancelOrder /
  getRecurringOrders), user's wallet signs, Jupiter lands it. Jupiter rules: >= 50 USDC per order, >= 2 orders, 0.1% fee per
  fill. Price range = minPrice/maxPrice. Guard/target pause exist only in practice. src/lib/jupiter.ts, components/app/DcaDesk.tsx.
- Copy desks (REAL): follows, desk ideas, skips, fills = wallet-signed records (rule B). A copy = Jupiter swap
  (swap/v1 quote + swap) built only after src/lib/copy-rules.ts passes (window, chase, day cap, position cap, stop); after it
  lands the browser posts record-fill and the server verifies the tx with getTransaction (fee payer = wallet, success, USDC
  and asset deltas in the idea's direction, signature recorded once).
- Review (REAL): OKX SOL-USDT 4H; xStocks = GeckoTerminal 4H candles of the deepest USDC pool (found per mint).
- Staking / fee share / holder discount: PRACTICE (rule D) inside the practice book (practice fee 0.20% / 0.10% when
  wallet+staked >= 250,000 practice $OSCRA; the book is the only staker). Real orders pay no OSCRA fee.
- Polls (REAL after CA): wallet-signed, weight = $OSCRA balance at vote time (server getTokenAccountsByOwner on BRAND.ca),
  one vote per wallet per poll (SET NX), open-poll needs 500,000 $OSCRA in the wallet, one open poll per author.
  Before the CA they show "Polls open once $OSCRA is live".
- Wallet: @solana/wallet-adapter-react(+ui), wallets: [] (Wallet Standard auto-detect), autoConnect, modal restyled in
  globals.css (.oscra-wallet-modal). Account chip + menu (SOL balance, Solana mainnet, open app, copy, Solscan, disconnect).
- Prices: Pyth push feed PDA (shard 0) when <= 300 s old (only SOL is pushed continuously), else Jupiter price v3 by mint.
  Pyth Hermes/benchmarks now answer "unauthorized" without a key, so they are not used.
- Markets (src/config/lanes.ts, verified on-chain 16 Oct): SOL (wSOL) + NVDAx SPYx QQQx AAPLx GOOGLx TSLAx MSFTx AMZNx METAx
  (Xs… Token-2022 mints, 8 decimals, issuer has permanent delegate + pause + scaled UI amount, transfer hook program = none).
  Pyth feeds "Crypto.<SYM>X/USD" ids in lanes.ts. USDC EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v.
- CA: `const CA` in src/config/brand.ts, placeholder "0xxxx…" (fails the base58 check). pump.fun mint -> pill, token page
  (pump.fun + Dexscreener buttons), TokenFacts (supply/decimals + Token-2022 metadata), poll weights. Then `npx tsc --noEmit`.
- Records security (lead review 16 Oct): stateless nonce = rand.HMAC(key, wallet|issuedAt|rand), key SET NX in the store;
  5 min window; replay keyed on the nonce rand (`used:<rand>` SET NX), never on signature bytes; S >= L refused;
  writes 503 on a deployment without KV (recordsWritable: memory store only when not on Vercel) and 503 on store errors;
  memory store = hard cap 5,000 keys, refuses new keys when full (no eviction), every key <= 1 day.
  Budgets (lib/guard.ts budget()): per known client IP, site-wide ceiling when the IP is not trusted. Routes: /api/rpc,
  /api/review, /api/nonce, /api/records (+20 writes per verified wallet / 10 min).
- Relay /api/rpc: Solana JSON-RPC allowlist (getAccountInfo, getMultipleAccounts<=20, getBalance, getTokenAccountsByOwner
  with a mint filter for a site mint only, getTokenAccountBalance, getSlot, getLatestBlockhash, getSignatureStatuses,
  getRecentPrioritizationFees, getTransaction, getSignaturesForAddress (limit<=50), getTokenSupply); never sendTransaction.

Removed: contracts/ (Solidity + Foundry), scripts/verify-*, contracts-artifacts, src/lib/abi.ts, src/config/contracts.ts,
/deploy + DeployPanel, viem, @walletconnect/*, public/wallets/*. No program/Anchor work kept (owner decision).

## Env (names only; values belong to the owner)
Required: none for reading. Records on a deployment need KV: KV_REST_API_URL=https://kv.kingfx.app + KV_REST_API_TOKEN
(kv-gateway project `oscra`, `ssh kingfx-vps 'sudo kv-gateway add oscra'`, token via `sudo kv-gateway token oscra`; key prefix
"oscra:"). Without it on Vercel: follows/ideas/votes answer 503 "not configured", everything else works.
Optional: SOLANA_RPC_URL (server), NEXT_PUBLIC_SOLANA_RPC_URL (browser, wallets send through it; Helius/QuickNode).
TRUST_PROXY_HEADERS only for self-hosting behind a proxy (Vercel is automatic). OSCRA_REQUIRE_KV=1 forces the KV rule locally.
Never on Vercel: NEXT_DIST_DIR, STORE_KEY_PREFIX. Old ROBINHOOD_* / WALLETCONNECT vars are dead: remove them from Vercel.

## QA (16 Oct 2026)
- `npm test` 34/34 (relay 8, records 10, budget 2, copy rules 4, practice 7 + review, capped 3) · `npx tsc --noEmit` clean ·
  `npx eslint src` clean · clean `next build` through the shared lock (31 routes) · `next start -p 5120`.
- curl: 17 indexable routes + /app/* 200, /deploy 404, /api/chain (slot, Pyth SOL, Jupiter xStocks), /api/review lane 0 + 1.
- ../referensi/qa/wallet-qa.mjs 28/28 (no-wallet dialog, Wallet Standard fake wallet listed, chip/menu/Solscan, signed follow
  and idea stored, forged record 401, Jupiter 50 USDC rule, recurring orders read back, practice, disconnect, navbar 360-1440
  before/after connect). ../referensi/qa/check-layout.mjs: 24 routes x 6 widths signed out + 6 workspace routes signed in
  (practice and real tabs): 0 layout problems, 0 console errors.
- Grep for the brief's list is 0 outside this file, matched as whole words ("pons" as a word: NextResponse contains it).

## Status (16 Oct 2026, end of Solana move)
- Internal main: 1b5d3da (EVM removal), c4d488d (Solana move), docs commit; NOT pushed (the lead pushes). ../public untouched.
- Server: http://localhost:5120 (next start) running. Nothing deployed; no program exists.

## Open questions (owner away; defaults chosen)
- Fee share/discount are practice: a real version needs custody or a program (excluded). Default: practice, labelled.
- Poll thresholds 500,000 to open, weight = balance at vote time (no snapshot). OK?
- Optional Memo anchoring of records not built yet (rule B says optional).
- KV for records on Vercel (kv-gateway `oscra`) must be registered before follows/ideas/votes work on the live site.
- xStocks issuer powers (pause/permanent delegate) disclosed on /risk and /contracts. Keep these ten markets?

---------------------------------------------------------------- history (Robinhood Chain build, before 16 Oct 2026)

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

## Live contracts (16 Oct 2026)
- OscraRunbook 0x1b9ac660b034e7ed285518a18443af12a854eb92 (tx 0xcb01a961…5b27), fromBlock 89189094. verify-deployment MATCH; Blockscout verified.
- binder (only wallet that can call bind(keel), once) = deployer 0x641baa6a7b3e5bfc2c4ce9d80a2ef2584486cfa3 — the owner must keep it.
- Not bound yet: fees are 0 until OscraKeel is deployed after the CA and bound. /deploy stays (localhost only) for Keel + Bind.
