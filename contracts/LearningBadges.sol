// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title LearningBadges (v3: learner claims)
 * @notice Soulbound ERC-1155 badges for the Si Her DeFi cohort.
 *
 * Token IDs:
 *  1..12 - Module badges (token id = the module's week)
 *  13    - Capstone / Completion badge (the certificate)
 *
 * Learners mint their own badges with claim(), paying their own gas. The app
 * decides what each learner has earned and signs an EIP-712 voucher with a
 * CLAIM_SIGNER_ROLE key (a signing-only key that holds no funds and can't mint
 * by itself). The contract checks that voucher, so only earned badges can be
 * claimed, only by the learner's own wallet, once per voucher (nonce), and
 * only before the voucher's deadline.
 *
 * MINTER_ROLE (optional) can still award badges directly, e.g. for support.
 * DEFAULT_ADMIN_ROLE (multisig recommended) manages roles, pauses, sets the URI
 * and can revoke a badge awarded by mistake.
 *
 * Changes from v2: EIP712 + claim(), CLAIM_SIGNER_ROLE, nonces(). The award
 * functions, metadata, soulbound and admin logic are unchanged.
 */
contract LearningBadges is ERC1155, AccessControl, Pausable, EIP712 {
    using Strings for uint256;

    // ============================ ROLES ============================

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    /// @notice Signs claim vouchers off-chain (the app's server). Never needs funds.
    bytes32 public constant CLAIM_SIGNER_ROLE = keccak256("CLAIM_SIGNER_ROLE");

    // ========================= COLLECTION INFO =====================

    string public constant name = "Si Her DeFi Badges";
    string public constant symbol = "SHDB";

    // ========================== TOKEN IDS ==========================

    uint256 public constant MODULE_1 = 1;
    uint256 public constant MODULE_12 = 12;
    uint256 public constant CAPSTONE_BADGE = 13;
    uint256 public constant TOTAL_MODULES = 12;

    // ============================ CLAIMS ===========================

    /// @dev EIP-712 type of a voucher. moduleIds is hashed as keccak256(abi.encodePacked(moduleIds)).
    bytes32 public constant CLAIM_TYPEHASH =
        keccak256("Claim(address learner,uint256[] moduleIds,bool capstone,uint256 nonce,uint256 deadline)");

    /// @notice Next voucher nonce per learner; every successful claim uses one up.
    mapping(address => uint256) public nonces;

    // ============================ ERRORS ===========================

    error InvalidModule();
    error BadgeAlreadyClaimed();
    error SoulboundToken();
    error InvalidRecipient();
    error CapstoneAlreadyClaimed();
    error NothingToRevoke();
    error VoucherExpired();
    error InvalidVoucher();
    error NothingToClaim();

    // ============================ EVENTS ===========================

    event ModuleBadgeAwarded(address indexed learner, uint256 indexed moduleId);
    event CapstoneBadgeAwarded(address indexed learner);
    event BadgeRevoked(address indexed learner, uint256 indexed id);
    event Claimed(address indexed learner, uint256 nonce, uint256 modulesMinted, bool capstoneMinted);

    // ========================== CONSTRUCTOR ========================

    /**
     * @param baseURI Metadata base ending in "/", e.g. "https://host/metadata/" or "ipfs://<CID>/".
     * @param admin   DEFAULT_ADMIN_ROLE holder (separate wallet / multisig)
     * @param signer  CLAIM_SIGNER_ROLE holder (the app server's signing key; no funds needed)
     */
    constructor(string memory baseURI, address admin, address signer)
        ERC1155(baseURI)
        EIP712("LearningBadges", "1")
    {
        if (admin == address(0) || signer == address(0)) revert InvalidRecipient();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(CLAIM_SIGNER_ROLE, signer);
    }

    // =========================== CLAIMING ==========================

    /**
     * @notice Mints the caller's earned badges from a voucher signed by the app.
     * @dev Badges the caller already holds are skipped, so a voucher listing
     *      every earned badge is always safe to use. Reverts if nothing new
     *      would be minted, so a learner never pays gas for nothing.
     * @param moduleIds Module badges earned (1..12)
     * @param capstone  Whether the certificate (13) is included
     * @param deadline  Unix time after which the voucher is no longer valid
     * @param signature EIP-712 signature by a CLAIM_SIGNER_ROLE account
     */
    function claim(uint256[] calldata moduleIds, bool capstone, uint256 deadline, bytes calldata signature)
        external
        whenNotPaused
    {
        if (block.timestamp > deadline) revert VoucherExpired();

        address learner = msg.sender;
        uint256 nonce = nonces[learner];
        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    CLAIM_TYPEHASH,
                    learner,
                    keccak256(abi.encodePacked(moduleIds)),
                    capstone,
                    nonce,
                    deadline
                )
            )
        );
        if (!hasRole(CLAIM_SIGNER_ROLE, ECDSA.recover(digest, signature))) revert InvalidVoucher();
        nonces[learner] = nonce + 1;

        uint256 minted;
        for (uint256 i = 0; i < moduleIds.length; i++) {
            uint256 moduleId = moduleIds[i];
            if (moduleId < MODULE_1 || moduleId > MODULE_12) revert InvalidModule();
            if (balanceOf(learner, moduleId) > 0) continue;
            _mint(learner, moduleId, 1, "");
            emit ModuleBadgeAwarded(learner, moduleId);
            minted++;
        }

        bool capstoneMinted;
        if (capstone && !hasCapstoneBadge(learner)) {
            _mint(learner, CAPSTONE_BADGE, 1, "");
            emit CapstoneBadgeAwarded(learner);
            capstoneMinted = true;
        }

        if (minted == 0 && !capstoneMinted) revert NothingToClaim();
        emit Claimed(learner, nonce, minted, capstoneMinted);
    }

    // ===================== DIRECT AWARDS (support) =================

    function awardModuleBadge(address learner, uint256 moduleId) external onlyRole(MINTER_ROLE) whenNotPaused {
        if (learner == address(0)) revert InvalidRecipient();
        if (moduleId < MODULE_1 || moduleId > MODULE_12) revert InvalidModule();
        if (balanceOf(learner, moduleId) > 0) revert BadgeAlreadyClaimed();
        _mint(learner, moduleId, 1, "");
        emit ModuleBadgeAwarded(learner, moduleId);
    }

    function batchAwardModuleBadges(address learner, uint256[] calldata moduleIds)
        external
        onlyRole(MINTER_ROLE)
        whenNotPaused
    {
        if (learner == address(0)) revert InvalidRecipient();
        for (uint256 i = 0; i < moduleIds.length; i++) {
            uint256 moduleId = moduleIds[i];
            if (moduleId < MODULE_1 || moduleId > MODULE_12) revert InvalidModule();
            if (balanceOf(learner, moduleId) > 0) continue;
            _mint(learner, moduleId, 1, "");
            emit ModuleBadgeAwarded(learner, moduleId);
        }
    }

    function awardCapstone(address learner) external onlyRole(MINTER_ROLE) whenNotPaused {
        if (learner == address(0)) revert InvalidRecipient();
        if (hasCapstoneBadge(learner)) revert CapstoneAlreadyClaimed();
        _mint(learner, CAPSTONE_BADGE, 1, "");
        emit CapstoneBadgeAwarded(learner);
    }

    function revokeBadge(address learner, uint256 id) external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 bal = balanceOf(learner, id);
        if (bal == 0) revert NothingToRevoke();
        _burn(learner, id, bal);
        emit BadgeRevoked(learner, id);
    }

    // ============================= VIEWS ===========================

    function hasCompletedAllModules(address learner) public view returns (bool) {
        for (uint256 m = MODULE_1; m <= MODULE_12; m++) {
            if (balanceOf(learner, m) == 0) return false;
        }
        return true;
    }

    function hasCapstoneBadge(address learner) public view returns (bool) {
        return balanceOf(learner, CAPSTONE_BADGE) > 0;
    }

    /// @notice The EIP-712 domain separator, for off-chain signers to check against.
    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    // ============================ METADATA =========================

    /// @dev baseURI + id + ".json"; reverts outside 1..13.
    function uri(uint256 id) public view override returns (string memory) {
        if (id < MODULE_1 || id > CAPSTONE_BADGE) revert InvalidModule();
        return string.concat(super.uri(id), id.toString(), ".json");
    }

    function setURI(string calldata newURI) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setURI(newURI);
    }

    // ============================ PAUSING ==========================

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    // ========================= SOULBOUND LOGIC =====================

    function _update(address from, address to, uint256[] memory ids, uint256[] memory values)
        internal
        override
        whenNotPaused
    {
        // Only mint (from == 0) and burn (to == 0) are allowed.
        if (from != address(0) && to != address(0)) revert SoulboundToken();
        super._update(from, to, ids, values);
    }

    // ========================== ERC-165 ============================

    function supportsInterface(bytes4 interfaceId) public view override(ERC1155, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
