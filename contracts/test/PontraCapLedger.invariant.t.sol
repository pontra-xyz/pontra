// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {PontraCapLedger} from "../src/PontraCapLedger.sol";
import {PontraTransferRules as R} from "../src/PontraTransferRules.sol";

/// Drives one company with random grants, cancels, notices and transfers. Only calls that the ledger accepts change state.
contract PontraHandler is Test {
    PontraCapLedger public ledger;
    uint256 public id;
    address[4] public people;
    uint256 public granted; // total ever granted
    uint256 public cancelled; // total cancelled
    bytes32 constant DOC = keccak256("doc");

    constructor(PontraCapLedger l) {
        ledger = l;
        id = ledger.createCompany(keccak256("inv"), DOC);
        ledger.addClass(id, "A", true, 0, DOC);
        ledger.addClass(id, "B", true, 0, DOC);
        for (uint256 i; i < 4; ++i) people[i] = address(uint160(0xa00 + i));
    }

    function doGrant(uint256 who, uint256 cls, uint128 amount, uint8 kind, uint32 dur) external {
        address h = people[who % 4];
        uint8 c = uint8(cls % 2);
        amount = uint128(bound(amount, 1, 1e24));
        kind = uint8(bound(kind, 0, 2));
        dur = uint32(bound(dur, 2_629_746, 4 * 31_556_952));
        if (kind == 0) dur = 0;
        if (ledger.positionOf(id, h, c).granted != 0) return;
        ledger.grant(id, PontraCapLedger.Grant(h, c, amount, uint64(block.timestamp), 0, dur, kind, 0), DOC);
        granted += amount;
    }

    function doTransfer(uint256 a, uint256 b, uint256 cls, uint128 amount) external {
        address from = people[a % 4];
        address to = people[b % 4];
        uint8 c = uint8(cls % 2);
        amount = uint128(bound(amount, 1, 1e24));
        if (ledger.checkTransfer(id, from, to, c, amount, block.timestamp) != 0) {
            vm.expectRevert();
            ledger.recordTransfer(id, from, to, c, amount, DOC);
            return;
        }
        ledger.recordTransfer(id, from, to, c, amount, DOC);
    }

    function doCancel(uint256 who, uint256 cls) external {
        address h = people[who % 4];
        uint8 c = uint8(cls % 2);
        PontraCapLedger.Position memory p = ledger.positionOf(id, h, c);
        uint256 v = R.vested(p.granted, p.vestStart, p.cliff, p.duration, p.kind, block.timestamp);
        uint256 floor = p.moved > p.received ? p.moved - p.received : 0;
        if (v < floor) v = floor;
        if (p.granted == 0 || p.granted == v) return;
        ledger.cancelUnvested(id, h, c, DOC);
        cancelled += p.granted - v;
    }

    function warp(uint32 dt) external {
        vm.warp(block.timestamp + bound(dt, 1, 90 days));
    }
}

contract PontraCapLedgerInvariant is Test {
    PontraCapLedger ledger;
    PontraHandler h;

    function setUp() public {
        vm.warp(1_750_000_000);
        ledger = new PontraCapLedger();
        h = new PontraHandler(ledger);
        targetContract(address(h));
    }

    /// Shares are only created by grants and destroyed by cancels; transfers conserve them.
    function invariant_conservation() public view {
        uint256 id = h.id();
        uint256 sum;
        for (uint256 i; i < 4; ++i) sum += ledger.holderOf(id, h.people(i)).total;
        assertEq(sum, h.granted() - h.cancelled());
    }

    /// Each holder total equals the sum of their class balances; holderCount counts the non-zero totals.
    function invariant_holderBookkeeping() public view {
        uint256 id = h.id();
        uint256 nonzero;
        for (uint256 i; i < 4; ++i) {
            address p = h.people(i);
            uint256 s;
            for (uint8 c; c < 2; ++c) {
                PontraCapLedger.Position memory q = ledger.positionOf(id, p, c);
                assertLe(q.moved, uint256(q.granted) + q.received);
                s += uint256(q.granted) + q.received - q.moved;
            }
            assertEq(ledger.holderOf(id, p).total, s);
            if (s > 0) ++nonzero;
        }
        assertEq(ledger.companyOf(id).holderCount, nonzero);
    }

    /// Nothing ever leaves a holder beyond what has vested plus what they received.
    function invariant_movedWithinAvailable() public view {
        uint256 id = h.id();
        for (uint256 i; i < 4; ++i) {
            for (uint8 c; c < 2; ++c) {
                PontraCapLedger.Position memory q = ledger.positionOf(id, h.people(i), c);
                uint256 v = R.vested(q.granted, q.vestStart, q.cliff, q.duration, q.kind, block.timestamp);
                assertLe(q.moved, v + q.received);
            }
        }
    }
}
