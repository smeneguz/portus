#[test_only]
module portus::ebl_tests;

use std::string;
use iota::test_scenario;
use iota::clock;
use portus::ebl::{Self, BLRegistry, CarrierCap, ElectronicBL};

const CARRIER: address = @0xCA;
const SHIPPER: address = @0x5A;
const CONSIGNEE: address = @0xC0;
const NOTIFY: address = @0x10;

#[test]
fun test_init_creates_registry() {
    let mut scenario = test_scenario::begin(CARRIER);
    {
        ebl::test_init(scenario.ctx());
    };
    scenario.next_tx(CARRIER);
    {
        let registry = test_scenario::take_shared<BLRegistry>(&scenario);
        assert!(ebl::total_bls_issued(&registry) == 0);
        assert!(ebl::total_bls_surrendered(&registry) == 0);
        test_scenario::return_shared(registry);
    };
    scenario.end();
}

#[test]
fun test_register_carrier() {
    let mut scenario = test_scenario::begin(CARRIER);
    {
        let clk = clock::create_for_testing(scenario.ctx());
        ebl::register_carrier(string::utf8(b"Test Carrier"), &clk, scenario.ctx());
        clock::destroy_for_testing(clk);
    };
    scenario.next_tx(CARRIER);
    {
        let cap = test_scenario::take_from_sender<CarrierCap>(&scenario);
        test_scenario::return_to_sender(&scenario, cap);
    };
    scenario.end();
}

#[test]
fun test_issue_ebl() {
    let mut scenario = test_scenario::begin(CARRIER);
    // Init
    {
        ebl::test_init(scenario.ctx());
    };
    // Register carrier
    scenario.next_tx(CARRIER);
    {
        let clk = clock::create_for_testing(scenario.ctx());
        ebl::register_carrier(string::utf8(b"Test Carrier"), &clk, scenario.ctx());
        clock::destroy_for_testing(clk);
    };
    // Issue eBL
    scenario.next_tx(CARRIER);
    {
        let cap = test_scenario::take_from_sender<CarrierCap>(&scenario);
        let mut registry = test_scenario::take_shared<BLRegistry>(&scenario);
        let clk = clock::create_for_testing(scenario.ctx());

        ebl::issue_ebl(
            &cap,
            &mut registry,
            string::utf8(b"TEST-BL-001"),
            SHIPPER,
            CONSIGNEE,
            NOTIFY,
            string::utf8(b"MV Terra Nova"),
            string::utf8(b"V2026-042"),
            string::utf8(b"Hamburg, Germany"),
            string::utf8(b"Shanghai, China"),
            string::utf8(b"Automotive parts"),
            string::utf8(b"MSKU1234567, MSKU1234568"),
            24000,
            480,
            0,
            string::utf8(b"abc123hash"),
            &clk,
            scenario.ctx(),
        );

        assert!(ebl::total_bls_issued(&registry) == 1);

        clock::destroy_for_testing(clk);
        test_scenario::return_to_sender(&scenario, cap);
        test_scenario::return_shared(registry);
    };
    // Verify eBL exists as shared object
    scenario.next_tx(SHIPPER);
    {
        let ebl_obj = test_scenario::take_shared<ElectronicBL>(&scenario);
        assert!(ebl::current_holder(&ebl_obj) == SHIPPER);
        assert!(ebl::carrier(&ebl_obj) == CARRIER);
        assert!(ebl::status(&ebl_obj) == 0);
        assert!(ebl::gross_weight_kg(&ebl_obj) == 24000);
        test_scenario::return_shared(ebl_obj);
    };
    scenario.end();
}

