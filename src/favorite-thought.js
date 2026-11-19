// Delivery, rather than counter stock or a waiter's pickup, starts this reaction.
export function needsFavoriteThought(actor,favoriteFoodId,time){
  return !actor.removed&&actor.phase==='eating'&&!!favoriteFoodId&&actor.foodId===favoriteFoodId&&Number.isFinite(actor.eatUntil)&&actor.eatUntil-time>2;
}
