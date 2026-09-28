use production::sse::SseEventBuffer;
use std::time::{Duration,Instant};
#[test] fn regression_fragmented_long_event_finishes_with_budget() {
 let mut buffer=SseEventBuffer::new();
 let start=Instant::now();
 assert!(buffer.process_bytes(b"data: ").is_empty());
 for _ in 0..2_000_000 {assert!(buffer.process_bytes(b"x").is_empty());}
 let events=buffer.process_bytes(b"\n\n");
 assert_eq!(events.len(),1);assert_eq!(events[0].len(),2_000_006);
 assert!(start.elapsed()<Duration::from_secs(3),"processing fragmented long event exceeded 3 seconds: {:?}",start.elapsed());
}
#[test] fn pass_to_pass_unicode_metadata_clear_and_flush() {
 let bytes="event: delta\r\ndata: {\"text\":\"中文🙂\"}\r\n\r\n".as_bytes();
 for width in [1,2,3,7,64] {
  let mut buffer=SseEventBuffer::new();let mut events=Vec::new();
  for part in bytes.chunks(width){events.extend(buffer.process_bytes(part));}
  events.extend(buffer.flush());assert_eq!(events,vec!["event: delta\ndata: {\"text\":\"中文🙂\"}"]);
  buffer.process_bytes(b"data: stale");buffer.clear();
  assert_eq!(buffer.process_bytes(b"data:[DONE]\n\n"),vec!["data:[DONE]"]);
 }
}
