module portus::ebl;

use std::string::String;
use iota::event;
use iota::clock::Clock;

// === Error codes ===
const ENotCarrier: u64 = 0;
const ENotHolder: u64 = 1;
const EInvalidStatus: u64 = 2;
const EAlreadySurrendered: u64 = 3;
const ENotSurrendered: u64 = 4;

// === Structs ===

/// The Bill of Lading as a shared Move object.
/// Logical ownership is tracked via `current_holder`.
public struct ElectronicBL has key {
    id: UID,
    bl_number: String,
    carrier: address,
    shipper: address,
    consignee: address,
    notify_party: address,
    vessel_name: String,
    voyage_number: String,
    port_of_loading: String,
    port_of_discharge: String,
    commodity_description: String,
    container_numbers: String,
    gross_weight_kg: u64,
    number_of_packages: u64,
    freight_terms: u8,
    content_hash: String,
    status: u8,
    current_holder: address,
    endorsement_count: u64,
    issued_at: u64,
    surrendered_at: u64,
}

/// Shared registry tracking global eBL statistics.
public struct BLRegistry has key {
    id: UID,
    total_bls_issued: u64,
    total_bls_surrendered: u64,
}

/// Capability proving the holder is a registered carrier.
public struct CarrierCap has key {
    id: UID,
    carrier_name: String,
    carrier_address: address,
}

// === Events ===

public struct BLIssued has copy, drop {
    bl_id: address,
    bl_number: String,
    carrier: address,
    shipper: address,
    consignee: address,
    port_of_loading: String,
    port_of_discharge: String,
    timestamp: u64,
}

public struct BLStatusUpdated has copy, drop {
    bl_id: address,
    old_status: u8,
    new_status: u8,
    timestamp: u64,
}

public struct BLSurrendered has copy, drop {
    bl_id: address,
    bl_number: String,
    surrendered_by: address,
    timestamp: u64,
}

public struct BLAccomplished has copy, drop {
    bl_id: address,
    bl_number: String,
    timestamp: u64,
}

// === Init ===

fun init(ctx: &mut TxContext) {
    transfer::share_object(BLRegistry {
        id: object::new(ctx),
        total_bls_issued: 0,
        total_bls_surrendered: 0,
    });
}

// === Public functions ===

/// Register the caller as a carrier, creating a CarrierCap.
public fun register_carrier(
    carrier_name: String,
    _clock: &Clock,
    ctx: &mut TxContext,
) {
    transfer::transfer(CarrierCap {
        id: object::new(ctx),
        carrier_name,
        carrier_address: ctx.sender(),
    }, ctx.sender());
}

/// Issue a new electronic Bill of Lading. Caller must hold a CarrierCap.
/// The eBL is created as a shared object with current_holder = shipper.
public fun issue_ebl(
    cap: &CarrierCap,
    registry: &mut BLRegistry,
    bl_number: String,
    shipper: address,
    consignee: address,
    notify_party: address,
    vessel_name: String,
    voyage_number: String,
    port_of_loading: String,
    port_of_discharge: String,
    commodity_description: String,
    container_numbers: String,
    gross_weight_kg: u64,
    number_of_packages: u64,
    freight_terms: u8,
    content_hash: String,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(cap.carrier_address == ctx.sender(), ENotCarrier);

    let carrier_addr = ctx.sender();
    let ts = clock.timestamp_ms();
    let uid = object::new(ctx);
    let bl_id = object::uid_to_address(&uid);

    event::emit(BLIssued {
        bl_id,
        bl_number,
        carrier: carrier_addr,
        shipper,
        consignee,
        port_of_loading,
        port_of_discharge,
        timestamp: ts,
    });

    transfer::share_object(ElectronicBL {
        id: uid,
        bl_number,
        carrier: carrier_addr,
        shipper,
        consignee,
        notify_party,
        vessel_name,
        voyage_number,
        port_of_loading,
        port_of_discharge,
        commodity_description,
        container_numbers,
        gross_weight_kg,
        number_of_packages,
        freight_terms,
        content_hash,
        status: 0,
        current_holder: shipper,
        endorsement_count: 0,
        issued_at: ts,
        surrendered_at: 0,
    });

    registry.total_bls_issued = registry.total_bls_issued + 1;
}

