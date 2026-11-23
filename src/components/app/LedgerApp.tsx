"use client";

import { useCallback, useState } from "react";
import { encodeFunctionData, keccak256, toHex } from "viem";
import { CHAIN, explorerAddress, explorerTx } from "@/config/brand";
import { CONTRACTS, ledgerLive } from "@/config/contracts";
import { LEDGER_ABI } from "@/lib/abi";
import { explain, read, readMany, simulate, waitForReceipt } from "@/lib/client";
import { useWorkspace } from "@/lib/cap/useWorkspace";
import type { Workspace } from "@/lib/cap/workspace";
import { useWallet } from "@/components/wallet/WalletProvider";
import { useWalletModal } from "@/components/wallet/WalletButton";
import { day, fmt, short } from "@/components/app/shared";

/** Text references are hashed before they go on chain; the text itself stays with the company. */
export const hashText = (v: string) => keccak256(toHex(v.trim()));
const label32 = (v: string) => {
  // a bytes32 label holds at most 32 UTF-8 bytes; longer labels are cut at the byte limit
  const bytes = new TextEncoder().encode(v.trim()).slice(0, 32);
  return (`0x${[...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")}`.padEnd(66, "0")) as `0x${string}`;
};
const unlabel = (hex: string) => {
  const clean = hex.replace(/^0x/, "").replace(/(00)+$/, "");
  const out: number[] = [];
  for (let i = 0; i < clean.length; i += 2) out.push(parseInt(clean.slice(i, i + 2), 16));
  return new TextDecoder().decode(new Uint8Array(out));
};

type Step = { label: string; fn: string; args: unknown[] };

/** The transactions that write this workspace to the ledger, in order. Positions that only hold received shares cannot be granted and are listed as skipped. */
export function publishPlan(w: Workspace): { steps: Step[]; skipped: string[] } {
  const steps: Step[] = [];
  const skipped: string[] = [];
  w.classes.forEach((c) => steps.push({ label: `Add class ${c.label}`, fn: "addClass", args: [c.label, c.transferable, BigInt(c.lockupUntil)] }));
  steps.push({
    label: "Set transfer rules",
    fn: "setRules",
    args: [{ lockupUntil: BigInt(w.rules.lockupUntil), rofrWindow: BigInt(w.rules.rofrWindow), maxHolders: w.rules.maxHolders, requireAccredited: w.rules.requireAccredited, requireAllowlist: w.rules.requireAllowlist, minTransfer: w.rules.minTransfer }],
  });
  w.holders.filter((h) => h.accredited || h.allowlisted).forEach((h) => steps.push({ label: `Flags for ${h.name || short(h.address)}`, fn: "setHolder", args: [h.address, h.accredited, h.allowlisted] }));
  w.positions.forEach((p) => {
    const net = p.granted - (p.moved > p.received ? p.moved - p.received : 0n);
    if (p.granted === 0n || net <= 0n) {
      skipped.push(`${short(p.holder)} ${w.classes[p.classId]?.label}: shares received by transfer (record the transfer itself once the seller's grant is on chain)`);
      return;
    }
    if (p.moved > 0n || p.received > 0n) skipped.push(`${short(p.holder)} ${w.classes[p.classId]?.label}: published as the original grant; later transfers are not replayed`);
    steps.push({ label: `Grant ${fmt(p.granted)} ${w.classes[p.classId]?.label} to ${short(p.holder)}`, fn: "grant", args: [{ holder: p.holder, classId: p.classId, amount: p.granted, vestStart: BigInt(p.vestStart), cliff: p.cliff, duration: p.duration, kind: p.kind, lockupUntil: BigInt(p.lockupUntil) }] });
  });
  if (w.frozen) steps.push({ label: "Freeze transfers", fn: "setFrozen", args: [true] });
  return { steps, skipped };
}

type Company = { owner: string; pendingOwner: string; nameHash: string; createdAt: bigint; frozen: boolean; classCount: number; holderCount: number; rules: { lockupUntil: bigint; rofrWindow: bigint; maxHolders: number; requireAccredited: boolean; requireAllowlist: boolean; minTransfer: bigint } };
type Change = { at: bigint; kind: number; classId: number; subject: string; counterparty: string; amount: bigint; docHash: string };
const KINDS: Record<number, string> = { 1: "Company opened", 2: "Owner changed", 3: "Class added", 4: "Class updated", 5: "Rules set", 6: "Holder flags", 7: "Grant", 8: "Unvested cancelled", 9: "First-refusal notice", 10: "Transfer", 11: "Freeze changed" };

