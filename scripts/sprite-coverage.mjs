import fs from 'node:fs/promises';
import {ZOMBIES} from '../src/data.js';
import {getCoverage} from '../src/atlas-preview.js';
const roster=ZOMBIES.filter(z=>!z.event),coverage=getCoverage(roster);
const rows=coverage.entries.map(e=>`| ${roster.find(z=>z.id===e.id).name} | ${e.id} | ${e.walk?`4방향 × ${e.walkFrames}프레임`:'미등록'} | ${e.sit?'4방향':'미등록'} | ${e.complete?'연결됨':'제작·검수 중'} |`);
await fs.writeFile(new URL('../docs/SPRITE_STATUS.md',import.meta.url),`# 좀비 스프라이트 등록 현황\n\n코드에 등록된 메타데이터를 기준으로 자동 생성합니다. 파일 생성·등록·실제 화면 검수는 별도 단계이며, 등록 수치가 이미지 품질 검수의 완료를 보장하지 않습니다.\n\n일반 좀비 ${coverage.total}종: 걷기 ${coverage.walking}종, 앉기 ${coverage.sitting}종, 둘 다 연결 ${coverage.complete}종. 이벤트 ${ZOMBIES.filter(z=>z.event).length}종은 이 집계에서 제외합니다. 일부 계절 손님은 기존 일반 손님 외형을 공유합니다.\n\n| 캐릭터 | ID | 걷기 | 앉기 | 등록 상태 |\n|---|---|---|---|---|\n${rows.join('\n')}\n\n갱신: node scripts/update-zombie-atlases.mjs 후 node scripts/sprite-coverage.mjs. 미검수 생성본은 게임에 등록하지 않습니다.\n`);
console.log(JSON.stringify({total:coverage.total,walking:coverage.walking,sitting:coverage.sitting,complete:coverage.complete}));
