use production::asset_filenames::*;
#[test] fn regression_distinct_user_names_never_alias() {
 let names=["report?.txt","report*.txt","report_.txt","report：.txt","report:.txt","é.txt","e\u{301}.txt","CON","CON_","trailing.","trailing"];
 let mut keys=std::collections::HashSet::new();
 for name in names {let encoded=encode_segment(name).unwrap();assert!(keys.insert(encoded.clone()),"distinct name aliased: {name}");assert_eq!(decode_segment(&encoded).unwrap(),name);}
}
#[test] fn pass_to_pass_ordinary_paths_and_limits() {
 assert_eq!(encode_segment("论文-2026.pdf").unwrap(),"论文-2026.pdf");
 let key=encode_asset_key_segments("active","files",&["folder","read.pdf"]).unwrap();
 assert_eq!(decode_asset_key(&key).unwrap(),"active/files/folder/read.pdf");
 assert!(encode_rel_path("a/../b").is_err());assert!(encode_rel_path("a//b").is_err());
 assert!(encode_segment(&"字".repeat(100)).is_err());
}

#[test] fn regression_existing_encoded_name_retains_legacy_lookup() {
 assert_eq!(legacy_sanitized_asset_key("active/files/folder/‛erread？.pdf").unwrap(),"active/files/folder/read_.pdf");
}
