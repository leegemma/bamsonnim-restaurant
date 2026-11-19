import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as E from '../src/engine.js';
import {RECIPES,BOOKS,ZOMBIES,SAVE_VERSION,SAVE_KEY,recipe,zombie} from '../src/data.js';

const SNACK_APPROVAL=JSON.parse(await readFile(new URL('./fixtures/snack-balance-approved.json',import.meta.url),'utf8'));
const APPROVED_BALANCE=new Map(SNACK_APPROVAL.rows.map(({id,...fields})=>[id,fields]));
// Apply only the five explicitly approved numeric fields to historical expectations.
// Only these user-requested classifications differ from the historical records.
const RELOCATED_TO_FIRST_BOOK=new Set(['sausage','bibimbap','gimbap','spider-mandu','tongue-sotteok','worm-tteokgalbi','nurungji-chicken-baeksuk','fried-ears','hair-seaweed-soup','xmas-soup']);
// Frozen records from the release before content expansion.
const BASELINE_RECIPES=[
 {"id":"rice","name":"뇌 주먹밥","description":"한 입 먹으면 머리가 맑아지는… 기분입니다.","duration":12,"servings":6,"coins":0,"hearts":0,"sprite":0,"book":0,"required":0,"price":1,"portion":1,"milestones":[3,8,10]},
 {"id":"skewer","name":"손가락 떡꼬치","description":"손가락으로 꼽을 만큼 맛있는 꼬치.","duration":30,"servings":10,"coins":1,"hearts":0,"sprite":1,"book":0,"required":3,"price":1,"portion":1,"milestones":[3,8,10]},
 {"id":"soup","name":"눈알 어묵탕","description":"국물과 눈이 마주쳐도 놀라지 마세요.","duration":120,"servings":30,"coins":3,"hearts":0,"sprite":2,"book":0,"required":6,"price":1,"portion":2,"milestones":[3,8,10]},
 {"id":"tteok","name":"손가락 떡볶이","description":"쫀득한 손가락에 매콤한 양념을 입혔어요.","duration":300,"servings":45,"coins":5,"hearts":0,"sprite":3,"book":0,"required":9,"price":1,"portion":2,"milestones":[3,8,10]},
 {"id":"sausage","name":"선지 눈알 순대","description":"한 접시가 당신을 빤히 바라봅니다.","duration":300,"servings":30,"coins":0,"hearts":1,"sprite":4,"book":1,"required":12,"price":4,"portion":2,"milestones":[3,8,10]},
 {"id":"noodle","name":"머리카락 잡채","description":"빗 하나 꽂아낸 가늘고 긴 면발. 출처는 묻지 마세요.","duration":1800,"servings":120,"coins":10,"hearts":0,"sprite":5,"book":1,"required":15,"price":1,"portion":6,"milestones":[2,5,8]},
 {"id":"gimbap","name":"팔뚝 김밥","description":"팔뚝 단면을 밥과 김으로 돌돌. 다른 속재료는 없어요.","duration":1800,"servings":175,"coins":0,"hearts":3,"sprite":6,"book":1,"required":18,"price":2,"portion":9,"milestones":[2,5,8]},
 {"id":"cookie","name":"입술 약과","description":"달콤한 입맞춤을 곁들였습니다.","duration":3600,"servings":160,"coins":15,"hearts":0,"sprite":7,"book":1,"required":21,"price":1,"portion":8,"milestones":[2,5,8]},
 {"id":"bibimbap","name":"위장 비빔밥","description":"속이 든든해지는 특별한 비빔밥.","duration":7200,"servings":700,"coins":0,"hearts":6,"sprite":8,"book":2,"required":24,"price":1,"portion":35,"milestones":[2,5,8]},
 {"id":"liver","name":"간장 간 조림","description":"간이 딱 맞는, 간 요리입니다.","duration":21600,"servings":300,"coins":0,"hearts":6,"sprite":9,"book":2,"required":27,"price":2,"portion":15,"milestones":[1,3,5]},
 {"id":"pancake","name":"발가락 감자전","description":"발끝까지 바삭하게 부쳤습니다.","duration":28800,"servings":700,"coins":25,"hearts":0,"sprite":10,"book":2,"required":30,"price":1,"portion":35,"milestones":[1,3,5]},
 {"id":"kimchi","name":"묵은지 간 찜","description":"오래 묵힐수록 깊어지는 수상한 맛.","duration":43200,"servings":950,"coins":50,"hearts":0,"sprite":11,"book":2,"required":33,"price":1,"portion":48,"milestones":[1,3,5]},
 {"id":"xmas-rice","name":"해골 성탄 떡","description":"다시 찾아올 겨울을 위한 달콤한 기억.","duration":120,"servings":40,"coins":15,"hearts":0,"sprite":12,"book":3,"required":0,"price":2,"portion":2,"milestones":[3,8,10],"event":"christmas"},
 {"id":"xmas-soup","name":"유령 만둣국","description":"뜨끈한 국물에 메리 크리스마스.","duration":300,"servings":60,"coins":25,"hearts":0,"sprite":13,"book":3,"required":3,"price":3,"portion":3,"milestones":[3,8,10],"event":"christmas"},
];
const BASELINE_BOOKS=[
 {"name":"무덤 앞 분식집","subtitle":"작고 소중한 첫 끼","color":"#ba6a43","symbol":"一"},
 {"name":"수상한 한 상","subtitle":"단골을 부르는 손맛","color":"#76885c","symbol":"二"},
 {"name":"밤 깊은 잔칫상","subtitle":"오래 기다린 만큼","color":"#817196","symbol":"三"},
 {"name":"오싹한 성탄절","subtitle":"한겨울의 특별한 손님","color":"#648d81","symbol":"冬","event":"christmas"},
];
const BASELINE_ZOMBIES=[
 {"id":"wanderer","name":"허기진 행인","favorite":null,"description":"밤이 되면 어슬렁. 배가 고픈 것뿐이에요.","sprite":0,"level":1},
 {"id":"student","name":"야자 학생","favorite":"rice","description":"일자 앞머리, 안경과 양갈래 머리. 오늘도 야자는 끝나지 않았어요.","sprite":1,"level":2},
 {"id":"scholar","name":"졸린 선비","favorite":null,"description":"갓은 삐뚤어져도 예의는 바릅니다.","sprite":2,"level":3},
 {"id":"office","name":"야근 직장인","favorite":"skewer","description":"퇴근은 했지만 영혼은 아직 회사에.","sprite":3,"level":4},
 {"id":"guard","name":"길 잃은 포졸","favorite":null,"description":"순찰을 돌다가 맛있는 냄새를 따라왔어요.","sprite":4,"level":5},
 {"id":"rider","name":"새벽 배달원","favorite":"soup","description":"민트색 헬멧과 배달박스. 오늘은 배달 말고 먹으러 왔습니다.","sprite":5,"level":6},
 {"id":"hostess","name":"수다쟁이 주모","favorite":"tteok","description":"볼의 커다란 왕점만큼 손도 큽니다.","sprite":6,"level":7},
 {"id":"hiker","name":"정상 찍은 등산객","favorite":null,"description":"정상에서 내려오니 세상이 좀 달라졌네요.","sprite":7,"level":8},
 {"id":"merchant","name":"장터 보부상","favorite":"sausage","description":"봇짐 속에도 없는 맛을 찾으러 왔어요.","sprite":8,"level":9},
 {"id":"nurse","name":"퇴근한 간호사","favorite":null,"description":"다른 사람 돌보기 전에 밥부터 먹어요.","sprite":9,"level":10},
 {"id":"dancer","name":"춤추는 탈꾼","favorite":"noodle","description":"한 젓가락 먹고 어깨춤이 절로.","sprite":10,"level":11},
 {"id":"bride","name":"전통혼례복 신부","favorite":"gimbap","description":"연두색 원삼, 붉은 치마와 족두리. 곱게 차려입고 한 줄 더 주세요.","sprite":11,"level":12},
 {"id":"idol","name":"케이팝 아이돌","favorite":"cookie","description":"마이크를 들고 입장! 오늘 앙코르는 약과예요.","sprite":12,"level":13},
 {"id":"hairdresser","name":"동네 미용사","favorite":null,"description":"앞머리 정리는 식사 후에 해드려요.","sprite":13,"level":14},
 {"id":"prince","name":"세자","favorite":"bibimbap","description":"작은 키에 왕실 예복. 입맛은 아주 높답니다.","sprite":14,"level":15},
 {"id":"delinquent","name":"일진 고딩","favorite":"noodle","description":"앞머리 롤, 교복 조끼와 넥타이. 봉고데기와 빗은 절대 놓지 않아요.","sprite":16,"level":16},
 {"id":"runner","name":"러닝 좀비","favorite":"rice","description":"헤어밴드와 러닝 조끼, 물통과 에너지젤. 오늘도 완주는 식당 앞까지.","sprite":17,"level":17},
 {"id":"tennis","name":"테니스 좀비","favorite":null,"description":"테니스채와 공, 겨땀에 젖은 테니스복. 듀스보다 밥이 먼저예요.","sprite":18,"level":18},
 {"id":"sauna","name":"찜질방 아줌마","favorite":null,"description":"양머리 수건 아래 젖은 뽀글머리. 황토색 찜방복, 락커키, 맥반석계란과 파란 뚜껑 커피통.","sprite":19,"level":19},
 {"id":"returning","name":"복학생","favorite":"gimbap","description":"올리브색 깔깔이에 보라색 티셔츠, 체크 이불. 오늘 수업은… 내일 생각할래요.","sprite":20,"level":20},
 {"id":"diver","name":"해녀","favorite":"soup","description":"잠수안경과 검은 잠수복, 초록 그물망과 테왁. 오늘 물질은 이만하면 됐어요.","sprite":21,"level":21},
 {"id":"ghost","name":"처녀귀신","favorite":"cookie","description":"피칠갑한 흰 소복과 긴 검은 머리. 한이 아니라 허기가 졌습니다.","sprite":22,"level":22},
 {"id":"grandmother","name":"삼신할머니","favorite":null,"description":"비녀 없는 쪽진 흰 머리와 보따리, 지팡이. 밥은 먹고 다니느냐고 물어요.","sprite":23,"level":23},
 {"id":"tiger","name":"멍한 호랑이","favorite":"rice","description":"한입 먹어 팥소가 보이는 찹쌀떡을 쥐고 두 발로 어슬렁. 무섭게 생기려다 깜빡했어요.","sprite":24,"level":24},
 {"id":"farmhand","name":"머슴","favorite":"kimchi","description":"걷은 소매와 해진 작업 한복. 일은 잠깐 미루고 새참부터.","sprite":25,"level":25},
 {"id":"hahoe","name":"하회탈","favorite":null,"description":"비대칭 웃음의 갈색 하회탈. 탈 아래에는 수상한 초록 손님이 있어요.","sprite":26,"level":26},
 {"id":"female-idol","name":"백금발 여자 아이돌","favorite":"cookie","description":"무릎까지 오는 백금발 양갈래. 흰 버클 무대 의상과 체인, 검은 끈 롱부츠.","sprite":27,"level":27},
 {"id":"dokkaebi","name":"도깨비","favorite":"pancake","description":"빨간 피부에 뿔 두 개, 노란 무늬옷과 돌기 방망이. 밥 나와라 뚝딱!","sprite":28,"level":28},
 {"id":"kongjwi","name":"가난한 콩쥐","favorite":"rice","description":"해진 붉은 치마와 땋은 머리, 낡은 바가지. 작은 개구리와 언제나 함께 다녀요.","sprite":29,"level":29},
 {"id":"santa-scholar","name":"산타 선비","favorite":"xmas-rice","description":"갓 대신 산타 모자. 선물은 밥 먹고 드립니다.","sprite":2,"level":1,"event":"christmas"},
 {"id":"snow-bride","name":"눈꽃 신부","favorite":"xmas-soup","description":"눈 내리는 밤에만 처음 만날 수 있어요.","sprite":11,"level":2,"event":"christmas"},
];
const ADDITIONS=[
 ["gopchang-jeongol",16,4,36,7200,200,75,0],
 ["worm-nakgopsae",17,4,39,21600,375,175,0],
 ["spider-mandu",18,4,42,1800,250,0,2],
 ["human-jokbal",19,4,45,28800,400,100,0],
 ["yukgaejang",20,5,48,64800,1200,75,0],
 ["human-suyuk",21,5,51,28800,400,100,0],
 ["worm-jeotgal",22,5,54,600,50,20,0],
 ["hell-dakbokkeum",23,5,57,43200,750,800,0],
 ["hair-seaweed-soup",24,6,60,900,220,0,4],
 ["bone-dogani-tang",25,6,63,300,40,50,0],
 ["cartilage-muchim",26,6,66,1800,200,0,3],
 ["human-rib-galbitang",27,6,69,43200,500,1000,0],
 ["spine-gamjatang",28,7,72,43200,700,375,0],
 ["human-samgyeopsal",29,7,75,129600,1300,800,0],
 ["blood-haejangguk",30,7,78,300,30,0,1],
 ["neck-steak",31,7,81,43200,600,500,0],
 ["human-leg-kalguksu",32,8,84,120,20,0,1],
 ["nurungji-chicken-baeksuk",33,8,87,43200,750,800,0],
 ["human-kimchi-jjim",34,8,90,43200,950,50,0],
 ["eyeball-squid-sundae",35,8,93,7200,900,0,6],
 ["tongue-sotteok",36,9,96,1800,105,60,0],
 ["worm-tteokgalbi",37,9,99,1800,80,60,0],
 ["thin-human-belly",38,9,102,129600,1300,800,0],
 ["grilled-tongue",39,9,105,108000,600,900,0],
 ["eyeball-bungeoppang",40,10,108,30,10,1,0],
 ["brain-walnut-cake",41,10,111,720,100,0,3],
 ["ghost-ppeongtwigi",42,10,114,18000,250,0,6],
 ["fried-ears",43,10,117,28800,500,0,2],
 ["hell-pizza-bun",44,10,120,420,154,0,3],
];
const BOOK_CONTENTS=[
 ["gopchang-jeongol","worm-nakgopsae","spider-mandu","human-jokbal"],
 ["yukgaejang","human-suyuk","worm-jeotgal","hell-dakbokkeum"],
 ["hair-seaweed-soup","bone-dogani-tang","cartilage-muchim","human-rib-galbitang"],
 ["spine-gamjatang","human-samgyeopsal","blood-haejangguk","neck-steak"],
 ["human-leg-kalguksu","nurungji-chicken-baeksuk","human-kimchi-jjim","eyeball-squid-sundae"],
 ["tongue-sotteok","worm-tteokgalbi","thin-human-belly","grilled-tongue"],
 ["eyeball-bungeoppang","brain-walnut-cake","ghost-ppeongtwigi","fried-ears","hell-pizza-bun"],
];

