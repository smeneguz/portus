module portus::interop_control;

use std::string::String;
use iota::clock::Clock;
use iota::event;

// === Error codes ===
const ENotController: u64 = 200;
const ENotPendingController: u64 = 201;
const ENoPendingTransfer: u64 = 202;
const ETransferAlreadyPending: u64 = 203;
const ETransferExpired: u64 = 204;
const EIdentityMismatch: u64 = 205;
const EPartyCodeMismatch: u64 = 206;
const EIdentityProofMismatch: u64 = 207;

// === States ===
const STATE_ACTIVE: u8 = 0;
const STATE_PENDING_TRANSFER: u8 = 1;
const PLATFORM_UNSET: u8 = 255;

// === Structs ===

/// Shared registry acting as a decentralized control-tracking registry (CTR).
public struct InteropRegistry has key {
    id: UID,
    total_documents: u64,
    total_transfers_completed: u64,
    pending_transfers: u64,
}

/// A control token for a trade document envelope with PINT-lite transfer metadata.
public struct TradeDocumentControl has key {
    id: UID,
    linked_ebl_id: address,
    document_hash: String,
    document_type: String,
    source_platform: u8,
    current_platform: u8,
    controller: address,
    controller_did: String,
    controller_party_code: String,
    controller_identity_hash: String,
    pending_controller: address,
    pending_controller_did: String,
    pending_party_code: String,
    pending_platform: u8,
    pending_identity_hash: String,
    transfer_nonce: String,
    pending_transfer_expiry_ms: u64,
    last_transfer_proof_hash: String,
    last_rejection_reason: String,
    transfer_count: u64,
    state: u8,
    created_at: u64,
    updated_at: u64,
}

// === Events ===

public struct DocumentRegistered has copy, drop {
    document_id: address,
    linked_ebl_id: address,
    controller: address,
    controller_did: String,
    controller_party_code: String,
    source_platform: u8,
    timestamp: u64,
}

public struct TransferInitiated has copy, drop {
    document_id: address,
    from: address,
    to: address,
    to_did: String,
    to_party_code: String,
    to_platform: u8,
    transfer_nonce: String,
    expires_at_ms: u64,
    timestamp: u64,
}

public struct TransferAccepted has copy, drop {
    document_id: address,
    from: address,
    to: address,
    to_did: String,
    to_party_code: String,
    new_platform: u8,
    timestamp: u64,
}

public struct TransferCancelled has copy, drop {
    document_id: address,
    controller: address,
    reason: String,
    timestamp: u64,
}

// === Init ===

fun init(ctx: &mut TxContext) {
    transfer::share_object(InteropRegistry {
        id: object::new(ctx),
        total_documents: 0,
        total_transfers_completed: 0,
        pending_transfers: 0,
    });
}

// === Public functions ===

/// Register a document envelope hash and mint a control token.
public fun register_document(
    registry: &mut InteropRegistry,
    linked_ebl_id: address,
    document_hash: String,
    document_type: String,
    source_platform: u8,
    controller_did: String,
    controller_party_code: String,
    controller_identity_hash: String,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let now = clock.timestamp_ms();
    let controller = ctx.sender();
    let uid = object::new(ctx);
    let document_id = object::uid_to_address(&uid);

    transfer::share_object(TradeDocumentControl {
        id: uid,
        linked_ebl_id,
        document_hash,
        document_type,
        source_platform,
        current_platform: source_platform,
        controller,
        controller_did,
        controller_party_code,
        controller_identity_hash,
        pending_controller: @0x0,
        pending_controller_did: b"".to_string(),
        pending_party_code: b"".to_string(),
        pending_platform: PLATFORM_UNSET,
        pending_identity_hash: b"".to_string(),
        transfer_nonce: b"".to_string(),
        pending_transfer_expiry_ms: 0,
        last_transfer_proof_hash: b"".to_string(),
        last_rejection_reason: b"".to_string(),
        transfer_count: 0,
        state: STATE_ACTIVE,
        created_at: now,
        updated_at: now,
    });

    registry.total_documents = registry.total_documents + 1;

    event::emit(DocumentRegistered {
        document_id,
        linked_ebl_id,
        controller,
        controller_did,
        controller_party_code,
        source_platform,
        timestamp: now,
    });
}

/// Initiate control transfer to another controller/platform with PINT-lite metadata.
public fun initiate_transfer(
    registry: &mut InteropRegistry,
    document: &mut TradeDocumentControl,
    to_controller: address,
    to_controller_did: String,
    to_party_code: String,
    to_platform: u8,
    proof_hash: String,
    expected_identity_hash: String,
    transfer_nonce: String,
    expiry_ms: u64,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let sender = ctx.sender();
    assert!(document.controller == sender, ENotController);
    assert!(document.state == STATE_ACTIVE, ETransferAlreadyPending);

    let now = clock.timestamp_ms();
    document.pending_controller = to_controller;
    document.pending_controller_did = to_controller_did;
    document.pending_party_code = to_party_code;
    document.pending_platform = to_platform;
    document.pending_identity_hash = expected_identity_hash;
    document.transfer_nonce = transfer_nonce;
    document.pending_transfer_expiry_ms = expiry_ms;
    document.last_transfer_proof_hash = proof_hash;
    document.last_rejection_reason = b"".to_string();
    document.state = STATE_PENDING_TRANSFER;
    document.updated_at = now;
    registry.pending_transfers = registry.pending_transfers + 1;

    event::emit(TransferInitiated {
        document_id: object::id_address(document),
        from: sender,
        to: to_controller,
        to_did: document.pending_controller_did,
        to_party_code: document.pending_party_code,
        to_platform,
        transfer_nonce: document.transfer_nonce,
        expires_at_ms: expiry_ms,
        timestamp: now,
    });
}

