use std::{env, fs, path::PathBuf};
fn main() {
 let root=env::var_os("DS_SOURCE_ROOT").map(PathBuf::from).unwrap_or_else(|| PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap()).ancestors().nth(5).unwrap().to_path_buf());
 let module=|name:&str,path:&str| format!("#[path={:?}] pub mod {};\n",root.join(path).to_string_lossy(),name);
 let mut s=String::new();
 s.push_str("pub mod mcp {\n");
 s+=&module("client","src-tauri/src/mcp/client.rs");
 s+=&module("protocol_version","src-tauri/src/mcp/protocol_version.rs");
 s.push_str("}\n");
 s.push_str("pub mod llm_manager {\n");
 s+=&module("utf8_stream","src-tauri/src/llm_manager/utf8_stream.rs");
 s.push_str("}\n");
 for (name,path) in [("mastery","src-tauri/src/mastery/bias.rs"),("sse","src-tauri/src/utils/sse_buffer.rs"),("classification","src-tauri/src/data_governance/sync/classification.rs"),("field_merge","src-tauri/src/data_governance/sync/field_merge.rs"),("asset_filenames","src-tauri/src/data_governance/sync/asset_filenames.rs")] {s+=&module(name,path);}
 fs::write(PathBuf::from(env::var("OUT_DIR").unwrap()).join("modules.rs"),s).unwrap();
 println!("cargo:rerun-if-env-changed=DS_SOURCE_ROOT");
 println!("cargo:rerun-if-changed={}",root.join("src-tauri/src").display());
}