#[test]
fun test_update_status() {
    let mut scenario = test_scenario::begin(CARRIER);
    {
        ebl::test_init(scenario.ctx());
    };
    scenario.next_tx(CARRIER);
    {
        let clk = clock::create_for_testing(scenario.ctx());
        ebl::register_carrier(string::utf8(b"Test Carrier"), &clk, scenario.ctx());
        clock::destroy_for_testing(clk);
    };
    scenario.next_tx(CARRIER);
    {
        let cap = test_scenario::take_from_sender<CarrierCap>(&scenario);
        let mut registry = test_scenario::take_shared<BLRegistry>(&scenario);
        let clk = clock::create_for_testing(scenario.ctx());
        ebl::issue_ebl(
            &cap, &mut registry,
            string::utf8(b"TEST-BL-002"), SHIPPER, CONSIGNEE, NOTIFY,
            string::utf8(b"MV Test"), string::utf8(b"V001"),
            string::utf8(b"PortA"), string::utf8(b"PortB"),
            string::utf8(b"Goods"), string::utf8(b"CTR001"),
            1000, 10, 0, string::utf8(b"hash"),
            &clk, scenario.ctx(),
        );
        clock::destroy_for_testing(clk);
        test_scenario::return_to_sender(&scenario, cap);
        test_scenario::return_shared(registry);
    };
    // Carrier updates status to in_transit
    scenario.next_tx(CARRIER);
    {
        let mut ebl_obj = test_scenario::take_shared<ElectronicBL>(&scenario);
        let clk = clock::create_for_testing(scenario.ctx());
        ebl::update_status(&mut ebl_obj, 1, &clk, scenario.ctx());
        assert!(ebl::status(&ebl_obj) == 1);
        clock::destroy_for_testing(clk);
        test_scenario::return_shared(ebl_obj);
    };
    // Carrier updates status to arrived
    scenario.next_tx(CARRIER);
    {
        let mut ebl_obj = test_scenario::take_shared<ElectronicBL>(&scenario);
        let clk = clock::create_for_testing(scenario.ctx());
        ebl::update_status(&mut ebl_obj, 2, &clk, scenario.ctx());
        assert!(ebl::status(&ebl_obj) == 2);
        clock::destroy_for_testing(clk);
        test_scenario::return_shared(ebl_obj);
    };
    scenario.end();
}

#[test]
fun test_surrender_and_accomplish() {
    let mut scenario = test_scenario::begin(CARRIER);
    {
        ebl::test_init(scenario.ctx());
    };
    scenario.next_tx(CARRIER);
    {
        let clk = clock::create_for_testing(scenario.ctx());
        ebl::register_carrier(string::utf8(b"Test Carrier"), &clk, scenario.ctx());
        clock::destroy_for_testing(clk);
    };
    scenario.next_tx(CARRIER);
    {
        let cap = test_scenario::take_from_sender<CarrierCap>(&scenario);
        let mut registry = test_scenario::take_shared<BLRegistry>(&scenario);
        let clk = clock::create_for_testing(scenario.ctx());
        // Issue with consignee as current holder directly for surrender test
        ebl::issue_ebl(
            &cap, &mut registry,
            string::utf8(b"TEST-BL-003"), CONSIGNEE, CONSIGNEE, NOTIFY,
            string::utf8(b"MV Test"), string::utf8(b"V001"),
            string::utf8(b"PortA"), string::utf8(b"PortB"),
            string::utf8(b"Goods"), string::utf8(b"CTR001"),
            1000, 10, 0, string::utf8(b"hash"),
            &clk, scenario.ctx(),
        );
        clock::destroy_for_testing(clk);
        test_scenario::return_to_sender(&scenario, cap);
        test_scenario::return_shared(registry);
    };
    // Consignee surrenders
    scenario.next_tx(CONSIGNEE);
    {
        let mut ebl_obj = test_scenario::take_shared<ElectronicBL>(&scenario);
        let mut registry = test_scenario::take_shared<BLRegistry>(&scenario);
        let clk = clock::create_for_testing(scenario.ctx());
        ebl::surrender(&mut ebl_obj, &mut registry, &clk, scenario.ctx());
        assert!(ebl::status(&ebl_obj) == 3);
        assert!(ebl::total_bls_surrendered(&registry) == 1);
        assert!(ebl::current_holder(&ebl_obj) == CARRIER);
        clock::destroy_for_testing(clk);
        test_scenario::return_shared(ebl_obj);
        test_scenario::return_shared(registry);
    };
    // Carrier accomplishes
    scenario.next_tx(CARRIER);
    {
        let mut ebl_obj = test_scenario::take_shared<ElectronicBL>(&scenario);
        let clk = clock::create_for_testing(scenario.ctx());
        ebl::accomplish(&mut ebl_obj, &clk, scenario.ctx());
        assert!(ebl::status(&ebl_obj) == 4);
        clock::destroy_for_testing(clk);
        test_scenario::return_shared(ebl_obj);
    };
    scenario.end();
}

