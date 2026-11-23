"use client";

import { KIND_LABEL, MONTH } from "@/lib/cap/rules";
import type { Position, Workspace } from "@/lib/cap/workspace";
import { useNow } from "@/lib/useNow";
import { SampleBadge } from "@/components/site/PageHead";

/* Small pieces shared by the workspace, vesting, transfer and ledger tools. */

export const fmt = (n: bigint | number) => (typeof n === "bigint" ? n.toLocaleString("en-US") : Math.round(n).toLocaleString("en-US"));
export const day = (unix: number) => (unix ? new Date(unix * 1000).toISOString().slice(0, 10) : "—");
export const toUnix = (isoDate: string) => {
  const t = Date.parse(`${isoDate}T00:00:00Z`);
  return Number.isFinite(t) ? Math.floor(t / 1000) : 0;
};
export const short = (a: string) => (a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);

export function scheduleText(p: Pick<Position, "kind" | "cliff" | "duration" | "vestStart">) {
  if (p.kind === 0) return "Fully vested";
  const months = (s: number) => `${(s / MONTH).toLocaleString("en-US", { maximumFractionDigits: 1 })} mo`;
  if (p.kind === 3) return `All at cliff (${months(p.cliff)}) from ${day(p.vestStart)}`;
  return `${KIND_LABEL[p.kind]}, ${months(p.duration)}${p.cliff ? `, cliff ${months(p.cliff)}` : ""}, from ${day(p.vestStart)}`;
}

/** The "as of" line: chain clock when the site can read it, else this device's clock. */
export function Clock({ at, onChange }: { at: number | null; onChange?: (unix: number) => void }) {
  const { now, source, block } = useNow();
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-[var(--muted)]" data-testid="clock">
      <span className="live-dot" aria-hidden="true" />
      <span>
        Now = {source === "chain" ? `Robinhood Chain block ${block?.toLocaleString("en-US")} time` : "this device's clock (chain not reachable)"}: {now ? new Date(now * 1000).toISOString().slice(0, 16).replace("T", " ") + " UTC" : "…"}
      </span>
      {onChange && at !== null ? (
        <label className="inline-flex items-center gap-2">
          <span>Checking at</span>
          <input type="date" className="input h-[34px] w-auto text-[13px]" value={day(at)} onChange={(e) => onChange(toUnix(e.target.value) + 12 * 3600)} data-testid="at-date" />
        </label>
      ) : null}
    </div>
  );
}

export function SampleNote({ w }: { w: Workspace }) {
  if (!w.sample) return null;
  return (
    <p className="flex flex-wrap items-center gap-2 text-[13px] text-[var(--muted)]" data-testid="sample-note">
      <SampleBadge /> {w.name} is invented: names, numbers and addresses are placeholders, not anyone&apos;s wallet or company.
    </p>
  );
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="fieldset">
      <span className="field-label">{label}</span>
      {children}
      {hint ? <span className="text-[12px] leading-[16px] text-[var(--muted)]">{hint}</span> : null}
    </label>
  );
}

export function Stat({ k, v, sub, testid }: { k: string; v: string; sub?: string; testid?: string }) {
  return (
    <div className="card-soft min-w-0" data-testid={testid}>
      <p className="label-sm text-[var(--muted)]">{k}</p>
      <p className="mt-2 text-[clamp(24px,2.6vw,36px)] leading-[1.05] tracking-[-0.03em] break-words">{v}</p>
      {sub ? <p className="mt-1 text-[12px] text-[var(--muted)]">{sub}</p> : null}
    </div>
  );
}
