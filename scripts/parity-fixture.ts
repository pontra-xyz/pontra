/*
 * Writes contracts/test/fixtures/parity.json: seeded random vesting and transfer-check cases with the answers of the
 * site's TypeScript rules (src/lib/cap/rules.ts). The forge test PontraParity decodes the same cases and asserts that the
 * Solidity library gives identical answers. Run: npx tsx scripts/parity-fixture.ts
 */
import { writeFileSync } from "node:fs";
import { encodeAbiParameters } from "viem";
import { check, MONTH, validSchedule, vested, type Facts } from "../src/lib/cap/rules";

let seed = 0x9e3779b9;
const rnd = () => {
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  return (seed >>> 0) / 0x100000000;
};
const pick = <T>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
const int = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));
const big = () => pick([0n, 1n, 7n, 999n, 1000n, 123_456n, 4_000_000n, BigInt(int(0, 5_000_000)), 2n ** 127n]);
const addr = () => pick(["0x00000000000000000000000000000000000000a1", "0x00000000000000000000000000000000000000b2", "0x0000000000000000000000000000000000000000"]);

const vest: { total: bigint; start: bigint; cliff: number; duration: number; kind: number; t: bigint; expected: bigint }[] = [];
while (vest.length < 400) {
  const kind = int(0, 3);
  const duration = kind === 0 ? 0 : kind === 3 ? 0 : pick([MONTH, 12 * MONTH, 48 * MONTH, int(1, 60 * MONTH), Math.floor(2.5 * MONTH)]);
  const cliff = kind === 0 ? 0 : kind === 3 ? int(1, 24 * MONTH) : int(0, duration);
  if (!validSchedule(cliff, duration, kind)) continue;
  const start = int(1_600_000_000, 1_900_000_000);
  const t = start + int(-MONTH, duration + cliff + 2 * MONTH);
  const total = big();
  vest.push({ total, start: BigInt(start), cliff, duration, kind, t: BigInt(t), expected: vested(total, start, cliff, duration, kind, t) });
}

const checks: { f: Facts; expected: number }[] = [];
for (let i = 0; i < 600; i++) {
  const at = int(1_700_000_000, 1_800_000_000);
  const fromBalance = big();
  const f: Facts = {
    at,
    from: addr(),
    to: addr(),
    amount: rnd() < 0.5 ? BigInt(int(0, 2000)) : big(),
    classExists: rnd() < 0.9,
    classTransferable: rnd() < 0.8,
    classLockupUntil: pick([0, at - 10, at, at + 10]),
    companyLockupUntil: pick([0, at - 10, at + 1]),
    grantLockupUntil: pick([0, at - 1, at + 1000]),
    frozen: rnd() < 0.1,
    fromBalance,
    fromAvailable: rnd() < 0.5 ? fromBalance : fromBalance / 2n,
    fromTotal: fromBalance + pick([0n, 0n, 5n]),
    toTotal: pick([0n, 0n, 10n]),
    holderCount: int(0, 20),
    maxHolders: pick([0, 0, 5, 10, 20]),
    requireAccredited: rnd() < 0.3,
    toAccredited: rnd() < 0.5,
    requireAllowlist: rnd() < 0.3,
    toAllowlisted: rnd() < 0.5,
    minTransfer: pick([0n, 0n, 100n, 1000n]),
    rofrWindow: pick([0, 0, 86_400, 30 * 86_400]),
    noticeAt: pick([0, at - 31 * 86_400, at - 2 * 86_400, at - 70 * 86_400]),
    noticeTo: addr(),
    noticeAmount: pick([0n, 100n, 2n ** 100n]),
  };
  checks.push({ f, expected: check(f) });
}

// near-miss cases: a clean transfer with zero, one or two things changed, so passes and single bits are well covered
const A1 = "0x00000000000000000000000000000000000000a1";
const B2 = "0x00000000000000000000000000000000000000b2";
const tweaks: ((f: Facts) => void)[] = [
  (f) => (f.amount = f.fromBalance + 1n),
  (f) => (f.fromAvailable = f.amount - 1n),
  (f) => (f.classLockupUntil = f.at + 1),
  (f) => (f.at = f.noticeAt + f.rofrWindow - 1),
  (f) => (f.at = f.noticeAt + f.rofrWindow + 30 * 86_400 + 1),
  (f) => (f.toAccredited = false),
  (f) => (f.toAllowlisted = false),
  (f) => (f.holderCount = f.maxHolders),
  (f) => (f.amount = f.fromTotal),
  (f) => (f.minTransfer = f.amount + 1n),
  (f) => (f.noticeAmount = f.amount - 1n),
  (f) => (f.noticeTo = A1),
  (f) => (f.frozen = true),
];
for (let i = 0; i < 400; i++) {
  const at = int(1_700_000_000, 1_800_000_000);
  const amount = BigInt(int(1000, 50_000));
  const f: Facts = {
    at, from: A1, to: B2, amount, classExists: true, classTransferable: true, classLockupUntil: 0, companyLockupUntil: at - 1, grantLockupUntil: 0,
    frozen: false, fromBalance: amount * 3n, fromAvailable: amount * 2n, fromTotal: amount * 3n, toTotal: 0n, holderCount: 4, maxHolders: 5,
    requireAccredited: true, toAccredited: true, requireAllowlist: true, toAllowlisted: true, minTransfer: 1000n, rofrWindow: 30 * 86_400,
    noticeAt: at - 31 * 86_400, noticeTo: B2, noticeAmount: amount,
  };
  const n = int(0, 2);
  for (let k = 0; k < n; k++) pick(tweaks)(f);
  checks.push({ f, expected: check(f) });
}

const VEST = [{ type: "tuple[]", components: ["total:uint256", "start:uint64", "cliff:uint32", "duration:uint32", "kind:uint8", "t:uint256", "expected:uint256"].map((s) => ({ name: s.split(":")[0], type: s.split(":")[1] })) }] as const;
const FACT_FIELDS = [
  "at:uint256", "from:address", "to:address", "amount:uint256", "classExists:bool", "classTransferable:bool", "classLockupUntil:uint64",
  "companyLockupUntil:uint64", "grantLockupUntil:uint64", "frozen:bool", "fromBalance:uint256", "fromAvailable:uint256", "fromTotal:uint256",
  "toTotal:uint256", "holderCount:uint32", "maxHolders:uint32", "requireAccredited:bool", "toAccredited:bool", "requireAllowlist:bool",
  "toAllowlisted:bool", "minTransfer:uint256", "rofrWindow:uint64", "noticeAt:uint64", "noticeTo:address", "noticeAmount:uint256",
].map((s) => ({ name: s.split(":")[0], type: s.split(":")[1] }));
const CHECK = [{ type: "tuple[]", components: [{ name: "f", type: "tuple", components: FACT_FIELDS }, { name: "expected", type: "uint32" }] }] as const;

const out = {
  note: "Generated by scripts/parity-fixture.ts from src/lib/cap/rules.ts. Do not edit by hand.",
  vestingCount: vest.length,
  checkCount: checks.length,
  vesting: encodeAbiParameters(VEST as never, [vest] as never),
  checks: encodeAbiParameters(CHECK as never, [checks.map((c) => ({ f: c.f, expected: c.expected }))] as never),
};
writeFileSync(new URL("../contracts/test/fixtures/parity.json", import.meta.url), JSON.stringify(out) + "\n");
const nz = checks.filter((c) => c.expected !== 0).length;
console.log(`parity.json: ${vest.length} vesting cases, ${checks.length} checks (${checks.length - nz} pass, ${nz} fail)`);
