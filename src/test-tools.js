import {RECIPES} from './data.js';

// A repeatable test preset, without replaying rewards or resetting the restaurant.
export function restoreBibimbapMastery(state){
  const cutoff=RECIPES.find(r=>r.id==='bibimbap').required;
  const completed=RECIPES.filter(r=>!r.event&&r.required<=cutoff);
  state.mastery=Object.fromEntries(completed.map(r=>[r.id,r.milestones.at(-1)]));
  state.knownRecipes=Object.fromEntries(completed.map(r=>[r.id,true]));
}
