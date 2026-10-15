# OSCRA — Oscra: Non-custodial trading automation. AI review. Visible controls. Your assets stay yours.

OSCRA is a non-custodial workspace for trading automation on Robinhood Chain. Recurring buys and copied trades run from
your own wallet under limits you write, and a rule-based review explains a market before you commit.

Website: https://oscra.xyz · X: [@oscra](https://x.com/oscra)

## The problem

Traders get two choices. Trading by hand means watching charts day and night and still acting on mood. Automated
services mean trusting rules you cannot read, on an account someone else holds. Neither gives you automation you can
inspect on money that stays yours.

## The solution

OSCRA puts the rules in a public contract and leaves the money in your wallet:

- **Recurring buys (DCA).** Fixed order size, pace and budget, with an optional price ceiling, drawdown guard and target
  pause. The contract checks every rule before every buy.
- **Copy desks.** Follow any wallet that posts trade ideas. Each copy passes your review delay, daily cap, position cap,
  chase limit and stop. Skip any idea you dislike.
- **Trade review.** Five checks from live prices (trend, invalidation, momentum, room overhead, volatility) and a position
  size from your account, your risk rule and the stop distance.
- **$OSCRA.** Stake it for a USDG share of every fee, hold or stake enough for a lower fee rate, and vote in polls.

## How it works

1. You approve the `OscraRunbook` contract to spend USDG from your wallet. That allowance is the only thing it can use.
2. When a buy is due, anyone may call it: you, or a keeper that collects a tip you chose.
3. The contract reads the Chainlink price for the market, applies your ceiling, guard and target, pulls exactly one order,
   swaps it on the market's Uniswap v3 USDG pool with a minimum set from the feed price, and the asset lands in your wallet.
4. The contract ends every transaction holding nothing. No owner, no admin key, no upgrade path.
5. Fees are zero until $OSCRA launches and the staking contract (`OscraKeel`) is linked once. Then 0.20% per order
   (0.10% for holders and stakers), all of it shared with stakers.

Markets: ETH and nine official Robinhood stock tokens (NVDA, SPY, QQQ, AAPL, GOOGL, TSLA, MSFT, AMZN, META), each
identified by address and paired with its Chainlink USD feed.

## What you can try

**Live now**
- The website with live Robinhood Chain data: block, gas, Chainlink prices for all ten markets.
- The trade review for every market (OKX candles for ETH, Chainlink rounds for stock tokens).
- The workspace in **practice mode**: the contract's rules in TypeScript, on live prices, with a simulated wallet kept in
  your browser. Plans, pauses, follows, review windows, skips and caps all behave like the contract.
- Wallet connect (EIP-6963 wallets, WalletConnect when configured), with Robinhood Chain added on connect.

**Coming later**
- Deployment of `OscraRunbook` (then the same screens send real transactions), the $OSCRA launch, `OscraKeel` and the bind.
- A keeper that runs due buys automatically.
- An assistant-written summary on top of the review numbers; premium features and API access for holders.
- Centralized exchange connections are **not** part of this release, and no exchange API keys are requested or stored.

## Run it locally

Requirements: Node.js 20+ and npm.

```bash
npm install
npm run build
npm start            # http://localhost:5120
```

Every environment variable is optional; the site builds and runs with none:

```bash
ROBINHOOD_RPC_URL=                     # private RPC for server reads (default: public Robinhood Chain RPC)
NEXT_PUBLIC_ROBINHOOD_RPC_URL=         # private RPC for browser reads
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=  # from cloud.reown.com; without it WalletConnect shows "not configured"
KV_REST_API_URL= / KV_REST_API_TOKEN=  # shared Redis for relay rate limits (in-memory without it)
```

Put them in `.env.local` locally, or in your hosting provider's environment settings.

Tests:

```bash
npm test                     # relay, practice rules, review rules, deployment checker
npx tsc --noEmit && npx eslint
```

### Contracts

```bash
cd contracts && ./setup.sh   # fetches forge-std into contracts/lib
forge test --no-match-path 'test/fork/*'
forge test --match-path 'test/fork/*' --fork-url https://robinhood.drpc.org --evm-version cancun
```

After a forge build, `npm run contracts:artifacts` regenerates `src/lib/contracts/artifacts.json` (used by the site and the
checker); `npm run contracts:artifacts -- --check` proves the committed file matches your build.

### Verify a deployment

```bash
npm run verify-deployment -- --runbook <address> --runbook-tx <creation tx hash> \
  [--keel <address> --keel-tx <hash> --token <$OSCRA address>]
```

It compares the runtime code byte for byte, checks every immutable against its expected value, reads back the ten stored
markets, and requires the creation transaction to be exactly this build plus the expected constructor arguments. Any
failure prints FAIL and exits non-zero.

## Robinhood Chain in your wallet

| Field | Value |
|---|---|
| Network | Robinhood Chain |
| Chain id | 4663 |
| RPC | https://rpc.mainnet.chain.robinhood.com |
| Currency | ETH |
| Explorer | https://robinhoodchain.blockscout.com |

Connecting on the site adds it for you.

## Project layout

```
contracts/           Foundry project: OscraRunbook, OscraKeel, OscraWire + unit, fuzz, invariant and fork tests
scripts/             contract artifacts generator, verify-deployment and its checks
src/app/             pages, the /app workspace, API routes (rpc relay, chain snapshot, review)
src/components/      site chrome, home sections, workspace screens, wallet dialog
src/config/          brand, markets (lanes), contract addresses, wallets
src/lib/             practice rules, review rules, chain reads, relay rules, formatting
public/              brand images and wallet logos
```

## Contracts and token

| Contract | Address |
|---|---|
| OscraRunbook | not deployed yet |
| OscraKeel | not deployed yet (after the $OSCRA launch) |
| $OSCRA | announced at launch on the site and on X |

## Security and status

- Contracts are tested with unit, fuzz, invariant and mainnet-fork tests, and an end-to-end run on a local fork.
- No owner, no admin key, no pause, no upgrade. The single privileged step is the one-time `bind` by the deploying wallet.
- The trade review is analysis of public data, not advice. Read the risk page on the website before using real funds.
- Report security issues privately by direct message to [@oscra](https://x.com/oscra).

## Contributing

Issues and pull requests are welcome. Please keep changes focused, run the tests above, and describe what you changed and
why. To get the code, download the ZIP from GitHub or fork the repository.

## License

MIT — see [LICENSE](LICENSE).
