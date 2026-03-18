#[test_only]
module portus::interop_control_tests;

use std::string;
use iota::clock;
use iota::test_scenario;
use portus::interop_control::{Self, InteropRegistry, TradeDocumentControl};

const PLATFORM_A: u8 = 1;
const PLATFORM_B: u8 = 2;

const ALICE: address = @0xA1;
const BOB: address = @0xB1;
const CHARLIE: address = @0xC1;

#[test]
fun test_register_document() {
    let mut scenario = test_scenario::begin(ALICE);
    interop_control::test_init(scenario.ctx());

    scenario.next_tx(ALICE);
    {
        let mut registry = test_scenario::take_shared<InteropRegistry>(&scenario);
        let clk = clock::create_for_testing(scenario.ctx());
        interop_control::register_document(
            &mut registry,
            string::utf8(b"hash-abc"),
            string::utf8(b"EBL_ENVELOPE"),
            PLATFORM_A,
            string::utf8(b"did:iota:testnet:alice"),
            string::utf8(b"ALICE-PLAT-A"),
            string::utf8(b"vc-hash-alice"),
            &clk,
            scenario.ctx(),
        );
        assert!(interop_control::total_documents(&registry) == 1);
        clock::destroy_for_testing(clk);
        test_scenario::return_shared(registry);
    };

    scenario.next_tx(ALICE);
    {
        let document = test_scenario::take_shared<TradeDocumentControl>(&scenario);
        assert!(interop_control::controller(&document) == ALICE);
        assert!(interop_control::controller_did(&document) == string::utf8(b"did:iota:testnet:alice"));
        assert!(interop_control::controller_party_code(&document) == string::utf8(b"ALICE-PLAT-A"));
        assert!(interop_control::current_platform(&document) == PLATFORM_A);
        assert!(interop_control::state(&document) == 0);
        assert!(interop_control::transfer_count(&document) == 0);
        test_scenario::return_shared(document);
    };

    scenario.end();
}

#[test]
fun test_initiate_and_accept_transfer() {
    let mut scenario = test_scenario::begin(ALICE);
    interop_control::test_init(scenario.ctx());

    scenario.next_tx(ALICE);
    {
        let mut registry = test_scenario::take_shared<InteropRegistry>(&scenario);
        let clk = clock::create_for_testing(scenario.ctx());
        interop_control::register_document(
            &mut registry,
            string::utf8(b"hash-001"),
            string::utf8(b"EBL_ENVELOPE"),
            PLATFORM_A,
            string::utf8(b"did:iota:testnet:alice"),
            string::utf8(b"ALICE-PLAT-A"),
            string::utf8(b"vc-hash-alice"),
            &clk,
            scenario.ctx(),
        );
        clock::destroy_for_testing(clk);
        test_scenario::return_shared(registry);
    };

    scenario.next_tx(ALICE);
    {
        let mut registry = test_scenario::take_shared<InteropRegistry>(&scenario);
        let mut document = test_scenario::take_shared<TradeDocumentControl>(&scenario);
        let clk = clock::create_for_testing(scenario.ctx());
        interop_control::initiate_transfer(
            &mut registry,
            &mut document,
            BOB,
            string::utf8(b"did:iota:testnet:bob"),
            string::utf8(b"BOB-PLAT-B"),
            PLATFORM_B,
            string::utf8(b"proof-v1"),
            string::utf8(b"vp-hash-bob"),
            string::utf8(b"nonce-001"),
            10_000,
            &clk,
            scenario.ctx(),
        );
        assert!(interop_control::pending_transfers(&registry) == 1);
        assert!(interop_control::state(&document) == 1);
        assert!(interop_control::pending_controller(&document) == BOB);
        assert!(interop_control::pending_controller_did(&document) == string::utf8(b"did:iota:testnet:bob"));
        assert!(interop_control::pending_party_code(&document) == string::utf8(b"BOB-PLAT-B"));
        assert!(interop_control::transfer_nonce(&document) == string::utf8(b"nonce-001"));
        clock::destroy_for_testing(clk);
        test_scenario::return_shared(registry);
        test_scenario::return_shared(document);
    };

    scenario.next_tx(BOB);
    {
        let mut registry = test_scenario::take_shared<InteropRegistry>(&scenario);
        let mut document = test_scenario::take_shared<TradeDocumentControl>(&scenario);
        let clk = clock::create_for_testing(scenario.ctx());
        interop_control::accept_transfer(
            &mut registry,
            &mut document,
            string::utf8(b"did:iota:testnet:bob"),
            string::utf8(b"BOB-PLAT-B"),
            string::utf8(b"vp-hash-bob"),
            &clk,
            scenario.ctx(),
        );
        assert!(interop_control::controller(&document) == BOB);
        assert!(interop_control::controller_did(&document) == string::utf8(b"did:iota:testnet:bob"));
        assert!(interop_control::controller_party_code(&document) == string::utf8(b"BOB-PLAT-B"));
        assert!(interop_control::current_platform(&document) == PLATFORM_B);
        assert!(interop_control::state(&document) == 0);
        assert!(interop_control::transfer_count(&document) == 1);
        assert!(interop_control::pending_transfers(&registry) == 0);
        assert!(interop_control::total_transfers_completed(&registry) == 1);
        clock::destroy_for_testing(clk);
        test_scenario::return_shared(registry);
        test_scenario::return_shared(document);
    };

    scenario.end();
}

