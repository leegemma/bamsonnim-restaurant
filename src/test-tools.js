import {RECIPES} from './data.js';

// A repeatable test preset, without replaying rewards or resetting the restaurant.
export function restoreBibimbapMastery(state){
  const cutoff=RECIPES.findIndex(r=>r.id==='bibimbap');
  const completed=RECIPES.slice(0,cutoff+1).filter(r=>!r.event);
  state.mastery=Object.fromEntries(completed.map(r=>[r.id,r.milestones.at(-1)]));
  state.knownRecipes=Object.fromEntries(completed.map(r=>[r.id,true]));
}
