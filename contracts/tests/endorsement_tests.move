#[test_only]
module portus::endorsement_tests;

use std::string;
use iota::test_scenario;
use iota::clock;
use portus::ebl::{Self, BLRegistry, CarrierCap, ElectronicBL};
use portus::endorsement::{Self, EndorsementChain};

const CARRIER: address = @0xCA;
const SHIPPER: address = @0x5A;
const BANK: address = @0xBA;
const CONSIGNEE: address = @0xC0;
const NOTIFY: address = @0x10;

fun setup_ebl(scenario: &mut test_scenario::Scenario) {
    // Init
    ebl::test_init(scenario.ctx());

    scenario.next_tx(CARRIER);
    let clk = clock::create_for_testing(scenario.ctx());
    ebl::register_carrier(string::utf8(b"Test Carrier"), &clk, scenario.ctx());
    clock::destroy_for_testing(clk);

    scenario.next_tx(CARRIER);
    let cap = test_scenario::take_from_sender<CarrierCap>(scenario);
    let mut registry = test_scenario::take_shared<BLRegistry>(scenario);
    let clk = clock::create_for_testing(scenario.ctx());
    ebl::issue_ebl(
        &cap, &mut registry,
        string::utf8(b"TEST-BL-END"), SHIPPER, CONSIGNEE, NOTIFY,
        string::utf8(b"MV Terra Nova"), string::utf8(b"V2026-042"),
        string::utf8(b"Hamburg"), string::utf8(b"Shanghai"),
        string::utf8(b"Auto parts"), string::utf8(b"CTR001"),
        24000, 480, 0, string::utf8(b"hash123"),
        &clk, scenario.ctx(),
    );
    clock::destroy_for_testing(clk);
    test_scenario::return_to_sender(scenario, cap);
    test_scenario::return_shared(registry);
}

#[test]
fun test_create_chain_and_endorse() {
    let mut scenario = test_scenario::begin(CARRIER);
    setup_ebl(&mut scenario);

    // Create endorsement chain
    scenario.next_tx(CARRIER);
    {
        let ebl_obj = test_scenario::take_shared<ElectronicBL>(&scenario);
        let bl_id = object::id_address(&ebl_obj);
        let clk = clock::create_for_testing(scenario.ctx());
        endorsement::create_chain(bl_id, SHIPPER, &clk, scenario.ctx());
        clock::destroy_for_testing(clk);
        test_scenario::return_shared(ebl_obj);
    };

    // Shipper endorses to bank
    scenario.next_tx(SHIPPER);
    {
        let mut chain = test_scenario::take_shared<EndorsementChain>(&scenario);
        let mut ebl_obj = test_scenario::take_shared<ElectronicBL>(&scenario);
        let clk = clock::create_for_testing(scenario.ctx());

        endorsement::endorse_and_transfer(
            &mut chain, &mut ebl_obj, BANK, 1,
            string::utf8(b"LC endorsement"), &clk, scenario.ctx(),
        );

        assert!(endorsement::get_current_holder(&chain) == BANK);
        assert!(endorsement::get_endorsement_count(&chain) == 1);
        assert!(ebl::current_holder(&ebl_obj) == BANK);

        clock::destroy_for_testing(clk);
        test_scenario::return_shared(chain);
        test_scenario::return_shared(ebl_obj);
    };

    // Bank endorses to consignee
    scenario.next_tx(BANK);
    {
        let mut chain = test_scenario::take_shared<EndorsementChain>(&scenario);
        let mut ebl_obj = test_scenario::take_shared<ElectronicBL>(&scenario);
        let clk = clock::create_for_testing(scenario.ctx());

        endorsement::endorse_and_transfer(
            &mut chain, &mut ebl_obj, CONSIGNEE, 2,
            string::utf8(b"Straight endorsement"), &clk, scenario.ctx(),
        );

        assert!(endorsement::get_current_holder(&chain) == CONSIGNEE);
        assert!(endorsement::get_endorsement_count(&chain) == 2);
        assert!(ebl::current_holder(&ebl_obj) == CONSIGNEE);

        clock::destroy_for_testing(clk);
        test_scenario::return_shared(chain);
        test_scenario::return_shared(ebl_obj);
    };

    scenario.end();
}

#[test]
#[expected_failure(abort_code = portus::endorsement::ENotHolder)]
fun test_unauthorised_endorsement() {
    let mut scenario = test_scenario::begin(CARRIER);
    setup_ebl(&mut scenario);

    scenario.next_tx(CARRIER);
    {
        let ebl_obj = test_scenario::take_shared<ElectronicBL>(&scenario);
        let bl_id = object::id_address(&ebl_obj);
        let clk = clock::create_for_testing(scenario.ctx());
        endorsement::create_chain(bl_id, SHIPPER, &clk, scenario.ctx());
        clock::destroy_for_testing(clk);
        test_scenario::return_shared(ebl_obj);
    };

    // Random address (BANK) tries to endorse — should fail
    scenario.next_tx(BANK);
    {
        let mut chain = test_scenario::take_shared<EndorsementChain>(&scenario);
        let mut ebl_obj = test_scenario::take_shared<ElectronicBL>(&scenario);
        let clk = clock::create_for_testing(scenario.ctx());

        endorsement::endorse_and_transfer(
            &mut chain, &mut ebl_obj, CONSIGNEE, 1,
            string::utf8(b"Unauthorized"), &clk, scenario.ctx(),
        );

        clock::destroy_for_testing(clk);
        test_scenario::return_shared(chain);
        test_scenario::return_shared(ebl_obj);
    };

    scenario.end();
}
