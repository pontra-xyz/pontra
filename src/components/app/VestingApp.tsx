"use client";

import { useMemo, useState } from "react";
import { KIND, KIND_LABEL, MONTH, validSchedule, vested } from "@/lib/cap/rules";
import { useWorkspace } from "@/lib/cap/useWorkspace";
import { curve, holderName } from "@/lib/cap/workspace";
import { useNow } from "@/lib/useNow";
import { Clock, day, Field, fmt, SampleNote, scheduleText, Stat, toUnix } from "@/components/app/shared";

type Sched = { granted: bigint; vestStart: number; cliff: number; duration: number; kind: number };

/* Vesting on any date, for a grant in the workspace or a schedule typed here, with the curve and its milestones. */
export function VestingApp() {
  const { workspace: w } = useWorkspace();
  const { now } = useNow();
  const grants = w.positions.filter((p) => p.granted > 0n);
  const [pick, setPick] = useState<string>("0");
  const [custom, setCustom] = useState({ amount: "48000", start: "2025-01-01", kind: String(KIND.MONTHLY), cliff: "12", months: "48" });
  const [atText, setAtText] = useState<string | null>(null);

  const sched: Sched | null = useMemo(() => {
    if (pick !== "custom") {
      const p = grants[Number(pick)];
      return p ? { granted: p.granted, vestStart: p.vestStart, cliff: p.cliff, duration: p.duration, kind: p.kind } : null;
    }
    const kind = Number(custom.kind);
    const cliff = kind === KIND.NONE ? 0 : Math.round(Number(custom.cliff || 0) * MONTH);
    const duration = kind === KIND.NONE || kind === KIND.CLIFF_ONLY ? 0 : Math.round(Number(custom.months || 0) * MONTH);
    let granted = 0n;
    try {
      granted = BigInt(custom.amount.replace(/[,_\s]/g, "") || "0");
    } catch {
      granted = 0n;
    }
    return { granted, vestStart: toUnix(custom.start), cliff, duration, kind };
  }, [pick, custom, grants]);

  const valid = sched ? validSchedule(sched.cliff, sched.duration, sched.kind) : false;
  const at = atText ? toUnix(atText) + 12 * 3600 : (now ?? 0);
  const v = sched && valid ? vested(sched.granted, sched.vestStart, sched.cliff, sched.duration, sched.kind, at) : 0n;
  const pts = sched && valid && sched.granted > 0n ? curve(sched) : [];
  const pct = sched && sched.granted > 0n ? (Number(v) / Number(sched.granted)) * 100 : 0;

  return (
    <div className="wrap grid grid-cols-1 gap-8 pb-24" data-testid="vesting-app">
      <SampleNote w={w} />
      <Clock at={at} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
        <div className="card grid grid-cols-1 content-start gap-4">
          <Field label="Grant">
            <select className="input" value={pick} onChange={(e) => setPick(e.target.value)} data-testid="vest-pick">
              {grants.map((p, i) => (
                <option key={i} value={i}>
                  {holderName(w, p.holder)} · {w.classes[p.classId]?.label} · {fmt(p.granted)}
                </option>
              ))}
              <option value="custom">A schedule I type in…</option>
            </select>
          </Field>
          {pick === "custom" ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Shares">
                  <input className="input mono" value={custom.amount} onChange={(e) => setCustom({ ...custom, amount: e.target.value })} data-testid="vest-amount" />
                </Field>
                <Field label="Start">
                  <input className="input" type="date" value={custom.start} onChange={(e) => setCustom({ ...custom, start: e.target.value })} data-testid="vest-start" />
                </Field>
              </div>
              <Field label="Kind">
                <select className="input" value={custom.kind} onChange={(e) => setCustom({ ...custom, kind: e.target.value })} data-testid="vest-kind">
                  {[0, 1, 2, 3].map((k) => (
                    <option key={k} value={k}>
                      {KIND_LABEL[k]}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Cliff (months)">
                  <input className="input" value={custom.cliff} onChange={(e) => setCustom({ ...custom, cliff: e.target.value })} data-testid="vest-cliff" />
                </Field>
                <Field label="Length (months)">
                  <input className="input" value={custom.months} onChange={(e) => setCustom({ ...custom, months: e.target.value })} data-testid="vest-months" />
                </Field>
              </div>
            </>
          ) : sched ? (
            <p className="text-[14px]">{scheduleText(sched)}</p>
          ) : null}
          <Field label="Vested on" hint="Defaults to now (chain clock).">
            <input className="input" type="date" value={atText ?? day(at)} onChange={(e) => setAtText(e.target.value || null)} data-testid="vest-at" />
          </Field>
          {!valid ? <p className="errbox">This schedule does not fit: the cliff must sit inside the length, monthly needs at least one month, cliff-only needs a cliff.</p> : null}
        </div>
        <div className="grid grid-cols-1 content-start gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Stat k={`Vested on ${day(at)}`} v={fmt(v)} sub={`${pct.toFixed(2)}% of the grant`} testid="vest-result" />
            <Stat k="Not vested yet" v={sched ? fmt(sched.granted - v) : "—"} />
            <Stat k="Fully vested on" v={sched && valid ? day(sched.kind === KIND.NONE ? sched.vestStart : sched.vestStart + Math.max(sched.duration, sched.cliff)) : "—"} />
          </div>
          {pts.length ? <Chart pts={pts} at={at} total={sched!.granted} cliffAt={sched!.vestStart + sched!.cliff} /> : null}
          <p className="text-[13px] text-[var(--muted)]">
            Same integer math as PontraCapLedger.vested(): floor rounding, nothing before the cliff, a month = 2,629,746 seconds (1/12 of 365.2425 days). Shares received by transfer are always vested and are not in this curve.
          </p>
        </div>
      </div>
    </div>
  );
}

function Chart({ pts, at, total, cliffAt }: { pts: [number, bigint][]; at: number; total: bigint; cliffAt: number }) {
  const W = 800;
  const H = 300;
  const t0 = pts[0][0];
  const t1 = pts[pts.length - 1][0];
  const x = (t: number) => 40 + ((t - t0) / Math.max(1, t1 - t0)) * (W - 60);
  const y = (v: bigint) => H - 30 - (Number(v) / Math.max(1, Number(total))) * (H - 60);
  let d = "";
  pts.forEach(([t, v], i) => {
    d += i === 0 ? `M${x(t)} ${y(v)}` : ` L${x(t)} ${y(pts[i - 1][1])} L${x(t)} ${y(v)}`;
  });
  const atX = Math.min(W - 20, Math.max(40, x(at)));
  return (
    <figure className="card" data-testid="vest-chart">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Vested shares over time">
        <line x1="40" x2={W - 20} y1={H - 30} y2={H - 30} stroke="currentColor" strokeOpacity="0.2" />
        <line x1="40" x2={W - 20} y1={30} y2={30} stroke="currentColor" strokeOpacity="0.08" strokeDasharray="4 6" />
        {cliffAt > t0 && cliffAt < t1 ? <line x1={x(cliffAt)} x2={x(cliffAt)} y1={24} y2={H - 30} stroke="currentColor" strokeOpacity="0.35" strokeDasharray="4 6" /> : null}
        <path d={d} fill="none" stroke="#000" strokeWidth="2.5" />
        <line x1={atX} x2={atX} y1={20} y2={H - 30} stroke="#1fe0b4" strokeWidth="3" />
        <text x="44" y="22" fontSize="12" fill="currentColor" opacity="0.6">
          {total.toLocaleString("en-US")}
        </text>
        <text x="44" y={H - 10} fontSize="12" fill="currentColor" opacity="0.6">
          {day(t0)}
        </text>
        <text x={W - 20} y={H - 10} fontSize="12" textAnchor="end" fill="currentColor" opacity="0.6">
          {day(t1)}
        </text>
      </svg>
      <figcaption className="mt-2 text-[12px] text-[var(--muted)]">Black: vested shares. Mint line: the date you are checking. Dashed: the cliff.</figcaption>
    </figure>
  );
}
