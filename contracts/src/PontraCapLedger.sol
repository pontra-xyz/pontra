// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {PontraTransferRules as R} from "./PontraTransferRules.sol";

/// @title PontraCapLedger
/// @notice A record book for private-company cap tables on Robinhood Chain. Each company is a separate entry with its own
///         owner (the wallet that created it, or the one it was handed to). The owner records share classes, holder
///         positions with vesting schedules, transfer rules and right-of-first-refusal notices; anyone can ask the ledger
///         how much of a grant has vested at a time and whether a proposed transfer passes every rule, with each failing
///         rule as its own bit.
///
///         What it is NOT: not a token, nothing in it can be sent or traded, it holds no funds and has no payable function,
///         no fee, no admin over other companies and no upgrade path. A position here is a record the company owner wrote;
///         it is not proof of ownership of any company's shares, which is governed by the company's own legal documents.
///         Every change is appended to a per-company change log with a document hash (e.g. the board resolution) and
///         cannot be edited or removed.
contract PontraCapLedger {
    // ------------------------------------------------------------------ limits

    uint8 public constant MAX_CLASSES = 16;
    uint32 public constant MAX_HOLDERS_LISTED = 1000;
    uint64 public constant MAX_ROFR_WINDOW = 90 days;

    // ------------------------------------------------------------------ change kinds (log)

    uint8 public constant C_CREATED = 1;
    uint8 public constant C_OWNER = 2;
    uint8 public constant C_CLASS_ADDED = 3;
    uint8 public constant C_CLASS_UPDATED = 4;
    uint8 public constant C_RULES = 5;
    uint8 public constant C_HOLDER = 6;
    uint8 public constant C_GRANT = 7;
    uint8 public constant C_CANCEL_UNVESTED = 8;
    uint8 public constant C_ROFR_NOTICE = 9;
    uint8 public constant C_TRANSFER = 10;
    uint8 public constant C_FREEZE = 11;

    // ------------------------------------------------------------------ storage

    struct Rules {
        uint64 lockupUntil; // company-wide lockup end (unix seconds), 0 = none
        uint64 rofrWindow; // seconds the company has to buy first after a notice, 0 = no ROFR
        uint32 maxHolders; // holder cap, 0 = none
        bool requireAccredited;
        bool requireAllowlist;
        uint128 minTransfer; // smallest transfer, 0 = none
    }

    struct Company {
        address owner;
        address pendingOwner;
        bytes32 nameHash; // keccak256 of the name the owner chose; names are not stored in clear
        uint64 createdAt;
        bool frozen;
        uint8 classCount;
        uint32 holderCount; // holders with a balance > 0
        Rules rules;
    }

    struct ShareClass {
        bytes32 label; // short label, e.g. "COMMON" (bytes32, left aligned)
        bool transferable;
        uint64 lockupUntil;
    }

    struct Holder {
        bool known;
        bool accredited;
        bool allowlisted;
        uint256 total; // balance across classes
    }

    /// One position per holder per class. balance = granted + received - moved.
    /// The vesting schedule applies to `granted` only; shares received by transfer are fully vested.
    struct Position {
        uint128 granted;
        uint128 received;
        uint128 moved;
        uint64 vestStart;
        uint32 cliff;
        uint32 duration;
        uint8 kind;
        uint64 lockupUntil;
    }

    struct Grant {
        address holder;
        uint8 classId;
        uint128 amount;
        uint64 vestStart;
        uint32 cliff;
        uint32 duration;
        uint8 kind;
        uint64 lockupUntil;
    }

    struct Notice {
        uint64 at;
        address to;
        uint128 amount;
    }

    struct Change {
        uint64 at;
        uint8 kind;
        uint8 classId;
        address subject;
        address counterparty;
        uint128 amount;
        bytes32 docHash;
    }

    uint256 public companyCount;
    mapping(uint256 => Company) private _companies;
    mapping(uint256 => mapping(uint8 => ShareClass)) private _classes;
    mapping(uint256 => mapping(address => Holder)) private _holders;
    mapping(uint256 => address[]) private _holderList;
    mapping(uint256 => mapping(address => mapping(uint8 => Position))) private _positions;
    mapping(uint256 => mapping(address => mapping(uint8 => Notice))) private _notices;
    mapping(uint256 => Change[]) private _log;

    // ------------------------------------------------------------------ events

    event CompanyCreated(uint256 indexed company, address indexed owner, bytes32 nameHash);
    event Changed(
        uint256 indexed company, uint256 indexed seq, uint8 indexed kind, address subject, address counterparty, uint8 classId, uint128 amount, bytes32 docHash
    );

    // ------------------------------------------------------------------ errors

    error UnknownCompany();
    error NotOwner();
    error NotPendingOwner();
    error ZeroAddress();
    error EmptyHash();
    error TooManyClasses();
    error UnknownClass();
    error BadSchedule();
    error PositionExists();
    error NoPosition();
    error NothingToCancel();
    error TooManyHolders();
    error ZeroAmount();
    error BadRules();
    error TransferBlocked(uint32 reasons);

    // ------------------------------------------------------------------ modifiers

    modifier onlyOwner(uint256 id) {
        Company storage c = _companies[id];
        if (c.owner == address(0)) revert UnknownCompany();
        if (c.owner != msg.sender) revert NotOwner();
        _;
    }

    modifier withDoc(bytes32 docHash) {
        if (docHash == bytes32(0)) revert EmptyHash();
        _;
    }

    // ------------------------------------------------------------------ company

    /// @notice Opens a new company entry owned by the caller. Anyone may open one; it says nothing about who really owns
    ///         a company, only who keeps this record.
    function createCompany(bytes32 nameHash, bytes32 docHash) external withDoc(docHash) returns (uint256 id) {
        if (nameHash == bytes32(0)) revert EmptyHash();
        id = ++companyCount;
        Company storage c = _companies[id];
        c.owner = msg.sender;
        c.nameHash = nameHash;
        c.createdAt = uint64(block.timestamp);
        emit CompanyCreated(id, msg.sender, nameHash);
        _append(id, C_CREATED, msg.sender, address(0), 0, 0, docHash);
    }

    /// @notice Two-step hand-over: the owner names the next owner, who must accept. address(0) cancels.
    function transferOwnership(uint256 id, address next) external onlyOwner(id) {
        _companies[id].pendingOwner = next;
    }

    function acceptOwnership(uint256 id, bytes32 docHash) external withDoc(docHash) {
        Company storage c = _companies[id];
        if (c.owner == address(0)) revert UnknownCompany();
        if (c.pendingOwner != msg.sender || msg.sender == address(0)) revert NotPendingOwner();
        address prev = c.owner;
        c.owner = msg.sender;
        c.pendingOwner = address(0);
        _append(id, C_OWNER, msg.sender, prev, 0, 0, docHash);
    }

    function setFrozen(uint256 id, bool frozen, bytes32 docHash) external onlyOwner(id) withDoc(docHash) {
        _companies[id].frozen = frozen;
        _append(id, C_FREEZE, msg.sender, address(0), 0, frozen ? 1 : 0, docHash);
    }

    function setRules(uint256 id, Rules calldata rules, bytes32 docHash) external onlyOwner(id) withDoc(docHash) {
        if (rules.rofrWindow > MAX_ROFR_WINDOW) revert BadRules();
        _companies[id].rules = rules;
        _append(id, C_RULES, msg.sender, address(0), 0, 0, docHash);
    }

    // ------------------------------------------------------------------ classes

    function addClass(uint256 id, bytes32 label, bool transferable, uint64 lockupUntil, bytes32 docHash)
        external
        onlyOwner(id)
        withDoc(docHash)
        returns (uint8 classId)
    {
        Company storage c = _companies[id];
        if (c.classCount >= MAX_CLASSES) revert TooManyClasses();
        if (label == bytes32(0)) revert EmptyHash();
        classId = c.classCount++;
        _classes[id][classId] = ShareClass(label, transferable, lockupUntil);
        _append(id, C_CLASS_ADDED, msg.sender, address(0), classId, 0, docHash);
    }

    function updateClass(uint256 id, uint8 classId, bool transferable, uint64 lockupUntil, bytes32 docHash) external onlyOwner(id) withDoc(docHash) {
        if (classId >= _companies[id].classCount) revert UnknownClass();
        ShareClass storage k = _classes[id][classId];
        k.transferable = transferable;
        k.lockupUntil = lockupUntil;
        _append(id, C_CLASS_UPDATED, msg.sender, address(0), classId, 0, docHash);
    }

    // ------------------------------------------------------------------ holders and grants

    /// @notice Marks a holder (or a prospective recipient) as accredited / allowlisted. These are the company's own
    ///         records; the ledger does not verify anyone and stores no personal data.
    function setHolder(uint256 id, address holder, bool accredited, bool allowlisted, bytes32 docHash) external onlyOwner(id) withDoc(docHash) {
        if (holder == address(0)) revert ZeroAddress();
        Holder storage h = _touch(id, holder);
        h.accredited = accredited;
        h.allowlisted = allowlisted;
        _append(id, C_HOLDER, holder, address(0), 0, (accredited ? 1 : 0) | (allowlisted ? 2 : 0), docHash);
    }

    /// @notice Records an issued grant with its vesting schedule. One grant per holder per class; to change one, cancel
    ///         the unvested part and grant again (both stay in the log).
    function grant(uint256 id, Grant calldata g, bytes32 docHash) external onlyOwner(id) withDoc(docHash) {
        if (g.holder == address(0)) revert ZeroAddress();
        if (g.classId >= _companies[id].classCount) revert UnknownClass();
        if (g.amount == 0) revert ZeroAmount();
        if (!R.validSchedule(g.cliff, g.duration, g.kind)) revert BadSchedule();
        Position storage p = _positions[id][g.holder][g.classId];
        if (p.granted != 0) revert PositionExists();
        p.granted = g.amount;
        p.vestStart = g.vestStart;
        p.cliff = g.cliff;
        p.duration = g.duration;
        p.kind = g.kind;
        p.lockupUntil = g.lockupUntil;
        _credit(id, g.holder, g.amount);
        _append(id, C_GRANT, g.holder, address(0), g.classId, g.amount, docHash);
    }

    /// @notice Cancels the part of a grant that has not vested yet (e.g. a leaver). What has vested stays, and it is
    ///         fully vested from now on.
    function cancelUnvested(uint256 id, address holder, uint8 classId, bytes32 docHash) external onlyOwner(id) withDoc(docHash) {
        Position storage p = _positions[id][holder][classId];
        if (p.granted == 0) revert NoPosition();
        uint256 v = R.vested(p.granted, p.vestStart, p.cliff, p.duration, p.kind, block.timestamp);
        // shares moved out can only have come from vested or received shares, so the kept grant never drops below
        // what left beyond the received part (the balance can never go negative)
        uint256 floor = p.moved > p.received ? p.moved - p.received : 0;
        if (v < floor) v = floor;
        uint128 cut = p.granted - uint128(v);
        if (cut == 0) revert NothingToCancel();
        p.granted = uint128(v);
        p.kind = R.NONE;
        p.cliff = 0;
        p.duration = 0;
        _debit(id, holder, cut);
        _append(id, C_CANCEL_UNVESTED, holder, address(0), classId, cut, docHash);
    }

    // ------------------------------------------------------------------ transfers

    /// @notice Files a right-of-first-refusal notice: the seller intends to sell `amount` of `classId` to `to`. The
    ///         transfer can only be recorded once the company's window has passed (and within 30 days after it).
    ///         A new notice for the same seller and class replaces the old one.
    function fileNotice(uint256 id, address from, address to, uint8 classId, uint128 amount, bytes32 docHash) external onlyOwner(id) withDoc(docHash) {
        if (from == address(0) || to == address(0)) revert ZeroAddress();
        if (classId >= _companies[id].classCount) revert UnknownClass();
        if (amount == 0) revert ZeroAmount();
        _notices[id][from][classId] = Notice(uint64(block.timestamp), to, amount);
        _append(id, C_ROFR_NOTICE, from, to, classId, amount, docHash);
    }

    /// @notice Records a transfer between two holders. Reverts with every failing rule unless all of them pass now.
    function recordTransfer(uint256 id, address from, address to, uint8 classId, uint128 amount, bytes32 docHash) external onlyOwner(id) withDoc(docHash) {
        uint32 reasons = checkTransfer(id, from, to, classId, amount, block.timestamp);
        if (reasons != 0) revert TransferBlocked(reasons);
        _positions[id][from][classId].moved += amount;
        _positions[id][to][classId].received += amount;
        _debit(id, from, amount);
        _touch(id, to);
        _credit(id, to, amount);
        delete _notices[id][from][classId];
        _append(id, C_TRANSFER, from, to, classId, amount, docHash);
    }

    // ------------------------------------------------------------------ views

    /// @notice Every rule the transfer would break at time `at`, as a bitmask (0 = all pass). See PontraTransferRules.
    function checkTransfer(uint256 id, address from, address to, uint8 classId, uint256 amount, uint256 at) public view returns (uint32) {
        Company storage c = _companies[id];
        if (c.owner == address(0)) revert UnknownCompany();
        return R.check(facts(id, from, to, classId, amount, at));
    }

    /// @notice The inputs checkTransfer feeds to the rules, so a site or a reviewer can see what the decision rested on.
    function facts(uint256 id, address from, address to, uint8 classId, uint256 amount, uint256 at) public view returns (R.Facts memory f) {
        Company storage c = _companies[id];
        f.at = at;
        f.from = from;
        f.to = to;
        f.amount = amount;
        f.classExists = classId < c.classCount;
        if (f.classExists) {
            ShareClass storage k = _classes[id][classId];
            f.classTransferable = k.transferable;
            f.classLockupUntil = k.lockupUntil;
        }
        f.companyLockupUntil = c.rules.lockupUntil;
        f.frozen = c.frozen;
        Position storage p = _positions[id][from][classId];
        f.grantLockupUntil = p.lockupUntil;
        f.fromBalance = uint256(p.granted) + p.received - p.moved;
        uint256 avail = R.vested(p.granted, p.vestStart, p.cliff, p.duration, p.kind, at) + p.received;
        f.fromAvailable = avail > p.moved ? avail - p.moved : 0;
        f.fromTotal = _holders[id][from].total;
        Holder storage t = _holders[id][to];
        f.toTotal = t.total;
        f.toAccredited = t.accredited;
        f.toAllowlisted = t.allowlisted;
        f.holderCount = c.holderCount;
        f.maxHolders = c.rules.maxHolders;
        f.requireAccredited = c.rules.requireAccredited;
        f.requireAllowlist = c.rules.requireAllowlist;
        f.minTransfer = c.rules.minTransfer;
        f.rofrWindow = c.rules.rofrWindow;
        Notice storage n = _notices[id][from][classId];
        f.noticeAt = n.at;
        f.noticeTo = n.to;
        f.noticeAmount = n.amount;
    }

    /// @notice Vested part of a holder's grant in a class at time `t` (received shares not included).
    function vested(uint256 id, address holder, uint8 classId, uint256 t) external view returns (uint256) {
        Position storage p = _positions[id][holder][classId];
        return R.vested(p.granted, p.vestStart, p.cliff, p.duration, p.kind, t);
    }

    function companyOf(uint256 id) external view returns (Company memory) {
        return _companies[id];
    }

    function classOf(uint256 id, uint8 classId) external view returns (ShareClass memory) {
        return _classes[id][classId];
    }

    function holderOf(uint256 id, address who) external view returns (Holder memory) {
        return _holders[id][who];
    }

    function positionOf(uint256 id, address who, uint8 classId) external view returns (Position memory) {
        return _positions[id][who][classId];
    }

    function noticeOf(uint256 id, address from, uint8 classId) external view returns (Notice memory) {
        return _notices[id][from][classId];
    }

    function holderListLength(uint256 id) external view returns (uint256) {
        return _holderList[id].length;
    }

    /// @notice Every address the company has recorded, in the order first seen (including holders whose balance is 0 now).
    function holderList(uint256 id, uint256 start, uint256 n) external view returns (address[] memory out) {
        address[] storage list = _holderList[id];
        if (start >= list.length) return out;
        uint256 end = start + n > list.length ? list.length : start + n;
        out = new address[](end - start);
        for (uint256 i = start; i < end; ++i) out[i - start] = list[i];
    }

    function changeCount(uint256 id) external view returns (uint256) {
        return _log[id].length;
    }

    function changes(uint256 id, uint256 start, uint256 n) external view returns (Change[] memory out) {
        Change[] storage list = _log[id];
        if (start >= list.length) return out;
        uint256 end = start + n > list.length ? list.length : start + n;
        out = new Change[](end - start);
        for (uint256 i = start; i < end; ++i) out[i - start] = list[i];
    }

    // ------------------------------------------------------------------ internals

    function _touch(uint256 id, address who) private returns (Holder storage h) {
        h = _holders[id][who];
        if (!h.known) {
            if (_holderList[id].length >= MAX_HOLDERS_LISTED) revert TooManyHolders();
            h.known = true;
            _holderList[id].push(who);
        }
    }

    function _credit(uint256 id, address who, uint256 amount) private {
        Holder storage h = _touch(id, who);
        if (h.total == 0) _companies[id].holderCount += 1;
        h.total += amount;
    }

    function _debit(uint256 id, address who, uint256 amount) private {
        Holder storage h = _holders[id][who];
        h.total -= amount;
        if (h.total == 0) _companies[id].holderCount -= 1;
    }

    function _append(uint256 id, uint8 kind, address subject, address counterparty, uint8 classId, uint128 amount, bytes32 docHash) private {
        uint256 seq = _log[id].length;
        _log[id].push(Change(uint64(block.timestamp), kind, classId, subject, counterparty, amount, docHash));
        emit Changed(id, seq, kind, subject, counterparty, classId, amount, docHash);
    }
}