function suppliedGame(level=1,status='upcoming',seed=67291,album={}){
 const s=E.newGame(1000);s.level=level;s.coins=1e9;s.hearts=1e6;s.seed=seed;s.events.christmas=status;s.album={...album};Object.assign(s.objects.find(o=>o.type==='server'),{foodId:'rice',stock:1000});s.spawnIn=0;return s;
}
function firstSpawn(level,status,seed,album){const s=suppliedGame(level,status,seed,album);E.advance(s,.25);s.spawnIn=1e9;return s;}
function findSpawn(id,level,status='upcoming',album={}){for(let seed=0;seed<1024;seed++){const s=firstSpawn(level,status,seed,album);if(s.customers.some(c=>c.zombieId===id))return{seed,s};}assert.fail(`${id} did not spawn at its unlocked level`);}

test('legacy recipe fields and book identities stay compatible except the explicit first-book relocations',()=>{
 assert.equal(SAVE_VERSION,1);assert.equal(SAVE_KEY,'bamsonnim.restaurant.v1');assert.deepEqual(RECIPES.slice(0,14),BASELINE_RECIPES.map(r=>{const relocated=RELOCATED_TO_FIRST_BOOK.has(r.id)?{...r,book:0}:r;if(r.id!=='xmas-soup')return relocated;const {event,...ordinary}=relocated;return {...ordinary,description:'뜨끈한 국물에 둥둥 떠다니는 유령 만두.'};}).map(r=>({...r,...APPROVED_BALANCE.get(r.id)})));assert.deepEqual(BOOKS.slice(0,4).map(({cover,...book})=>book),BASELINE_BOOKS);
 for(const old of BASELINE_ZOMBIES){const current=zombie(old.id);assert.ok(current);if(old.id==='hiker'){const {description,...rest}=current,{description:previous,...before}=old;assert.deepEqual(rest,before);for(const token of ['검정 짧은 머리','붉은 렌즈 선글라스','주황','자주','회색 상의','검정 바지','배낭','등산 스틱'])assert.ok(description.includes(token));}else assert.deepEqual(current,old);}
});

