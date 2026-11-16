const LINES={
 favorite:['맛있어요!','역시 이 맛이야!','한 그릇 더…','단골 예약이요!','죽어도 못 잊을 맛!','기운이 살아나요!'],
 eating:['잘 먹겠습니다!','냠냐리…','둘이 먹다 하나가 죽어도..','속이 든든해요!','오늘도 한 끼 해결!','손맛이 좋네요!','다음에 또 올게요!'],
 waiting:['배고파…','밥은 아직인가요?','꼬르륵…','맛있는 냄새가 나네…']
};

// A meal keeps its line for the whole phase, including after save/reload.
export function guestDialogue(actor,{favorite=false,time=null}={}){
 const waiting=actor.phase==='waiting'&&actor.wait>=28&&actor.wait<32;
 const eating=actor.phase==='eating'&&(!Number.isFinite(time)||!Number.isFinite(actor.eatUntil)||actor.eatUntil-time>2);
 const kind=waiting?'waiting':eating?(favorite?'favorite':'eating'):null;
 if(!kind)return null;
 let hash=2166136261;
 for(const char of `${actor.uid}:${actor.zombieId}:${actor.foodId||''}:${kind}`)hash=Math.imul(hash^char.codePointAt(0),16777619)>>>0;
 return LINES[kind][hash%LINES[kind].length];
}
