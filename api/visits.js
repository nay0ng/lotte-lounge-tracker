/* =========================================================
   /api/visits  —  Vercel 서버리스 함수 (심부름꾼)

   왜 이 파일이 필요한가? (초등학생 버전)
   - Notion 열쇠(토큰)를 웹페이지에 넣으면 누구나 훔쳐볼 수 있어요.
   - 그래서 열쇠는 Vercel의 금고(환경변수)에 넣어두고,
     이 심부름꾼이 대신 Notion에 다녀옵니다.
   - 브라우저는 이 심부름꾼한테만 말을 겁니다.

   사용하는 금고 열쇠 2개 (Vercel 환경변수에서 설정):
   - NOTION_TOKEN       : Notion 통합(Integration) 시크릿 키
   - NOTION_DATABASE_ID : 기록을 저장할 DB의 ID

   Notion DB에 필요한 속성(컬럼) 2개:
   - "날짜" : Date 타입
   - "사람" : Select 타입 (옵션은 앱에서 자동으로 만들어짐)
   ========================================================= */

const NOTION_API = 'https://api.notion.com/v1';

// Notion API를 부를 때 항상 붙는 공통 헤더 (열쇠 + 버전)
function notionHeaders() {
  return {
    'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json',
  };
}

/* ---------- Notion에서 특정 날짜의 기록 찾기 ---------- */
async function findPageByDate(date) {
  const res = await fetch(`${NOTION_API}/databases/${process.env.NOTION_DATABASE_ID}/query`, {
    method: 'POST',
    headers: notionHeaders(),
    body: JSON.stringify({
      filter: { property: '날짜', date: { equals: date } },
    }),
  });
  const data = await res.json();
  return data.results?.[0] || null; // 있으면 첫 번째 것, 없으면 null
}

/* ---------- 메인 핸들러: 요청 종류(GET/POST)에 따라 나눠서 처리 ---------- */
export default async function handler(req, res) {
  try {
    /* ===== GET: 전체 기록 내려주기 =====
       달력을 그릴 때 브라우저가 제일 먼저 부릅니다.
       Notion은 한 번에 최대 100개씩 주므로, "다음 장 주세요"를
       반복하며 전부 모읍니다 (페이지네이션). */
    if (req.method === 'GET') {
      const visits = {}; // { '2026-07-22': '나', ... } 모양으로 만들 예정
      let cursor = undefined;

      do {
        const r = await fetch(`${NOTION_API}/databases/${process.env.NOTION_DATABASE_ID}/query`, {
          method: 'POST',
          headers: notionHeaders(),
          body: JSON.stringify({
            page_size: 100,
            ...(cursor ? { start_cursor: cursor } : {}), // 다음 장이 있으면 그 위치부터
          }),
        });
        const data = await r.json();
        if (data.object === 'error') throw new Error(data.message);

        // Notion의 각 줄(page)에서 날짜와 사람을 꺼내 visits에 담기
        for (const page of data.results) {
          const date = page.properties['날짜']?.date?.start;
          const who = page.properties['사람']?.select?.name;
          if (date && who) visits[date] = who;
        }
        cursor = data.has_more ? data.next_cursor : undefined;
      } while (cursor);

      return res.status(200).json({ visits });
    }

    /* ===== POST: 기록 저장/변경/삭제 =====
       브라우저가 { date: '2026-07-22', who: '나' } 를 보내면 저장,
       who가 null이면 그 날짜 기록을 삭제(보관 처리)합니다. */
    if (req.method === 'POST') {
      const { date, who } = req.body;
      if (!date) return res.status(400).json({ error: 'date가 필요해요' });

      const existing = await findPageByDate(date); // 이 날짜 기록이 이미 있나?

      // --- 삭제: who가 null이면 기존 기록을 보관함으로 ---
      if (!who) {
        if (existing) {
          await fetch(`${NOTION_API}/pages/${existing.id}`, {
            method: 'PATCH',
            headers: notionHeaders(),
            body: JSON.stringify({ archived: true }), // Notion은 삭제 대신 '보관'
          });
        }
        return res.status(200).json({ ok: true });
      }

      // --- 저장할 속성 내용 (있으면 수정, 없으면 새로 만들 때 공용) ---
      const properties = {
        '이름': { title: [{ text: { content: `${date} ${who}` } }] }, // 노션에서 보기 좋은 제목
        '날짜': { date: { start: date } },
        '사람': { select: { name: who } }, // 없는 옵션이면 Notion이 자동으로 만들어줌
      };

      if (existing) {
        // --- 수정: 이미 있는 줄의 사람만 바꾸기 ---
        await fetch(`${NOTION_API}/pages/${existing.id}`, {
          method: 'PATCH',
          headers: notionHeaders(),
          body: JSON.stringify({ properties }),
        });
      } else {
        // --- 생성: 새 줄 추가 ---
        await fetch(`${NOTION_API}/pages`, {
          method: 'POST',
          headers: notionHeaders(),
          body: JSON.stringify({
            parent: { database_id: process.env.NOTION_DATABASE_ID },
            properties,
          }),
        });
      }
      return res.status(200).json({ ok: true });
    }

    // GET/POST 말고 다른 요청은 거절
    return res.status(405).json({ error: '허용되지 않은 방식이에요' });

  } catch (err) {
    // 뭔가 잘못되면 이유를 알려주기 (디버깅용)
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
