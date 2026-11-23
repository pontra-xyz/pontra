import type { Abi } from "viem";
import artifacts from "@/lib/contracts/artifacts.json";

/* Every contract ABI the site calls, straight from the build artifacts, plus the feed read. */

export const LEDGER_ABI = artifacts.contracts.PontraCapLedger.abi as Abi;

export const FEED_ABI = [
  { type: "function", name: "latestRoundData", stateMutability: "view", inputs: [], outputs: [{ type: "uint80" }, { type: "int256" }, { type: "uint256" }, { type: "uint256" }, { type: "uint80" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
] as const satisfies Abi;

/** Chainlink ETH / USD on Robinhood Chain (confirmed on chain 11 Nov 2026, memory note chainlink-eth-usd-robinhood-chain). */
export const ETH_USD_FEED = { address: "0x78F3556b67E17Df817D51Ef5a990cDaF09E8d3A9", pair: "ETH / USD", decimals: 8 } as const;
