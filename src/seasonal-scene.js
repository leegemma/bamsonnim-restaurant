export const christmasActive=state=>state?.events?.christmas==='active';

// Optional seasonal artwork never prevents the original courtyard rendering.
export function seasonalBackdrop(state,images={}){
 const active=christmasActive(state),winter=!!(active&&images.nightWinter);
 return{key:winter?'nightWinter':'night',image:winter?images.nightWinter:images.night||null,winter,fallback:active&&!winter,normalFx:!winter,fireflies:!winter};
}
