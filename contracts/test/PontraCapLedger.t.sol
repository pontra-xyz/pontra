// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {PontraCapLedger} from "../src/PontraCapLedger.sol";
import {PontraTransferRules as R} from "../src/PontraTransferRules.sol";

contract PontraCapLedgerTest is Test {
    PontraCapLedger ledger;
    address owner = makeAddr("owner");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");
    address mallory = makeAddr("mallory");
    bytes32 constant DOC = keccak256("board resolution");
    uint256 constant T0 = 1_750_000_000;
    uint256 id;
    uint256 constant MONTH = 2_629_746;

    function setUp() public {
        vm.warp(T0);
        ledger = new PontraCapLedger();
        vm.startPrank(owner);
        id = ledger.createCompany(keccak256("Sample Co."), DOC);
        ledger.addClass(id, "COMMON", true, 0, DOC);
        ledger.addClass(id, "FOUNDER", false, 0, DOC);
        vm.stopPrank();
    }

    function _grant(address who, uint8 cls, uint128 amount, uint8 kind, uint32 cliff, uint32 duration) internal {
        vm.prank(owner);
        ledger.grant(id, PontraCapLedger.Grant(who, cls, amount, uint64(T0), cliff, duration, kind, 0), DOC);
    }

    function test_createCompany_setsOwnerAndLogs() public view {
        PontraCapLedger.Company memory c = ledger.companyOf(id);
        assertEq(c.owner, owner);
        assertEq(c.classCount, 2);
        assertEq(ledger.changeCount(id), 3);
        PontraCapLedger.Change[] memory ch = ledger.changes(id, 0, 10);
        assertEq(ch[0].kind, ledger.C_CREATED());
        assertEq(ch[0].docHash, DOC);
    }

    function test_onlyOwnerWrites() public {
        vm.startPrank(mallory);
        vm.expectRevert(PontraCapLedger.NotOwner.selector);
        ledger.addClass(id, "X", true, 0, DOC);
        vm.expectRevert(PontraCapLedger.NotOwner.selector);
        ledger.grant(id, PontraCapLedger.Grant(mallory, 0, 1, 0, 0, 0, 0, 0), DOC);
        vm.expectRevert(PontraCapLedger.NotOwner.selector);
        ledger.setFrozen(id, true, DOC);
        vm.expectRevert(PontraCapLedger.NotOwner.selector);
        ledger.recordTransfer(id, alice, bob, 0, 1, DOC);
        vm.expectRevert(PontraCapLedger.NotOwner.selector);
        ledger.transferOwnership(id, mallory);
        vm.expectRevert(PontraCapLedger.UnknownCompany.selector);
        ledger.setFrozen(999, true, DOC);
        vm.stopPrank();
    }

    function test_everyChangeNeedsADocument() public {
        vm.startPrank(owner);
        vm.expectRevert(PontraCapLedger.EmptyHash.selector);
        ledger.addClass(id, "X", true, 0, bytes32(0));
        vm.expectRevert(PontraCapLedger.EmptyHash.selector);
        ledger.createCompany(keccak256("y"), bytes32(0));
        vm.expectRevert(PontraCapLedger.EmptyHash.selector);
        ledger.createCompany(bytes32(0), DOC);
        vm.stopPrank();
    }

    function test_ownershipIsTwoStep() public {
        vm.prank(owner);
        ledger.transferOwnership(id, alice);
        vm.prank(mallory);
        vm.expectRevert(PontraCapLedger.NotPendingOwner.selector);
        ledger.acceptOwnership(id, DOC);
        vm.prank(alice);
        ledger.acceptOwnership(id, DOC);
        assertEq(ledger.companyOf(id).owner, alice);
        vm.prank(owner);
        vm.expectRevert(PontraCapLedger.NotOwner.selector);
        ledger.setFrozen(id, true, DOC);
    }

    function test_grantValidation() public {
        vm.startPrank(owner);
        vm.expectRevert(PontraCapLedger.UnknownClass.selector);
        ledger.grant(id, PontraCapLedger.Grant(alice, 5, 1, 0, 0, 0, 0, 0), DOC);
        vm.expectRevert(PontraCapLedger.ZeroAmount.selector);
        ledger.grant(id, PontraCapLedger.Grant(alice, 0, 0, 0, 0, 0, 0, 0), DOC);
        vm.expectRevert(PontraCapLedger.ZeroAddress.selector);
        ledger.grant(id, PontraCapLedger.Grant(address(0), 0, 1, 0, 0, 0, 0, 0), DOC);
        vm.expectRevert(PontraCapLedger.BadSchedule.selector);
        ledger.grant(id, PontraCapLedger.Grant(alice, 0, 1, 0, 10, 5, 1, 0), DOC);
        vm.expectRevert(PontraCapLedger.BadSchedule.selector);
        ledger.grant(id, PontraCapLedger.Grant(alice, 0, 1, 0, 0, 100, 2, 0), DOC);
        ledger.grant(id, PontraCapLedger.Grant(alice, 0, 1, 0, 0, 0, 0, 0), DOC);
        vm.expectRevert(PontraCapLedger.PositionExists.selector);
        ledger.grant(id, PontraCapLedger.Grant(alice, 0, 1, 0, 0, 0, 0, 0), DOC);
        vm.stopPrank();
    }

    function test_vestingView_monthlyWithCliff() public {
        _grant(alice, 0, 4800, R.MONTHLY, uint32(12 * MONTH), uint32(48 * MONTH));
        assertEq(ledger.vested(id, alice, 0, T0 + 12 * MONTH - 1), 0);
        assertEq(ledger.vested(id, alice, 0, T0 + 12 * MONTH), 1200);
        assertEq(ledger.vested(id, alice, 0, T0 + 13 * MONTH), 1300);
        assertEq(ledger.vested(id, alice, 0, T0 + 60 * MONTH), 4800);
    }

    function test_transferHappyPath_movesRecordsAndLogs() public {
        _grant(alice, 0, 1000, R.NONE, 0, 0);
        uint256 logBefore = ledger.changeCount(id);
        vm.prank(owner);
        ledger.recordTransfer(id, alice, bob, 0, 400, DOC);
        assertEq(ledger.holderOf(id, alice).total, 600);
        assertEq(ledger.holderOf(id, bob).total, 400);
        assertEq(ledger.companyOf(id).holderCount, 2);
        assertEq(ledger.positionOf(id, bob, 0).received, 400);
        assertEq(ledger.changeCount(id), logBefore + 1);
        // everything else leaves alice; she drops out of the holder count
        vm.prank(owner);
        ledger.recordTransfer(id, alice, bob, 0, 600, DOC);
        assertEq(ledger.companyOf(id).holderCount, 1);
    }

    function test_transferRevertsWithEveryReason() public {
        _grant(alice, 1, 1000, R.LINEAR, 100, 1000);
        PontraCapLedger.Rules memory rules = PontraCapLedger.Rules(uint64(T0 + 10), 7 days, 1, true, true, 500);
        vm.startPrank(owner);
        ledger.setRules(id, rules, DOC);
        uint32 expected = R.CLASS_RESTRICTED | R.UNVESTED | R.LOCKUP | R.ROFR_PENDING | R.NOT_ACCREDITED | R.NOT_ALLOWLISTED | R.MAX_HOLDERS;
        assertEq(ledger.checkTransfer(id, alice, bob, 1, 600, T0), expected);
        vm.expectRevert(abi.encodeWithSelector(PontraCapLedger.TransferBlocked.selector, expected));
        ledger.recordTransfer(id, alice, bob, 1, 600, DOC);
        vm.stopPrank();
    }

    function test_rofrFlow() public {
        _grant(alice, 0, 1000, R.NONE, 0, 0);
        vm.startPrank(owner);
        ledger.setRules(id, PontraCapLedger.Rules(0, 7 days, 0, false, false, 0), DOC);
        assertEq(ledger.checkTransfer(id, alice, bob, 0, 100, block.timestamp), R.ROFR_PENDING);
        ledger.fileNotice(id, alice, bob, 0, 100, DOC);
        assertEq(ledger.checkTransfer(id, alice, bob, 0, 100, block.timestamp), R.ROFR_PENDING);
        assertEq(ledger.checkTransfer(id, alice, carol, 0, 100, block.timestamp + 8 days), R.ROFR_PENDING);
        assertEq(ledger.checkTransfer(id, alice, bob, 0, 101, block.timestamp + 8 days), R.ROFR_PENDING);
        assertEq(ledger.checkTransfer(id, alice, bob, 0, 100, block.timestamp + 7 days + 31 days), R.ROFR_EXPIRED);
        vm.warp(block.timestamp + 7 days);
        ledger.recordTransfer(id, alice, bob, 0, 100, DOC);
        // the notice is used up
        assertEq(ledger.noticeOf(id, alice, 0).at, 0);
        assertEq(ledger.checkTransfer(id, alice, bob, 0, 100, block.timestamp), R.ROFR_PENDING);
        vm.stopPrank();
    }

    function test_unvestedCannotMove_vestedCan() public {
        _grant(alice, 0, 1000, R.LINEAR, 0, 1000);
        vm.warp(T0 + 300);
        vm.startPrank(owner);
        assertEq(ledger.checkTransfer(id, alice, bob, 0, 301, block.timestamp), R.UNVESTED);
        ledger.recordTransfer(id, alice, bob, 0, 300, DOC);
        assertEq(ledger.checkTransfer(id, alice, bob, 0, 1, block.timestamp), R.UNVESTED);
        vm.warp(T0 + 301);
        assertEq(ledger.checkTransfer(id, alice, bob, 0, 1, block.timestamp), 0);
        vm.stopPrank();
    }

    function test_cancelUnvested_keepsVestedAndNeverGoesNegative() public {
        _grant(alice, 0, 1000, R.LINEAR, 0, 1000);
        vm.warp(T0 + 400);
        vm.startPrank(owner);
        ledger.recordTransfer(id, alice, bob, 0, 400, DOC);
        ledger.cancelUnvested(id, alice, 0, DOC);
        PontraCapLedger.Position memory p = ledger.positionOf(id, alice, 0);
        assertEq(p.granted, 400);
        assertEq(p.kind, R.NONE);
        assertEq(ledger.holderOf(id, alice).total, 0);
        assertEq(ledger.companyOf(id).holderCount, 1);
        vm.expectRevert(PontraCapLedger.NothingToCancel.selector);
        ledger.cancelUnvested(id, alice, 0, DOC);
        vm.expectRevert(PontraCapLedger.NoPosition.selector);
        ledger.cancelUnvested(id, carol, 0, DOC);
        vm.stopPrank();
    }

    function test_cancelAfterReceiving_floorUsesReceived() public {
        _grant(alice, 0, 1000, R.NONE, 0, 0);
        _grant(bob, 0, 1000, R.LINEAR, 0, 1000);
        vm.startPrank(owner);
        ledger.recordTransfer(id, alice, bob, 0, 500, DOC); // bob received 500
        vm.warp(T0 + 100);
        ledger.recordTransfer(id, bob, carol, 0, 550, DOC); // 100 vested + 500 received available
        ledger.cancelUnvested(id, bob, 0, DOC);
        PontraCapLedger.Position memory p = ledger.positionOf(id, bob, 0);
        assertEq(uint256(p.granted) + p.received - p.moved, ledger.holderOf(id, bob).total);
        assertEq(p.granted, 100);
        vm.stopPrank();
    }

    function test_setHolderFlags_enableRecipient() public {
        _grant(alice, 0, 1000, R.NONE, 0, 0);
        vm.startPrank(owner);
        ledger.setRules(id, PontraCapLedger.Rules(0, 0, 0, true, true, 0), DOC);
        assertEq(ledger.checkTransfer(id, alice, bob, 0, 10, block.timestamp), R.NOT_ACCREDITED | R.NOT_ALLOWLISTED);
        ledger.setHolder(id, bob, true, true, DOC);
        assertEq(ledger.checkTransfer(id, alice, bob, 0, 10, block.timestamp), 0);
        assertEq(ledger.holderListLength(id), 2);
        vm.expectRevert(PontraCapLedger.ZeroAddress.selector);
        ledger.setHolder(id, address(0), true, true, DOC);
        vm.stopPrank();
    }

    function test_frozenBlocksAll() public {
        _grant(alice, 0, 1000, R.NONE, 0, 0);
        vm.prank(owner);
        ledger.setFrozen(id, true, DOC);
        assertEq(ledger.checkTransfer(id, alice, bob, 0, 1, block.timestamp), R.FROZEN);
    }

    function test_limits() public {
        vm.startPrank(owner);
        for (uint8 i = 2; i < 16; ++i) ledger.addClass(id, bytes32(uint256(i + 1)), true, 0, DOC);
        vm.expectRevert(PontraCapLedger.TooManyClasses.selector);
        ledger.addClass(id, "X", true, 0, DOC);
        vm.expectRevert(PontraCapLedger.BadRules.selector);
        ledger.setRules(id, PontraCapLedger.Rules(0, 91 days, 0, false, false, 0), DOC);
        vm.stopPrank();
    }

    function test_companiesAreIsolated() public {
        vm.prank(mallory);
        uint256 other = ledger.createCompany(keccak256("other"), DOC);
        _grant(alice, 0, 1000, R.NONE, 0, 0);
        vm.prank(mallory);
        vm.expectRevert(PontraCapLedger.NotOwner.selector);
        ledger.recordTransfer(id, alice, mallory, 0, 1000, DOC);
        assertEq(ledger.holderOf(other, alice).total, 0);
        vm.expectRevert(PontraCapLedger.UnknownCompany.selector);
        ledger.checkTransfer(999, alice, bob, 0, 1, 0);
    }

    function test_noPayableNoFunds() public {
        (bool ok,) = address(ledger).call{value: 1}("");
        assertFalse(ok);
        assertEq(address(ledger).balance, 0);
    }

    function testFuzz_vestedMonotoneAndBounded(uint128 total, uint32 cliff, uint32 duration, uint8 kind, uint32 dt1, uint32 dt2) public pure {
        kind = uint8(bound(kind, 0, 3));
        if (!R.validSchedule(cliff, duration, kind)) return;
        uint256 a = R.vested(total, uint64(T0), cliff, duration, kind, T0 + uint256(dt1));
        uint256 b = R.vested(total, uint64(T0), cliff, duration, kind, T0 + uint256(dt1) + dt2);
        assertLe(a, b);
        assertLe(b, total);
    }

    function testFuzz_recordedTransfersConserveShares(uint128 amount, uint128 move) public {
        amount = uint128(bound(amount, 1, type(uint128).max / 2));
        move = uint128(bound(move, 1, amount));
        _grant(alice, 0, amount, R.NONE, 0, 0);
        vm.prank(owner);
        ledger.recordTransfer(id, alice, bob, 0, move, DOC);
        assertEq(ledger.holderOf(id, alice).total + ledger.holderOf(id, bob).total, amount);
    }
}
