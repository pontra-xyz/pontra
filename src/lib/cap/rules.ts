/*
 * Line-by-line mirror of contracts/src/PontraTransferRules.sol. Same constants, same rounding (bigint, floor), same bit for
 * every rule. contracts/test/fixtures/parity.json is generated from this file (scripts/parity-fixture.ts) and the forge test
 * PontraParity replays it against the Solidity library, so the site and the contract cannot drift apart silently.
 */

export const KIND = { NONE: 0, LINEAR: 1, MONTHLY: 2, CLIFF_ONLY: 3 } as const;
export type Kind = (typeof KIND)[keyof typeof KIND];
export const KIND_LABEL: Record<number, string> = { 0: "Fully vested", 1: "Linear (per second)", 2: "Monthly steps", 3: "Cliff only" };

/** 1/12 of an average Gregorian year (365.2425 days), in seconds. */
export const MONTH = 2_629_746;
export const DAY = 86_400;
export const MAX_DURATION = 20 * 12 * MONTH;
export const ROFR_VALIDITY = 30 * DAY;

export function validSchedule(cliff: number, duration: number, kind: number): boolean {
  if (!Number.isInteger(cliff) || !Number.isInteger(duration) || cliff < 0 || duration < 0 || cliff > 0xffffffff || duration > 0xffffffff) return false;
  if (kind > KIND.CLIFF_ONLY || kind < 0) return false;
  if (kind === KIND.NONE) return cliff === 0 && duration === 0;
  if (kind === KIND.CLIFF_ONLY) return duration === 0 && cliff > 0 && cliff <= MAX_DURATION;
  if (duration === 0 || duration > MAX_DURATION || cliff > duration) return false;
  if (kind === KIND.MONTHLY && duration < MONTH) return false;
  return true;
}

/** Vested part of `total` at unix time `t` (seconds). Floor rounding, like the contract. */
export function vested(total: bigint, start: number, cliff: number, duration: number, kind: number, t: number): bigint {
  if (kind === KIND.NONE) return total;
  if (t < start + cliff) return 0n;
  if (kind === KIND.CLIFF_ONLY) return total;
  const elapsed = t - start;
  if (elapsed >= duration) return total;
  if (kind === KIND.LINEAR) return (total * BigInt(elapsed)) / BigInt(duration);
  const steps = BigInt(Math.floor(duration / MONTH));
  const done = BigInt(Math.floor(elapsed / MONTH));
  return (total * done) / steps;
}

export const REASON = {
  ZERO_AMOUNT: 1 << 0,
  SAME_HOLDER: 1 << 1,
  ZERO_RECIPIENT: 1 << 2,
  UNKNOWN_CLASS: 1 << 3,
  NO_POSITION: 1 << 4,
  OVER_BALANCE: 1 << 5,
  UNVESTED: 1 << 6,
  CLASS_RESTRICTED: 1 << 7,
  LOCKUP: 1 << 8,
  ROFR_PENDING: 1 << 9,
  NOT_ACCREDITED: 1 << 10,
  NOT_ALLOWLISTED: 1 << 11,
  MAX_HOLDERS: 1 << 12,
  BELOW_MINIMUM: 1 << 13,
  FROZEN: 1 << 14,
  ROFR_EXPIRED: 1 << 15,
} as const;
export type ReasonKey = keyof typeof REASON;
export const ALL_REASONS = (1 << 16) - 1;

/** Plain words for every bit, in bit order. Shown on /transfer and /method. */
export const REASON_TEXT: Record<ReasonKey, { title: string; why: string }> = {
  ZERO_AMOUNT: { title: "No amount", why: "The transfer moves zero shares." },
  SAME_HOLDER: { title: "Same holder", why: "Seller and recipient are the same address." },
  ZERO_RECIPIENT: { title: "No recipient", why: "The recipient address is empty (the zero address)." },
  UNKNOWN_CLASS: { title: "Unknown share class", why: "The company has no share class with this number." },
  NO_POSITION: { title: "Seller holds none", why: "The seller holds no shares of this class." },
  OVER_BALANCE: { title: "More than the seller holds", why: "The amount is larger than the seller's balance in this class." },
  UNVESTED: { title: "Not vested yet", why: "Part of the amount has not vested on the transfer date. Only vested shares (plus shares received by transfer) can move." },
  CLASS_RESTRICTED: { title: "Class not transferable", why: "The company marked this share class as non-transferable." },
  LOCKUP: { title: "Lockup still running", why: "A company, class or grant lockup ends after the transfer date." },
  ROFR_PENDING: { title: "Right of first refusal open", why: "The company's right of first refusal applies: no matching notice is on file, or its window has not passed yet." },
  NOT_ACCREDITED: { title: "Recipient not accredited", why: "The company only allows recipients it has marked as accredited." },
  NOT_ALLOWLISTED: { title: "Recipient not on the allowlist", why: "The company only allows recipients on its allowlist." },
  MAX_HOLDERS: { title: "Holder cap reached", why: "The recipient would be a new holder and the company is at its holder cap." },
  BELOW_MINIMUM: { title: "Below the minimum", why: "The amount is under the company's minimum transfer size." },
  FROZEN: { title: "Transfers frozen", why: "The company has frozen all transfers." },
  ROFR_EXPIRED: { title: "Notice expired", why: "The notice's window passed more than 30 days before the transfer date. File a new notice." },
};

