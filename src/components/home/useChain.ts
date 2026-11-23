"use client";

import { useJson } from "@/lib/useJson";

export type ChainFacts = {
  block: number | null;
  time: number | null;
  blockSeconds: number | null;
  gasPriceWei: string | null;
  baseFeeWei: string | null;
  ethUsd: { price: number; updatedAt: number; feed: string } | null;
  ledgerCode: boolean | null;
  recent: { number: number; time: number; txs: number; gasUsed: number }[];
  readAt: number;
};

/** Live chain facts from /api/chain (server-cached a few seconds; polling pauses while the tab is hidden). */
export function useChain(every = 20_000) {
  return useJson<ChainFacts>("/api/chain", every);
}
