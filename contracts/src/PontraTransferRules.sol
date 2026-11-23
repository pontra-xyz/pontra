// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title PontraTransferRules
/// @notice Pure rules shared by PontraCapLedger and the Pontra site (src/lib/cap/rules.ts mirrors this file line by line and
///         both are tested against the same fixtures in contracts/test/fixtures/parity.json).
///         Two questions only: how much of a grant has vested at time t, and which rules a proposed transfer breaks.
///         Every broken rule sets its own bit, so a refusal always lists every reason, not just the first one found.
library PontraTransferRules {
    // ------------------------------------------------------------------ vesting

    /// Vesting kinds. NONE = fully vested on grant. LINEAR = per second from start, nothing before the cliff.
    /// MONTHLY = equal steps every MONTH seconds, nothing before the cliff. CLIFF_ONLY = everything at start + cliff.
    uint8 internal constant NONE = 0;
    uint8 internal constant LINEAR = 1;
    uint8 internal constant MONTHLY = 2;
    uint8 internal constant CLIFF_ONLY = 3;

    /// One twelfth of an average Gregorian year (365.2425 days). Calendar months differ by a few days; this is the
    /// fixed step both the contract and the site use, written on the method page.
    uint256 internal constant MONTH = 2_629_746;

    /// Longest schedule accepted: 20 years.
    uint256 internal constant MAX_DURATION = 20 * 12 * MONTH;

    /// True when a schedule can be stored: known kind, cliff inside the duration, duration bounded, and a duration
    /// that makes sense for the kind (LINEAR and MONTHLY need one; MONTHLY needs at least one whole step).
    function validSchedule(uint32 cliff, uint32 duration, uint8 kind) internal pure returns (bool) {
        if (kind > CLIFF_ONLY) return false;
        if (kind == NONE) return cliff == 0 && duration == 0;
        if (kind == CLIFF_ONLY) return duration == 0 && cliff > 0 && cliff <= MAX_DURATION;
        if (duration == 0 || duration > MAX_DURATION || cliff > duration) return false;
        if (kind == MONTHLY && duration < MONTH) return false;
        return true;
    }

    /// Vested part of `total` at time `t`. Rounds down, never exceeds `total`, never decreases as t grows.
    function vested(uint256 total, uint64 start, uint32 cliff, uint32 duration, uint8 kind, uint256 t) internal pure returns (uint256) {
        if (kind == NONE) return total;
        if (t < uint256(start) + cliff) return 0;
        if (kind == CLIFF_ONLY) return total;
        uint256 elapsed = t - start;
        if (elapsed >= duration) return total;
        if (kind == LINEAR) return (total * elapsed) / duration;
        // MONTHLY: whole steps elapsed over whole steps in the schedule; the last partial step lands at `duration`.
        uint256 steps = duration / MONTH;
        uint256 done = elapsed / MONTH;
        return (total * done) / steps;
    }

    // ------------------------------------------------------------------ transfer check

    uint32 internal constant ZERO_AMOUNT = 1 << 0; // amount is 0
    uint32 internal constant SAME_HOLDER = 1 << 1; // from == to
    uint32 internal constant ZERO_RECIPIENT = 1 << 2; // to is the zero address
    uint32 internal constant UNKNOWN_CLASS = 1 << 3; // no such share class
    uint32 internal constant NO_POSITION = 1 << 4; // seller holds nothing in this class
    uint32 internal constant OVER_BALANCE = 1 << 5; // more than the seller holds in this class
    uint32 internal constant UNVESTED = 1 << 6; // more than the seller's vested, unmoved part
    uint32 internal constant CLASS_RESTRICTED = 1 << 7; // the class is marked non-transferable
    uint32 internal constant LOCKUP = 1 << 8; // a company, class or grant lockup has not ended
    uint32 internal constant ROFR_PENDING = 1 << 9; // no matching right-of-first-refusal notice whose window has passed
    uint32 internal constant NOT_ACCREDITED = 1 << 10; // company requires accredited recipients; this one is not marked
    uint32 internal constant NOT_ALLOWLISTED = 1 << 11; // company requires allowlisted recipients; this one is not listed
    uint32 internal constant MAX_HOLDERS = 1 << 12; // a new holder would exceed the holder cap
    uint32 internal constant BELOW_MINIMUM = 1 << 13; // under the company's minimum transfer size
    uint32 internal constant FROZEN = 1 << 14; // the company froze all transfers
    uint32 internal constant ROFR_EXPIRED = 1 << 15; // the notice exists but its validity ended after the window

    /// Highest bit in use; the site refuses to decode unknown bits as "allowed".
    uint32 internal constant ALL = (1 << 16) - 1;

    /// A notice stays usable for this long after its window ends.
    uint256 internal constant ROFR_VALIDITY = 30 days;

    /// Everything the check needs, gathered by the caller. Kept as one struct so the site can feed the same fields.
    struct Facts {
        uint256 at; // time the transfer would happen
        address from;
        address to;
        uint256 amount;
        bool classExists;
        bool classTransferable;
        uint64 classLockupUntil;
        uint64 companyLockupUntil;
        uint64 grantLockupUntil;
        bool frozen;
        uint256 fromBalance; // seller's balance in this class (granted + received - moved)
        uint256 fromAvailable; // seller's vested, unmoved part in this class
        uint256 fromTotal; // seller's balance across all classes
        uint256 toTotal; // recipient's balance across all classes
        uint32 holderCount; // holders with a balance > 0
        uint32 maxHolders; // 0 = no cap
        bool requireAccredited;
        bool toAccredited;
        bool requireAllowlist;
        bool toAllowlisted;
        uint256 minTransfer; // 0 = no minimum
        uint64 rofrWindow; // 0 = no right of first refusal
        uint64 noticeAt; // 0 = no notice on file
        address noticeTo;
        uint256 noticeAmount;
    }

    /// Bitmask of every rule the transfer breaks; 0 means every rule passes.
    function check(Facts memory f) internal pure returns (uint32 r) {
        if (f.amount == 0) r |= ZERO_AMOUNT;
        if (f.to == address(0)) r |= ZERO_RECIPIENT;
        if (f.from == f.to) r |= SAME_HOLDER;
        if (f.frozen) r |= FROZEN;
        if (!f.classExists) {
            r |= UNKNOWN_CLASS;
        } else if (!f.classTransferable) {
            r |= CLASS_RESTRICTED;
        }
        if (f.fromBalance == 0) {
            r |= NO_POSITION;
        } else if (f.amount > f.fromBalance) {
            r |= OVER_BALANCE;
        }
        if (f.amount > f.fromAvailable && f.fromBalance != 0 && f.amount <= f.fromBalance) r |= UNVESTED;
        uint256 lock = f.companyLockupUntil;
        if (f.classLockupUntil > lock) lock = f.classLockupUntil;
        if (f.grantLockupUntil > lock) lock = f.grantLockupUntil;
        if (f.at < lock) r |= LOCKUP;
        if (f.minTransfer != 0 && f.amount < f.minTransfer && f.amount != 0) r |= BELOW_MINIMUM;
        if (f.requireAccredited && !f.toAccredited) r |= NOT_ACCREDITED;
        if (f.requireAllowlist && !f.toAllowlisted) r |= NOT_ALLOWLISTED;
        if (f.maxHolders != 0 && f.toTotal == 0 && f.to != f.from) {
            // the seller leaves the table only when this transfer empties every class they hold
            bool sellerLeaves = f.amount != 0 && f.amount >= f.fromTotal;
            uint256 next = uint256(f.holderCount) + 1 - (sellerLeaves ? 1 : 0);
            if (next > f.maxHolders) r |= MAX_HOLDERS;
        }
        if (f.rofrWindow != 0) {
            bool matches = f.noticeAt != 0 && f.noticeTo == f.to && f.noticeAmount >= f.amount;
            if (!matches || f.at < uint256(f.noticeAt) + f.rofrWindow) {
                r |= ROFR_PENDING;
            } else if (f.at > uint256(f.noticeAt) + f.rofrWindow + ROFR_VALIDITY) {
                r |= ROFR_EXPIRED;
            }
        }
    }
}