/// Update eBL status. Only the carrier can call this.
public fun update_status(
    ebl: &mut ElectronicBL,
    new_status: u8,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(ebl.carrier == ctx.sender(), ENotCarrier);
    assert!(new_status <= 2, EInvalidStatus);
    assert!(new_status > ebl.status, EInvalidStatus);

    let old_status = ebl.status;
    ebl.status = new_status;

    event::emit(BLStatusUpdated {
        bl_id: object::id_address(ebl),
        old_status,
        new_status,
        timestamp: clock.timestamp_ms(),
    });
}

/// Surrender the eBL at port. Only the current holder can call this.
public fun surrender(
    ebl: &mut ElectronicBL,
    registry: &mut BLRegistry,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(ebl.current_holder == ctx.sender(), ENotHolder);
    assert!(ebl.status != 3 && ebl.status != 4, EAlreadySurrendered);

    let ts = clock.timestamp_ms();
    let surrendered_by = ctx.sender();
    ebl.status = 3;
    ebl.surrendered_at = ts;
    ebl.current_holder = ebl.carrier;
    registry.total_bls_surrendered = registry.total_bls_surrendered + 1;

    event::emit(BLSurrendered {
        bl_id: object::id_address(ebl),
        bl_number: ebl.bl_number,
        surrendered_by,
        timestamp: ts,
    });
}

/// Carrier confirms goods released after surrender.
public fun accomplish(
    ebl: &mut ElectronicBL,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(ebl.carrier == ctx.sender(), ENotCarrier);
    assert!(ebl.status == 3, ENotSurrendered);

    ebl.status = 4;

    event::emit(BLAccomplished {
        bl_id: object::id_address(ebl),
        bl_number: ebl.bl_number,
        timestamp: clock.timestamp_ms(),
    });
}

// === Package-internal functions (for endorsement module) ===

public(package) fun set_holder(ebl: &mut ElectronicBL, new_holder: address) {
    ebl.current_holder = new_holder;
}

public(package) fun increment_endorsement_count(ebl: &mut ElectronicBL) {
    ebl.endorsement_count = ebl.endorsement_count + 1;
}

// === View / getter functions ===

public fun bl_number(ebl: &ElectronicBL): String { ebl.bl_number }
public fun carrier(ebl: &ElectronicBL): address { ebl.carrier }
public fun shipper(ebl: &ElectronicBL): address { ebl.shipper }
public fun consignee(ebl: &ElectronicBL): address { ebl.consignee }
public fun notify_party(ebl: &ElectronicBL): address { ebl.notify_party }
public fun vessel_name(ebl: &ElectronicBL): String { ebl.vessel_name }
public fun voyage_number(ebl: &ElectronicBL): String { ebl.voyage_number }
public fun port_of_loading(ebl: &ElectronicBL): String { ebl.port_of_loading }
public fun port_of_discharge(ebl: &ElectronicBL): String { ebl.port_of_discharge }
public fun commodity_description(ebl: &ElectronicBL): String { ebl.commodity_description }
public fun container_numbers(ebl: &ElectronicBL): String { ebl.container_numbers }
public fun gross_weight_kg(ebl: &ElectronicBL): u64 { ebl.gross_weight_kg }
public fun number_of_packages(ebl: &ElectronicBL): u64 { ebl.number_of_packages }
public fun freight_terms(ebl: &ElectronicBL): u8 { ebl.freight_terms }
public fun content_hash(ebl: &ElectronicBL): String { ebl.content_hash }
public fun status(ebl: &ElectronicBL): u8 { ebl.status }
public fun current_holder(ebl: &ElectronicBL): address { ebl.current_holder }
public fun endorsement_count(ebl: &ElectronicBL): u64 { ebl.endorsement_count }
public fun issued_at(ebl: &ElectronicBL): u64 { ebl.issued_at }
public fun surrendered_at(ebl: &ElectronicBL): u64 { ebl.surrendered_at }
public fun total_bls_issued(registry: &BLRegistry): u64 { registry.total_bls_issued }
public fun total_bls_surrendered(registry: &BLRegistry): u64 { registry.total_bls_surrendered }

// === Test helpers ===

#[test_only]
public fun test_init(ctx: &mut TxContext) {
    init(ctx);
}
