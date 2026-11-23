import { test } from "node:test";
import assert from "node:assert/strict";
import { check, decodeReasons, KIND, MONTH, REASON, validSchedule, vested, type Facts } from "./rules";

const A = "0x00000000000000000000000000000000000000a1";
const B = "0x00000000000000000000000000000000000000b2";

test("linear vesting: nothing before the cliff, catches up at the cliff, floor rounding, capped at total", () => {
  assert.equal(vested(1000n, 0, 100, 400, KIND.LINEAR, 99), 0n);
  assert.equal(vested(1000n, 0, 100, 400, KIND.LINEAR, 100), 250n);
  assert.equal(vested(1000n, 0, 100, 400, KIND.LINEAR, 201), 502n);
  assert.equal(vested(1000n, 0, 100, 400, KIND.LINEAR, 400), 1000n);
  assert.equal(vested(1000n, 0, 100, 400, KIND.LINEAR, 10_000), 1000n);
  assert.equal(vested(7n, 0, 0, 3, KIND.LINEAR, 1), 2n);
});

test("monthly vesting moves in whole steps of 1/12 average year", () => {
  const y = 12 * MONTH;
  assert.equal(vested(1200n, 0, y, 4 * y, KIND.MONTHLY, y - 1), 0n);
  assert.equal(vested(1200n, 0, y, 4 * y, KIND.MONTHLY, y), 300n);
  assert.equal(vested(1200n, 0, y, 4 * y, KIND.MONTHLY, 13 * MONTH - 1), 300n);
  assert.equal(vested(1200n, 0, y, 4 * y, KIND.MONTHLY, 13 * MONTH), 325n);
  assert.equal(vested(1200n, 0, y, 4 * y, KIND.MONTHLY, 4 * y), 1200n);
  // a partial last step lands at the end of the duration
  const dur = Math.floor(2.5 * MONTH);
  assert.equal(vested(1200n, 0, 0, dur, KIND.MONTHLY, MONTH), 600n);
  assert.equal(vested(1200n, 0, 0, dur, KIND.MONTHLY, 2 * MONTH), 1200n);
});

test("cliff-only and fully vested grants", () => {
  assert.equal(vested(500n, 1000, 100, 0, KIND.CLIFF_ONLY, 1099), 0n);
  assert.equal(vested(500n, 1000, 100, 0, KIND.CLIFF_ONLY, 1100), 500n);
  assert.equal(vested(500n, 1000, 0, 0, KIND.NONE, 0), 500n);
});

test("schedule validation matches the contract", () => {
  assert.equal(validSchedule(0, 0, KIND.NONE), true);
  assert.equal(validSchedule(1, 0, KIND.NONE), false);
  assert.equal(validSchedule(10, 0, KIND.CLIFF_ONLY), true);
  assert.equal(validSchedule(0, 0, KIND.CLIFF_ONLY), false);
  assert.equal(validSchedule(10, 5, KIND.LINEAR), false);
  assert.equal(validSchedule(0, 0, KIND.LINEAR), false);
  assert.equal(validSchedule(0, MONTH - 1, KIND.MONTHLY), false);
  assert.equal(validSchedule(0, MONTH, KIND.MONTHLY), true);
  assert.equal(validSchedule(0, 10, 4), false);
});

const base = (): Facts => ({
  at: 1_000_000, from: A, to: B, amount: 100n, classExists: true, classTransferable: true, classLockupUntil: 0, companyLockupUntil: 0,
  grantLockupUntil: 0, frozen: false, fromBalance: 1000n, fromAvailable: 1000n, fromTotal: 1000n, toTotal: 0n, holderCount: 3, maxHolders: 0,
  requireAccredited: false, toAccredited: false, requireAllowlist: false, toAllowlisted: false, minTransfer: 0n, rofrWindow: 0, noticeAt: 0,
  noticeTo: "0x0000000000000000000000000000000000000000", noticeAmount: 0n,
});

test("a clean transfer passes", () => assert.equal(check(base()), 0));

test("each rule sets its own bit", () => {
  const cases: [Partial<Facts>, number][] = [
    [{ amount: 0n }, REASON.ZERO_AMOUNT],
    [{ to: A }, REASON.SAME_HOLDER],
    [{ classExists: false }, REASON.UNKNOWN_CLASS],
    [{ classTransferable: false }, REASON.CLASS_RESTRICTED],
    [{ fromBalance: 0n, fromAvailable: 0n }, REASON.NO_POSITION],
    [{ amount: 1001n }, REASON.OVER_BALANCE],
    [{ fromAvailable: 50n }, REASON.UNVESTED],
    [{ classLockupUntil: 1_000_001 }, REASON.LOCKUP],
    [{ grantLockupUntil: 1_000_001 }, REASON.LOCKUP],
    [{ companyLockupUntil: 1_000_001 }, REASON.LOCKUP],
    [{ requireAccredited: true }, REASON.NOT_ACCREDITED],
    [{ requireAllowlist: true }, REASON.NOT_ALLOWLISTED],
    [{ maxHolders: 3 }, REASON.MAX_HOLDERS],
    [{ minTransfer: 101n }, REASON.BELOW_MINIMUM],
    [{ frozen: true }, REASON.FROZEN],
    [{ rofrWindow: 100 }, REASON.ROFR_PENDING],
  ];
  for (const [patch, bit] of cases) assert.equal(check({ ...base(), ...patch }), bit, JSON.stringify(patch, (_k, v) => (typeof v === "bigint" ? `${v}` : v)));
});

test("holder cap: a seller who leaves frees the seat; an existing holder never counts as new", () => {
  assert.equal(check({ ...base(), maxHolders: 3, amount: 1000n }), 0);
  assert.equal(check({ ...base(), maxHolders: 3, toTotal: 5n }), 0);
  assert.equal(check({ ...base(), maxHolders: 3, amount: 1000n, fromTotal: 2000n }), REASON.MAX_HOLDERS);
});

test("right of first refusal: notice must match, window must pass, notice expires 30 days later", () => {
  const n = { rofrWindow: 1000, noticeAt: 500_000, noticeTo: B, noticeAmount: 100n };
  assert.equal(check({ ...base(), ...n }), 0);
  assert.equal(check({ ...base(), ...n, at: 500_999 }), REASON.ROFR_PENDING);
  assert.equal(check({ ...base(), ...n, noticeTo: A }), REASON.ROFR_PENDING);
  assert.equal(check({ ...base(), ...n, noticeAmount: 99n }), REASON.ROFR_PENDING);
  assert.equal(check({ ...base(), ...n, at: 500_000 + 1000 + 30 * 86400 }), 0);
  assert.equal(check({ ...base(), ...n, at: 500_000 + 1000 + 30 * 86400 + 1 }), REASON.ROFR_EXPIRED);
});

test("every failing rule is reported, not just the first", () => {
  const m = check({ ...base(), frozen: true, requireAccredited: true, requireAllowlist: true, fromAvailable: 10n, classLockupUntil: 2_000_000 });
  assert.deepEqual(decodeReasons(m), ["UNVESTED", "LOCKUP", "NOT_ACCREDITED", "NOT_ALLOWLISTED", "FROZEN"]);
});
