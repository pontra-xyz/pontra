// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {PontraTransferRules as R} from "../src/PontraTransferRules.sol";

/// Replays fixtures/parity.json (written from the site's TypeScript rules by scripts/parity-fixture.ts) against the
/// Solidity library: the site and the contract must give the same answer for every case.
contract PontraParity is Test {
    struct VestCase {
        uint256 total;
        uint64 start;
        uint32 cliff;
        uint32 duration;
        uint8 kind;
        uint256 t;
        uint256 expected;
    }

    struct CheckCase {
        R.Facts f;
        uint32 expected;
    }

    function _json() internal view returns (string memory) {
        return vm.readFile(string.concat(vm.projectRoot(), "/test/fixtures/parity.json"));
    }

    function test_parity_vesting() public view {
        VestCase[] memory cs = abi.decode(vm.parseJsonBytes(_json(), ".vesting"), (VestCase[]));
        assertEq(cs.length, 400);
        for (uint256 i; i < cs.length; ++i) {
            VestCase memory c = cs[i];
            assertTrue(R.validSchedule(c.cliff, c.duration, c.kind), "fixture schedule valid");
            assertEq(R.vested(c.total, c.start, c.cliff, c.duration, c.kind, c.t), c.expected, vm.toString(i));
        }
    }

    function test_parity_checks() public view {
        CheckCase[] memory cs = abi.decode(vm.parseJsonBytes(_json(), ".checks"), (CheckCase[]));
        assertEq(cs.length, 1000);
        uint256 passes;
        for (uint256 i; i < cs.length; ++i) {
            uint32 got = R.check(cs[i].f);
            assertEq(got, cs[i].expected, vm.toString(i));
            if (got == 0) ++passes;
        }
        assertGt(passes, 50);
    }
}
