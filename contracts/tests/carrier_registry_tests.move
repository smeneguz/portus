#[test_only]
module portus::carrier_registry_tests;

use std::string;
use iota::test_scenario;
use iota::clock;
use portus::carrier_registry::{Self, GlobalCarrierRegistry, CarrierProfile};

const CARRIER: address = @0xCA;

#[test]
fun test_init_creates_registry() {
    let mut scenario = test_scenario::begin(CARRIER);
    {
        carrier_registry::test_init(scenario.ctx());
    };
    scenario.next_tx(CARRIER);
    {
        let registry = test_scenario::take_shared<GlobalCarrierRegistry>(&scenario);
        assert!(carrier_registry::total_carriers(&registry) == 0);
        test_scenario::return_shared(registry);
    };
    scenario.end();
}

#[test]
fun test_register_carrier() {
    let mut scenario = test_scenario::begin(CARRIER);
    {
        carrier_registry::test_init(scenario.ctx());
    };
    scenario.next_tx(CARRIER);
    {
        let mut registry = test_scenario::take_shared<GlobalCarrierRegistry>(&scenario);
        let clk = clock::create_for_testing(scenario.ctx());
        carrier_registry::register(
            &mut registry,
            string::utf8(b"Portus Shipping"),
            string::utf8(b"PRTS"),
            string::utf8(b"DE"),
            &clk,
            scenario.ctx(),
        );
        assert!(carrier_registry::total_carriers(&registry) == 1);
        clock::destroy_for_testing(clk);
        test_scenario::return_shared(registry);
    };
    scenario.next_tx(CARRIER);
    {
        let profile = test_scenario::take_from_sender<CarrierProfile>(&scenario);
        assert!(carrier_registry::name(&profile) == string::utf8(b"Portus Shipping"));
        assert!(carrier_registry::scac_code(&profile) == string::utf8(b"PRTS"));
        assert!(carrier_registry::bls_issued(&profile) == 0);
        test_scenario::return_to_sender(&scenario, profile);
    };
    scenario.end();
}

#[test]
fun test_increment_bls() {
    let mut scenario = test_scenario::begin(CARRIER);
    {
        carrier_registry::test_init(scenario.ctx());
    };
    scenario.next_tx(CARRIER);
    {
        let mut registry = test_scenario::take_shared<GlobalCarrierRegistry>(&scenario);
        let clk = clock::create_for_testing(scenario.ctx());
        carrier_registry::register(
            &mut registry,
            string::utf8(b"Test"),
            string::utf8(b"TST"),
            string::utf8(b"US"),
            &clk,
            scenario.ctx(),
        );
        clock::destroy_for_testing(clk);
        test_scenario::return_shared(registry);
    };
    scenario.next_tx(CARRIER);
    {
        let mut profile = test_scenario::take_from_sender<CarrierProfile>(&scenario);
        carrier_registry::increment_bls(&mut profile);
        assert!(carrier_registry::bls_issued(&profile) == 1);
        carrier_registry::increment_bls(&mut profile);
        assert!(carrier_registry::bls_issued(&profile) == 2);
        test_scenario::return_to_sender(&scenario, profile);
    };
    scenario.end();
}
