import {zombie} from './data.js';
import {ASSET_MANIFEST,characterFrame} from './assets.js';

export function createCelebrations(stage){
  const layer=document.createElement('div');layer.className='celebration-layer';
  layer.innerHTML=`<div id="combo-pill" class="combo-graphic" hidden role="status" aria-live="polite"><b></b><img src="/assets/combo-title.png" alt="Combo!" width="2172" height="724"></div><div class="festival-entry" hidden role="status" aria-label="달밤의 축제 시작"><img src="/assets/moon-festival-banner.png" alt="달밤의 축제" width="2172" height="724"></div><div class="guest-arrival-zone" role="status" aria-live="polite" aria-atomic="true"></div>`;
  stage.append(layer);const lights=document.createElement('div');lights.className='festival-lights';lights.hidden=true;lights.setAttribute('aria-hidden','true');lights.innerHTML='<i></i><i></i><i></i>';stage.append(lights);
  const combo=layer.querySelector('.combo-graphic'),festival=layer.querySelector('.festival-entry'),arrivals=layer.querySelector('.guest-arrival-zone'),motion=matchMedia('(prefers-reduced-motion: reduce)'),timers=new Map(),queue=[],shown=new Set();
  let observed=null,previousCombo=0,previousFever=0,showing=false,editing=false;
  function clear(name){clearTimeout(timers.get(name));timers.delete(name);}
  function pop(el,name,duration){
    clear(name);el.getAnimations().forEach(a=>a.cancel());el.hidden=false;
    if(!motion.matches)el.animate([{opacity:0,transform:'translateY(8px) scale(.3) rotate(-8deg)',offset:0},{opacity:1,transform:'translateY(0) scale(1.1) rotate(2deg)',offset:.16},{opacity:1,transform:'translateY(0) scale(1)',offset:.28},{opacity:1,transform:'translateY(0) scale(1)',offset:.82},{opacity:0,transform:'translateY(-20px) scale(1)',offset:1}],{duration,easing:'ease-out',fill:'forwards'});
    timers.set(name,setTimeout(()=>{el.hidden=true;timers.delete(name);if(name==='festival')stage.classList.remove('festival-entering');},duration));
  }
  function nextGuest(){
    if(showing||!queue.length||editing)return;const event=queue.shift(),z=zombie(event.zombieId);if(!z){nextGuest();return;}showing=true;
    const card=document.createElement('div');card.className='guest-arrival';card.setAttribute('aria-label',`새로운 좀비 방문! ${z.name}`);
    const title=document.createElement('img');title.className='arrival-title';title.src='/assets/new-zombie-title.png';title.alt='새로운 좀비 방문!';title.width=2172;title.height=724;
    const portrait=document.createElement('div');portrait.className='arrival-portrait';const sprite=document.createElement('span');sprite.className='arrival-zombie';sprite.setAttribute('aria-hidden','true');
    const frame=characterFrame(z.sprite),asset=ASSET_MANIFEST[frame.key],cols=asset.cols||1,rows=asset.rows||1;
    sprite.style.backgroundImage=`url("${asset.url}")`;sprite.style.backgroundSize=`${cols*100}% ${rows*100}%`;sprite.style.backgroundPosition=`${cols===1?50:frame.index%cols*100/(cols-1)}% ${rows===1?50:Math.floor(frame.index/cols)*100/(rows-1)}%`;
    portrait.append(sprite);const name=document.createElement('strong');name.className='arrival-name';name.textContent=z.name;card.append(title,portrait,name);arrivals.replaceChildren(card);pop(card,'arrival',3400);
    timers.set('arrival-next',setTimeout(()=>{card.remove();showing=false;nextGuest();},3450));
  }
  function sync(state){
    for(const timer of timers.values())clearTimeout(timer);timers.clear();shown.clear();queue.length=0;showing=false;arrivals.replaceChildren();combo.hidden=true;festival.hidden=true;stage.classList.remove('festival-entering');observed=state;previousCombo=state.combo;previousFever=state.feverUntil;
  }
  function update(state,isEditing=false){
    if(state!==observed)sync(state);editing=isEditing;layer.hidden=isEditing;const active=state.feverUntil>state.time;lights.hidden=!active||isEditing;stage.classList.toggle('festival-active',active&&!isEditing);
    if(active&&state.feverUntil>previousFever){combo.hidden=true;stage.classList.add('festival-entering');pop(festival,'festival',1600);}
    else if(!active&&state.combo>0&&state.combo!==previousCombo){combo.querySelector('b').textContent=state.combo;combo.setAttribute('aria-label',`${state.combo} Combo!`);pop(combo,'combo',1600);}
    if(!active){festival.hidden=true;stage.classList.remove('festival-entering');}if(state.combo===0||active)combo.hidden=true;
    previousCombo=state.combo;previousFever=state.feverUntil;if(!isEditing)nextGuest();
  }
  function arrival(event){if(!zombie(event.zombieId)||shown.has(event.id))return;shown.add(event.id);queue.push(event);nextGuest();}
  return{sync,update,arrival};
}