export function decodeReasons(mask: number): ReasonKey[] {
  return (Object.keys(REASON) as ReasonKey[]).filter((k) => (mask & REASON[k]) !== 0);
}
/** Bits that no rule in this version defines: never shown as "allowed". */
export const unknownBits = (mask: number) => mask & ~ALL_REASONS;

export type Facts = {
  at: number;
  from: string;
  to: string;
  amount: bigint;
  classExists: boolean;
  classTransferable: boolean;
  classLockupUntil: number;
  companyLockupUntil: number;
  grantLockupUntil: number;
  frozen: boolean;
  fromBalance: bigint;
  fromAvailable: bigint;
  fromTotal: bigint;
  toTotal: bigint;
  holderCount: number;
  maxHolders: number;
  requireAccredited: boolean;
  toAccredited: boolean;
  requireAllowlist: boolean;
  toAllowlisted: boolean;
  minTransfer: bigint;
  rofrWindow: number;
  noticeAt: number;
  noticeTo: string;
  noticeAmount: bigint;
};

const ZERO = "0x0000000000000000000000000000000000000000";
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** Bitmask of every rule the transfer breaks; 0 = every rule passes. Mirrors PontraTransferRules.check. */
export function check(f: Facts): number {
  let r = 0;
  if (f.amount === 0n) r |= REASON.ZERO_AMOUNT;
  if (same(f.to, ZERO)) r |= REASON.ZERO_RECIPIENT;
  if (same(f.from, f.to)) r |= REASON.SAME_HOLDER;
  if (f.frozen) r |= REASON.FROZEN;
  if (!f.classExists) r |= REASON.UNKNOWN_CLASS;
  else if (!f.classTransferable) r |= REASON.CLASS_RESTRICTED;
  if (f.fromBalance === 0n) r |= REASON.NO_POSITION;
  else if (f.amount > f.fromBalance) r |= REASON.OVER_BALANCE;
  if (f.amount > f.fromAvailable && f.fromBalance !== 0n && f.amount <= f.fromBalance) r |= REASON.UNVESTED;
  const lock = Math.max(f.companyLockupUntil, f.classLockupUntil, f.grantLockupUntil);
  if (f.at < lock) r |= REASON.LOCKUP;
  if (f.minTransfer !== 0n && f.amount < f.minTransfer && f.amount !== 0n) r |= REASON.BELOW_MINIMUM;
  if (f.requireAccredited && !f.toAccredited) r |= REASON.NOT_ACCREDITED;
  if (f.requireAllowlist && !f.toAllowlisted) r |= REASON.NOT_ALLOWLISTED;
  if (f.maxHolders !== 0 && f.toTotal === 0n && !same(f.to, f.from)) {
    const sellerLeaves = f.amount !== 0n && f.amount >= f.fromTotal;
    const next = f.holderCount + 1 - (sellerLeaves ? 1 : 0);
    if (next > f.maxHolders) r |= REASON.MAX_HOLDERS;
  }
  if (f.rofrWindow !== 0) {
    const matches = f.noticeAt !== 0 && same(f.noticeTo, f.to) && f.noticeAmount >= f.amount;
    if (!matches || f.at < f.noticeAt + f.rofrWindow) r |= REASON.ROFR_PENDING;
    else if (f.at > f.noticeAt + f.rofrWindow + ROFR_VALIDITY) r |= REASON.ROFR_EXPIRED;
  }
  return r;
}
