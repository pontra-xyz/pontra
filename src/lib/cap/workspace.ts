import { check, KIND, validSchedule, vested, type Facts } from "./rules";

/*
 * A company workspace kept in the visitor's browser. Its shape and its state changes follow PontraCapLedger one to one:
 * the same positions (granted / received / moved), the same holder count, the same notice and transfer rules. That is what
 * lets the ledger page publish a workspace to the contract step by step, and read one back.
 * Amounts are whole shares (bigint). Times are unix seconds.
 */

export type Address = `0x${string}`;

export type ShareClass = { label: string; transferable: boolean; lockupUntil: number };
export type HolderRec = { address: Address; name: string; accredited: boolean; allowlisted: boolean };
export type Position = {
  holder: Address;
  classId: number;
  granted: bigint;
  received: bigint;
  moved: bigint;
  vestStart: number;
  cliff: number;
  duration: number;
  kind: number;
  lockupUntil: number;
};
export type Rules = { lockupUntil: number; rofrWindow: number; maxHolders: number; requireAccredited: boolean; requireAllowlist: boolean; minTransfer: bigint };
export type Notice = { from: Address; classId: number; at: number; to: Address; amount: bigint };
export type ChangeKind = "created" | "class" | "class-update" | "rules" | "holder" | "grant" | "cancel" | "notice" | "transfer" | "freeze";
export type Change = { at: number; kind: ChangeKind; subject: string; counterparty?: string; classId?: number; amount?: bigint; doc: string; note: string };

export type Workspace = {
  version: 1;
  name: string;
  sample: boolean;
  frozen: boolean;
  classes: ShareClass[];
  holders: HolderRec[];
  positions: Position[];
  rules: Rules;
  notices: Notice[];
  log: Change[];
};

export const MAX_CLASSES = 16;
export const MAX_ROFR_WINDOW = 90 * 86_400;
const lc = (a: string) => a.toLowerCase();

export class WorkspaceError extends Error {}

