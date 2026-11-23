# Pontra

Pontra is a proposed toolkit for private-company share records on Robinhood Chain. Companies and their shareholders keep asking three plain questions: who holds how many shares, when do those shares vest, and may this transfer go ahead? Pontra keeps the answers in one company workspace, works out vesting on any date with exact integer math, and checks a proposed transfer against every recorded rule, returning each one that fails with its reason. The same rules run in a record-only contract, PontraCapLedger, so anyone can ask the chain the same question.

Private Equity, Clearly Managed. Cap table & transfer tools planned for Robinhood Chain.

## Read this before anything else

This repository is the working code behind https://pontra.xyz.

- **What runs today.** A company workspace in the browser (share classes, holders, grants with vesting, transfer rules, first-refusal notices, a change log; export and import as JSON), a vesting calculator (cliff, linear, monthly, cliff-only) and a transfer check covering sixteen rules. They run on an invented sample company. No wallet is needed for any of it.
- **What reads live data.** Robinhood Chain mainnet: the latest block and its time (the "now" used for vesting and checks), block time, gas price, base fee, recent blocks and the Chainlink ETH/USD feed. Real cap tables are not on chain and nobody has published one there, so every holder number on the site is sample data or what you type.
- **The contract.** `PontraCapLedger` (with the internal library `PontraTransferRules`) is written and tested but **not deployed yet**. Until it is, the ledger page explains what each action will write and runs nothing on chain.
- **Planned, not built.** Scheduled reporting and a transfer-check API. $PONTRA is planned as a service token for those, once they exist.
- **What nothing here claims.** A record in Pontra or PontraCapLedger is not proof of ownership of any company's shares; ownership comes from the company's own legal documents and register. A passing check is not legal or investment advice and does not make a transfer lawful. Pontra verifies no identities. It is not affiliated with Robinhood or any company. No safety guarantee for any contract and no promised value for $PONTRA.

## Layout

| Path | What it is |
|---|---|
| `src/app/` | Pages (`/`, `/workspace`, `/vesting`, `/transfer`, `/ledger`, `/network`, `/method`, `/token`) and API routes (`/api/chain`, `/api/rpc`). |
| `src/components/` | Interface components: home sections, the workspace, vesting, transfer and ledger tools, the wallet dialog. |
| `src/lib/cap/` | The rules (`rules.ts`, a line-by-line mirror of the Solidity library), the workspace model (`workspace.ts`), the sample company (`sample.ts`). |
| `src/lib/` | Chain reads, the RPC relay rules, rate limits, formatting. |
| `src/config/` | `brand.ts` (name, ticker, token address, links), `contracts.ts` (ledger address), `status.ts` (what is Prototype and what is Concept). |
| `contracts/` | Solidity sources (`src/`) and Foundry tests (`test/`, with the parity fixtures in `test/fixtures/`). |
| `scripts/` | `verify-deployment`, the contract artifact builder and the parity fixture generator. |
| `public/` | Images, icons and wallet logos. |

## Run the tests

Node.js 20 or newer.

```
npm install
npm run typecheck
npm test
```

