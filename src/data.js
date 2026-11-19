// Keep content IDs stable: save files reference these IDs, never translated names.
export const SAVE_VERSION = 1;
export const SAVE_KEY = 'bamsonnim.restaurant.v1';
export const OFFLINE_CAP = 8 * 3600;
export const RECIPES = [
  ['rice', '뇌 주먹밥', '한 입 먹으면 머리가 맑아지는… 기분입니다.',12,6,0,0,0],
  ['skewer','손가락 떡꼬치','손가락으로 꼽을 만큼 맛있는 꼬치.',30,10,1,0,1],
  ['soup','눈알 어묵탕','국물과 눈이 마주쳐도 놀라지 마세요.',120,30,3,0,2],
  ['tteok','손가락 떡볶이','쫀득한 손가락에 매콤한 양념을 입혔어요.',300,45,5,0,3],
  ['sausage','선지 눈알 순대','한 접시가 당신을 빤히 바라봅니다.',300,30,0,1,4],
  ['noodle','머리카락 잡채','빗 하나 꽂아낸 가늘고 긴 면발. 출처는 묻지 마세요.',1800,120,10,0,5],
  ['gimbap','팔뚝 김밥','팔뚝 단면을 밥과 김으로 돌돌. 다른 속재료는 없어요.',1800,175,0,3,6],
  ['cookie','입술 약과','달콤한 입맞춤을 곁들였습니다.',3600,160,15,0,7],
  ['bibimbap','위장 비빔밥','속이 든든해지는 특별한 비빔밥.',7200,700,0,6,8],
  ['liver','간장 간 조림','간이 딱 맞는, 간 요리입니다.',21600,300,0,6,9],
  ['pancake','발가락 감자전','발끝까지 바삭하게 부쳤습니다.',28800,700,25,0,10],
  ['kimchi','묵은지 간 찜','오래 묵힐수록 깊어지는 수상한 맛.',43200,950,50,0,11],
].map(([id,name,description,duration,servings,coins,hearts,sprite],i)=>({
  id,name,description,duration,servings,coins,hearts,sprite,book:['sausage','bibimbap','gimbap'].includes(id)?0:Math.floor(i/4),required:i*3,
  price:hearts?Math.max(1,Math.ceil(hearts*100/servings)):Math.max(1,Math.ceil(coins*1.3/servings)),
  portion:Math.max(1,Math.round(servings/20)),
  milestones:duration<=600?[3,8,10]:duration<=7200?[2,5,8]:duration<=43200?[1,3,5]:[1,2,3],
}));
RECIPES.push(
  {id:'xmas-rice',name:'해골 성탄 떡',description:'다시 찾아올 겨울을 위한 달콤한 기억.',duration:120,servings:40,coins:15,hearts:0,sprite:12,book:3,required:0,price:2,portion:2,milestones:[3,8,10],event:'christmas'},
  {id:'xmas-soup',name:'유령 만둣국',description:'뜨끈한 국물에 둥둥 떠다니는 유령 만두.',duration:300,servings:60,coins:25,hearts:0,sprite:13,book:0,required:3,price:3,portion:3,milestones:[3,8,10]},
);
RECIPES.push(
  {"id":"gopchang-jeongol","name":"지옥 곱창전골","description":"피처럼 붉은 국물에 꼬인 곱창과 불씨 무늬 냄비를 담았어요.","duration":7200,"servings":200,"coins":75,"hearts":0,"sprite":16,"book":4,"required":36,"price":1,"portion":10,"milestones":[2,5,8]},
  {"id":"worm-nakgopsae","name":"벌레 낙곱새","description":"낙지를 마디 있는 벌레로 바꾸고 곱창과 새우는 살렸어요.","duration":21600,"servings":375,"coins":175,"hearts":0,"sprite":17,"book":4,"required":39,"price":1,"portion":19,"milestones":[1,3,5]},
  {"id":"spider-mandu","name":"거미 찐만두","description":"얇은 피의 반달 주름 만두를 금속 찜판에 쪄내고 거미 다리가 살짝 보여요.","duration":1800,"servings":250,"coins":0,"hearts":2,"sprite":18,"book":0,"required":42,"price":1,"portion":13,"milestones":[2,5,8]},
  {"id":"human-jokbal","name":"사람발 족발","description":"엄지가 가장 크고 새끼발가락이 작은 통째 사람발 족발.","duration":28800,"servings":400,"coins":100,"hearts":0,"sprite":19,"book":4,"required":45,"price":1,"portion":20,"milestones":[1,3,5]},
  {"id":"yukgaejang","name":"피 육개장","description":"피처럼 붉은 국물에 고기와 고사리, 숙주와 대파를 듬뿍 담았어요.","duration":64800,"servings":1200,"coins":75,"hearts":0,"sprite":20,"book":5,"required":48,"price":1,"portion":60,"milestones":[1,2,3]},
  {"id":"human-suyuk","name":"사람살 수육과 알배추","description":"얇게 썬 사람살 수육을 노란 알배추와 쌈장에 싸 먹어요.","duration":28800,"servings":400,"coins":100,"hearts":0,"sprite":21,"book":5,"required":51,"price":1,"portion":20,"milestones":[1,3,5]},
  {"id":"worm-jeotgal","name":"꿈틀 젓갈","description":"작은 벌레가 꼬물거리는 매콤한 젓갈 한 종지.","duration":600,"servings":50,"coins":20,"hearts":0,"sprite":22,"book":5,"required":54,"price":1,"portion":3,"milestones":[3,8,10]},
  {"id":"hell-dakbokkeum","name":"지옥 닭볶음탕","description":"닭고기와 감자, 당근을 피처럼 붉은 양념에 끓인 뜨거운 한 냄비.","duration":43200,"servings":750,"coins":800,"hearts":0,"sprite":23,"book":5,"required":57,"price":2,"portion":38,"milestones":[1,3,5]},
  {"id":"hair-seaweed-soup","name":"머리카락 미역국","description":"미역 사이로 긴 머리카락이 풀어지는 생일 국.","duration":900,"servings":220,"coins":0,"hearts":4,"sprite":24,"book":0,"required":60,"price":2,"portion":11,"milestones":[2,5,8]},
  {"id":"bone-dogani-tang","name":"사람뼈 도가니탕","description":"뽀얀 국물에 사람 무릎뼈가 큼직하게 들어갔어요.","duration":300,"servings":40,"coins":50,"hearts":0,"sprite":25,"book":6,"required":63,"price":2,"portion":2,"milestones":[3,8,10]},
  {"id":"cartilage-muchim","name":"연골 오독무침","description":"빨간 양념에 무친 오독오독한 연골무침.","duration":1800,"servings":200,"coins":0,"hearts":3,"sprite":26,"book":6,"required":66,"price":2,"portion":10,"milestones":[2,5,8]},
  {"id":"human-rib-galbitang","name":"사람갈비 LA갈비탕","description":"사람 갈비뼈를 통째 넣고 푹 고아낸 갈비탕.","duration":43200,"servings":500,"coins":1000,"hearts":0,"sprite":27,"book":6,"required":69,"price":3,"portion":25,"milestones":[1,3,5]},
  {"id":"spine-gamjatang","name":"등뼈 감자탕","description":"사람 갈비뼈와 감자가 솥 위로 솟은 감자탕.","duration":43200,"servings":700,"coins":375,"hearts":0,"sprite":28,"book":7,"required":72,"price":1,"portion":35,"milestones":[1,3,5]},
  {"id":"human-samgyeopsal","name":"사람 삼겹살 쌈","description":"노릇한 사람 삼겹살에 상추와 쌈장을 곁들였어요.","duration":129600,"servings":1300,"coins":800,"hearts":0,"sprite":29,"book":7,"required":75,"price":1,"portion":65,"milestones":[1,2,3]},
  {"id":"blood-haejangguk","name":"선지 해장국","description":"사람 피 선지가 둥둥 뜬 얼큰한 해장국.","duration":300,"servings":30,"coins":0,"hearts":1,"sprite":30,"book":7,"required":78,"price":4,"portion":2,"milestones":[3,8,10]},
  {"id":"neck-steak","name":"항정살 스테이크","description":"항정살을 두툼하게 구워 육즙을 가둔 스테이크.","duration":43200,"servings":600,"coins":500,"hearts":0,"sprite":31,"book":7,"required":81,"price":2,"portion":30,"milestones":[1,3,5]},
  {"id":"human-leg-kalguksu","name":"사람다리 닭칼국수","description":"닭 대신 사람다리를 넣고 칼국수 면을 푹 끓였어요.","duration":120,"servings":20,"coins":0,"hearts":1,"sprite":32,"book":8,"required":84,"price":5,"portion":1,"milestones":[3,8,10]},
  {"id":"nurungji-chicken-baeksuk","name":"누룽지 닭백숙","description":"푹 익힌 닭과 구수한 황금빛 누룽지. 폐허의 밤에도 속은 든든하게.","duration":43200,"servings":750,"coins":800,"hearts":0,"sprite":33,"book":0,"required":87,"price":2,"portion":38,"milestones":[1,3,5]},
  {"id":"human-kimchi-jjim","name":"사람살 김치찜","description":"묵은 김치 속에 사람살이 푹 익어 있어요.","duration":43200,"servings":950,"coins":50,"hearts":0,"sprite":34,"book":8,"required":90,"price":1,"portion":48,"milestones":[1,3,5]},
  {"id":"eyeball-squid-sundae","name":"눈알 오징어순대","description":"오징어 속 밥과 채소 사이로 핏줄 선 눈알 두 개가 서로 다른 곳을 봐요.","duration":7200,"servings":900,"coins":0,"hearts":6,"sprite":35,"book":8,"required":93,"price":1,"portion":45,"milestones":[2,5,8]},
  {"id":"tongue-sotteok","name":"사람혀 소떡소떡","description":"떡과 사람 혀 소시지를 번갈아 꽂아 구웠어요.","duration":1800,"servings":105,"coins":60,"hearts":0,"sprite":36,"book":0,"required":96,"price":1,"portion":5,"milestones":[2,5,8]},
  {"id":"worm-tteokgalbi","name":"벌레 떡갈비","description":"다진 벌레를 넓적한 떡갈비 모양으로 구웠어요.","duration":1800,"servings":80,"coins":60,"hearts":0,"sprite":37,"book":0,"required":99,"price":1,"portion":4,"milestones":[2,5,8]},
  {"id":"thin-human-belly","name":"대패 사람삼겹살","description":"얇게 썬 사람 삼겹살을 불판에 바삭하게 구웠어요.","duration":129600,"servings":1300,"coins":800,"hearts":0,"sprite":38,"book":9,"required":102,"price":1,"portion":65,"milestones":[1,2,3]},
  {"id":"grilled-tongue","name":"우설 구이","description":"길게 썬 소의 혀를 노릇하게 구워 소금에 찍어요.","duration":108000,"servings":600,"coins":900,"hearts":0,"sprite":39,"book":9,"required":105,"price":2,"portion":30,"milestones":[1,2,3]},
  {"id":"eyeball-bungeoppang","name":"눈알 붕어빵","description":"황금빛 물고기 모양 과자와 팥소. 커다란 눈동자는 서로 다른 곳을 봅니다.","duration":30,"servings":10,"coins":1,"hearts":0,"sprite":40,"book":10,"required":108,"price":1,"portion":1,"milestones":[3,8,10]},
  {"id":"brain-walnut-cake","name":"뇌 호두과자","description":"호두 모양 과자 안에 달콤한 뇌 앙금을 넣었어요.","duration":720,"servings":100,"coins":0,"hearts":3,"sprite":41,"book":10,"required":111,"price":3,"portion":5,"milestones":[2,5,8]},
  {"id":"ghost-ppeongtwigi","name":"유령 납작 뻥튀기","description":"얇고 납작한 둥근 뻥튀기에 작은 유령 얼굴이 나타났어요.","duration":18000,"servings":250,"coins":0,"hearts":6,"sprite":42,"book":10,"required":114,"price":3,"portion":13,"milestones":[1,3,5]},
  {"id":"fried-ears","name":"바삭 귀튀김","description":"사람 귀를 얇게 튀겨 바삭한 한입 안주로 냈어요.","duration":28800,"servings":500,"coins":0,"hearts":2,"sprite":43,"book":0,"required":117,"price":1,"portion":25,"milestones":[1,3,5]},
  {"id":"hell-pizza-bun","name":"지옥 피자호빵","description":"둥근 호빵을 가르면 붉은 피자 소스와 치즈, 작은 거미가 빼꼼.","duration":420,"servings":154,"coins":0,"hearts":3,"sprite":44,"book":10,"required":120,"price":2,"portion":8,"milestones":[3,8,10]},
);
// Approved first-book balance. Apply after legacy derived fields to preserve mastery and portion.
const SNACK_BALANCE = {
  "rice":{"duration":12,"servings":6,"coins":0,"hearts":0,"price":1},
  "skewer":{"duration":30,"servings":10,"coins":2,"hearts":0,"price":2},
  "soup":{"duration":120,"servings":24,"coins":10,"hearts":0,"price":3},
  "tteok":{"duration":300,"servings":40,"coins":25,"hearts":0,"price":4},
  "sausage":{"duration":300,"servings":36,"coins":30,"hearts":0,"price":5},
  "gimbap":{"duration":900,"servings":90,"coins":90,"hearts":0,"price":6},
  "bibimbap":{"duration":1800,"servings":120,"coins":180,"hearts":0,"price":9},
  "xmas-soup":{"duration":300,"servings":50,"coins":25,"hearts":0,"price":4},
  "spider-mandu":{"duration":600,"servings":60,"coins":60,"hearts":0,"price":6},
  "hair-seaweed-soup":{"duration":900,"servings":75,"coins":75,"hearts":0,"price":7},
  "nurungji-chicken-baeksuk":{"duration":3600,"servings":150,"coins":240,"hearts":0,"price":14},
  "tongue-sotteok":{"duration":600,"servings":50,"coins":50,"hearts":0,"price":7},
  "worm-tteokgalbi":{"duration":900,"servings":60,"coins":90,"hearts":0,"price":9},
  "fried-ears":{"duration":1800,"servings":90,"coins":120,"hearts":0,"price":12},
};
for(const r of RECIPES)if(Object.hasOwn(SNACK_BALANCE,r.id))Object.assign(r,SNACK_BALANCE[r.id]);

