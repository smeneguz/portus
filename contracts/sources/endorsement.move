module portus::endorsement;

use std::string::String;
use iota::event;
use iota::clock::Clock;
use portus::ebl::{Self, ElectronicBL};

// === Error codes ===
const ENotHolder: u64 = 100;
const EBLMismatch: u64 = 101;

// === Structs ===

/// A single endorsement record in the chain.
public struct EndorsementRecord has store, copy, drop {
    from: address,
    to: address,
    endorsement_type: u8,
    note: String,
    timestamp: u64,
}

/// Shared object tracking the full endorsement chain for a specific eBL.
public struct EndorsementChain has key {
    id: UID,
    bl_id: address,
    endorsements: vector<EndorsementRecord>,
    current_holder: address,
}

// === Events ===

public struct EndorsementMade has copy, drop {
    bl_id: address,
    from: address,
    to: address,
    endorsement_type: u8,
    timestamp: u64,
}

// === Public functions ===

/// Create a new endorsement chain for an eBL.
public fun create_chain(
    bl_id: address,
    initial_holder: address,
    _clock: &Clock,
    ctx: &mut TxContext,
) {
    transfer::share_object(EndorsementChain {
        id: object::new(ctx),
        bl_id,
        endorsements: vector[],
        current_holder: initial_holder,
    });
}

/// Endorse and transfer the eBL to a new holder.
/// Caller must be the current holder.
public fun endorse_and_transfer(
    chain: &mut EndorsementChain,
    bl: &mut ElectronicBL,
    to: address,
    endorsement_type: u8,
    note: String,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let sender = ctx.sender();
    assert!(chain.current_holder == sender, ENotHolder);
    assert!(chain.bl_id == object::id_address(bl), EBLMismatch);

    let ts = clock.timestamp_ms();

    chain.endorsements.push_back(EndorsementRecord {
        from: sender,
        to,
        endorsement_type,
        note,
        timestamp: ts,
    });
    chain.current_holder = to;

    ebl::set_holder(bl, to);
    ebl::increment_endorsement_count(bl);

    event::emit(EndorsementMade {
        bl_id: chain.bl_id,
        from: sender,
        to,
        endorsement_type,
        timestamp: ts,
    });
}

// === View / getter functions ===

public fun get_current_holder(chain: &EndorsementChain): address {
    chain.current_holder
}

public fun get_bl_id(chain: &EndorsementChain): address {
    chain.bl_id
}

public fun get_endorsement_count(chain: &EndorsementChain): u64 {
    chain.endorsements.length()
}

public fun get_endorsement(chain: &EndorsementChain, index: u64): &EndorsementRecord {
    &chain.endorsements[index]
}

public fun endorsement_from(record: &EndorsementRecord): address { record.from }
public fun endorsement_to(record: &EndorsementRecord): address { record.to }
public fun endorsement_type(record: &EndorsementRecord): u8 { record.endorsement_type }
public fun endorsement_note(record: &EndorsementRecord): String { record.note }
public fun endorsement_timestamp(record: &EndorsementRecord): u64 { record.timestamp }