export function LedgerApp() {
  const live = ledgerLive();
  const ledger = CONTRACTS.ledger as `0x${string}`;
  const { workspace: w } = useWorkspace();
  const { address, onChain, sendTransaction, switchNetwork } = useWallet();
  const { open } = useWalletModal();
  const [id, setId] = useState("1");
  const [view, setView] = useState<{ c: Company; classes: { label: string; transferable: boolean; lockupUntil: bigint }[]; holders: { a: string; total: bigint }[]; changes: Change[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [docRef, setDocRef] = useState("");
  const [progress, setProgress] = useState<{ i: number; n: number; text: string; tx?: string; ok?: boolean } | null>(null);
  const [created, setCreated] = useState<number | null>(null);

  const load = useCallback(
    async (which = id) => {
      setErr(null);
      if (!/^\d+$/.test(which) || which === "0") return setErr("Company numbers start at 1.");
      try {
        const n = BigInt(which);
        const c = await read<Company>({ to: ledger, abi: LEDGER_ABI, fn: "companyOf", args: [n] });
        if (/^0x0{40}$/i.test(c.owner)) {
          setView(null);
          return setErr("There is no company with that number on the ledger.");
        }
        const len = Number(await read<bigint>({ to: ledger, abi: LEDGER_ABI, fn: "holderListLength", args: [n] }));
        const list = len ? await read<string[]>({ to: ledger, abi: LEDGER_ABI, fn: "holderList", args: [n, 0n, BigInt(Math.min(len, 100))] }) : [];
        const cls = (await readMany(Array.from({ length: Number(c.classCount) }, (_, i) => ({ to: ledger, abi: LEDGER_ABI, fn: "classOf", args: [n, i] })))) as ({ label: string; transferable: boolean; lockupUntil: bigint } | null)[];
        const hs = (await readMany(list.map((a) => ({ to: ledger, abi: LEDGER_ABI, fn: "holderOf", args: [n, a] })))) as ({ total: bigint } | null)[];
        const count = Number(await read<bigint>({ to: ledger, abi: LEDGER_ABI, fn: "changeCount", args: [n] }));
        const changes = await read<Change[]>({ to: ledger, abi: LEDGER_ABI, fn: "changes", args: [n, BigInt(Math.max(0, count - 25)), 25n] });
        setView({
          c,
          classes: cls.map((x) => ({ label: x ? unlabel(x.label) : "?", transferable: Boolean(x?.transferable), lockupUntil: x?.lockupUntil ?? 0n })),
          holders: list.map((a, i) => ({ a, total: hs[i]?.total ?? 0n })),
          changes: [...changes].reverse(),
        });
      } catch {
        setView(null);
        setErr("The ledger could not be read right now.");
      }
    },
    [id, ledger],
  );

  const send = async (fn: string, args: unknown[]) => {
    const data = encodeFunctionData({ abi: LEDGER_ABI, functionName: fn, args } as never);
    await simulate(address!, ledger, data);
    const hash = await sendTransaction({ to: ledger, data });
    const r = await waitForReceipt(hash, 180_000);
    if (!r.ok) throw Object.assign(new Error("The transaction reverted."), { hash });
    return hash;
  };

  const publish = async () => {
    if (!address) return open();
    if (!onChain) return switchNetwork();
    const plan = publishPlan(w);
    const doc = hashText(docRef || `${w.name} workspace export`);
    const total = plan.steps.length + 1;
    try {
      setProgress({ i: 1, n: total, text: "Opening the company entry…" });
      const before = Number(await read<bigint>({ to: ledger, abi: LEDGER_ABI, fn: "companyCount" }));
      const h0 = await send("createCompany", [hashText(w.name), doc]);
      // the new number is the first company after `before` that this wallet owns
      let cid = 0;
      const after = Number(await read<bigint>({ to: ledger, abi: LEDGER_ABI, fn: "companyCount" }));
      for (let k = before + 1; k <= after; k++) {
        const c = await read<Company>({ to: ledger, abi: LEDGER_ABI, fn: "companyOf", args: [BigInt(k)] });
        if (c.owner.toLowerCase() === address.toLowerCase()) {
          cid = k;
          break;
        }
      }
      if (!cid) throw new Error("The new company number could not be found.");
      setCreated(cid);
      setProgress({ i: 1, n: total, text: `Company #${cid} opened.`, tx: h0 });
      for (let s = 0; s < plan.steps.length; s++) {
        const st = plan.steps[s];
        setProgress({ i: s + 2, n: total, text: `${st.label}…` });
        const args = st.fn === "addClass" ? [BigInt(cid), label32(String(st.args[0])), st.args[1], st.args[2], doc] : [BigInt(cid), ...st.args, doc];
        const tx = await send(st.fn, args);
        setProgress({ i: s + 2, n: total, text: `${st.label}: done.`, tx });
      }
      setProgress({ i: total, n: total, text: `Published as company #${cid}.`, ok: true });
      setId(String(cid));
      await load(String(cid));
    } catch (e) {
      setProgress((p) => ({ i: p?.i ?? 0, n: total, text: explain(e), ok: false }));
    }
  };

  const plan = publishPlan(w);

  return (
    <div className="wrap grid grid-cols-1 gap-10 pb-24" data-testid="ledger-app">
      <div className="card-soft grid grid-cols-1 gap-2 text-[14px] md:grid-cols-[1fr_auto] md:items-center">
        <p>
          {live ? (
            <>
              PontraCapLedger is live at{" "}
              <a className="link mono break-all" href={explorerAddress(ledger)} target="_blank" rel="noreferrer">
                {ledger}
              </a>{" "}
              on {CHAIN.name}.
            </>
          ) : (
            <>PontraCapLedger is written and tested but <b>not deployed yet</b>. Reading and publishing turn on once the owner deploys it; until then this page shows what each action will write.</>
          )}
        </p>
        <span className={`badge ${live ? "badge-live" : "badge-concept"}`} data-testid="ledger-state">
          {live ? "Live" : "Not deployed"}
        </span>
      </div>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card grid grid-cols-1 content-start gap-4">
          <h2 className="h3">Read a company</h2>
          <div className="flex flex-wrap items-end gap-3">
            <label className="fieldset">
              <span className="field-label">Company number</span>
              <input className="input w-[160px]" value={id} onChange={(e) => setId(e.target.value.replace(/\D/g, ""))} disabled={!live} data-testid="ledger-id" />
            </label>
            <button type="button" className="btn btn-ink" disabled={!live} onClick={() => load()} data-testid="ledger-load">
              Read from chain
            </button>
          </div>
          {err ? <p className="errbox">{err}</p> : null}
          {view ? (
            <div className="grid grid-cols-1 gap-4 text-[14px]" data-testid="ledger-view">
              <dl className="kv">
                <dt>Record keeper</dt>
                <dd>{short(view.c.owner)}</dd>
                <dt>Opened</dt>
                <dd>{day(Number(view.c.createdAt))}</dd>
                <dt>Holders with shares</dt>
                <dd data-testid="ledger-holders">{view.c.holderCount}</dd>
                <dt>Transfers</dt>
                <dd>{view.c.frozen ? "Frozen" : "Open"}</dd>
                <dt>Classes</dt>
                <dd>{view.classes.map((c) => c.label).join(", ") || "—"}</dd>
              </dl>
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Address</th>
                      <th className="num">Shares</th>
                    </tr>
                  </thead>
                  <tbody>
                    {view.holders.map((h) => (
                      <tr key={h.a}>
                        <td className="mono text-[12px]">
                          <a className="link" href={explorerAddress(h.a)} target="_blank" rel="noreferrer">
                            {short(h.a)}
                          </a>
                        </td>
                        <td className="num">{fmt(h.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <p className="field-label">Latest changes</p>
                <ul className="mt-2 grid gap-1">
                  {view.changes.map((c, i) => (
                    <li key={i} className="flex justify-between gap-3 border-t border-[var(--line)] pt-1">
                      <span>
                        {KINDS[c.kind] ?? c.kind} {c.amount ? `· ${fmt(c.amount)}` : ""} {/^0x0{40}$/i.test(c.subject) ? "" : `· ${short(c.subject)}`}
                      </span>
                      <span className="mono text-[12px] text-[var(--muted)]">{day(Number(c.at))}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
        </div>

        <div className="card grid grid-cols-1 content-start gap-4">
          <h2 className="h3">Publish this workspace</h2>
          <p className="text-[14px] text-[var(--muted)]">
            Writes {w.name} to the ledger as a new company owned by your wallet: {plan.steps.length + 1} transactions, each signed in your wallet and paid in {CHAIN.nativeSymbol}. Only hashes of the name and
            the document go on chain; holder names never do.
          </p>
          <label className="fieldset">
            <span className="field-label">Document reference (hashed)</span>
            <input className="input" value={docRef} onChange={(e) => setDocRef(e.target.value)} placeholder="e.g. Cap table as of board consent 2026-11" data-testid="publish-doc" />
          </label>
          <ol className="grid grid-cols-1 gap-1 text-[13px]" data-testid="publish-plan">
            <li className="border-t border-[var(--line)] pt-1">1. Open the company entry (name hash)</li>
            {plan.steps.map((s, i) => (
              <li key={i} className="border-t border-[var(--line)] pt-1">
                {i + 2}. {s.label}
              </li>
            ))}
          </ol>
          {plan.skipped.length ? (
            <ul className="warnbox grid gap-1 text-[13px]">
              {plan.skipped.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          ) : null}
          {w.sample ? <p className="warnbox">This is the invented sample company. Publish it only to try the ledger; its addresses belong to nobody.</p> : null}
          <button type="button" className="btn btn-ink" disabled={!live || Boolean(progress && progress.ok === undefined)} onClick={publish} data-testid="publish">
            {!live ? "Available once deployed" : !address ? "Connect wallet" : !onChain ? `Switch to ${CHAIN.name}` : "Publish to the ledger"}
          </button>
          {progress ? (
            <p className={progress.ok === false ? "errbox" : progress.ok ? "warnbox !bg-[var(--good-bg)] !text-[var(--good)]" : "warnbox"} role="status" data-testid="publish-progress">
              Step {progress.i} of {progress.n}: {progress.text}{" "}
              {progress.tx ? (
                <a className="link" href={explorerTx(progress.tx)} target="_blank" rel="noreferrer">
                  transaction
                </a>
              ) : null}
            </p>
          ) : null}
          {created ? <p className="text-[13px]" data-testid="publish-id">Company number: {created}</p> : null}
        </div>
      </section>
    </div>
  );
}
