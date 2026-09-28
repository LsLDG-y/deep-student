use production::mastery::*;
#[test] fn regression_learning_steps_stay_ahead_of_mastery_boost() {
 let now=1_800_000_000_000i64;
 let mut cards=vec![("weak_new",0,Some(0.0),now),("weak_review",2,Some(0.1),now-60000),("learning",1,Some(1.0),now-1000),("relearning",3,None,now-2000)];
 cards.sort_by_key(|(_,state,score,due)|queue_sort_key(*state,*score,*due));
 assert_eq!(cards.iter().map(|x|x.0).collect::<Vec<_>>(),vec!["relearning","learning","weak_new","weak_review"]);
}
#[test] fn pass_to_pass_bias_is_bounded() {
 let now=1_800_000_000_000i64;
 assert_eq!(apply_mastery_due_bias(0.0,now,now+600000),now+600000);
 assert_eq!(apply_mastery_due_bias(0.5,now,now+86_400_000),now+86_400_000);
 assert!(apply_mastery_due_bias(0.0,now,now+10*86_400_000)>=now+7*86_400_000);
 assert_eq!(mastery_queue_priority_key(None,now),now);
}
