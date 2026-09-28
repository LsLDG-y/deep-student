#![allow(dead_code, unused_imports)]
// The only substituted dependency is outside every tested execution path.
// Reaching it fails loudly; no business behavior is reproduced here.
pub mod memory {pub mod learner_profile {
 pub fn merge_profile_json_for_sync(_: &str, _: &str) -> Option<String> {
  panic!("unreachable learner-profile dependency reached by benchmark");
 }
}}
include!(concat!(env!("OUT_DIR"), "/modules.rs"));