export const BOOKS = [
  {name:'무덤 앞 분식집',subtitle:'작고 소중한 첫 끼',color:'#ba6a43',symbol:'一',cover:'/assets/cookbook-grave-bunsik.png'},
  {name:'수상한 한 상',subtitle:'단골을 부르는 손맛',color:'#76885c',symbol:'二',cover:'/assets/cookbook-suspicious-table.png'},
  {name:'밤 깊은 잔칫상',subtitle:'오래 기다린 만큼',color:'#817196',symbol:'三',cover:'/assets/cookbook-midnight-feast.png'},
  {name:'오싹한 성탄절',subtitle:'한겨울의 특별한 손님',color:'#648d81',symbol:'冬',event:'christmas',cover:'/assets/cookbook-spooky-christmas.png'},
  {"name":"저승 골목 포차","subtitle":"국물과 고기, 뜨거운 한 상","color":"#9b5947","symbol":"四",cover:'/assets/cookbook-underworld-pocha.png'},
  {"name":"살점 곁들임","subtitle":"쌈과 젓갈, 수상한 반찬","color":"#78854f","symbol":"五",cover:'/assets/cookbook-fleshy-sides.png'},
  {"name":"뼈 국물과 구이","subtitle":"오래 끓이고 노릇하게","color":"#817196","symbol":"六",cover:'/assets/cookbook-bone-broths.png'},
  {"name":"벌레와 사람살","subtitle":"속을 채우고 천천히 익혀요","color":"#a36b43","symbol":"七",cover:'/assets/cookbook-worms-and-flesh.png'},
  {"name":"불판 위의 밤","subtitle":"얇게 굽고 길게 즐기는 고기","color":"#765c57","symbol":"八",cover:'/assets/cookbook-night-fire.png'},
  {"name":"밤참 골목","subtitle":"붕어빵부터 바삭한 귀까지","color":"#527b72","symbol":"九",cover:'/assets/cookbook-late-night-alley.png'},
  {"name":"달콤하고 납작한 간식","subtitle":"마지막 다섯 가지 야식","color":"#8c6b9b","symbol":"十",cover:'/assets/cookbook-sweet-flat-snacks.png'},
];
const roster=[
 ['wanderer','허기진 행인',null,'밤이 되면 어슬렁. 배가 고픈 것뿐이에요.'],
 ['student','야자 학생','rice','일자 앞머리, 안경과 양갈래 머리. 오늘도 야자는 끝나지 않았어요.'],
 ['scholar','졸린 선비',null,'갓은 삐뚤어져도 예의는 바릅니다.'],
 ['office','야근 직장인','skewer','퇴근은 했지만 영혼은 아직 회사에.'],
 ['guard','길 잃은 포졸',null,'순찰을 돌다가 맛있는 냄새를 따라왔어요.'],
 ['rider','새벽 배달원','soup','민트색 헬멧과 배달박스. 오늘은 배달 말고 먹으러 왔습니다.'],
 ['hostess','수다쟁이 주모','tteok','볼의 커다란 왕점만큼 손도 큽니다.'],
 ['hiker','정상 찍은 등산객',null,'검정 짧은 머리와 붉은 렌즈 선글라스. 한쪽 렌즈가 깨져 좀비 눈알이 보여요. 주황·자주·회색 상의와 검정 바지. 배낭과 등산 스틱을 챙겨 내려왔어요.'],
 ['merchant','장터 보부상','sausage','봇짐 속에도 없는 맛을 찾으러 왔어요.'],
 ['nurse','퇴근한 간호사',null,'다른 사람 돌보기 전에 밥부터 먹어요.'],
 ['dancer','춤추는 탈꾼','noodle','한 젓가락 먹고 어깨춤이 절로.'],
 ['bride','전통혼례복 신부','gimbap','연두색 원삼, 붉은 치마와 족두리. 곱게 차려입고 한 줄 더 주세요.'],
 ['idol','케이팝 아이돌','cookie','마이크를 들고 입장! 오늘 앙코르는 약과예요.'],
 ['hairdresser','동네 미용사',null,'앞머리 정리는 식사 후에 해드려요.'],
 ['prince','세자','bibimbap','작은 키에 왕실 예복. 입맛은 아주 높답니다.'],
];
export const ZOMBIES=roster.map(([id,name,favorite,description],sprite)=>({id,name,favorite,description,sprite,level:sprite+1}));
ZOMBIES.push(
 {id:'delinquent',name:'일진 고딩',favorite:'noodle',description:'앞머리 롤, 교복 조끼와 넥타이. 봉고데기와 빗은 절대 놓지 않아요.',sprite:16,level:16},
 {id:'runner',name:'러닝 좀비',favorite:'rice',description:'헤어밴드와 러닝 조끼, 물통과 에너지젤. 오늘도 완주는 식당 앞까지.',sprite:17,level:17},
 {id:'tennis',name:'테니스 좀비',favorite:null,description:'테니스채와 공, 겨땀에 젖은 테니스복. 듀스보다 밥이 먼저예요.',sprite:18,level:18},
 {id:'sauna',name:'찜질방 아줌마',favorite:null,description:'양머리 수건 아래 젖은 뽀글머리. 황토색 찜방복, 락커키, 맥반석계란과 파란 뚜껑 커피통.',sprite:19,level:19},
 {id:'returning',name:'복학생',favorite:'gimbap',description:'올리브색 깔깔이에 보라색 티셔츠, 체크 이불. 오늘 수업은… 내일 생각할래요.',sprite:20,level:20},
 {id:'diver',name:'해녀',favorite:'soup',description:'잠수안경과 검은 잠수복, 초록 그물망과 테왁. 오늘 물질은 이만하면 됐어요.',sprite:21,level:21},
 {id:'ghost',name:'처녀귀신',favorite:'cookie',description:'피칠갑한 흰 소복과 긴 검은 머리. 한이 아니라 허기가 졌습니다.',sprite:22,level:22},
 {id:'grandmother',name:'삼신할머니',favorite:null,description:'비녀 없는 쪽진 흰 머리와 보따리, 지팡이. 밥은 먹고 다니느냐고 물어요.',sprite:23,level:23},
 {id:'tiger',name:'멍한 호랑이',favorite:'rice',description:'한입 먹어 팥소가 보이는 찹쌀떡을 쥐고 두 발로 어슬렁. 무섭게 생기려다 깜빡했어요.',sprite:24,level:24},
 {id:'farmhand',name:'머슴',favorite:'kimchi',description:'걷은 소매와 해진 작업 한복. 일은 잠깐 미루고 새참부터.',sprite:25,level:25},
 {id:'hahoe',name:'하회탈',favorite:null,description:'비대칭 웃음의 갈색 하회탈. 탈 아래에는 수상한 초록 손님이 있어요.',sprite:26,level:26},
 {id:'female-idol',name:'백금발 여자 아이돌',favorite:'cookie',description:'무릎까지 오는 백금발 양갈래. 흰 버클 무대 의상과 체인, 검은 끈 롱부츠.',sprite:27,level:27},
 {id:'dokkaebi',name:'도깨비',favorite:'pancake',description:'빨간 피부에 뿔 두 개, 노란 무늬옷과 돌기 방망이. 밥 나와라 뚝딱!',sprite:28,level:28},
 {id:'kongjwi',name:'가난한 콩쥐',favorite:'rice',description:'해진 붉은 치마와 땋은 머리, 낡은 바가지. 작은 개구리와 언제나 함께 다녀요.',sprite:29,level:29},
);
ZOMBIES.push(
 {id:'santa-scholar',name:'산타 선비',favorite:'xmas-rice',description:'갓 대신 산타 모자. 선물은 밥 먹고 드립니다.',sprite:2,level:1,event:'christmas'},
 {id:'snow-bride',name:'눈꽃 신부',favorite:'xmas-soup',description:'눈 내리는 밤에만 처음 만날 수 있어요.',sprite:11,level:2,event:'christmas'},
);
ZOMBIES.push(
 {"id":"santa","name":"벌레 선물 산타","favorite":null,"description":"벌레가 기어 나오는 열린 선물 상자를 꼭 쥐고 왔어요.","sprite":30,"level":1,"event":"christmas"},
 {"id":"shaman","name":"무당","favorite":null,"description":"노란 저고리와 붉은 치마, 쪽진 머리. 방울 대신 부채를 들었어요.","sprite":31,"level":30},
 {"id":"lounge-singer","name":"밤무대 가수","favorite":null,"description":"흰 반짝이 모자와 호피 재킷, 마이크와 탬버린. 선글라스 한쪽 렌즈가 깨져 좀비 눈알이 보여요. 한 끼 후에 앙코르!","sprite":32,"level":31},
 {"id":"clown","name":"삐에로","favorite":null,"description":"물방울무늬 옷과 빨간 코, 손에는 강아지 모양 풍선.","sprite":33,"level":32},
);
// Scoped approval: only these three completed actors join the existing roster.
ZOMBIES.push(
 {id:'nz-baduk-player',name:'남자 바둑기사',favorite:'xmas-soup',description:'바둑돌을 챙겨 온 기사. 대국 전에 따뜻한 만둣국 한 그릇.',sprite:34,level:12},
 {id:'nz-golf-man',name:'골프 남자',favorite:'gimbap',description:'골프채를 곁에 두고 쉬어 가요. 김밥을 먹고 다음 홀로.',sprite:35,level:8},
 {id:'nz-futsal-man',name:'풋살 남자',favorite:'skewer',description:'공은 발옆에 두고 잠깐 식사. 떡꼬치로 경기 뒤 허기를 달래요.',sprite:36,level:4},
);
export const DIRECTIONS=[[1,0],[0,1],[-1,0],[0,-1]];
export const FURNITURE=[
 {id:'table',name:'오래된 소반',category:'table',price:100,level:1,sprite:0,description:'손님에게 따뜻한 한 끼를.'},
 {id:'chair',name:'붉은 방석 의자',category:'chair',price:50,level:1,sprite:1,description:'테이블을 향하도록 돌려주세요.'},
 {id:'stove',name:'무쇠 가마솥',category:'stove',price:400,level:1,sprite:5,description:'오래 끓일수록 깊은 맛.'},
 {id:'server',name:'나무 서빙대',category:'server',price:300,level:1,sprite:6,description:'한 종류의 음식을 차곡차곡.'},
 {id:'lantern',name:'달빛 초롱',category:'decor',price:150,level:1,sprite:7},
 {id:'jars',name:'할머니의 장독',category:'decor',price:200,level:2,sprite:8},
 {id:'bonsai',name:'작은 소나무',category:'decor',price:350,level:3,sprite:9},
 {id:'bamboo',name:'사각사각 대나무',category:'decor',price:450,level:4,sprite:10},
 {id:'cat',name:'수호 고양이',category:'decor',price:650,level:5,sprite:11},
 {id:'poster',name:'뇌 주먹밥의 효능',category:'decor',price:180,level:1,sprite:12,description:'머리가 든든 · 허기가 쏙 · 단골이 방긋! 벽면 전용 포스터.'},
 {id:'tree',name:'오싹 성탄 나무',category:'decor',price:400,level:1,sprite:14,event:'christmas'},
 {id:'xmas-lantern',name:'눈꽃 초롱',category:'decor',price:250,level:1,sprite:15,event:'christmas'},
 {id:'xmas-stool',name:'선물 방석',category:'decor',price:150,level:1,sprite:13,event:'christmas'},
];
export const SKINS=[
 {id:'wood',name:'오래된 마루',type:'floor',price:0,level:1,color:'#aa774b'},
 {id:'dark',name:'짙은 밤나무',type:'floor',price:1000,level:4,color:'#70513d'},
 {id:'moss',name:'이끼 낀 마루',type:'floor',price:2000,level:8,color:'#77805a'},
 {id:'paper',name:'달빛 창호',type:'wall',price:0,level:1,color:'#d9c39b'},
 {id:'jade',name:'옥빛 창호',type:'wall',price:1200,level:5,color:'#96b3a0'},
 {id:'rose',name:'분홍빛 창호',type:'wall',price:2500,level:9,color:'#d6a49d'},
];
export const WAITER_NAMES=['하온','하영','은재','리아','나리','소담','다솜','아리'];
export const WAITER_NAME_UPDATES={달래:'하온',보리:'하영',초롱:'은재',두리:'리아'};
export const LIMITS={waiters:[[1,2],[5,3],[10,4],[15,5],[20,6],[26,8]],stove:[[1,2],[4,3],[8,4],[12,5],[16,6],[20,8],[25,10]],server:[[1,2],[6,3],[12,4],[18,5],[25,6]]};
export const EXPANSIONS=[{size:9,level:4,price:1000},{size:10,level:7,price:3000},{size:11,level:10,price:6000},{size:12,level:13,price:10000},{size:13,level:16,price:16000},{size:14,level:20,price:25000},{size:15,level:24,price:40000},{size:16,level:28,price:60000}];
export const QUESTS=[
 {id:'cook1',name:'가마솥에 불을 지펴요',description:'요리를 2번 완성해 서빙대로 옮기세요.',stat:'cooked',target:2,coins:100,xp:100,skip:10},
 {id:'treat1',name:'첫 손님을 부탁해요',description:'음식을 2번 서빙하세요.',stat:'served',target:2,coins:100,xp:100,skip:10},
 {id:'tables1',name:'어서 오세요, 두 자리 더',description:'테이블을 2개 구매하세요.',stat:'tablesBought',target:2,coins:150,xp:150,skip:20},
 {id:'chairs1',name:'편히 앉으세요',description:'의자를 2개 구매하세요.',stat:'chairsBought',target:2,coins:150,xp:150},
 {id:'master1',name:'이 집의 대표 메뉴',description:'음식 1종의 숙련도를 3으로 만드세요.',stat:'mastered',target:1,coins:150,xp:150,absolute:true},
 {id:'cook2',name:'부지런한 주방장',description:'요리를 20번 완성하세요.',stat:'cooked',target:20,coins:200,xp:200},
 {id:'brains',name:'배고픈 이웃들',description:'행인 좀비에게 50번 식사를 판매하세요.',stat:'fed:wanderer',target:50,coins:200,xp:200},
 {id:'expand1',name:'조금 더 넓은 식당',description:'식당을 9×9로 확장하세요.',stat:'size',target:9,coins:300,xp:300,absolute:true,skip:30},
 {id:'hire1',name:'도움이 필요해요',description:'직원 1명을 추가 고용하세요.',stat:'hired',target:1,coins:300,xp:300},
 {id:'album1',name:'밤손님 수집가',description:'캐릭터북에 좀비 10종을 등록하세요.',stat:'album',target:10,coins:1500,xp:1500,absolute:true},
 {id:'frenzy1',name:'달밤의 축제',description:'피버 모드를 1번 시작하세요.',stat:'fevers',target:1,coins:500,xp:500},
 {id:'expand2',name:'식당 확장 10×10',description:'식당을 10×10로 확장하세요.',stat:'size',target:10,coins:600,xp:600,absolute:true,skip:40},
 {id:'expand3',name:'식당 확장 11×11',description:'식당을 11×11로 확장하세요.',stat:'size',target:11,coins:1000,xp:1000,absolute:true,skip:50},
 {id:'expand4',name:'식당 확장 12×12',description:'식당을 12×12로 확장하세요.',stat:'size',target:12,coins:2000,xp:2000,absolute:true,skip:60},
 {id:'expand5',name:'식당 확장 13×13',description:'식당을 13×13로 확장하세요.',stat:'size',target:13,coins:4000,xp:4000,absolute:true,skip:70},
 {id:'expand6',name:'식당 확장 14×14',description:'식당을 14×14로 확장하세요.',stat:'size',target:14,coins:6000,xp:6000,absolute:true,skip:80},
 {id:'expand7',name:'식당 확장 15×15',description:'식당을 15×15로 확장하세요.',stat:'size',target:15,coins:9000,xp:9000,absolute:true,skip:90},
 {id:'expand8',name:'식당 확장 16×16',description:'식당을 16×16로 확장하세요.',stat:'size',target:16,coins:15000,xp:15000,absolute:true,skip:100},
];
export const recipe=id=>RECIPES.find(r=>r.id===id);
export const zombie=id=>ZOMBIES.find(z=>z.id===id);
export const furniture=id=>FURNITURE.find(f=>f.id===id);
export function formatTime(seconds){const n=Math.max(0,Math.ceil(seconds));return n<60?`${n}초`:n<3600?`${Math.floor(n/60)}분${n%60?` ${n%60}초`:''}`:`${Math.floor(n/3600)}시간${Math.floor(n%3600/60)?` ${Math.floor(n%3600/60)}분`:''}`;}
export const xpNeeded=level=>Math.round(4*Math.pow(level,2.39));
export {ASSETS} from './assets.js';
export const WALK_ANIMATION={fps:7,keys:['walk1','walk2','walk3','walk4']};
