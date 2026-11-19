import {tutorialActive,tutorialStove,nextTutorial,skipTutorial,reconcileTutorial} from './mayor-tutorial.js';

const COPY={
  'intro-city':['도시에 밤손님이 찾아왔어요','큰일이에요! 도시 곳곳에 허기진 좀비들이 나타났어요.','다음'],
  'intro-full':['배가 부르면 물지 않아요','다행히 알아낸 게 있어요. 배부른 좀비는 사람을 물지 않는답니다. 따뜻한 한 끼가 도시를 지킬 수 있어요.','다음'],
  'intro-restaurant':['한옥 식당을 부탁해요','이 한옥 식당에서 밤손님들에게 음식을 대접해주세요. 제가 첫 요리부터 함께 알려드릴게요.','첫 요리 시작'],
  stove:['첫 요리를 준비해요','표시된 빈 가마솥을 눌러 요리책을 열어보세요. 아래 버튼으로도 열 수 있어요.','가마솥 열기'],
  recipe:['무료 뇌 주먹밥부터','첫 요리책의 뇌 주먹밥을 골라 ‘조리 시작’을 눌러주세요. 비용은 무료, 조리 시간은 12초예요.','뇌 주먹밥 보기'],
  cooking:['맛있게 익는 중이에요','완성되면 가마솥 위에 초록색 완료 표시가 떠요. 그때 가마솥을 눌러 음식을 서빙대로 옮겨주세요.',''],
  ready:['첫 요리가 완성됐어요','초록색 완료 표시가 있는 가마솥을 눌러주세요. 서빙대에 자리가 있으면 완성된 음식을 회수할 수 있어요.','완성 요리 회수'],
  transport:['음식을 옮기고 있어요','음식이 서빙대에 도착하면 직원이 손님에게 가져다줄 거예요. 통로를 비워주세요.',''],
  serving:['직원이 한 끼를 대접해요','직원이 서빙대의 음식을 손님에게 가져다줍니다. 첫 서빙을 함께 기다려봐요. 오래 기다린 손님은 화가 나서 떠나고 도시의 허기가 올라가요.',''],
  finish:['이제 식당을 부탁해요','손님이 식사를 마치면 코인과 경험치를 받아요. 같은 음식을 여러 번 조리하면 숙련도와 레시피 레벨이 올라 새 요리가 열려요. 좋아하는 요리를 숙달하면 새로운 단골도 찾아옵니다. 음식이 떨어지고 도시의 허기가 높아지면 붉은 좀비를 조심하세요. 왼쪽 위의 제 얼굴을 누르면 부탁과 보상을 확인할 수 있어요.','영업 시작'],
};

export function createMayorTutorial({stage,dialog,view,getContext,onStove,onRecipe,onChange}){
  const panel=document.createElement('section');panel.className='mayor-tutorial';panel.hidden=true;panel.tabIndex=0;panel.setAttribute('aria-label','시장님의 첫 영업 안내');
  panel.innerHTML='<svg class="tutorial-mayor" viewBox="650 0 250 174" aria-hidden="true"><image href="/assets/characters.png" width="1254" height="1254"/></svg><div class="tutorial-bubble"><div class="tutorial-copy" aria-live="polite" aria-atomic="true"><small>시장님의 첫 영업 안내</small><h2></h2><small class="tutorial-scroll-note">아래로 스크롤해 계속 읽어주세요.</small><p></p></div><div class="tutorial-actions"><button type="button" class="button primary tutorial-next"></button><button type="button" class="button quiet tutorial-skip">안내 건너뛰기</button></div></div>';
  const marker=document.createElement('div');marker.className='tutorial-target';marker.hidden=true;marker.setAttribute('aria-hidden','true');stage.append(marker,panel);
  const title=panel.querySelector('h2'),text=panel.querySelector('p'),next=panel.querySelector('.tutorial-next'),skip=panel.querySelector('.tutorial-skip');
  let lastKey='',initialFocus=true,observedState=null,observedTutorial=null;
  function finishChange(){lastKey='';onChange();update();if(panel.hidden){const target=dialog.open?dialog.querySelector('.close-button')||dialog.querySelector('[data-act="cook"][data-id="rice"]:not(:disabled)'):view.canvas;target?.focus({preventScroll:true});}else (next.hidden?skip:next).focus({preventScroll:true});}
  next.addEventListener('click',()=>{const {state}=getContext(),step=state.guidedTutorial?.step;if(nextTutorial(state)){finishChange();return;}if(step==='recipe')onRecipe();else if(['stove','ready'].includes(step)){const o=tutorialStove(state);if(o)onStove(o.uid);}update();});
  skip.addEventListener('click',()=>{if(skipTutorial(getContext().state))finishChange();});
  document.addEventListener('keydown',e=>{const c=getContext();if(e.key==='Escape'&&!e.defaultPrevented&&!dialog.open&&!c.edit&&!panel.hidden&&tutorialActive(c.state)){e.preventDefault();skipTutorial(c.state);finishChange();}},true);
  function update(){
    const {state,modal,edit,reconciling,orientationBlocked}=getContext();if(reconcileTutorial(state))onChange();
    if(state!==observedState||state.guidedTutorial!==observedTutorial){observedState=state;observedTutorial=state.guidedTutorial;initialFocus=true;lastKey='';}
    const t=state.guidedTutorial,bookHint=modal?.type==='cookbook'&&t?.step==='recipe';
    const visible=tutorialActive(state)&&!edit&&!reconciling&&!orientationBlocked&&(!modal||bookHint);
    panel.hidden=!visible;marker.hidden=true;if(!visible){for(const button of dialog.querySelectorAll('.tutorial-recipe-target'))button.classList.remove('tutorial-recipe-target');return;}
    const host=bookHint?dialog:stage;if(panel.parentElement!==host)host.insertBefore(panel,host.firstChild);
    panel.classList.toggle('tutorial-in-book',bookHint);panel.dataset.step=t.step;
    const key=t.step+':'+bookHint;
    if(lastKey!==key){const copy=COPY[t.step];title.textContent=copy[0];text.textContent=copy[1];next.textContent=copy[2];next.hidden=!copy[2]||bookHint;panel.scrollTop=0;lastKey=key;}
    const rice=dialog.querySelector('[data-act="cook"][data-id="rice"]');
    for(const button of dialog.querySelectorAll('.tutorial-recipe-target'))if(button!==rice||!bookHint)button.classList.remove('tutorial-recipe-target');
    if(bookHint&&rice)rice.classList.add('tutorial-recipe-target');
    if(initialFocus&&t.step.startsWith('intro-')){initialFocus=false;next.focus({preventScroll:true});}
    if(!bookHint&&['stove','recipe','ready'].includes(t.step)){
      const o=tutorialStove(state),geometry=o&&view.origin&&view.furnitureGeometry(o);
      if(geometry){const point=view.sceneToScreen({x:geometry.x+geometry.w/2,y:geometry.y+geometry.h*.65}),rect=view.canvas.getBoundingClientRect();if(point.x>=24&&point.x<=rect.width-24&&point.y>=24&&point.y<=rect.height-24){marker.hidden=false;marker.style.left=point.x+'px';marker.style.top=point.y+'px';marker.dataset.targetUid=o.uid;}}
    }
  }
  return {update,get panel(){return panel;}};
}