/// Accept a pending transfer. Must be called by the pending controller.
public fun accept_transfer(
    registry: &mut InteropRegistry,
    document: &mut TradeDocumentControl,
    recipient_did: String,
    recipient_party_code: String,
    identity_hash: String,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(document.state == STATE_PENDING_TRANSFER, ENoPendingTransfer);

    let sender = ctx.sender();
    assert!(document.pending_controller == sender, ENotPendingController);

    let now = clock.timestamp_ms();
    assert!(document.pending_transfer_expiry_ms >= now, ETransferExpired);
    assert!(document.pending_controller_did == recipient_did, EIdentityMismatch);
    assert!(document.pending_party_code == recipient_party_code, EPartyCodeMismatch);
    assert!(document.pending_identity_hash == identity_hash, EIdentityProofMismatch);

    let previous_controller = document.controller;
    let new_platform = document.pending_platform;

    document.controller = sender;
    document.current_platform = new_platform;
    document.controller_did = recipient_did;
    document.controller_party_code = recipient_party_code;
    document.controller_identity_hash = identity_hash;
    document.pending_controller = @0x0;
    document.pending_controller_did = b"".to_string();
    document.pending_party_code = b"".to_string();
    document.pending_platform = PLATFORM_UNSET;
    document.pending_identity_hash = b"".to_string();
    document.transfer_nonce = b"".to_string();
    document.pending_transfer_expiry_ms = 0;
    document.transfer_count = document.transfer_count + 1;
    document.state = STATE_ACTIVE;
    document.updated_at = now;

    registry.total_transfers_completed = registry.total_transfers_completed + 1;
    registry.pending_transfers = registry.pending_transfers - 1;

    event::emit(TransferAccepted {
        document_id: object::id_address(document),
        from: previous_controller,
        to: sender,
        to_did: document.controller_did,
        to_party_code: document.controller_party_code,
        new_platform,
        timestamp: now,
    });
}

/// Cancel a pending transfer. Must be called by current controller.
public fun cancel_transfer(
    registry: &mut InteropRegistry,
    document: &mut TradeDocumentControl,
    rejection_reason: String,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(document.controller == ctx.sender(), ENotController);
    assert!(document.state == STATE_PENDING_TRANSFER, ENoPendingTransfer);

    document.pending_controller = @0x0;
    document.pending_controller_did = b"".to_string();
    document.pending_party_code = b"".to_string();
    document.pending_platform = PLATFORM_UNSET;
    document.pending_identity_hash = b"".to_string();
    document.transfer_nonce = b"".to_string();
    document.pending_transfer_expiry_ms = 0;
    document.state = STATE_ACTIVE;
    document.updated_at = clock.timestamp_ms();
    document.last_rejection_reason = rejection_reason;
    registry.pending_transfers = registry.pending_transfers - 1;

    event::emit(TransferCancelled {
        document_id: object::id_address(document),
        controller: ctx.sender(),
        reason: document.last_rejection_reason,
        timestamp: document.updated_at,
    });
}

// === View / getter functions ===

public fun linked_ebl_id(document: &TradeDocumentControl): address { document.linked_ebl_id }
public fun document_hash(document: &TradeDocumentControl): String { document.document_hash }
public fun document_type(document: &TradeDocumentControl): String { document.document_type }
public fun source_platform(document: &TradeDocumentControl): u8 { document.source_platform }
public fun current_platform(document: &TradeDocumentControl): u8 { document.current_platform }
public fun controller(document: &TradeDocumentControl): address { document.controller }
public fun controller_did(document: &TradeDocumentControl): String { document.controller_did }
public fun controller_party_code(document: &TradeDocumentControl): String { document.controller_party_code }
public fun controller_identity_hash(document: &TradeDocumentControl): String { document.controller_identity_hash }
public fun pending_controller(document: &TradeDocumentControl): address { document.pending_controller }
public fun pending_controller_did(document: &TradeDocumentControl): String { document.pending_controller_did }
public fun pending_party_code(document: &TradeDocumentControl): String { document.pending_party_code }
public fun pending_platform(document: &TradeDocumentControl): u8 { document.pending_platform }
public fun pending_identity_hash(document: &TradeDocumentControl): String { document.pending_identity_hash }
public fun transfer_nonce(document: &TradeDocumentControl): String { document.transfer_nonce }
public fun pending_transfer_expiry_ms(document: &TradeDocumentControl): u64 { document.pending_transfer_expiry_ms }
public fun last_transfer_proof_hash(document: &TradeDocumentControl): String { document.last_transfer_proof_hash }
public fun last_rejection_reason(document: &TradeDocumentControl): String { document.last_rejection_reason }
public fun transfer_count(document: &TradeDocumentControl): u64 { document.transfer_count }
public fun state(document: &TradeDocumentControl): u8 { document.state }
public fun created_at(document: &TradeDocumentControl): u64 { document.created_at }
public fun updated_at(document: &TradeDocumentControl): u64 { document.updated_at }

public fun total_documents(registry: &InteropRegistry): u64 { registry.total_documents }
public fun total_transfers_completed(registry: &InteropRegistry): u64 { registry.total_transfers_completed }
public fun pending_transfers(registry: &InteropRegistry): u64 { registry.pending_transfers }

// === Test helpers ===

#[test_only]
public fun test_init(ctx: &mut TxContext) {
    init(ctx);
}
