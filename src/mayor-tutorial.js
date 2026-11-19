import {furniture} from './data.js';

export const TUTORIAL_STEPS=['intro-city','intro-full','intro-restaurant','stove','recipe','cooking','ready','transport','serving','finish','done','skipped'];
export const newTutorial=()=>({version:1,step:'intro-city',stoveId:null});
export function restartTutorial(s){s.guidedTutorial=newTutorial();}
export const tutorialActive=s=>s.guidedTutorial?.version===1&&!['done','skipped'].includes(s.guidedTutorial.step);
export function validateTutorial(s){
  // Missing means an older save. Its numeric tutorial and progress stay intact.
  const t=s.guidedTutorial;if(t===undefined)return;
  if(!t||t.version!==1||!TUTORIAL_STEPS.includes(t.step)||(t.stoveId!==null&&typeof t.stoveId!=='string'))throw new Error('처음 안내 정보가 손상되었습니다.');
}
export function nextTutorial(s){
  if(!tutorialActive(s))return false;const t=s.guidedTutorial;
  const next={'intro-city':'intro-full','intro-full':'intro-restaurant','intro-restaurant':'stove',finish:'done'}[t.step];
  if(!next)return false;t.step=next;return true;
}
export function skipTutorial(s){if(!tutorialActive(s))return false;s.guidedTutorial.step='skipped';return true;}
export function tutorialStove(s){
  const t=s.guidedTutorial,stoves=s.objects.filter(o=>furniture(o.type)?.category==='stove');
  const usable=o=>!o.cook||o.cook.foodId==='rice'&&s.time<o.cook.spoilAt;
  return stoves.find(o=>o.uid===t?.stoveId&&usable(o))||stoves.find(o=>o.cook?.foodId==='rice'&&usable(o))||stoves.find(o=>!o.cook)||null;
}
export function chooseTutorialStove(s,id){
  if(!tutorialActive(s)||!['stove','recipe'].includes(s.guidedTutorial.step))return;
  const o=s.objects.find(o=>o.uid===id);if(!o||furniture(o.type)?.category!=='stove'||o.cook)return;
  Object.assign(s.guidedTutorial,{step:'recipe',stoveId:id});
}
export function tutorialCooked(s,id,foodId){
  if(tutorialActive(s)&&foodId==='rice'&&['stove','recipe'].includes(s.guidedTutorial.step))Object.assign(s.guidedTutorial,{step:'cooking',stoveId:id});
}
export function tutorialStocked(s,foodId){
  if(tutorialActive(s)&&foodId==='rice'&&['cooking','ready','transport'].includes(s.guidedTutorial.step))s.guidedTutorial.step='serving';
}
export function tutorialServed(s,foodId){
  if(tutorialActive(s)&&foodId==='rice'&&['serving','transport'].includes(s.guidedTutorial.step))s.guidedTutorial.step='finish';
}
export function reconcileTutorial(s){
  if(!tutorialActive(s))return false;const t=s.guidedTutorial,before=JSON.stringify(t);
  if(t.step.startsWith('intro-')||t.step==='finish')return false;
  if(t.step==='serving'){
    const available=s.objects.some(o=>o.foodId==='rice'&&o.stock>0)||s.waiters.some(w=>w.task?.foodId==='rice')||s.transfers.some(x=>x.foodId==='rice');
    if(!available){t.step='stove';t.stoveId=null;}
    return before!==JSON.stringify(t);
  }
  const o=tutorialStove(s);
  if(o?.cook?.foodId==='rice'){
    t.stoveId=o.uid;t.step=o.cook.collecting?'transport':s.time>=o.cook.spoilAt?'recipe':s.time>=o.cook.readyAt?'ready':'cooking';
  }else if(['cooking','ready','transport'].includes(t.step)){
    const riceStock=s.objects.some(o=>furniture(o.type)?.category==='server'&&o.foodId==='rice'&&o.stock>0);
    t.step=riceStock?'serving':'stove';t.stoveId=null;
  }else if(t.step==='recipe'&&(!o||o.cook)){t.step='stove';t.stoveId=null;}
  return before!==JSON.stringify(t);
}
