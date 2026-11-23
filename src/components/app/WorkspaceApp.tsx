"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { KIND, MONTH } from "@/lib/cap/rules";
import { useWorkspace } from "@/lib/cap/useWorkspace";
import {
  addClass,
  balanceOf,
  cancelUnvested,
  fileNotice,
  fromJson,
  grant,
  holderName,
  setFrozen,
  setRules,
  summary,
  toJson,
  upsertHolder,
  WorkspaceError,
  type Address,
  type Workspace,
} from "@/lib/cap/workspace";
import { vested } from "@/lib/cap/rules";
import { useNow } from "@/lib/useNow";
import { Clock, day, Field, fmt, SampleNote, scheduleText, short, Stat, toUnix } from "@/components/app/shared";

const EMPTY: Workspace = {
  version: 1,
  name: "My company",
  sample: false,
  frozen: false,
  classes: [],
  holders: [],
  positions: [],
  rules: { lockupUntil: 0, rofrWindow: 0, maxHolders: 0, requireAccredited: false, requireAllowlist: false, minTransfer: 0n },
  notices: [],
  log: [],
};

type Tab = "table" | "grant" | "rules" | "log";

export function WorkspaceApp() {
  const { workspace: w, save, reset } = useWorkspace();
  const { now } = useNow();
  const at = now ?? 0;
  const s = useMemo(() => summary(w, at), [w, at]);
  const [tab, setTab] = useState<Tab>("table");
  const [doc, setDoc] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const file = useRef<HTMLInputElement>(null);

  const apply = (fn: (w: Workspace) => Workspace, done: string) => {
    try {
      save({ ...fn(w), sample: w.sample });
      setMsg({ ok: true, text: done });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof WorkspaceError ? e.message : "That change could not be applied." });
    }
  };

  const exportFile = () => {
    const blob = new Blob([toJson(w)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${w.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "workspace"}.pontra.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const importFile = async (f: File) => {
    try {
      if (f.size > 2_000_000) throw new WorkspaceError("That file is larger than 2 MB.");
      save(fromJson(await f.text()));
      setMsg({ ok: true, text: `Imported ${f.name}.` });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof WorkspaceError ? e.message : "That file could not be read as a workspace." });
    }
  };

  return (
    <div className="wrap grid grid-cols-1 gap-8 pb-24" data-testid="workspace-app">
      <div className="grid grid-cols-1 gap-4 border-b border-[var(--line)] pb-6 md:grid-cols-[1fr_auto] md:items-end">
        <div className="grid grid-cols-1 gap-3">
          <input
            aria-label="Company name"
            className="w-full bg-transparent text-[clamp(28px,3vw,44px)] leading-[1.05] font-medium tracking-[-0.035em] outline-none"
            value={w.name}
            maxLength={60}
            onChange={(e) => save({ ...w, name: e.target.value })}
            data-testid="company-name"
          />
          <SampleNote w={w} />
          <Clock at={at} />
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-line" onClick={exportFile} data-testid="export">
            Export file
          </button>
          <button type="button" className="btn btn-line" onClick={() => file.current?.click()}>
            Import file
          </button>
          <input ref={file} type="file" accept="application/json,.json" className="hidden" onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} data-testid="import" />
          <button type="button" className="btn btn-line" onClick={() => (reset(), setMsg({ ok: true, text: "Back to the sample company." }))} data-testid="reset">
            Reset to sample
          </button>
          <button type="button" className="btn btn-line" onClick={() => save({ ...EMPTY, log: [{ at, kind: "created", subject: "company", doc: "Workspace opened", note: "Empty workspace opened" }] })} data-testid="start-empty">
            Start empty
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
        <Stat k="Shares outstanding" v={fmt(s.outstanding)} sub={w.sample ? "Sample data" : "From this workspace"} testid="stat-outstanding" />
        <Stat k="Vested now" v={fmt(s.vested)} sub={s.outstanding > 0n ? `${((Number(s.vested) / Number(s.outstanding)) * 100).toFixed(1)}% of outstanding` : "—"} />
        <Stat k="Holders" v={`${s.holderCount}${w.rules.maxHolders ? ` / ${w.rules.maxHolders}` : ""}`} sub={w.rules.maxHolders ? "holder cap set" : "no holder cap"} testid="stat-holders" />
        <Stat k="Transfers" v={w.frozen ? "Frozen" : "Open"} sub={`${w.classes.length} share class${w.classes.length === 1 ? "" : "es"}`} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="tabs" role="tablist">
          {(
            [
              ["table", "Cap table"],
              ["grant", "Add holder / grant"],
              ["rules", "Rules & notices"],
              ["log", `Change log (${w.log.length})`],
            ] as [Tab, string][]
          ).map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} data-testid={`tab-${k}`}>
              {l}
            </button>
          ))}
        </div>
        <Link href="/transfer" className="cta cta-sm">
          <span className="u">Check a transfer</span> →
        </Link>
      </div>

      {msg ? (
        <p className={msg.ok ? "warnbox !bg-[var(--good-bg)] !text-[var(--good)]" : "errbox"} role="status" data-testid="ws-msg">
          {msg.text}
        </p>
      ) : null}

      {tab !== "table" ? (
        <div className="max-w-[560px]">
          <Field label="Document reference for the next change" hint="Every change carries one, like the board resolution or agreement it comes from. On chain only its hash is stored.">
            <input className="input" value={doc} onChange={(e) => setDoc(e.target.value)} placeholder="e.g. Board consent 2026-11" data-testid="doc" />
          </Field>
        </div>
      ) : null}

      {tab === "table" ? <CapTable w={w} at={at} s={s} onCancel={(h, c) => apply((x) => cancelUnvested(x, h, c, doc || "Cancellation (no document given)", at), "Unvested shares cancelled and logged.")} /> : null}
      {tab === "grant" ? <GrantForms w={w} at={at} doc={doc} apply={apply} /> : null}
      {tab === "rules" ? <RulesForms w={w} at={at} doc={doc} apply={apply} /> : null}
      {tab === "log" ? <Log w={w} /> : null}
    </div>
  );
}