export function holderName(w: Workspace, address: string) {
  return w.holders.find((h) => lc(h.address) === lc(address))?.name || `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function findPosition(w: Workspace, holder: string, classId: number) {
  return w.positions.find((p) => lc(p.holder) === lc(holder) && p.classId === classId);
}

export const balanceOf = (p: Pick<Position, "granted" | "received" | "moved">) => p.granted + p.received - p.moved;

export function totalOf(w: Workspace, holder: string) {
  return w.positions.filter((p) => lc(p.holder) === lc(holder)).reduce((s, p) => s + balanceOf(p), 0n);
}

/** Holders with a balance above zero (the contract's holderCount). */
export function holderCount(w: Workspace) {
  const set = new Set<string>();
  for (const p of w.positions) if (balanceOf(p) > 0n) set.add(lc(p.holder));
  return set.size;
}

/** Vested + received - moved: what a holder could move in that class at time t (before the other rules). */
export function availableOf(p: Position, t: number) {
  const v = vested(p.granted, p.vestStart, p.cliff, p.duration, p.kind, t) + p.received;
  return v > p.moved ? v - p.moved : 0n;
}

/** The same Facts the contract's facts() returns, from the workspace. */
export function factsFor(w: Workspace, from: string, to: string, classId: number, amount: bigint, at: number): Facts {
  const k = w.classes[classId];
  const p = findPosition(w, from, classId);
  const toRec = w.holders.find((h) => lc(h.address) === lc(to));
  const n = w.notices.find((x) => lc(x.from) === lc(from) && x.classId === classId);
  return {
    at,
    from,
    to,
    amount,
    classExists: classId >= 0 && classId < w.classes.length,
    classTransferable: k?.transferable ?? false,
    classLockupUntil: k?.lockupUntil ?? 0,
    companyLockupUntil: w.rules.lockupUntil,
    grantLockupUntil: p?.lockupUntil ?? 0,
    frozen: w.frozen,
    fromBalance: p ? balanceOf(p) : 0n,
    fromAvailable: p ? availableOf(p, at) : 0n,
    fromTotal: totalOf(w, from),
    toTotal: totalOf(w, to),
    holderCount: holderCount(w),
    maxHolders: w.rules.maxHolders,
    requireAccredited: w.rules.requireAccredited,
    toAccredited: toRec?.accredited ?? false,
    requireAllowlist: w.rules.requireAllowlist,
    toAllowlisted: toRec?.allowlisted ?? false,
    minTransfer: w.rules.minTransfer,
    rofrWindow: w.rules.rofrWindow,
    noticeAt: n?.at ?? 0,
    noticeTo: n?.to ?? "0x0000000000000000000000000000000000000000",
    noticeAmount: n?.amount ?? 0n,
  };
}

export function checkTransfer(w: Workspace, from: string, to: string, classId: number, amount: bigint, at: number) {
  const facts = factsFor(w, from, to, classId, amount, at);
  return { mask: check(facts), facts };
}

// ------------------------------------------------------------------ state changes (each appends to the log)

const isAddr = (a: string): a is Address => /^0x[0-9a-fA-F]{40}$/.test(a);
function needDoc(doc: string) {
  if (!doc.trim()) throw new WorkspaceError("Every change needs a document reference (for example the board resolution). It is hashed before it goes on chain.");
}

export function addClass(w: Workspace, c: ShareClass, doc: string, at: number): Workspace {
  needDoc(doc);
  if (w.classes.length >= MAX_CLASSES) throw new WorkspaceError(`At most ${MAX_CLASSES} share classes.`);
  if (!c.label.trim() || c.label.length > 31) throw new WorkspaceError("A class needs a label of 1–31 characters.");
  return { ...w, classes: [...w.classes, c], log: [...w.log, { at, kind: "class", subject: "company", classId: w.classes.length, doc, note: `Added class ${c.label}` }] };
}

export function setRules(w: Workspace, rules: Rules, doc: string, at: number): Workspace {
  needDoc(doc);
  if (rules.rofrWindow < 0 || rules.rofrWindow > MAX_ROFR_WINDOW) throw new WorkspaceError("The right-of-first-refusal window can be at most 90 days.");
  return { ...w, rules, log: [...w.log, { at, kind: "rules", subject: "company", doc, note: "Transfer rules updated" }] };
}

export function setFrozen(w: Workspace, frozen: boolean, doc: string, at: number): Workspace {
  needDoc(doc);
  return { ...w, frozen, log: [...w.log, { at, kind: "freeze", subject: "company", doc, note: frozen ? "Transfers frozen" : "Transfers unfrozen" }] };
}

export function upsertHolder(w: Workspace, h: HolderRec, doc: string, at: number): Workspace {
  needDoc(doc);
  if (!isAddr(h.address) || /^0x0{40}$/.test(h.address)) throw new WorkspaceError("A holder needs a wallet address (0x + 40 hex).");
  const rest = w.holders.filter((x) => lc(x.address) !== lc(h.address));
  const flags = [h.accredited ? "accredited" : "", h.allowlisted ? "allowlisted" : ""].filter(Boolean).join(", ") || "no flags";
  return { ...w, holders: [...rest, h], log: [...w.log, { at, kind: "holder", subject: h.address, doc, note: `${h.name || "Holder"}: ${flags}` }] };
}

export type GrantInput = Omit<Position, "received" | "moved">;

export function grant(w: Workspace, g: GrantInput, doc: string, at: number): Workspace {
  needDoc(doc);
  if (!isAddr(g.holder)) throw new WorkspaceError("A grant needs the holder's address.");
  if (g.classId < 0 || g.classId >= w.classes.length) throw new WorkspaceError("Pick an existing share class.");
  if (g.granted <= 0n) throw new WorkspaceError("A grant needs a positive number of shares.");
  if (g.granted >= 2n ** 128n) throw new WorkspaceError("That number is too large.");
  if (!validSchedule(g.cliff, g.duration, g.kind)) throw new WorkspaceError("The vesting schedule does not fit: the cliff must sit inside the duration, monthly needs at least one month, cliff-only needs a cliff and no duration.");
  const existing = findPosition(w, g.holder, g.classId);
  if (existing && existing.granted !== 0n) throw new WorkspaceError("This holder already has a grant in this class. Cancel its unvested part first or use another class.");
  const holders = w.holders.some((h) => lc(h.address) === lc(g.holder)) ? w.holders : [...w.holders, { address: g.holder, name: "", accredited: false, allowlisted: false }];
  const positions = existing
    ? w.positions.map((p) => (p === existing ? { ...p, ...g, received: p.received, moved: p.moved } : p))
    : [...w.positions, { ...g, received: 0n, moved: 0n }];
  return { ...w, holders, positions, log: [...w.log, { at, kind: "grant", subject: g.holder, classId: g.classId, amount: g.granted, doc, note: `Granted ${g.granted.toLocaleString("en-US")} ${w.classes[g.classId].label}` }] };
}

export function cancelUnvested(w: Workspace, holder: string, classId: number, doc: string, at: number): Workspace {
  needDoc(doc);
  const p = findPosition(w, holder, classId);
  if (!p || p.granted === 0n) throw new WorkspaceError("No grant for this holder in this class.");
  let v = vested(p.granted, p.vestStart, p.cliff, p.duration, p.kind, at);
  const floor = p.moved > p.received ? p.moved - p.received : 0n;
  if (v < floor) v = floor;
  const cut = p.granted - v;
  if (cut === 0n) throw new WorkspaceError("Nothing left to cancel: the grant has fully vested.");
  const next: Position = { ...p, granted: v, kind: KIND.NONE, cliff: 0, duration: 0 };
  return {
    ...w,
    positions: w.positions.map((x) => (x === p ? next : x)),
    log: [...w.log, { at, kind: "cancel", subject: p.holder, classId, amount: cut, doc, note: `Cancelled ${cut.toLocaleString("en-US")} unvested` }],
  };
}

export function fileNotice(w: Workspace, n: Omit<Notice, "at">, doc: string, at: number): Workspace {
  needDoc(doc);
  if (!isAddr(n.from) || !isAddr(n.to)) throw new WorkspaceError("A notice needs both addresses.");
  if (n.classId < 0 || n.classId >= w.classes.length) throw new WorkspaceError("Pick an existing share class.");
  if (n.amount <= 0n) throw new WorkspaceError("A notice needs a positive amount.");
  const rest = w.notices.filter((x) => !(lc(x.from) === lc(n.from) && x.classId === n.classId));
  return {
    ...w,
    notices: [...rest, { ...n, at }],
    log: [...w.log, { at, kind: "notice", subject: n.from, counterparty: n.to, classId: n.classId, amount: n.amount, doc, note: `First-refusal notice: ${n.amount.toLocaleString("en-US")} to ${holderName(w, n.to)}` }],
  };
}

/** Applies a transfer only when every rule passes at `at`; otherwise throws with the failing mask. */
export function recordTransfer(w: Workspace, from: Address, to: Address, classId: number, amount: bigint, doc: string, at: number): Workspace {
  needDoc(doc);
  const { mask } = checkTransfer(w, from, to, classId, amount, at);
  if (mask !== 0) throw Object.assign(new WorkspaceError("The transfer breaks at least one rule."), { mask });
  let positions = w.positions.map((p) => (lc(p.holder) === lc(from) && p.classId === classId ? { ...p, moved: p.moved + amount } : p));
  const dest = positions.find((p) => lc(p.holder) === lc(to) && p.classId === classId);
  positions = dest
    ? positions.map((p) => (p === dest ? { ...p, received: p.received + amount } : p))
    : [...positions, { holder: to, classId, granted: 0n, received: amount, moved: 0n, vestStart: 0, cliff: 0, duration: 0, kind: KIND.NONE, lockupUntil: 0 }];
  const holders = w.holders.some((h) => lc(h.address) === lc(to)) ? w.holders : [...w.holders, { address: to, name: "", accredited: false, allowlisted: false }];
  return {
    ...w,
    positions,
    holders,
    notices: w.notices.filter((x) => !(lc(x.from) === lc(from) && x.classId === classId)),
    log: [...w.log, { at, kind: "transfer", subject: from, counterparty: to, classId, amount, doc, note: `${holderName(w, from)} → ${holderName(w, to)}: ${amount.toLocaleString("en-US")} ${w.classes[classId].label}` }],
  };
}

// ------------------------------------------------------------------ summaries

export type ClassRow = { classId: number; label: string; outstanding: bigint; vested: bigint; holders: number; pct: number };

export function summary(w: Workspace, at: number) {
  const outstanding = w.positions.reduce((s, p) => s + balanceOf(p), 0n);
  const vestedNow = w.positions.reduce((s, p) => s + vested(p.granted, p.vestStart, p.cliff, p.duration, p.kind, at) + p.received - p.moved, 0n);
  const classes: ClassRow[] = w.classes.map((c, i) => {
    const ps = w.positions.filter((p) => p.classId === i);
    const o = ps.reduce((s, p) => s + balanceOf(p), 0n);
    return {
      classId: i,
      label: c.label,
      outstanding: o,
      vested: ps.reduce((s, p) => s + vested(p.granted, p.vestStart, p.cliff, p.duration, p.kind, at) + p.received - p.moved, 0n),
      holders: new Set(ps.filter((p) => balanceOf(p) > 0n).map((p) => lc(p.holder))).size,
      pct: outstanding > 0n ? Number((o * 1_000_000n) / outstanding) / 10_000 : 0,
    };
  });
  const byHolder = new Map<string, { address: Address; total: bigint; vested: bigint }>();
  for (const p of w.positions) {
    const k = lc(p.holder);
    const cur = byHolder.get(k) ?? { address: p.holder, total: 0n, vested: 0n };
    cur.total += balanceOf(p);
    cur.vested += vested(p.granted, p.vestStart, p.cliff, p.duration, p.kind, at) + p.received - p.moved;
    byHolder.set(k, cur);
  }
  const holders = [...byHolder.values()]
    .filter((h) => h.total > 0n)
    .sort((a, b) => (b.total > a.total ? 1 : b.total < a.total ? -1 : 0))
    .map((h) => ({ ...h, name: holderName(w, h.address), pct: outstanding > 0n ? Number((h.total * 1_000_000n) / outstanding) / 10_000 : 0 }));
  return { outstanding, vested: vestedNow, holderCount: holderCount(w), classes, holders };
}

/** Points of a vesting curve for a chart: [t, vested] from start - 1 month to the end + 1 month. */
export function curve(p: Pick<Position, "granted" | "vestStart" | "cliff" | "duration" | "kind">, points = 96): [number, bigint][] {
  const end = p.vestStart + Math.max(p.duration, p.cliff, 30 * 86_400);
  const from = p.vestStart - 30 * 86_400;
  const to = end + 30 * 86_400;
  const out: [number, bigint][] = [];
  for (let i = 0; i <= points; i++) {
    const t = Math.round(from + ((to - from) * i) / points);
    out.push([t, vested(p.granted, p.vestStart, p.cliff, p.duration, p.kind, t)]);
  }
  return out;
}

// ------------------------------------------------------------------ (de)serialisation for local storage and export

export function toJson(w: Workspace): string {
  return JSON.stringify(w, (_k, v) => (typeof v === "bigint" ? `${v}n` : v), 2);
}

export function fromJson(text: string): Workspace {
  const raw = JSON.parse(text, (_k, v) => (typeof v === "string" && /^\d+n$/.test(v) ? BigInt(v.slice(0, -1)) : v)) as Workspace;
  if (!raw || raw.version !== 1 || !Array.isArray(raw.classes) || !Array.isArray(raw.positions) || !Array.isArray(raw.holders) || !raw.rules) {
    throw new WorkspaceError("This file is not a Pontra workspace (version 1).");
  }
  if (raw.classes.length > MAX_CLASSES || raw.holders.length > 1000 || raw.positions.length > 4000) throw new WorkspaceError("The workspace is larger than the ledger allows.");
  for (const p of raw.positions) {
    if (!isAddr(p.holder) || typeof p.granted !== "bigint" || typeof p.received !== "bigint" || typeof p.moved !== "bigint") throw new WorkspaceError("A position in the file is malformed.");
    if (balanceOf(p) < 0n) throw new WorkspaceError("A position in the file has a negative balance.");
  }
  return { ...raw, log: Array.isArray(raw.log) ? raw.log : [], notices: Array.isArray(raw.notices) ? raw.notices : [] };
}
