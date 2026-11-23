import { KIND, MONTH } from "./rules";
import type { Address, Workspace } from "./workspace";

/*
 * The demo company. Everything here is SAMPLE DATA: an invented company, invented people and placeholder addresses
 * (0x…a001 style, nobody's wallet). Cap tables of real companies are not public and not on chain; the site says so next to
 * every number that comes from here.
 */

const d = (iso: string) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / 1000);
const a = (n: number) => `0x${"5a".repeat(17)}00${n.toString(16).padStart(4, "0")}` as Address;

export const SAMPLE_ADDR = {
  founderA: a(0xa001),
  founderB: a(0xa002),
  engineer: a(0xa003),
  designer: a(0xa004),
  seedFund: a(0xa005),
  angel: a(0xa006),
  buyer: a(0xa007),
  outsider: a(0xa008),
} as const;

const S = SAMPLE_ADDR;
const YEAR = 12 * MONTH;

export function sampleWorkspace(): Workspace {
  return {
    version: 1,
    name: "Sample Co. (demo)",
    sample: true,
    frozen: false,
    classes: [
      { label: "Common", transferable: true, lockupUntil: 0 },
      { label: "Seed Preferred", transferable: true, lockupUntil: d("2027-03-01") },
      { label: "Founder Common", transferable: false, lockupUntil: 0 },
    ],
    holders: [
      { address: S.founderA, name: "Founder A", accredited: false, allowlisted: true },
      { address: S.founderB, name: "Founder B", accredited: false, allowlisted: true },
      { address: S.engineer, name: "Engineer (employee)", accredited: false, allowlisted: true },
      { address: S.designer, name: "Designer (employee)", accredited: false, allowlisted: true },
      { address: S.seedFund, name: "Seed fund", accredited: true, allowlisted: true },
      { address: S.angel, name: "Angel investor", accredited: true, allowlisted: true },
      { address: S.buyer, name: "Prospective buyer", accredited: true, allowlisted: true },
      { address: S.outsider, name: "Unverified buyer", accredited: false, allowlisted: false },
    ],
    positions: [
      { holder: S.founderA, classId: 2, granted: 4_000_000n, received: 0n, moved: 0n, vestStart: d("2024-03-01"), cliff: YEAR, duration: 4 * YEAR, kind: KIND.MONTHLY, lockupUntil: 0 },
      { holder: S.founderB, classId: 2, granted: 3_000_000n, received: 0n, moved: 0n, vestStart: d("2024-03-01"), cliff: YEAR, duration: 4 * YEAR, kind: KIND.MONTHLY, lockupUntil: 0 },
      { holder: S.engineer, classId: 0, granted: 250_000n, received: 0n, moved: 0n, vestStart: d("2025-01-15"), cliff: YEAR, duration: 4 * YEAR, kind: KIND.LINEAR, lockupUntil: 0 },
      { holder: S.designer, classId: 0, granted: 120_000n, received: 0n, moved: 0n, vestStart: d("2025-09-01"), cliff: YEAR, duration: 4 * YEAR, kind: KIND.MONTHLY, lockupUntil: 0 },
      { holder: S.seedFund, classId: 1, granted: 1_500_000n, received: 0n, moved: 0n, vestStart: 0, cliff: 0, duration: 0, kind: KIND.NONE, lockupUntil: 0 },
      { holder: S.angel, classId: 0, granted: 200_000n, received: 0n, moved: 0n, vestStart: 0, cliff: 0, duration: 0, kind: KIND.NONE, lockupUntil: d("2025-06-01") },
    ],
    rules: { lockupUntil: d("2025-01-01"), rofrWindow: 30 * 86_400, maxHolders: 12, requireAccredited: true, requireAllowlist: true, minTransfer: 1_000n },
    notices: [{ from: S.angel, classId: 0, at: d("2026-10-01"), to: S.buyer, amount: 50_000n }],
    log: [
      { at: d("2024-03-01"), kind: "created", subject: "company", doc: "Certificate of incorporation (sample)", note: "Workspace opened" },
      { at: d("2024-03-01"), kind: "grant", subject: S.founderA, classId: 2, amount: 4_000_000n, doc: "Founder stock agreement A (sample)", note: "Granted 4,000,000 Founder Common" },
      { at: d("2024-03-01"), kind: "grant", subject: S.founderB, classId: 2, amount: 3_000_000n, doc: "Founder stock agreement B (sample)", note: "Granted 3,000,000 Founder Common" },
      { at: d("2024-11-20"), kind: "grant", subject: S.seedFund, classId: 1, amount: 1_500_000n, doc: "Seed purchase agreement (sample)", note: "Granted 1,500,000 Seed Preferred" },
      { at: d("2024-11-20"), kind: "grant", subject: S.angel, classId: 0, amount: 200_000n, doc: "Angel subscription (sample)", note: "Granted 200,000 Common" },
      { at: d("2025-01-15"), kind: "grant", subject: S.engineer, classId: 0, amount: 250_000n, doc: "Board consent 2025-01 (sample)", note: "Granted 250,000 Common" },
      { at: d("2025-09-01"), kind: "grant", subject: S.designer, classId: 0, amount: 120_000n, doc: "Board consent 2025-09 (sample)", note: "Granted 120,000 Common" },
      { at: d("2026-10-01"), kind: "notice", subject: S.angel, counterparty: S.buyer, classId: 0, amount: 50_000n, doc: "Notice of proposed transfer (sample)", note: "First-refusal notice: 50,000 to Prospective buyer" },
    ],
  };
}
