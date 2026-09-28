use production::mcp::client::*;
use serde_json::json;
#[test] fn regression_wire_roundtrip() {
 let wire=json!({"name":"inspect","description":"read", "inputSchema":{"type":"object","properties":{"query":{"type":"string"}}}});
 let tool: Tool=serde_json::from_value(wire.clone()).expect("standard server tool schema should load");
 assert_eq!(tool.input_schema["properties"]["query"]["type"],"string");
 assert_eq!(serde_json::to_value(tool).unwrap(),wire);
 let result:ToolResult=serde_json::from_value(json!({"content":[{"type":"image","data":"AQID","mimeType":"image/png"}],"isError":true})).unwrap();
 assert_eq!(result.is_error,Some(true));
 let caps: ServerCapabilities=serde_json::from_value(json!({"tools":{"listChanged":true},"resources":{"listChanged":false,"subscribe":true},"prompts":{"listChanged":true}})).unwrap();
 assert_eq!(caps.tools.unwrap().list_changed,Some(true));
 assert_eq!(caps.resources.unwrap().list_changed,Some(false));
}
#[test] fn pass_to_pass_text_and_plain_fields() {
 let content:Content=serde_json::from_value(json!({"type":"text","text":"你好"})).unwrap();
 assert_eq!(serde_json::to_value(content).unwrap()["text"],"你好");
 let r:JsonRpcResponse=serde_json::from_value(json!({"jsonrpc":"2.0","id":7,"result":{"ok":true}})).unwrap();
 assert_eq!(r.id,Some(json!(7)));
}
