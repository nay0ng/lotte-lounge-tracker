# 롯백 당번 달력 (Notion 연동 버전)

## 폴더 구조
```
lotbaek/
├── index.html      ← 달력 화면
└── api/
    └── visits.js   ← Notion에 다녀오는 심부름꾼 (서버리스 함수)
```

## 연결 순서 (딱 4단계)

### 1. Notion 통합(열쇠) 만들기
1. https://www.notion.so/my-integrations 접속 → "New integration"
2. 이름 아무거나 (예: 롯백달력) → 만들기
3. "Internal Integration Secret" 복사해두기 → 이게 NOTION_TOKEN

### 2. Notion에 DB 만들기
1. 노션에서 새 페이지 → 데이터베이스(표) 추가
2. 속성(컬럼) 2개 만들기 (이름 정확히!):
   - `날짜` : Date 타입
   - `사람` : Select 타입 (선택지는 앱이 알아서 만들어줌)
   - 기본 제목 컬럼 이름은 `이름` 으로 바꾸기
3. DB 페이지 오른쪽 위 ⋯ → "연결(Connections)" → 1번에서 만든 통합 추가
4. DB 주소에서 ID 복사: notion.so/워크스페이스/【이부분32자리】?v=...
   → 이게 NOTION_DATABASE_ID

### 3. Vercel에 배포
1. 이 폴더를 GitHub에 올리거나, 터미널에서 `npx vercel`
2. Vercel 프로젝트 → Settings → Environment Variables 에 추가:
   - NOTION_TOKEN = 1번에서 복사한 시크릿
   - NOTION_DATABASE_ID = 2번에서 복사한 ID
3. 재배포(Redeploy)

### 4. 이름 바꾸기
- index.html 위쪽의 `const NAMES = ['나', '동생1', '동생2']` 수정
