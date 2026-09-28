use production::field_merge::*;
use serde_json::json;
#[test] fn regression_lowered_values_and_coupled_counters_survive() {
 for (table,column) in [("questions","attempt_count"),("questions","correct_count"),("review_plans","interval_days"),("review_plans","consecutive_failures"),("todo_items","estimated_pomodoros")] {
  let (value,merged,conflict)=merge_field(table,column,Some(&json!(12)),Some(&json!(0)));
  assert_eq!(value,json!(0),"{table}.{column}");assert!(!merged);assert!(conflict);
  assert!(!field_merge_columns_for_table(table).contains(&column));
 }
}
#[test] fn pass_to_pass_convergent_merges_remain() {
 assert_eq!(merge_field("review_plans","total_reviews",Some(&json!(12)),Some(&json!(4))).0,json!(12));
 assert_eq!(merge_field("notes","is_favorite",Some(&json!(false)),Some(&json!(true))).0,json!(true));
 assert_eq!(merge_field("files","tags_json",Some(&json!(["a","b"])),Some(&json!(["b","c"]))).0,json!(["a","b","c"]));
 assert_eq!(merge_field("notes","title",Some(&json!("old")),Some(&json!("new"))).0,json!("new"));
}
