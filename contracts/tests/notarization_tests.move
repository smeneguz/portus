#[test_only]
module portus::notarization_tests;

use std::string;
use iota::test_scenario;
use iota::clock;
use portus::notarization::{Self, NotarizedBLDoc};

const USER: address = @0xAA;
const BL_ID: address = @0xBB;

#[test]
fun test_notarize_and_verify() {
    let mut scenario = test_scenario::begin(USER);
    {
        let clk = clock::create_for_testing(scenario.ctx());
        notarization::notarize(
            string::utf8(b"sha256_hash_abc"),
            string::utf8(b"bill_of_lading"),
            BL_ID,
            &clk,
            scenario.ctx(),
        );
        clock::destroy_for_testing(clk);
    };

    scenario.next_tx(USER);
    {
        let doc = test_scenario::take_from_sender<NotarizedBLDoc>(&scenario);
        // Correct hash → true
        assert!(notarization::verify(&doc, string::utf8(b"sha256_hash_abc")) == true);
        // Wrong hash → false
        assert!(notarization::verify(&doc, string::utf8(b"wrong_hash")) == false);
        assert!(notarization::bl_id(&doc) == BL_ID);
        test_scenario::return_to_sender(&scenario, doc);
    };

    scenario.end();
}

#[test]
fun test_batch_notarize() {
    let mut scenario = test_scenario::begin(USER);
    {
        let clk = clock::create_for_testing(scenario.ctx());
        let hashes = vector[
            string::utf8(b"hash1"),
            string::utf8(b"hash2"),
        ];
        let types = vector[
            string::utf8(b"bill_of_lading"),
            string::utf8(b"packing_list"),
        ];
        notarization::batch_notarize(hashes, types, BL_ID, &clk, scenario.ctx());
        clock::destroy_for_testing(clk);
    };

    scenario.next_tx(USER);
    {
        // Both docs should exist
        let doc1 = test_scenario::take_from_sender<NotarizedBLDoc>(&scenario);
        let doc2 = test_scenario::take_from_sender<NotarizedBLDoc>(&scenario);
        test_scenario::return_to_sender(&scenario, doc1);
        test_scenario::return_to_sender(&scenario, doc2);
    };

    scenario.end();
}