test('the expanded recipe registry has forty-two normal and one event recipe with valid runtime fields',()=>{
 assert.equal(RECIPES.length,43);assert.equal(RECIPES.filter(r=>!r.event).length,42);assert.equal(RECIPES.filter(r=>r.event==='christmas').length,1);assert.equal(new Set(RECIPES.map(r=>r.id)).size,43);assert.equal(new Set(RECIPES.map(r=>r.sprite)).size,43);
 const allowed=new Set(['id','name','description','duration','servings','coins','hearts','sprite','book','required','price','portion','milestones','event']);
 for(const r of RECIPES){assert.match(r.id,/^[a-z][a-z0-9-]*$/);for(const key of ['name','description'])assert.ok(typeof r[key]==='string'&&r[key].trim());for(const key of ['duration','servings','coins','hearts','sprite','book','required','price','portion'])assert.ok(Number.isSafeInteger(r[key])&&r[key]>=(['duration','servings','price','portion'].includes(key)?1:0),`${r.id}.${key}`);assert.ok(r.book<BOOKS.length);assert.ok(r.portion<=r.servings);assert.equal(r.milestones.length,3);assert.ok(r.milestones.every((n,i)=>Number.isSafeInteger(n)&&n>0&&(!i||n>r.milestones[i-1])));for(const key of Object.keys(r))assert.ok(allowed.has(key),`${r.id} includes non-runtime ${key}`);}
 assert.equal(RECIPES.some(r=>r.sprite===14||r.sprite===15),false,'reserved resource cells 14/15 stay unassigned');
});