#[test]
fun test_cancel_transfer_records_reason() {
    let mut scenario = test_scenario::begin(ALICE);
    interop_control::test_init(scenario.ctx());

    scenario.next_tx(ALICE);
    {
        let mut registry = test_scenario::take_shared<InteropRegistry>(&scenario);
        let clk = clock::create_for_testing(scenario.ctx());
        interop_control::register_document(
            &mut registry,
            string::utf8(b"hash-cancel"),
            string::utf8(b"EBL_ENVELOPE"),
            PLATFORM_A,
            string::utf8(b"did:iota:testnet:alice"),
            string::utf8(b"ALICE-PLAT-A"),
            string::utf8(b"vc-hash-alice"),
            &clk,
            scenario.ctx(),
        );
        clock::destroy_for_testing(clk);
        test_scenario::return_shared(registry);
    };

    scenario.next_tx(ALICE);
    {
        let mut registry = test_scenario::take_shared<InteropRegistry>(&scenario);
        let mut document = test_scenario::take_shared<TradeDocumentControl>(&scenario);
        let clk = clock::create_for_testing(scenario.ctx());
        interop_control::initiate_transfer(
            &mut registry,
            &mut document,
            BOB,
            string::utf8(b"did:iota:testnet:bob"),
            string::utf8(b"BOB-PLAT-B"),
            PLATFORM_B,
            string::utf8(b"proof-v2"),
            string::utf8(b"vp-hash-bob"),
            string::utf8(b"nonce-002"),
            10_000,
            &clk,
            scenario.ctx(),
        );
        clock::destroy_for_testing(clk);
        test_scenario::return_shared(registry);
        test_scenario::return_shared(document);
    };

    scenario.next_tx(ALICE);
    {
        let mut registry = test_scenario::take_shared<InteropRegistry>(&scenario);
        let mut document = test_scenario::take_shared<TradeDocumentControl>(&scenario);
        let clk = clock::create_for_testing(scenario.ctx());
        interop_control::cancel_transfer(
            &mut registry,
            &mut document,
            string::utf8(b"Receiver validation failed"),
            &clk,
            scenario.ctx(),
        );
        assert!(interop_control::state(&document) == 0);
        assert!(interop_control::pending_transfers(&registry) == 0);
        assert!(interop_control::last_rejection_reason(&document) == string::utf8(b"Receiver validation failed"));
        clock::destroy_for_testing(clk);
        test_scenario::return_shared(registry);
        test_scenario::return_shared(document);
    };

    scenario.end();
}

#[test]
#[expected_failure(abort_code = portus::interop_control::ENotController)]
fun test_unauthorised_initiate_transfer() {
    let mut scenario = test_scenario::begin(ALICE);
    interop_control::test_init(scenario.ctx());

    scenario.next_tx(ALICE);
    {
        let mut registry = test_scenario::take_shared<InteropRegistry>(&scenario);
        let clk = clock::create_for_testing(scenario.ctx());
        interop_control::register_document(
            &mut registry,
            string::utf8(b"hash-x"),
            string::utf8(b"EBL_ENVELOPE"),
            PLATFORM_A,
            string::utf8(b"did:iota:testnet:alice"),
            string::utf8(b"ALICE-PLAT-A"),
            string::utf8(b"vc-hash-alice"),
            &clk,
            scenario.ctx(),
        );
        clock::destroy_for_testing(clk);
        test_scenario::return_shared(registry);
    };

    scenario.next_tx(CHARLIE);
    {
        let mut registry = test_scenario::take_shared<InteropRegistry>(&scenario);
        let mut document = test_scenario::take_shared<TradeDocumentControl>(&scenario);
        let clk = clock::create_for_testing(scenario.ctx());
        interop_control::initiate_transfer(
            &mut registry,
            &mut document,
            BOB,
            string::utf8(b"did:iota:testnet:bob"),
            string::utf8(b"BOB-PLAT-B"),
            PLATFORM_B,
            string::utf8(b"proof"),
            string::utf8(b"vp-hash-bob"),
            string::utf8(b"nonce-x"),
            10_000,
            &clk,
            scenario.ctx(),
        );
        clock::destroy_for_testing(clk);
        test_scenario::return_shared(registry);
        test_scenario::return_shared(document);
    };

    scenario.end();
}

