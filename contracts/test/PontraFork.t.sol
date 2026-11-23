// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {PontraCapLedger} from "../src/PontraCapLedger.sol";
import {PontraTransferRules as R} from "../src/PontraTransferRules.sol";

/// Runs against a Robinhood Chain fork (forge test --match-contract Fork --fork-url <rpc> --evm-version cancun).
/// Deploys a fresh ledger on the real chain state and walks a sample company through grant, notice, wait and transfer,
/// using the chain's own clock (block.timestamp), which is what the site uses as "now".
contract PontraFork is Test {
    address constant MULTICALL3 = 0xcA11bde05977b3631167028862bE2a173976CA11;

    function setUp() public {
        if (block.chainid != 4663) vm.skip(true);
    }

    function test_fork_chainShape() public view {
        assertEq(block.chainid, 4663);
        assertGt(MULTICALL3.code.length, 0);
        assertGt(block.timestamp, 1_760_000_000);
    }

    function test_fork_fullFlowOnRealChain() public {
        address owner = makeAddr("fork-owner");
        address seller = makeAddr("fork-seller");
        address buyer = makeAddr("fork-buyer");
        bytes32 doc = keccak256("fork doc");
        vm.startPrank(owner);
        PontraCapLedger ledger = new PontraCapLedger();
        uint256 id = ledger.createCompany(keccak256("Fork Co."), doc);
        ledger.addClass(id, "COMMON", true, 0, doc);
        ledger.setRules(id, PontraCapLedger.Rules(0, 14 days, 10, true, false, 1), doc);
        ledger.setHolder(id, buyer, true, false, doc);
        ledger.grant(id, PontraCapLedger.Grant(seller, 0, 1_000_000, uint64(block.timestamp - 400 days), 365 days, 4 * 365 days, R.LINEAR, 0), doc);
        assertEq(ledger.checkTransfer(id, seller, buyer, 0, 100_000, block.timestamp), R.ROFR_PENDING);
        ledger.fileNotice(id, seller, buyer, 0, 100_000, doc);
        vm.warp(block.timestamp + 14 days);
        assertEq(ledger.checkTransfer(id, seller, buyer, 0, 400_000, block.timestamp), R.UNVESTED | R.ROFR_PENDING);
        assertEq(ledger.checkTransfer(id, seller, buyer, 0, 100_000, block.timestamp), 0);
        ledger.recordTransfer(id, seller, buyer, 0, 100_000, doc);
        vm.stopPrank();
        assertEq(ledger.holderOf(id, buyer).total, 100_000);
        assertEq(ledger.changeCount(id), 7);
    }
}
