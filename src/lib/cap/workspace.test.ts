import { test } from "node:test";
import assert from "node:assert/strict";
import { REASON } from "./rules";
import { SAMPLE_ADDR as S, sampleWorkspace } from "./sample";
import { checkTransfer, fromJson, grant, holderCount, recordTransfer, cancelUnvested, summary, toJson, WorkspaceError } from "./workspace";

const NOW = Math.floor(Date.parse("2026-11-23T12:00:00Z") / 1000);

test("sample: the noticed angel sale passes every rule", () => {
  assert.equal(checkTransfer(sampleWorkspace(), S.angel, S.buyer, 0, 50_000n, NOW).mask, 0);
});

test("sample: an employee sale to an unverified buyer lists every failing rule", () => {
  const { mask } = checkTransfer(sampleWorkspace(), S.engineer, S.outsider, 0, 100_000n, NOW);
  assert.equal(mask, REASON.ROFR_PENDING | REASON.NOT_ACCREDITED | REASON.NOT_ALLOWLISTED);
});

test("sample: founder shares are in a non-transferable class, seed preferred is locked up", () => {
  assert.ok(checkTransfer(sampleWorkspace(), S.founderA, S.buyer, 2, 1_000n, NOW).mask & REASON.CLASS_RESTRICTED);
  assert.ok(checkTransfer(sampleWorkspace(), S.seedFund, S.buyer, 1, 1_000n, NOW).mask & REASON.LOCKUP);
});

test("recording a transfer moves shares, keeps totals, clears the notice and logs it", () => {
  const w0 = sampleWorkspace();
  const before = summary(w0, NOW).outstanding;
  const w1 = recordTransfer(w0, S.angel, S.buyer, 0, 50_000n, "SPA 2026-11 (sample)", NOW);
  assert.equal(summary(w1, NOW).outstanding, before);
  assert.equal(holderCount(w1), holderCount(w0) + 1);
  assert.equal(w1.notices.length, 0);
  assert.equal(w1.log.at(-1)?.kind, "transfer");
  // the same transfer again now fails: the notice was used
  assert.ok(checkTransfer(w1, S.angel, S.buyer, 0, 50_000n, NOW).mask & REASON.ROFR_PENDING);
  assert.throws(() => recordTransfer(w1, S.angel, S.buyer, 0, 50_000n, "x", NOW), WorkspaceError);
});

test("cancelling unvested shares keeps what vested and lowers the total", () => {
  const w = cancelUnvested(sampleWorkspace(), S.designer, 0, "Leaver notice (sample)", NOW);
  const p = w.positions.find((x) => x.holder === S.designer)!;
  assert.ok(p.granted < 120_000n);
  assert.equal(p.kind, 0);
});

test("grants refuse bad schedules and doubles, every change needs a document", () => {
  const w = sampleWorkspace();
  assert.throws(() => grant(w, { holder: S.buyer, classId: 0, granted: 10n, vestStart: 0, cliff: 10, duration: 5, kind: 1, lockupUntil: 0 }, "doc", NOW), /schedule/);
  assert.throws(() => grant(w, { holder: S.angel, classId: 0, granted: 10n, vestStart: 0, cliff: 0, duration: 0, kind: 0, lockupUntil: 0 }, "doc", NOW), /already/);
  assert.throws(() => grant(w, { holder: S.buyer, classId: 0, granted: 10n, vestStart: 0, cliff: 0, duration: 0, kind: 0, lockupUntil: 0 }, " ", NOW), /document/);
});

test("export and import keep bigints exactly", () => {
  const w = sampleWorkspace();
  assert.deepEqual(fromJson(toJson(w)), w);
  assert.throws(() => fromJson('{"version":2}'), WorkspaceError);
});
