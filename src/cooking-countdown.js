export const COOKING_TIMER_FONT='700 12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
export function cookingCountdown(seconds){
  const total=Math.max(0,Math.ceil(seconds));
  return `${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;
}