test('additions retain legacy derived fields and sprite slots, with only approved balance values overridden',()=>{
 assert.equal(ADDITIONS.length,29);assert.deepEqual(RECIPES.slice(14).map(r=>[r.id,r.sprite,r.book,r.required,r.duration,r.servings,r.coins,r.hearts]),ADDITIONS.map(([id,sprite,book,required,duration,servings,coins,hearts])=>{const values=APPROVED_BALANCE.get(id);return[id,sprite,RELOCATED_TO_FIRST_BOOK.has(id)?0:book,required,values?.duration??duration,values?.servings??servings,values?.coins??coins,values?.hearts??hearts];}));assert.deepEqual(RECIPES.slice(14).map(r=>r.sprite),Array.from({length:29},(_,i)=>16+i));
 for(const r of RECIPES.slice(14)){const old=ADDITIONS.find(row=>row[0]===r.id),[, , , ,duration,servings,coins,hearts]=old;assert.equal(r.event,undefined);assert.equal(r.price,APPROVED_BALANCE.get(r.id)?.price??(hearts?Math.max(1,Math.ceil(hearts*100/servings)):Math.max(1,Math.ceil(coins*1.3/servings))));assert.equal(r.portion,Math.max(1,Math.round(servings/20)));assert.deepEqual(r.milestones,duration<=600?[3,8,10]:duration<=7200?[2,5,8]:duration<=43200?[1,3,5]:[1,2,3]);}
});

