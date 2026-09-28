use production::classification::*;
#[test] fn regression_classify_every_runtime_and_derived_record() {
 let entries=sync_classification_registry();
 for (db,name,category) in [("vfs","note_tags",SyncCategory::DerivedRebuild),("vfs","note_links",SyncCategory::DerivedRebuild),("vfs","notes_fts",SyncCategory::DerivedRebuild),("vfs","qbank_generation_tasks",SyncCategory::LocalRuntime),("chat_v2","chat_v2_goals",SyncCategory::LocalRuntime),("chat_v2","connector_operations",SyncCategory::LocalRuntime),("chat_v2","completion_outbox",SyncCategory::LocalRuntime)] {
  let entry=entries.iter().find(|e|e.database==db && e.table_name==name).expect("known device-local or derived table must have explicit classification");assert_eq!(entry.category,category);assert_eq!(entry.conflict_policy,ConflictPolicyClass::NoConflict);
 }
}
#[test] fn pass_to_pass_business_records_remain_syncable() {
 let entries=sync_classification_registry();
 for name in ["notes","questions","files","folders"] {assert_eq!(entries.iter().find(|e|e.database=="vfs" && e.table_name==name).unwrap().category,SyncCategory::RowSync);}
 let mut keys=std::collections::HashSet::new();for e in entries {assert!(keys.insert((e.database,e.table_name)));}
}