#[test]
#[expected_failure(abort_code = portus::ebl::ENotCarrier)]
fun test_unauthorised_status_update() {
    let mut scenario = test_scenario::begin(CARRIER);
    {
        ebl::test_init(scenario.ctx());
    };
    scenario.next_tx(CARRIER);
    {
        let clk = clock::create_for_testing(scenario.ctx());
        ebl::register_carrier(string::utf8(b"Test Carrier"), &clk, scenario.ctx());
        clock::destroy_for_testing(clk);
    };
    scenario.next_tx(CARRIER);
    {
        let cap = test_scenario::take_from_sender<CarrierCap>(&scenario);
        let mut registry = test_scenario::take_shared<BLRegistry>(&scenario);
        let clk = clock::create_for_testing(scenario.ctx());
        ebl::issue_ebl(
            &cap, &mut registry,
            string::utf8(b"TEST-BL-AUTH"), SHIPPER, CONSIGNEE, NOTIFY,
            string::utf8(b"MV Test"), string::utf8(b"V001"),
            string::utf8(b"PortA"), string::utf8(b"PortB"),
            string::utf8(b"Goods"), string::utf8(b"CTR001"),
            1000, 10, 0, string::utf8(b"hash"),
            &clk, scenario.ctx(),
        );
        clock::destroy_for_testing(clk);
        test_scenario::return_to_sender(&scenario, cap);
        test_scenario::return_shared(registry);
    };
    // Non-carrier (SHIPPER) tries to update status — should abort
    scenario.next_tx(SHIPPER);
    {
        let mut ebl_obj = test_scenario::take_shared<ElectronicBL>(&scenario);
        let clk = clock::create_for_testing(scenario.ctx());
        ebl::update_status(&mut ebl_obj, 1, &clk, scenario.ctx());
        clock::destroy_for_testing(clk);
        test_scenario::return_shared(ebl_obj);
    };
    scenario.end();
}

#[test]
#[expected_failure(abort_code = portus::ebl::ENotHolder)]
fun test_unauthorised_surrender() {
    let mut scenario = test_scenario::begin(CARRIER);
    {
        ebl::test_init(scenario.ctx());
    };
    scenario.next_tx(CARRIER);
    {
        let clk = clock::create_for_testing(scenario.ctx());
        ebl::register_carrier(string::utf8(b"Test Carrier"), &clk, scenario.ctx());
        clock::destroy_for_testing(clk);
    };
    scenario.next_tx(CARRIER);
    {
        let cap = test_scenario::take_from_sender<CarrierCap>(&scenario);
        let mut registry = test_scenario::take_shared<BLRegistry>(&scenario);
        let clk = clock::create_for_testing(scenario.ctx());
        ebl::issue_ebl(
            &cap, &mut registry,
            string::utf8(b"TEST-BL-SUR"), SHIPPER, CONSIGNEE, NOTIFY,
            string::utf8(b"MV Test"), string::utf8(b"V001"),
            string::utf8(b"PortA"), string::utf8(b"PortB"),
            string::utf8(b"Goods"), string::utf8(b"CTR001"),
            1000, 10, 0, string::utf8(b"hash"),
            &clk, scenario.ctx(),
        );
        clock::destroy_for_testing(clk);
        test_scenario::return_to_sender(&scenario, cap);
        test_scenario::return_shared(registry);
    };
    // Non-holder (CARRIER) tries to surrender — should abort (holder is SHIPPER)
    scenario.next_tx(CARRIER);
    {
        let mut ebl_obj = test_scenario::take_shared<ElectronicBL>(&scenario);
        let mut registry = test_scenario::take_shared<BLRegistry>(&scenario);
        let clk = clock::create_for_testing(scenario.ctx());
        ebl::surrender(&mut ebl_obj, &mut registry, &clk, scenario.ctx());
        clock::destroy_for_testing(clk);
        test_scenario::return_shared(ebl_obj);
        test_scenario::return_shared(registry);
    };
    scenario.end();
}