test('unpublished menu names and IDs describe the selected art without changing its recipe slots',()=>{
 const expected=[
  ['yukgaejang','피 육개장','피처럼 붉은 국물에 고기와 고사리, 숙주와 대파를 듬뿍 담았어요.'],
  ['hell-dakbokkeum','지옥 닭볶음탕','닭고기와 감자, 당근을 피처럼 붉은 양념에 끓인 뜨거운 한 냄비.'],
  ['nurungji-chicken-baeksuk','누룽지 닭백숙','푹 익힌 닭과 구수한 황금빛 누룽지. 폐허의 밤에도 속은 든든하게.'],
  ['eyeball-squid-sundae','눈알 오징어순대','오징어 속 밥과 채소 사이로 핏줄 선 눈알 두 개가 서로 다른 곳을 봐요.'],
  ['eyeball-bungeoppang','눈알 붕어빵','황금빛 물고기 모양 과자와 팥소. 커다란 눈동자는 서로 다른 곳을 봅니다.'],
  ['ghost-ppeongtwigi','유령 납작 뻥튀기','얇고 납작한 둥근 뻥튀기에 작은 유령 얼굴이 나타났어요.'],
  ['hell-pizza-bun','지옥 피자호빵','둥근 호빵을 가르면 붉은 피자 소스와 치즈, 작은 거미가 빼꼼.'],
 ];
 for(const [id,name,description]of expected)assert.deepEqual([recipe(id)?.name,recipe(id)?.description],[name,description]);
 for(const id of ['human-dakbokkeum','hair-chicken-baeksuk','tentacle-sundae','blood-bungeoppang','flat-blood-ppeong','tongue-pizza-bun'])assert.equal(recipe(id),undefined);
 for(const token of ['노란 알배추','쌈장'])assert.ok(recipe('human-suyuk').description.includes(token));assert.ok(recipe('blood-haejangguk').description.includes('사람 피 선지'));assert.ok(recipe('spine-gamjatang').description.includes('사람 갈비뼈'));assert.ok(recipe('grilled-tongue').description.includes('소의 혀'));assert.equal(recipe('grilled-tongue').description.includes('사람'),false);assert.ok(recipe('human-leg-kalguksu').description.includes('사람다리'));
});