#[test]
#[expected_failure(abort_code = portus::interop_control::ENotPendingController)]
fun test_unauthorised_accept_transfer() {
    let mut scenario = test_scenario::begin(ALICE);
    interop_control::test_init(scenario.ctx());

    scenario.next_tx(ALICE);
    {
        let mut registry = test_scenario::take_shared<InteropRegistry>(&scenario);
        let clk = clock::create_for_testing(scenario.ctx());
        interop_control::register_document(
            &mut registry,
            string::utf8(b"hash-y"),
            string::utf8(b"EBL_ENVELOPE"),
            PLATFORM_A,
            string::utf8(b"did:iota:testnet:alice"),
            string::utf8(b"ALICE-PLAT-A"),
            string::utf8(b"vc-hash-alice"),
            &clk,
            scenario.ctx(),
        );
        clock::destroy_for_testing(clk);
        test_scenario::return_shared(registry);
    };

    scenario.next_tx(ALICE);
    {
        let mut registry = test_scenario::take_shared<InteropRegistry>(&scenario);
        let mut document = test_scenario::take_shared<TradeDocumentControl>(&scenario);
        let clk = clock::create_for_testing(scenario.ctx());
        interop_control::initiate_transfer(
            &mut registry,
            &mut document,
            BOB,
            string::utf8(b"did:iota:testnet:bob"),
            string::utf8(b"BOB-PLAT-B"),
            PLATFORM_B,
            string::utf8(b"proof"),
            string::utf8(b"vp-hash-bob"),
            string::utf8(b"nonce-y"),
            10_000,
            &clk,
            scenario.ctx(),
        );
        clock::destroy_for_testing(clk);
        test_scenario::return_shared(registry);
        test_scenario::return_shared(document);
    };

    scenario.next_tx(CHARLIE);
    {
        let mut registry = test_scenario::take_shared<InteropRegistry>(&scenario);
        let mut document = test_scenario::take_shared<TradeDocumentControl>(&scenario);
        let clk = clock::create_for_testing(scenario.ctx());
        interop_control::accept_transfer(
            &mut registry,
            &mut document,
            string::utf8(b"did:iota:testnet:bob"),
            string::utf8(b"BOB-PLAT-B"),
            string::utf8(b"vp-hash-bob"),
            &clk,
            scenario.ctx(),
        );
        clock::destroy_for_testing(clk);
        test_scenario::return_shared(registry);
        test_scenario::return_shared(document);
    };

    scenario.end();
}

#[test]
#[expected_failure(abort_code = portus::interop_control::EIdentityProofMismatch)]
fun test_accept_transfer_requires_matching_identity_hash() {
    let mut scenario = test_scenario::begin(ALICE);
    interop_control::test_init(scenario.ctx());

    scenario.next_tx(ALICE);
    {
        let mut registry = test_scenario::take_shared<InteropRegistry>(&scenario);
        let clk = clock::create_for_testing(scenario.ctx());
        interop_control::register_document(
            &mut registry,
            string::utf8(b"hash-proof"),
            string::utf8(b"EBL_ENVELOPE"),
            PLATFORM_A,
            string::utf8(b"did:iota:testnet:alice"),
            string::utf8(b"ALICE-PLAT-A"),
            string::utf8(b"vc-hash-alice"),
            &clk,
            scenario.ctx(),
        );
        clock::destroy_for_testing(clk);
        test_scenario::return_shared(registry);
    };

    scenario.next_tx(ALICE);
    {
        let mut registry = test_scenario::take_shared<InteropRegistry>(&scenario);
        let mut document = test_scenario::take_shared<TradeDocumentControl>(&scenario);
        let clk = clock::create_for_testing(scenario.ctx());
        interop_control::initiate_transfer(
            &mut registry,
            &mut document,
            BOB,
            string::utf8(b"did:iota:testnet:bob"),
            string::utf8(b"BOB-PLAT-B"),
            PLATFORM_B,
            string::utf8(b"proof"),
            string::utf8(b"vp-hash-bob"),
            string::utf8(b"nonce-proof"),
            10_000,
            &clk,
            scenario.ctx(),
        );
        clock::destroy_for_testing(clk);
        test_scenario::return_shared(registry);
        test_scenario::return_shared(document);
    };

    scenario.next_tx(BOB);
    {
        let mut registry = test_scenario::take_shared<InteropRegistry>(&scenario);
        let mut document = test_scenario::take_shared<TradeDocumentControl>(&scenario);
        let clk = clock::create_for_testing(scenario.ctx());
        interop_control::accept_transfer(
            &mut registry,
            &mut document,
            string::utf8(b"did:iota:testnet:bob"),
            string::utf8(b"BOB-PLAT-B"),
            string::utf8(b"wrong-vp-hash"),
            &clk,
            scenario.ctx(),
        );
        clock::destroy_for_testing(clk);
        test_scenario::return_shared(registry);
        test_scenario::return_shared(document);
    };

    scenario.end();
}
