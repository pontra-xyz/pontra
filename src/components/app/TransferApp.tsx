"use client";

import { useMemo, useState } from "react";
import { CONTRACTS, ledgerLive } from "@/config/contracts";
import { LEDGER_ABI } from "@/lib/abi";
import { read } from "@/lib/client";
import { decodeReasons, REASON, REASON_TEXT, unknownBits, type ReasonKey } from "@/lib/cap/rules";
import { useWorkspace } from "@/lib/cap/useWorkspace";
import { checkTransfer, holderName, recordTransfer, WorkspaceError, type Address } from "@/lib/cap/workspace";
import { useNow } from "@/lib/useNow";
import { Clock, day, Field, fmt, SampleNote, short, toUnix } from "@/components/app/shared";

const ADDR = /^0x[0-9a-fA-F]{40}$/;

/* The transfer simulator: allowed or not, every failing rule with its reason, and the facts the answer rested on. */
export function TransferApp() {
  const { workspace: w, save } = useWorkspace();
  const { now } = useNow();
  const holders = w.holders;
  const [from, setFrom] = useState<string>(holders.find((h) => h.name.startsWith("Engineer"))?.address ?? holders[0]?.address ?? "");
  const [to, setTo] = useState<string>(holders.find((h) => h.name.startsWith("Unverified"))?.address ?? holders[1]?.address ?? "");
  const [toCustom, setToCustom] = useState("");
  const [classId, setClassId] = useState("0");
  const [amount, setAmount] = useState("100000");
  const [atText, setAtText] = useState<string | null>(null);
  const [doc, setDoc] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const at = atText ? toUnix(atText) + 12 * 3600 : (now ?? 0);
  const recipient = to === "custom" ? toCustom.trim() : to;
  let amt = 0n;
  try {
    amt = BigInt(amount.replace(/[,_\s]/g, "") || "0");
  } catch {
    amt = -1n;
  }
  const inputOk = ADDR.test(from) && ADDR.test(recipient) && amt >= 0n && at > 0;
  const result = useMemo(() => (inputOk ? checkTransfer(w, from, recipient, Number(classId), amt, at) : null), [w, from, recipient, classId, amt, at, inputOk]);
  const failing = result ? decodeReasons(result.mask) : [];

  const preset = (f: string, t: string, c: number, a: string) => {
    const byName = (n: string) => holders.find((h) => h.name.startsWith(n))?.address ?? "";
    setFrom(byName(f));
    setTo(byName(t));
    setClassId(String(c));
    setAmount(a);
    setAtText(null);
    setMsg(null);
  };

  return (
    <div className="wrap grid grid-cols-1 gap-8 pb-24" data-testid="transfer-app">
      <SampleNote w={w} />
      {w.sample ? (
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <span className="text-[var(--muted)]">Try:</span>
          <button type="button" className="chip-copy" onClick={() => preset("Angel", "Prospective", 0, "50000")} data-testid="preset-pass">
            Angel → noticed buyer (passes)
          </button>
          <button type="button" className="chip-copy" onClick={() => preset("Engineer", "Unverified", 0, "100000")} data-testid="preset-fail">
            Employee → unverified buyer
          </button>
          <button type="button" className="chip-copy" onClick={() => preset("Founder A", "Prospective", 2, "10000")}>
            Founder shares
          </button>
          <button type="button" className="chip-copy" onClick={() => preset("Seed", "Prospective", 1, "10000")}>
            Seed preferred in lockup
          </button>
        </div>
      ) : null}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[400px_1fr]">
        <form className="card grid grid-cols-1 content-start gap-4" onSubmit={(e) => e.preventDefault()} data-testid="transfer-form">
          <Field label="Seller">
            <select className="input" value={from} onChange={(e) => setFrom(e.target.value)} data-testid="t-from">
              {holders.map((h) => (
                <option key={h.address} value={h.address}>
                  {h.name || short(h.address)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Recipient">
            <select className="input" value={to} onChange={(e) => setTo(e.target.value)} data-testid="t-to">
              {holders.map((h) => (
                <option key={h.address} value={h.address}>
                  {h.name || short(h.address)}
                </option>
              ))}
              <option value="custom">Another address…</option>
            </select>
          </Field>
          {to === "custom" ? (
            <Field label="Recipient address">
              <input className="input mono" value={toCustom} onChange={(e) => setToCustom(e.target.value)} placeholder="0x…" data-testid="t-to-custom" />
            </Field>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Class">
              <select className="input" value={classId} onChange={(e) => setClassId(e.target.value)} data-testid="t-class">
                {w.classes.map((c, i) => (
                  <option key={i} value={i}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Shares">
              <input className="input mono" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} data-testid="t-amount" />
            </Field>
          </div>
          <Field label="Transfer date" hint="Defaults to now on the chain clock.">
            <input className="input" type="date" value={atText ?? day(at)} onChange={(e) => setAtText(e.target.value || null)} data-testid="t-at" />
          </Field>
          {!inputOk ? <p className="errbox">Pick a seller and a recipient (0x + 40 hex) and a whole number of shares.</p> : null}
        </form>

        <div className="grid grid-cols-1 content-start gap-5">
          <Clock at={at} />
          {result ? (
            <div className={`verdict ${result.mask === 0 ? "ok" : "no"}`} data-testid="verdict" data-mask={result.mask}>
              <p className="label-sm opacity-70">
                {holderName(w, from)} → {holderName(w, recipient)} · {fmt(amt < 0n ? 0n : amt)} {w.classes[Number(classId)]?.label} · {day(at)}
              </p>
              <p className="mt-2 text-[clamp(28px,3vw,44px)] leading-[1.05] font-medium tracking-[-0.035em]">
                {result.mask === 0 ? "Allowed by every recorded rule." : `Not allowed: ${failing.length} rule${failing.length === 1 ? "" : "s"} fail.`}
              </p>
              {unknownBits(result.mask) ? <p className="mt-2">Unknown rule bits returned; treat as not allowed.</p> : null}
            </div>
          ) : null}
          {result ? (
            <div className="card" data-testid="reasons">
              <h2 className="h3">Every rule, checked</h2>
              <ol className="mt-3">
                {(Object.keys(REASON) as ReasonKey[]).map((k, i) => {
                  const bad = (result.mask & REASON[k]) !== 0;
                  return (
                    <li key={k} className={`reason ${bad ? "" : "pass"}`} data-testid={`rule-${k}`} data-fail={bad ? "1" : "0"}>
                      <span className="n" aria-hidden="true">
                        {bad ? "×" : "✓"}
                      </span>
                      <span>
                        <span className="font-medium">
                          {REASON_TEXT[k].title} <span className="mono text-[11px] text-[var(--muted)]">bit {i}</span>
                        </span>
                        {bad ? <span className="mt-1 block text-[14px] text-[var(--muted)]">{REASON_TEXT[k].why}</span> : null}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
          ) : null}
          {result ? (
            <details className="card">
              <summary className="cursor-pointer font-medium">What the answer rested on (the same facts the contract reads)</summary>
              <dl className="kv mt-4">
                <dt>Seller balance in class</dt>
                <dd>{fmt(result.facts.fromBalance)}</dd>
                <dt>Seller vested + received, not moved</dt>
                <dd>{fmt(result.facts.fromAvailable)}</dd>
                <dt>Recipient holds now</dt>
                <dd>{fmt(result.facts.toTotal)}</dd>
                <dt>Holders / cap</dt>
                <dd>
                  {result.facts.holderCount} / {result.facts.maxHolders || "none"}
                </dd>
                <dt>Lockups (company, class, grant)</dt>
                <dd>
                  {day(result.facts.companyLockupUntil)}, {day(result.facts.classLockupUntil)}, {day(result.facts.grantLockupUntil)}
                </dd>
                <dt>First-refusal notice</dt>
                <dd>{result.facts.noticeAt ? `${day(result.facts.noticeAt)} → ${holderName(w, result.facts.noticeTo)}, ${fmt(result.facts.noticeAmount)}` : "none on file"}</dd>
              </dl>
            </details>
          ) : null}
          {result && result.mask === 0 ? (
            <div className="card grid gap-3">
              <h2 className="h3">Record it in the workspace</h2>
              <Field label="Document reference">
                <input className="input" value={doc} onChange={(e) => setDoc(e.target.value)} placeholder="e.g. Share purchase agreement 2026-11" data-testid="t-doc" />
              </Field>
              <button
                type="button"
                className="btn btn-ink"
                onClick={() => {
                  try {
                    save(recordTransfer(w, from as Address, recipient as Address, Number(classId), amt, doc, at));
                    setMsg({ ok: true, text: "Recorded in the workspace and the change log. The used notice is cleared." });
                  } catch (e) {
                    setMsg({ ok: false, text: e instanceof WorkspaceError ? e.message : "Could not record it." });
                  }
                }}
                data-testid="t-record"
              >
                Record transfer
              </button>
            </div>
          ) : null}
          {msg ? (
            <p className={msg.ok ? "warnbox !bg-[var(--good-bg)] !text-[var(--good)]" : "errbox"} data-testid="t-msg">
              {msg.text}
            </p>
          ) : null}
          <OnChainCheck from={from} to={recipient} classId={Number(classId)} amount={amt} at={at} local={result?.mask ?? null} />
          <p className="text-[13px] text-[var(--muted)]">
            A check against the rules recorded here, not legal advice. It does not know rules that were never written down, and a pass does not make a transfer lawful.
          </p>
        </div>
      </div>
    </div>
  );
}

function OnChainCheck({ from, to, classId, amount, at, local }: { from: string; to: string; classId: number; amount: bigint; at: number; local: number | null }) {
  const [company, setCompany] = useState("1");
  const [out, setOut] = useState<{ mask: number } | { error: string } | null>(null);
  if (!ledgerLive()) {
    return (
      <div className="card-soft text-[14px]" data-testid="onchain-off">
        <p className="font-medium">On-chain check</p>
        <p className="mt-1 text-[var(--muted)]">PontraCapLedger is not deployed yet, so this check runs in your browser only. Once it is live, the same question can be asked of the contract with checkTransfer().</p>
      </div>
    );
  }
  const run = async () => {
    setOut(null);
    try {
      const mask = await read<number>({ to: CONTRACTS.ledger, abi: LEDGER_ABI, fn: "checkTransfer", args: [BigInt(company || "0"), from, to, classId, amount, BigInt(at)] });
      setOut({ mask: Number(mask) });
    } catch (e) {
      setOut({ error: e instanceof Error && /UnknownCompany|revert/i.test(e.message) ? "No company with that number on the ledger." : "The chain could not be read." });
    }
  };
  return (
    <div className="card-soft grid grid-cols-1 gap-3 text-[14px]" data-testid="onchain-check">
      <p className="font-medium">Ask the contract the same question</p>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Company number on the ledger">
          <input className="input w-[140px]" value={company} onChange={(e) => setCompany(e.target.value.replace(/\D/g, ""))} data-testid="onchain-company" />
        </Field>
        <button type="button" className="btn btn-line" onClick={run} data-testid="onchain-run">
          Run checkTransfer()
        </button>
      </div>
      {out && "mask" in out ? (
        <p data-testid="onchain-result">
          Contract: {out.mask === 0 ? "allowed" : decodeReasons(out.mask).map((k) => REASON_TEXT[k].title).join(", ")} (mask {out.mask}).{" "}
          {local !== null ? (out.mask === local ? "Same answer as this workspace." : "Differs from this workspace: the on-chain company holds different records.") : null}
        </p>
      ) : null}
      {out && "error" in out ? <p className="errbox">{out.error}</p> : null}
    </div>
  );
}
