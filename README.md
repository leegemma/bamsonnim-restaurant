# 밤손님 식당

한옥에서 기괴한 한식을 만들고 좀비 손님을 맞이하는 브라우저 게임입니다.

**플레이:** https://leegemma.github.io/bamsonnim-restaurant/

PC 브라우저에서 바로 플레이할 수 있습니다. 모바일은 가로 화면을 사용합니다. 진행 상황은 접속한 브라우저에 저장되므로 다른 기기나 주소의 저장과 자동으로 공유되지 않습니다.

## 개발

Node.js 20 이상에서 실행합니다.

```sh
npm ci
npm run dev
```

```sh
npm test
npm run build
```

GitHub Pages의 프로젝트 경로로 빌드하려면:

```sh
GITHUB_PAGES_BASE=/bamsonnim-restaurant/ npm run build
```

배포 결과인 `dist/`를 `gh-pages` 브랜치 루트에 게시합니다. 저장소 Pages 설정은 `gh-pages` 브랜치의 `/` 경로를 사용합니다.

폰트 라이선스는 `public/fonts/LICENSE-NeoDunggeunmo.txt`에 있습니다.
