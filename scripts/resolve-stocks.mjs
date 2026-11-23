// Proves each candidate stock token on Robinhood Chain and finds the block of its first mint, then writes
// src/config/stocks.generated.ts. Run: RPC_URL=<robinhood rpc> node scripts/resolve-stocks.mjs
//
// A token counts as an official stock token only when all three hold (see the project notes):
//   1. its runtime code hash is the stock-token beacon proxy's (0x6c1fdd40…5630),
//   2. its ERC-1967 beacon slot points at the stock-token beacon 0xe10b…1b00,
//   3. totalSupply() > 0 (minting needs a role the issuer holds).
// The first-mint block comes from Transfer logs from address(0) (the official RPC has no historical state, so getCode at an
// old block cannot be used). Company names come from name() minus the " • Robinhood Token" suffix.
import { writeFileSync } from "node:fs";

const RPC = process.env.RPC_URL || "https://rpc.mainnet.chain.robinhood.com";
const CANDIDATES = [
  "0xdf0992e440dd0be65bd8439b609d6d4366bf1cb5",
  "0x4a0e65a3eccec6dbe60ae065f2e7bb85fae35eea",
  "0x5c90450bbb4273d7b2f17cf6917aeb237a569679",
  "0xf7181b63fdb858558a74ba96bc42732684cd7965",
  "0x03bc731ffb162cdd7b98d3c6542bfc291126075d",
  "0x9e7abd3c9139d14e4c86dce0e455aab7a0c2fb3e",
  "0x41f4267525a8aff329540ef24fd83d9044758b33",
  "0x5f10a1c971b69e47e059e1dc91901b59b3fb49c3",
];
// Chainlink "Robinhood <SYM> / USD" proxies from reference-data-directory.vercel.app/feeds-robinhood-mainnet.json, re-checked below.
const FEEDS = {
  CRCL: "0x6652eDf64bA3731C4F2D3ce821A0Fb1f1f6b482a",
  SPCX: "0xB265810950ba6c5C0Ff821c9963014a56fD8Bffb",
  CRWV: "0xe1b3aABCAFAd1c94708dc1367dcfF8Aa4407487C",
};
const PROXY_CODEHASH = "0x6c1fdd40002dcb440c7fff6a84171404d279ccb057803b65826f7546acd65630";
const BEACON = "0xe10b6f6b275de231345c20d14ab812db62151b00";
const SLOT = "0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50";
const TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const ZERO = "0x" + "0".repeat(64);

let id = 0;
async function rpc(method, params) {
  for (let t = 0; t < 4; t++) {
    try {
      const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }) });
      const b = await r.json();
      if (b.error) return { error: b.error.message };
      return { result: b.result };
    } catch (e) {
      if (t === 3) return { error: String(e) };
    }
  }
}
const { keccak256 } = await import("viem");
const str = (hex) => {
  if (!hex || hex.length < 130) return null;
  const len = Number(BigInt("0x" + hex.slice(66, 130)));
  return Buffer.from(hex.slice(130, 130 + len * 2), "hex").toString("utf8");
};
const hx = (n) => "0x" + n.toString(16);

async function firstMint(addr, head) {
  // Scan forward in windows; on a "too many results" refusal split the window to find the earliest log.
  async function earliest(from, to) {
    const r = await rpc("eth_getLogs", [{ address: addr, topics: [TRANSFER, ZERO], fromBlock: hx(from), toBlock: hx(to) }]);
    if (r.error) {
      if (!/exceed|limit|too many|more than/i.test(r.error) || to - from < 2) throw new Error(r.error);
      const mid = Math.floor((from + to) / 2);
      return (await earliest(from, mid)) ?? (await earliest(mid + 1, to));
    }
    if (!r.result.length) return null;
    return r.result.reduce((a, l) => (Number(BigInt(l.blockNumber)) < Number(BigInt(a.blockNumber)) ? l : a));
  }
  for (let from = 0; from <= head; from += 9_000_000) {
    const l = await earliest(from, Math.min(head, from + 8_999_999));
    if (l) return l;
  }
  return null;
}

const head = Number(BigInt((await rpc("eth_blockNumber", [])).result));
const rows = [];
for (const a of CANDIDATES) {
  const [code, beacon, supply, name, symbol] = await Promise.all([
    rpc("eth_getCode", [a, "latest"]),
    rpc("eth_getStorageAt", [a, SLOT, "latest"]),
    rpc("eth_call", [{ to: a, data: "0x18160ddd" }, "latest"]),
    rpc("eth_call", [{ to: a, data: "0x06fdde03" }, "latest"]),
    rpc("eth_call", [{ to: a, data: "0x95d89b41" }, "latest"]),
  ]);
  const proof = {
    codehash: code.result ? keccak256(code.result) === PROXY_CODEHASH : false,
    beacon: beacon.result ? "0x" + beacon.result.slice(26) === BEACON : false,
    supply: supply.result ? BigInt(supply.result) > 0n : false,
  };
  if (!proof.codehash || !proof.beacon || !proof.supply) {
    console.log("REJECT", a, proof);
    continue;
  }
  const sym = str(symbol.result);
  const company = (str(name.result) || "").replace(/\s*•\s*Robinhood Token$/, "");
  const mint = await firstMint(a, head);
  const blk = mint ? await rpc("eth_getBlockByNumber", [mint.blockNumber, false]) : null;
  let feed = null;
  if (FEEDS[sym]) {
    const d = await rpc("eth_call", [{ to: FEEDS[sym], data: "0x7284e416" }, "latest"]);
    const desc = str(d.result);
    if (desc === `Robinhood ${sym} / USD`) feed = FEEDS[sym];
    else console.log("feed description mismatch", sym, desc);
  }
  rows.push({
    address: a,
    symbol: sym,
    company,
    feed,
    firstMintBlock: mint ? Number(BigInt(mint.blockNumber)) : null,
    firstMintTx: mint ? mint.transactionHash : null,
    firstMintTime: blk?.result ? Number(BigInt(blk.result.timestamp)) : null,
  });
  console.log("OK", sym, company, feed ? "feed" : "no feed", rows.at(-1).firstMintBlock);
}
const out = `// Generated by scripts/resolve-stocks.mjs at block ${head} (${new Date().toISOString().slice(0, 10)}). Do not edit by hand.
// Each token passed the three-part stock-token proof (proxy code hash, beacon slot, supply > 0) on Robinhood Chain.
// feed = Chainlink "Robinhood <SYM> / USD" proxy whose description() was checked on chain; null = no feed found.
export type StockToken = { address: \`0x\${string}\`; symbol: string; company: string; feed: \`0x\${string}\` | null; firstMintBlock: number | null; firstMintTx: string | null; firstMintTime: number | null };
export const STOCKS_RESOLVED_AT = ${head};
export const STOCKS: StockToken[] = ${JSON.stringify(rows, null, 2)};
`;
writeFileSync(new URL("../src/config/stocks.generated.ts", import.meta.url), out);
console.log("wrote", rows.length);
