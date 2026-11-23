"use client";

import { useEffect, useState } from "react";
import { useChain } from "@/components/home/useChain";

/**
 * "Now" for vesting and transfer checks: the time of the latest Robinhood Chain block when the site can read it (the same
 * clock the contract uses), else this device's clock. Re-evaluated every 30 s.
 */
export function useNow() {
  const { data } = useChain(30_000);
  const [local, setLocal] = useState<number | null>(null);
  useEffect(() => {
    const t = () => setLocal(Math.floor(Date.now() / 1000));
    t();
    const id = setInterval(t, 30_000);
    return () => clearInterval(id);
  }, []);
  if (data?.time) {
    // advance the block time by the age of the answer so it never runs behind the page
    const drift = local ? Math.max(0, local - Math.floor(data.readAt / 1000)) : 0;
    return { now: data.time + drift, source: "chain" as const, block: data.block };
  }
  return { now: local, source: "device" as const, block: null };
}