test('appended books retain unrelocated recipes and the seasonal book retains its remaining Christmas recipe',()=>{
 assert.equal(BOOKS.length,11);for(const b of BOOKS){for(const key of ['name','subtitle','symbol'])assert.ok(typeof b[key]==='string'&&b[key].trim());assert.match(b.color,/^#[0-9a-f]{6}$/i);}
 assert.deepEqual(Array.from({length:7},(_,i)=>RECIPES.filter(r=>r.book===i+4).map(r=>r.id)),BOOK_CONTENTS.map(ids=>ids.filter(id=>!RELOCATED_TO_FIRST_BOOK.has(id))));assert.deepEqual(RECIPES.filter(r=>r.book===3).map(r=>r.id),['xmas-rice']);assert.equal(BOOKS[3].event,'christmas');
});

test('normal mastery unlocks the complete chain through required level 120 without a seasonal recipe',()=>{
 const s=E.newGame();s.events.christmas='ended';const normal=RECIPES.filter(r=>!r.event).toSorted((a,b)=>a.required-b.required);assert.equal(E.recipeLevel(s),0);
 for(const r of normal){assert.equal(E.canCook(s,r),true,`${r.id} is reachable at mastery level ${E.recipeLevel(s)}`);s.mastery[r.id]=r.milestones.at(-1);}
 assert.equal(Math.max(...normal.map(r=>r.required)),120);assert.equal(E.recipeLevel(s),126);assert.ok(normal.every(r=>E.canCook(s,r)));assert.ok(RECIPES.filter(r=>r.event).every(r=>!E.canCook(s,r)));assert.equal(s.mastery['xmas-rice'],undefined);assert.equal(s.mastery['xmas-soup'],recipe('xmas-soup').milestones.at(-1));
});

test('existing v1 saves keep old mastery, inventory, albums, event progress and money',()=>{
 const raw=E.newGame(1000);raw.level=32;raw.coins=31415;raw.hearts=9;raw.xp=17;raw.events.christmas='ended';raw.eventBooks.christmas=true;raw.mastery=Object.fromEntries(BASELINE_RECIPES.map(r=>[r.id,r.milestones.at(-1)]));raw.knownRecipes=Object.fromEntries(BASELINE_RECIPES.map(r=>[r.id,true]));raw.album=Object.fromEntries(BASELINE_ZOMBIES.map((z,i)=>[z.id,i+1]));Object.assign(raw.objects.find(o=>o.type==='server'),{foodId:'kimchi',stock:37});Object.assign(raw.objects.find(o=>o.type==='stove'),{cook:{foodId:'xmas-soup',started:0,readyAt:300,spoilAt:900}});const source=JSON.stringify(raw),loaded=E.validateSave(raw);assert.equal(JSON.stringify(raw),source);assert.deepEqual(loaded,raw);assert.equal(Object.keys(loaded.mastery).length,14);assert.equal(Object.keys(loaded.album).length,31);
});

test('every new recipe cooks and transfers the correct quantity through the unchanged engine',()=>{
 for(const r of RECIPES.slice(14)){const s=E.newGame();s.coins=1e9;s.hearts=1e6;s.spawnIn=1e9;s.mastery=Object.fromEntries(RECIPES.filter(r=>!r.event).map(r=>[r.id,r.milestones.at(-1)]));const stove=s.objects.find(o=>o.type==='stove'),coins=s.coins,hearts=s.hearts;assert.equal(E.cook(s,stove.uid,r.id),null,r.id);assert.equal(s.coins,coins-r.coins);assert.equal(s.hearts,hearts-r.hearts);assert.equal(stove.cook.readyAt-stove.cook.started,r.duration);s.time=stove.cook.readyAt;assert.equal(E.collect(s,stove.uid),null,r.id);E.advance(s,20);const counter=s.objects.find(o=>o.type==='server');assert.equal(counter.foodId,r.id);assert.equal(counter.stock,r.servings);assert.equal(s.stats.cooked,1);assert.equal(s.knownRecipes[r.id],true);assert.equal(stove.cook,undefined);assert.equal(s.transfers.length,0);}
});

test('the thirty-eight guests preserve legacy identities and append only three approved visitors',()=>{
 assert.equal(ZOMBIES.length,38);assert.equal(ZOMBIES.filter(z=>!z.event).length,35);assert.equal(ZOMBIES.filter(z=>z.event==='christmas').length,3);assert.equal(new Set(ZOMBIES.map(z=>z.id)).size,38);
 assert.equal(ZOMBIES.slice(0,35).length,35);assert.ok(ZOMBIES.slice(0,35).every(z=>z.sprite<=33));
 assert.deepEqual(ZOMBIES.slice(35).map(z=>z.id),['nz-baduk-player','nz-golf-man','nz-futsal-man']);
 for(const z of ZOMBIES){assert.match(z.id,/^[a-z][a-z0-9-]*$/);for(const key of ['name','description'])assert.ok(typeof z[key]==='string'&&z[key].trim());assert.ok(Number.isSafeInteger(z.level)&&z.level>=1);assert.ok(Number.isSafeInteger(z.sprite)&&z.sprite>=0&&z.sprite<=36);assert.ok(z.favorite===null||recipe(z.favorite));}
 for(const [id,name,level,sprite]of [['shaman','무당',30,31],['lounge-singer','밤무대 가수',31,32],['clown','삐에로',32,33]]){assert.deepEqual([zombie(id).name,zombie(id).level,zombie(id).sprite,zombie(id).favorite,zombie(id).event],[name,level,sprite,null,undefined]);for(let seed=0;seed<32;seed++)assert.equal(firstSpawn(level-1,'upcoming',seed).customers.some(c=>c.zombieId===id),false);assert.ok(findSpawn(id,level).s.customers.some(c=>c.zombieId===id));}
 const santa=zombie('santa');assert.deepEqual([santa.name,santa.level,santa.sprite,santa.favorite,santa.event],['벌레 선물 산타',1,30,null,'christmas']);
});

test('Santa first appears during Christmas and enters the album only after an online payment',()=>{
 for(const status of ['upcoming','ended'])for(let seed=0;seed<64;seed++)assert.equal(firstSpawn(1,status,seed).customers.some(c=>c.zombieId==='santa'),false);
 const {s,seed}=findSpawn('santa',1,'active');assert.equal(s.album.santa,undefined);assert.equal(s.stats.fed.santa,undefined);E.advance(s,50);assert.equal(s.album.santa,1);assert.equal(s.stats.fed.santa,1);assert.equal(s.notifications.filter(n=>n.type==='payment').length,1);
 const returning=firstSpawn(1,'ended',seed,{santa:1});assert.ok(returning.customers.some(c=>c.zombieId==='santa'));assert.equal(returning.album.santa,1);E.advance(returning,50);assert.equal(returning.album.santa,2);assert.equal(returning.stats.fed.santa,1);assert.equal(returning.events.christmas,'ended');
});

test('new guest and recipe IDs round-trip while offline Santa payments do not register a discovery',()=>{
 const raw=suppliedGame(32,'active');raw.spawnIn=1e9;raw.mastery=Object.fromEntries(RECIPES.map(r=>[r.id,r.milestones.at(-1)]));raw.knownRecipes=Object.fromEntries(RECIPES.map(r=>[r.id,true]));raw.album=Object.fromEntries(ZOMBIES.map(z=>[z.id,1]));Object.assign(raw.objects.find(o=>o.type==='server'),{foodId:'hell-pizza-bun',stock:154});assert.deepEqual(E.validateSave(JSON.parse(JSON.stringify(raw))),raw);
 const s=E.newGame();s.spawnIn=1e9;const chair=s.objects.find(o=>o.type==='chair');s.customers=[{uid:'offline-santa',zombieId:'santa',x:chair.x,y:chair.y,phase:'eating',wait:0,path:[],seat:chair.uid,foodId:'rice',portion:1,eatUntil:.25}];E.advance(s,.25,{offline:true});assert.equal(s.stats.sold,1);assert.equal(s.stats.fed.santa,1);assert.equal(s.album.santa,undefined);assert.equal(s.notifications.some(n=>n.type==='payment'),false);
});

test('six real legacy traffic saves retain their saved content, resources and album records',async()=>{
 for(const name of ['8-seats','12-seats','4-seats-clutter','8-seats-clutter','12-seats-clutter','12-seats-clutter-fractional-idle']){const raw=JSON.parse(await readFile(new URL(`./fixtures/traffic/${name}-final.json`,import.meta.url),'utf8')),before=JSON.stringify(raw),loaded=E.validateSave(raw);assert.equal(JSON.stringify(raw),before);for(const key of ['version','coins','hearts','xp','level','seed','mastery','knownRecipes','album','events','eventBooks','stats'])assert.deepEqual(loaded[key],raw[key],`${name}.${key}`);assert.deepEqual(loaded.objects.map(({x,y,reservedFood,...o})=>o),raw.objects.map(({x,y,reservedFood,...o})=>o),'entrance migration preserves every object and its food/cooking state');assert.ok(loaded.objects.filter(o=>{const before=raw.objects.find(b=>b.uid===o.uid);return o.x!==before.x||o.y!==before.y;}).length<=1,'at most one old wall object moves to open the guest doorway');if(loaded.notifications.some(n=>n.message.includes('좀비 출입구를 비우기')))assert.ok(E.path(loaded,E.staffEntrance(loaded),Object.values(E.zombieEntrance(loaded)),{allowBlockedTarget:false}),'relocated wall furniture opens a connected doorway');else if(!E.path(loaded,E.staffEntrance(loaded),Object.values(E.zombieEntrance(loaded)),{allowBlockedTarget:false}))assert.ok(loaded.customers.every(c=>c.exitDoor?.x===0&&c.exitDoor?.y===loaded.size-1),'already blocked legacy layouts retain old guest exit routes');}
});
