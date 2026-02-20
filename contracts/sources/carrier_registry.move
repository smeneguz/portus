module portus::carrier_registry;

use std::string::String;
use iota::event;
use iota::clock::Clock;

// === Structs ===

/// Profile of a registered shipping carrier.
public struct CarrierProfile has key, store {
    id: UID,
    name: String,
    scac_code: String,
    country: String,
    registered_at: u64,
    bls_issued: u64,
}

/// Shared global registry of all carriers.
public struct GlobalCarrierRegistry has key {
    id: UID,
    total_carriers: u64,
}

// === Events ===

public struct CarrierRegistered has copy, drop {
    profile_id: address,
    name: String,
    scac_code: String,
    country: String,
    timestamp: u64,
}

// === Init ===

fun init(ctx: &mut TxContext) {
    transfer::share_object(GlobalCarrierRegistry {
        id: object::new(ctx),
        total_carriers: 0,
    });
}

// === Public functions ===

/// Register a new carrier in the global registry.
#[allow(lint(self_transfer))]
public fun register(
    registry: &mut GlobalCarrierRegistry,
    name: String,
    scac_code: String,
    country: String,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let ts = clock.timestamp_ms();
    let uid = object::new(ctx);
    let profile_id = object::uid_to_address(&uid);

    event::emit(CarrierRegistered {
        profile_id,
        name,
        scac_code,
        country,
        timestamp: ts,
    });

    transfer::public_transfer(CarrierProfile {
        id: uid,
        name,
        scac_code,
        country,
        registered_at: ts,
        bls_issued: 0,
    }, ctx.sender());

    registry.total_carriers = registry.total_carriers + 1;
}

/// Increment the BoL counter on a carrier profile.
public fun increment_bls(profile: &mut CarrierProfile) {
    profile.bls_issued = profile.bls_issued + 1;
}

// === View / getter functions ===

public fun name(profile: &CarrierProfile): String { profile.name }
public fun scac_code(profile: &CarrierProfile): String { profile.scac_code }
public fun country(profile: &CarrierProfile): String { profile.country }
public fun registered_at(profile: &CarrierProfile): u64 { profile.registered_at }
public fun bls_issued(profile: &CarrierProfile): u64 { profile.bls_issued }
public fun total_carriers(registry: &GlobalCarrierRegistry): u64 { registry.total_carriers }

// === Test helpers ===

#[test_only]
public fun test_init(ctx: &mut TxContext) {
    init(ctx);
}
