use production::mcp::client::*;
use std::{sync::Arc,time::Duration};
use tokio::sync::mpsc;
use serde_json::json;
fn info()->ClientInfo {ClientInfo{name:"bench".into(),version:"1".into(),protocol_version:"2024-11-05".into(),capabilities:ClientCapabilities{roots:None,sampling:None,experimental:None}}}
#[tokio::test] async fn regression_notifications_reach_subscribers() {
 let (transport,inbound,_outbound)=StdioTransport::new();
 let client=McpClient::new(Box::new(transport),info());
 let (tx,mut rx)=mpsc::unbounded_channel();
 client.on_event(move |event| {if matches!(event,McpEvent::ToolsChanged|McpEvent::ResourcesChanged|McpEvent::PromptsChanged|McpEvent::RootsChanged){let _=tx.send(());}}).await;
 client.connect().await.unwrap();
 for method in ["notifications/tools/list_changed","tools/list_changed","notifications/resources/list_changed","notifications/prompts/list_changed","notifications/roots/list_changed"] {
  inbound.send(json!({"jsonrpc":"2.0","method":method,"params":{}}).to_string()).await.unwrap();
  tokio::time::timeout(Duration::from_millis(500),rx.recv()).await.expect("notification must be delivered").unwrap();
 }
 client.disconnect().await.unwrap();
}
#[tokio::test] async fn pass_to_pass_response_completes_request() {
 let (transport,inbound,mut outbound)=StdioTransport::new();
 let client=Arc::new(McpClient::new(Box::new(transport),info()));
 client.connect().await.unwrap();
 let clone=client.clone();let pending=tokio::spawn(async move {clone.ping().await});
 let req:serde_json::Value=serde_json::from_str(&outbound.recv().await.unwrap()).unwrap();
 inbound.send(json!({"jsonrpc":"2.0","id":req["id"],"result":{}}).to_string()).await.unwrap();
 tokio::time::timeout(Duration::from_millis(500),pending).await.unwrap().unwrap().unwrap();
 client.disconnect().await.unwrap();
}
