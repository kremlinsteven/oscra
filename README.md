# OSCRA — Oscra: Non-custodial trading automation. AI review. Visible controls. Your assets stay yours.

OSCRA is a non-custodial workspace for trading automation on Solana. Recurring buys and copied trades run from your own
wallet under limits you write, and a rule-based review explains a market before you commit.

Website: https://oscra.xyz · X: [@oscra](https://x.com/oscra)

## The problem

Traders get two choices. Trading by hand means watching charts day and night and still acting on mood. Automated
services mean trusting rules you cannot read, on an account someone else holds. Neither gives you automation you can
inspect on money that stays yours.

## The solution

OSCRA has no smart contract of its own and never holds funds. Every real order is an existing Solana rail that your
wallet signs:

- **Recurring buys (DCA).** A Jupiter Recurring order: fixed USDC per order, number of orders, pace and an optional price
  range. Jupiter fills it on schedule; you can cancel it any time and get the unspent USDC and everything bought back.
- **Copy desks.** Follow any Solana wallet that posts trade ideas. Each copy must pass your review delay, copy window,
  chase limit, daily cap, position cap and stop before OSCRA builds a Jupiter swap, which your wallet then confirms.
- **Trade review.** Five checks from live prices (trend, invalidation, momentum, room overhead, volatility) and a position
  size from your account, your risk rule and the stop distance.
- **$OSCRA.** A pump.fun token. Polls weigh the $OSCRA your wallet holds at vote time. Staking, fee share and the holder
  discount run as practice (no funds move).

## How it works

1. **Recurring buys.** The workspace asks Jupiter's Recurring API for a create-order transaction, your wallet signs it,
   and Jupiter lands it. Orders are read back by wallet address and can be cancelled the same way.
2. **Follows, ideas, skips, polls and votes** are wallet-signed records: `signMessage` over a stateless server nonce
   (random + HMAC, valid five minutes), verified with ed25519 (tweetnacl) against your address, used once. They move
   no funds.
3. **Copies.** When a followed desk posts an idea, the server stores the live price with it. Inside your copy window the
   workspace checks your limits, asks Jupiter for a quote with your slippage limit and builds the swap. After it lands,
   the server reads the transaction (`getTransaction`): your wallet paid, it succeeded, and USDC and the asset moved the
   way the idea said. Only then does it count toward your caps and holdings.
4. **Prices** come from Pyth's on-chain push feed when fresh (SOL), else from the Jupiter price API, always matched by
   mint. The review reads OKX four-hour candles for SOL and GeckoTerminal pool candles for xStocks.

## What you can try

Live now:

- Trade review for all ten markets, from live data.
- Real recurring buys through Jupiter Recurring (at least 50 USDC per order, 2+ orders; Jupiter keeps 0.1% per fill).
- Real copy desks: sign a follow, post ideas as a desk, copy ideas with Jupiter swaps.
- Practice mode on every screen: 10,000 practice USDC in your browser, a practice clock, drawdown guard and target pause.
- Practice staking with fee share and the holder discount.

Coming later:

- Polls and votes open once $OSCRA is live on pump.fun.
- An assistant-written summary on top of the review numbers.
- Optional on-chain anchoring of records with the SPL Memo program.

## Run it locally

Requirements: Node.js 20 or newer.

```bash
npm install
npm run build
npm start            # http://localhost:5120
```

`npm test` runs the unit tests (relay rules, signed records, nonce and signature checks, store limits, copy limits,
practice rules, review maths). `npx tsc --noEmit` and `npx eslint src` check types and lint.

Environment variables are optional; the site works with none:

| Name | Purpose |
|---|---|
| `SOLANA_RPC_URL` | Server-side Solana RPC (for example a Helius or QuickNode URL). Defaults to the public mainnet RPC. |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | Browser RPC the wallet sends transactions through. Defaults to `https://solana-rpc.publicnode.com` (the official public mainnet RPC refuses browser requests). |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Redis REST store for records and rate limits. Without it, a local run keeps records in memory; a deployment refuses writes (503) until it is set. |
| `TRUST_PROXY_HEADERS` | Set to `1` behind a proxy you control so per-IP limits read the forwarded address (automatic on Vercel). |

Put them in `.env.local` for a local run, or in your host's project settings. Never commit real values.

## Solana in your wallet

OSCRA runs on Solana mainnet. Any Wallet Standard wallet is detected automatically (Phantom, Solflare, Backpack and
others); there is no network to add. You need a little SOL for fees and USDC for orders.

## Project layout

```
src/app/              pages and API routes (/api/rpc relay, /api/chain snapshot, /api/review, /api/nonce, /api/records)
src/components/app/   workspace screens (overview, recurring buys, copy desks, review, stake and vote)
src/components/wallet wallet adapter provider and account menu
src/config/           brand, markets (mints, Pyth feed ids), limits
src/lib/              Jupiter client, copy limits, practice engine, review rules, relay rules, signed records
src/lib/server/       snapshot, price series, records store and checks, rate limits
```

## Markets and token

Markets: SOL and nine xStocks (NVDAx, SPYx, QQQx, AAPLx, GOOGLx, TSLAx, MSFTx, AMZNx, METAx), identified by mint, priced
in USDC (`EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`). xStocks are Token-2022 mints whose issuer holds a pause switch
and a permanent delegate.

$OSCRA launches on pump.fun (1,000,000,000 supply, 6 decimals). The mint address is published on the website's token
page and on X only.

## Security and status

- No program, no vault, no server wallet, no private key in any environment variable.
- Signed records: stateless HMAC nonces, five-minute window, single use per nonce, canonical ed25519 signatures only.
- Writes fail closed when the store is missing or down; one vote per wallet per poll.
- Read relay: method allowlist, size caps, token-account queries limited to the site's mints, per-IP budgets with a
  site-wide ceiling for callers without a trusted IP.
- Jupiter, Pyth and the xStocks issuer are third parties with their own risks. Nothing here has been audited.

## Contributing

Issues and pull requests are welcome. Please keep changes small, run `npm test`, `npx tsc --noEmit` and `npx eslint src`
before opening a pull request, and describe how you checked the change. To work on the code, download the ZIP or fork
the repository.

## License

MIT, see [LICENSE](LICENSE).