function CapTable({ w, at, s, onCancel }: { w: Workspace; at: number; s: ReturnType<typeof summary>; onCancel: (holder: Address, classId: number) => void }) {
  return (
    <div className="grid grid-cols-1 gap-10">
      <section>
        <h2 className="h3">Share classes</h2>
        <div className="tbl-wrap mt-4">
          <table className="tbl stack" data-testid="class-table">
            <thead>
              <tr>
                <th>Class</th>
                <th>Transferable</th>
                <th>Lockup until</th>
                <th className="num">Outstanding</th>
                <th className="num">Vested now</th>
                <th className="num">Holders</th>
                <th className="num">Share</th>
              </tr>
            </thead>
            <tbody>
              {s.classes.map((c) => (
                <tr key={c.classId}>
                  <td className="font-medium">
                    {c.label} <span className="mono text-[12px] text-[var(--muted)]">#{c.classId}</span>
                  </td>
                  <td data-l="Transferable">{w.classes[c.classId].transferable ? "Yes" : "No"}</td>
                  <td data-l="Lockup until">{w.classes[c.classId].lockupUntil ? day(w.classes[c.classId].lockupUntil) : "—"}</td>
                  <td data-l="Outstanding" className="num">{fmt(c.outstanding)}</td>
                  <td data-l="Vested now" className="num">{fmt(c.vested)}</td>
                  <td data-l="Holders" className="num">{c.holders}</td>
                  <td data-l="Share" className="num">{c.pct.toFixed(2)}%</td>
                </tr>
              ))}
              {s.classes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-[var(--muted)]">
                    No share classes yet. Add one under &quot;Add holder / grant&quot;.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
      <section>
        <h2 className="h3">Holders</h2>
        <div className="tbl-wrap mt-4">
          <table className="tbl stack min-w-[860px]" data-testid="holder-table">
            <thead>
              <tr>
                <th>Holder</th>
                <th>Class</th>
                <th>Schedule</th>
                <th className="num">Balance</th>
                <th className="num">Vested now</th>
                <th className="num">Share of total</th>
                <th>Flags</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {w.positions
                .filter((p) => balanceOf(p) > 0n || p.granted > 0n)
                .map((p) => {
                  const h = w.holders.find((x) => x.address.toLowerCase() === p.holder.toLowerCase());
                  const bal = balanceOf(p);
                  const v = vested(p.granted, p.vestStart, p.cliff, p.duration, p.kind, at) + p.received - p.moved;
                  const pct = s.outstanding > 0n ? Number((bal * 1_000_000n) / s.outstanding) / 10_000 : 0;
                  const unvested = p.granted > 0n && vested(p.granted, p.vestStart, p.cliff, p.duration, p.kind, at) < p.granted;
                  return (
                    <tr key={`${p.holder}-${p.classId}`}>
                      <td>
                        <span className="block font-medium">{holderName(w, p.holder)}</span>
                        <span className="mono text-[12px] text-[var(--muted)]" title={p.holder}>
                          {short(p.holder)}
                        </span>
                      </td>
                      <td data-l="Class">{w.classes[p.classId]?.label}</td>
                      <td data-l="Schedule" className="max-w-[240px] text-[13px]">{scheduleText(p)}</td>
                      <td data-l="Balance" className="num">{fmt(bal)}</td>
                      <td data-l="Vested now" className="num">{fmt(v < 0n ? 0n : v)}</td>
                      <td data-l="Share of total" className="num">
                        {pct.toFixed(2)}%
                        <span className="bar mt-1 ml-auto block w-[80px]">
                          <i className="acc" style={{ width: `${Math.min(100, pct)}%` }} />
                        </span>
                      </td>
                      <td data-l="Flags" className="text-[12px]">{[h?.accredited ? "Accredited" : "", h?.allowlisted ? "Allowlisted" : ""].filter(Boolean).join(" · ") || "—"}</td>
                      <td>
                        {unvested ? (
                          <button type="button" className="text-[12px] font-bold uppercase underline decoration-[var(--accent)] decoration-2 underline-offset-2" onClick={() => onCancel(p.holder, p.classId)}>
                            Cancel unvested
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
        {w.holders.some((h) => !w.positions.some((p) => p.holder.toLowerCase() === h.address.toLowerCase() && balanceOf(p) > 0n)) ? (
          <p className="mt-3 text-[13px] text-[var(--muted)]">
            Known without shares:{" "}
            {w.holders
              .filter((h) => !w.positions.some((p) => p.holder.toLowerCase() === h.address.toLowerCase() && balanceOf(p) > 0n))
              .map((h) => `${h.name || short(h.address)}${h.accredited ? " (accredited)" : ""}`)
              .join(", ")}
          </p>
        ) : null}
      </section>
    </div>
  );
}

type Apply = (fn: (w: Workspace) => Workspace, done: string) => void;

function GrantForms({ w, at, doc, apply }: { w: Workspace; at: number; doc: string; apply: Apply }) {
  const [cls, setCls] = useState({ label: "", transferable: true, lockup: "" });
  const [h, setH] = useState({ address: "", name: "", accredited: false, allowlisted: true });
  const [g, setG] = useState({ holder: "", classId: "0", amount: "", start: "", kind: String(KIND.MONTHLY), cliffMonths: "12", months: "48", lockup: "" });
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <form
        className="card grid grid-cols-1 content-start gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          apply((x) => addClass(x, { label: cls.label.trim(), transferable: cls.transferable, lockupUntil: cls.lockup ? toUnix(cls.lockup) : 0 }, doc, at), `Class ${cls.label} added.`);
        }}
      >
        <h3 className="h3">Share class</h3>
        <Field label="Label">
          <input className="input" value={cls.label} maxLength={31} onChange={(e) => setCls({ ...cls, label: e.target.value })} placeholder="e.g. Series A Preferred" data-testid="class-label" />
        </Field>
        <Field label="Lockup until (optional)">
          <input className="input" type="date" value={cls.lockup} onChange={(e) => setCls({ ...cls, lockup: e.target.value })} />
        </Field>
        <label className="check">
          <input type="checkbox" checked={cls.transferable} onChange={(e) => setCls({ ...cls, transferable: e.target.checked })} /> Transferable
        </label>
        <button className="btn btn-ink" data-testid="class-add">
          Add class
        </button>
      </form>
      <form
        className="card grid grid-cols-1 content-start gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          apply((x) => upsertHolder(x, { address: h.address.trim() as Address, name: h.name.trim(), accredited: h.accredited, allowlisted: h.allowlisted }, doc, at), "Holder saved.");
        }}
      >
        <h3 className="h3">Holder</h3>
        <Field label="Wallet address">
          <input className="input mono" value={h.address} onChange={(e) => setH({ ...h, address: e.target.value })} placeholder="0x…" data-testid="holder-address" />
        </Field>
        <Field label="Name (stays in this browser)" hint="Only the address would ever go on chain, never a name.">
          <input className="input" value={h.name} maxLength={40} onChange={(e) => setH({ ...h, name: e.target.value })} data-testid="holder-name" />
        </Field>
        <label className="check">
          <input type="checkbox" checked={h.accredited} onChange={(e) => setH({ ...h, accredited: e.target.checked })} /> Marked accredited by the company
        </label>
        <label className="check">
          <input type="checkbox" checked={h.allowlisted} onChange={(e) => setH({ ...h, allowlisted: e.target.checked })} /> On the company&apos;s allowlist
        </label>
        <button className="btn btn-ink" data-testid="holder-save">
          Save holder
        </button>
      </form>
      <form
        className="card grid grid-cols-1 content-start gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          const kind = Number(g.kind);
          const cliff = kind === KIND.NONE ? 0 : Math.round(Number(g.cliffMonths || 0) * MONTH);
          const duration = kind === KIND.NONE || kind === KIND.CLIFF_ONLY ? 0 : Math.round(Number(g.months || 0) * MONTH);
          let amount = 0n;
          try {
            amount = BigInt(g.amount.replace(/[,_\s]/g, "") || "0");
          } catch {
            amount = 0n;
          }
          apply(
            (x) => grant(x, { holder: g.holder as Address, classId: Number(g.classId), granted: amount, vestStart: toUnix(g.start || day(at)), cliff, duration, kind, lockupUntil: g.lockup ? toUnix(g.lockup) : 0 }, doc, at),
            "Grant recorded.",
          );
        }}
      >
        <h3 className="h3">Grant</h3>
        <Field label="Holder">
          <select className="input" value={g.holder} onChange={(e) => setG({ ...g, holder: e.target.value })} data-testid="grant-holder">
            <option value="">Pick a holder…</option>
            {w.holders.map((x) => (
              <option key={x.address} value={x.address}>
                {x.name || short(x.address)}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Class">
            <select className="input" value={g.classId} onChange={(e) => setG({ ...g, classId: e.target.value })} data-testid="grant-class">
              {w.classes.map((c, i) => (
                <option key={i} value={i}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Shares">
            <input className="input mono" inputMode="numeric" value={g.amount} onChange={(e) => setG({ ...g, amount: e.target.value })} placeholder="100000" data-testid="grant-amount" />
          </Field>
        </div>
        <Field label="Vesting">
          <select className="input" value={g.kind} onChange={(e) => setG({ ...g, kind: e.target.value })} data-testid="grant-kind">
            <option value={KIND.NONE}>Fully vested</option>
            <option value={KIND.LINEAR}>Linear (per second)</option>
            <option value={KIND.MONTHLY}>Monthly steps</option>
            <option value={KIND.CLIFF_ONLY}>Cliff only</option>
          </select>
        </Field>
        {Number(g.kind) !== KIND.NONE ? (
          <div className="grid grid-cols-3 gap-3">
            <Field label="Start">
              <input className="input" type="date" value={g.start || (at ? day(at) : "")} onChange={(e) => setG({ ...g, start: e.target.value })} />
            </Field>
            <Field label="Cliff (mo)">
              <input className="input" inputMode="decimal" value={g.cliffMonths} onChange={(e) => setG({ ...g, cliffMonths: e.target.value })} />
            </Field>
            {Number(g.kind) !== KIND.CLIFF_ONLY ? (
              <Field label="Length (mo)">
                <input className="input" inputMode="decimal" value={g.months} onChange={(e) => setG({ ...g, months: e.target.value })} />
              </Field>
            ) : null}
          </div>
        ) : null}
        <Field label="Grant lockup until (optional)">
          <input className="input" type="date" value={g.lockup} onChange={(e) => setG({ ...g, lockup: e.target.value })} />
        </Field>
        <button className="btn btn-ink" disabled={!w.classes.length} data-testid="grant-add">
          Record grant
        </button>
      </form>
    </div>
  );
}

function RulesForms({ w, at, doc, apply }: { w: Workspace; at: number; doc: string; apply: Apply }) {
  const r = w.rules;
  const [f, setF] = useState({
    lockup: r.lockupUntil ? day(r.lockupUntil) : "",
    rofrDays: String(Math.round(r.rofrWindow / 86400)),
    maxHolders: String(r.maxHolders),
    acc: r.requireAccredited,
    allow: r.requireAllowlist,
    min: r.minTransfer.toString(),
  });
  const [n, setN] = useState({ from: "", to: "", classId: "0", amount: "" });
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <form
        className="card grid grid-cols-1 content-start gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          let min = 0n;
          try {
            min = BigInt(f.min || "0");
          } catch {
            min = -1n;
          }
          apply(
            (x) => {
              if (min < 0n) throw new WorkspaceError("The minimum must be a whole number.");
              return setRules(x, { lockupUntil: f.lockup ? toUnix(f.lockup) : 0, rofrWindow: Math.round(Number(f.rofrDays || 0)) * 86400, maxHolders: Math.max(0, Math.round(Number(f.maxHolders || 0))), requireAccredited: f.acc, requireAllowlist: f.allow, minTransfer: min }, doc, at);
            },
            "Rules saved.",
          );
        }}
        data-testid="rules-form"
      >
        <h3 className="h3">Transfer rules</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Company lockup until">
            <input className="input" type="date" value={f.lockup} onChange={(e) => setF({ ...f, lockup: e.target.value })} />
          </Field>
          <Field label="First-refusal window (days)" hint="0 = no right of first refusal. At most 90.">
            <input className="input" inputMode="numeric" value={f.rofrDays} onChange={(e) => setF({ ...f, rofrDays: e.target.value })} data-testid="rofr-days" />
          </Field>
          <Field label="Holder cap" hint="0 = no cap.">
            <input className="input" inputMode="numeric" value={f.maxHolders} onChange={(e) => setF({ ...f, maxHolders: e.target.value })} data-testid="max-holders" />
          </Field>
          <Field label="Minimum transfer (shares)">
            <input className="input" inputMode="numeric" value={f.min} onChange={(e) => setF({ ...f, min: e.target.value })} />
          </Field>
        </div>
        <label className="check">
          <input type="checkbox" checked={f.acc} onChange={(e) => setF({ ...f, acc: e.target.checked })} /> Recipients must be marked accredited
        </label>
        <label className="check">
          <input type="checkbox" checked={f.allow} onChange={(e) => setF({ ...f, allow: e.target.checked })} /> Recipients must be on the allowlist
        </label>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-ink" data-testid="rules-save">
            Save rules
          </button>
          <button type="button" className="btn btn-line" onClick={() => apply((x) => setFrozen(x, !x.frozen, doc, at), w.frozen ? "Transfers unfrozen." : "Transfers frozen.")} data-testid="freeze">
            {w.frozen ? "Unfreeze transfers" : "Freeze all transfers"}
          </button>
        </div>
      </form>
      <div className="grid grid-cols-1 content-start gap-6">
        <form
          className="card grid grid-cols-1 content-start gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            let amount = 0n;
            try {
              amount = BigInt(n.amount.replace(/[,_\s]/g, "") || "0");
            } catch {
              amount = 0n;
            }
            apply((x) => fileNotice(x, { from: n.from as Address, to: n.to as Address, classId: Number(n.classId), amount }, doc, at), "Notice filed. The transfer passes this rule once the window has run.");
          }}
        >
          <h3 className="h3">First-refusal notice</h3>
          <p className="text-[13px] text-[var(--muted)]">A seller tells the company who they plan to sell to and how many shares. The company has the window to buy first; after it, the sale may go ahead for 30 days.</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Seller">
              <select className="input" value={n.from} onChange={(e) => setN({ ...n, from: e.target.value })}>
                <option value="">Pick…</option>
                {w.holders.map((x) => (
                  <option key={x.address} value={x.address}>
                    {x.name || short(x.address)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Buyer">
              <select className="input" value={n.to} onChange={(e) => setN({ ...n, to: e.target.value })}>
                <option value="">Pick…</option>
                {w.holders.map((x) => (
                  <option key={x.address} value={x.address}>
                    {x.name || short(x.address)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Class">
              <select className="input" value={n.classId} onChange={(e) => setN({ ...n, classId: e.target.value })}>
                {w.classes.map((c, i) => (
                  <option key={i} value={i}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Shares">
              <input className="input mono" inputMode="numeric" value={n.amount} onChange={(e) => setN({ ...n, amount: e.target.value })} />
            </Field>
          </div>
          <button className="btn btn-ink">File notice</button>
        </form>
        <div className="card">
          <h3 className="h3">Notices on file</h3>
          <ul className="mt-3 grid gap-2 text-[14px]">
            {w.notices.map((x) => (
              <li key={`${x.from}-${x.classId}`} className="border-t border-[var(--line)] pt-2">
                {holderName(w, x.from)} → {holderName(w, x.to)}: {fmt(x.amount)} {w.classes[x.classId]?.label}. Filed {day(x.at)}, window ends {day(x.at + w.rules.rofrWindow)}, usable until {day(x.at + w.rules.rofrWindow + 30 * 86400)}.
              </li>
            ))}
            {w.notices.length === 0 ? <li className="text-[var(--muted)]">None.</li> : null}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Log({ w }: { w: Workspace }) {
  return (
    <div className="tbl-wrap">
      <table className="tbl stack min-w-[720px]" data-testid="log-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Date</th>
            <th>Change</th>
            <th>Document</th>
          </tr>
        </thead>
        <tbody>
          {[...w.log].reverse().map((c, i) => (
            <tr key={i}>
              <td data-l="#" className="mono text-[12px]">{w.log.length - 1 - i}</td>
              <td data-l="Date" className="mono text-[12px] whitespace-nowrap">{day(c.at)}</td>
              <td data-l="Change">{c.note}</td>
              <td data-l="Document" className="text-[13px] text-[var(--muted)]">{c.doc}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-[13px] text-[var(--muted)]">Append-only, like the contract&apos;s change log: entries are never edited or removed. {w.sample ? "Sample entries are invented." : ""}</p>
    </div>
  );
}