Contracts use [Foundry](https://book.getfoundry.sh/):

```
cd contracts
bash setup.sh
forge test
```

Fork tests against Robinhood Chain: `forge test --match-contract Fork --fork-url <robinhood rpc> --evm-version cancun`.
After changing `src/lib/cap/rules.ts`, regenerate the parity cases with `npm run contracts:parity` and run `forge test` again.

### What was checked for this snapshot

23 Nov 2026 (UTC), Node.js 20+, forge 1.x: `npm run typecheck` exit 0; `npm test` 37 pass / 0 fail (vesting and every transfer rule, the sample company, recording and cancelling, export and import, relay and rate-limit rules, deployment checker); `next build` 19 routes; `forge test` 24 passed (unit and fuzz in `PontraCapLedger.t.sol`, 3 invariants in `PontraCapLedger.invariant.t.sol`, and `PontraParity.t.sol`, which replays 400 vesting and 1,000 transfer-check cases generated from the TypeScript rules and gets identical answers) plus 2 fork tests against Robinhood Chain mainnet state in `PontraFork.t.sol`; browser tests with an injected wallet on a local fork of Robinhood Chain: 7 passed / 0 failed (wallet dialog, workspace, transfer check, vesting, publishing the sample company to a fork deployment and reading it back, the same on-chain check as the browser, the local deploy page, 390 px). `verify-deployment` printed MATCH for the fork deployment and MISMATCH for a wrong address. Not run: a mainnet deployment (none exists yet) and any outside security review.

## Look at the site

```
npm install
npm run build
npm start
```

Open http://localhost:6620. Everything works with no configuration: the server reads the public Robinhood Chain RPC. Optional variables: `ROBINHOOD_RPC_URL` (a private RPC URL, `https://…`), `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` (32 hex characters; without it WalletConnect shows "Not configured on this site yet"), `KV_REST_API_URL` + `KV_REST_API_TOKEN` (shared rate-limit store; without them limits are kept per server instance).

## Contracts

| Contract | Address | Explorer |
|---|---|---|
| PontraCapLedger | not deployed yet | — |

Anyone can open a company entry; the wallet that opens it keeps the record and can hand it over in two steps. The keeper records up to 16 share classes (transferable or not, with a lockup), one grant per holder and class with a vesting schedule (none, linear, monthly or cliff-only), transfer rules (company lockup, a right-of-first-refusal window of up to 90 days, holder cap, accredited-only, allowlist-only, minimum size), first-refusal notices and a freeze. `checkTransfer` returns a 16-bit mask with one bit per failing rule; `recordTransfer` only goes through when the mask is 0 and otherwise reverts with the mask. `cancelUnvested` keeps what has vested. Every write needs a document hash and is appended to the company's change log, which is never edited. The contract has no global owner, no admin, no fee and no upgrade path, makes no external calls and holds no funds (no payable function). Measured gas: deployment 3,213,664; `createCompany` 189,136; `grant` 251,036; `recordTransfer` 257,545.

## Verify a deployment

```
npm run verify-deployment -- --ledger <address> --ledger-tx <creation transaction>
```

The script compares the bytecode on Robinhood Chain with the build in this repository and prints MATCH or the first difference.

## Add the network to your wallet

| Field | Value |
|---|---|
| Network | Robinhood Chain |
| Chain ID | 4663 |
| Currency | ETH |
| RPC | https://rpc.mainnet.chain.robinhood.com |
| Explorer | https://robinhoodchain.blockscout.com |

The site offers to add it when you connect.

## Data sources and limits

- Robinhood Chain RPC (official endpoint, public fallbacks for plain reads), read by the server and cached for a few seconds; a failed read is never served as a number.
- The "now" for vesting and transfer checks is the time of the latest block; if the chain cannot be read, the page says it is using the device clock.
- Chainlink ETH/USD on Robinhood Chain at `0x78F3556b67E17Df817D51Ef5a990cDaF09E8d3A9`, shown with its update time.
- Cap tables, holder names and agreements are not on chain. The sample company is invented and labelled; its addresses belong to nobody. The workspace lives in your browser's storage only.
- A month in vesting is a fixed step of 2,629,746 seconds (1/12 of 365.2425 days), in the site and in the contract alike; agreements that count calendar months can differ by a few days.

## Token

$PONTRA is the community token of Pontra on Robinhood Chain. Contract address: announced on https://pontra.xyz at launch. Its planned use is paying for reporting and the transfer-check API once those services exist; neither is built yet. It is not proof of ownership of any company's shares, it has no promised value, and nothing on the site needs it.

## Deploy your own

1. Import the repository into a Next.js host (framework preset Next.js, root `./`).
2. Optional environment variables (names and formats only):

| Variable | What it is for | Format |
|---|---|---|
| `ROBINHOOD_RPC_URL` | Private RPC for server reads | `https://…` |
| `NEXT_PUBLIC_ROBINHOOD_RPC_URL` | Same, exposed to the browser | `https://…` |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WalletConnect in the wallet dialog | 32 hex characters |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Shared rate-limit store | `https://…`, token string |
| `STORE_KEY_PREFIX` | Key prefix in that store | short text, default `pontra:` |

3. After the deploy: `/` answers 200, `/api/chain` returns JSON with a block number, `/deploy` answers 404 on any public host.
4. Contract: `PontraCapLedger` has no constructor arguments. Deploy it (for example `forge create` or `/deploy` on localhost), write its address and block into `src/config/contracts.ts`, then run `npm run verify-deployment`.

## Contributing

Fork the repository, branch from `main`, and run `npm run typecheck`, `npm test` and `npm run build`, and `bash setup.sh && forge test` in `contracts/` before opening a pull request. A change to a rule must change `src/lib/cap/rules.ts` and `contracts/src/PontraTransferRules.sol` together, with regenerated parity cases. For a bug, open an issue with the expected and actual behavior and minimal steps. Keep private keys, seed phrases, environment values and real shareholder data out of issues.

## Security

Please do not open a public issue for a suspected vulnerability. Use GitHub private vulnerability reporting: open the **Security** tab of this repository and choose **Report a vulnerability**. The contract, the API routes, the RPC relay and transaction building are in scope; wallets, RPC providers, explorers and launchpads are not. There is no bug bounty.

## Notices and license

This project's original code is released under the [MIT License](LICENSE). DM Sans and IBM Plex Mono are self-hosted under the SIL Open Font License (`src/fonts/OFL-*.txt`). Wallet logos in `public/wallets/` belong to their projects and are used only to identify the wallet. The Pontra name, logo and artwork belong to the project and are not licensed for reuse as a brand.
