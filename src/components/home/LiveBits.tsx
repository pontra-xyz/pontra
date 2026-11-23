"use client";

import Link from "next/link";
import { useMemo } from "react";
import { CHAIN, explorerAddress } from "@/config/brand";
import { ETH_USD_FEED } from "@/lib/abi";
import { useChain } from "@/components/home/useChain";
import { sampleWorkspace } from "@/lib/cap/sample";
import { summary } from "@/lib/cap/workspace";
import { useNow } from "@/lib/useNow";

const gwei = (wei: string | null) => (wei ? `${(Number(wei) / 1e9).toLocaleString("en-US", { maximumFractionDigits: 4 })} gwei` : "—");

/** The reference's running row of figures, here the live Robinhood Chain facts the prototype uses (each with its source). */
export function LiveFigures() {
  const { data, error } = useChain(15_000);
  const items: { v: string; k: string; href: string }[] = [
    { v: data?.block ? `#${data.block.toLocaleString("en-US")}` : "…", k: "Latest block", href: data?.block ? `${CHAIN.explorer}/block/${data.block}` : CHAIN.explorer },
    { v: data?.time ? new Date(data.time * 1000).toISOString().slice(11, 19) + " UTC" : "…", k: "Chain clock (vesting uses it)", href: "/network" },
    { v: data?.blockSeconds ? `${data.blockSeconds.toFixed(3)} s` : "…", k: "Block time, last 100k blocks", href: "/network" },
    { v: gwei(data?.gasPriceWei ?? null), k: `Gas price (${CHAIN.nativeSymbol})`, href: "/network" },
    { v: data?.ethUsd ? `$${data.ethUsd.price.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : "…", k: "ETH / USD, Chainlink", href: explorerAddress(ETH_USD_FEED.address) },
    { v: String(CHAIN.id), k: "Chain id", href: "/network" },
  ];
  return (
    <div data-testid="live-figures">
      <div className="marquee" style={{ "--mq": "50s" } as React.CSSProperties}>
        <div className="marquee-track">
          {[0, 1].map((k) => (
            <ul key={k} className="flex items-end gap-14 pr-14" aria-hidden={k === 1 ? true : undefined}>
              {items.map((it) => (
                <li key={it.k} className="whitespace-nowrap">
                  <a href={it.href} target={it.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="block" tabIndex={k === 1 ? -1 : undefined}>
                    <span className="block text-[clamp(28px,2.8vw,40px)] leading-[1.1] tracking-[-0.03em]">{it.v}</span>
                    <span className="label-sm text-[var(--muted)]">{it.k}</span>
                  </a>
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
      {error && !data ? <p className="mt-3 text-[13px] text-[var(--muted)]">The chain could not be read right now; figures appear when it answers.</p> : null}
    </div>
  );
}

/** A small floating card next to the title (the reference's hover preview), here the sample company's table at chain time. */
export function CapPreview() {
  const { now } = useNow();
  const s = useMemo(() => (now ? summary(sampleWorkspace(), now) : null), [now]);
  return (
    <Link
      href="/workspace"
      data-follow=""
      className="absolute top-[52%] right-[-6%] hidden w-[250px] rounded-[4px] bg-white p-4 text-left shadow-[0_24px_60px_rgba(0,0,0,0.16)] ring-1 ring-black/10 lg:block"
      aria-label="Open the sample cap table"
      data-testid="cap-preview"
    >
      <span className="flex items-center justify-between">
        <span className="label-sm font-bold">Sample Co.</span>
        <span className="badge badge-sample">Sample</span>
      </span>
      <span className="mt-3 block space-y-2">
        {(s?.holders ?? []).slice(0, 4).map((h) => (
          <span key={h.address} className="block">
            <span className="flex justify-between text-[12px] leading-[16px]">
              <span className="truncate pr-2">{h.name}</span>
              <span className="mono">{h.pct.toFixed(1)}%</span>
            </span>
            <span className="bar mt-1 block">
              <i className="acc" style={{ width: `${Math.min(100, h.pct)}%` }} />
            </span>
          </span>
        ))}
      </span>
      <span className="mt-3 block text-[11px] text-[var(--muted)]">{s ? `${s.holderCount} holders · ${s.outstanding.toLocaleString("en-US")} shares` : "Loading…"}</span>
    </Link>
  );
}
