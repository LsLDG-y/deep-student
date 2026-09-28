use production::mcp::client::*;
use serde_json::json;
#[test] fn regression_optional_params_do_not_send_null() {
 for method in ["tools/list","resources/list","ping"] {
  let r=JsonRpcRequest{jsonrpc:"2.0".into(),method:method.into(),params:None,id:Some(json!(11))};
  assert!(serde_json::to_value(r).unwrap().get("params").is_none());
 }
 let n=JsonRpcNotification{jsonrpc:"2.0".into(),method:"notifications/initialized".into(),params:None};
 assert!(serde_json::to_value(n).unwrap().get("params").is_none());
}
#[test] fn pass_to_pass_explicit_params_preserved() {
 for params in [json!({}),json!({"x":null}),json!([1,2])] {
  let r=JsonRpcRequest{jsonrpc:"2.0".into(),method:"test".into(),params:Some(params.clone()),id:Some(json!(1))};
  assert_eq!(serde_json::to_value(r).unwrap()["params"],params);
 }
 let r:JsonRpcRequest=serde_json::from_value(json!({"jsonrpc":"2.0","method":"ping","id":1})).unwrap();
 assert!(r.params.is_none());
}
