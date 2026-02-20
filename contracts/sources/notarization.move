module portus::notarization;

use std::string::String;
use iota::event;
use iota::clock::Clock;

// === Error codes ===
const ELengthMismatch: u64 = 200;

// === Structs ===

/// A notarised document hash anchored on-chain.
public struct NotarizedBLDoc has key, store {
    id: UID,
    doc_hash: String,
    doc_type: String,
    bl_id: address,
    notarized_by: address,
    notarized_at: u64,
}

// === Events ===

public struct BLDocNotarized has copy, drop {
    doc_id: address,
    doc_hash: String,
    doc_type: String,
    bl_id: address,
    timestamp: u64,
}

// === Public functions ===

/// Notarise a single document hash for a given eBL.
#[allow(lint(self_transfer))]
public fun notarize(
    doc_hash: String,
    doc_type: String,
    bl_id: address,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let ts = clock.timestamp_ms();
    let notarized_by = ctx.sender();
    let uid = object::new(ctx);
    let doc_id = object::uid_to_address(&uid);

    event::emit(BLDocNotarized {
        doc_id,
        doc_hash,
        doc_type,
        bl_id,
        timestamp: ts,
    });

    transfer::public_transfer(NotarizedBLDoc {
        id: uid,
        doc_hash,
        doc_type,
        bl_id,
        notarized_by,
        notarized_at: ts,
    }, notarized_by);
}

/// Verify a notarised document against an expected hash.
public fun verify(doc: &NotarizedBLDoc, expected_hash: String): bool {
    doc.doc_hash == expected_hash
}

/// Notarise multiple documents in one transaction.
#[allow(lint(self_transfer))]
public fun batch_notarize(
    doc_hashes: vector<String>,
    doc_types: vector<String>,
    bl_id: address,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let len = doc_hashes.length();
    assert!(len == doc_types.length(), ELengthMismatch);

    let mut i = 0;
    while (i < len) {
        let ts = clock.timestamp_ms();
        let notarized_by = ctx.sender();
        let uid = object::new(ctx);
        let doc_id = object::uid_to_address(&uid);

        event::emit(BLDocNotarized {
            doc_id,
            doc_hash: doc_hashes[i],
            doc_type: doc_types[i],
            bl_id,
            timestamp: ts,
        });

        transfer::public_transfer(NotarizedBLDoc {
            id: uid,
            doc_hash: doc_hashes[i],
            doc_type: doc_types[i],
            bl_id,
            notarized_by,
            notarized_at: ts,
        }, notarized_by);

        i = i + 1;
    };
}

// === View / getter functions ===

public fun doc_hash(doc: &NotarizedBLDoc): String { doc.doc_hash }
public fun doc_type(doc: &NotarizedBLDoc): String { doc.doc_type }
public fun bl_id(doc: &NotarizedBLDoc): address { doc.bl_id }
public fun notarized_by(doc: &NotarizedBLDoc): address { doc.notarized_by }
public fun notarized_at(doc: &NotarizedBLDoc): u64 { doc.notarized_at }
