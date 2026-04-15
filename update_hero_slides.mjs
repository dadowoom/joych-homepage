// 히어로 슬라이드 교체: 영상만 교체, 텍스트/버튼은 기존 것 유지
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const CDN = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663470178900/KASTcRBzh5rwhJEekrJN6E';

const SHARED_TEXT = {
  yearLabel: '2026 JOYFUL',
  mainTitle: '처음 익은 열매로\n여호와를 공경하라',
  subTitle: '네 재물과 네 소산물의 처음 익은 열매로 여호와를 공경하라',
  bibleRef: '잠언 3장 9절',
  btn1Text: '새가족 등록',
  btn1Href: '#',
  btn2Text: '예배 안내',
  btn2Href: '#',
};

const NEW_SLIDES = [
  { videoUrl: `${CDN}/church-video-01_61f8116e.mp4`, posterUrl: `${CDN}/church-exterior-3_d8667ded.jpg`, sortOrder: 1 },
  { videoUrl: `${CDN}/church-video-02_688a5b23.mp4`, posterUrl: `${CDN}/church-exterior-1_2852892c.webp`, sortOrder: 2 },
  { videoUrl: `${CDN}/church-video-03_23301078.mp4`, posterUrl: `${CDN}/church-exterior-2_6e8b76cf.jpg`, sortOrder: 3 },
  { videoUrl: `${CDN}/church-video-04_5b4a27de.mp4`, posterUrl: `${CDN}/church-exterior-3_d8667ded.jpg`, sortOrder: 4 },
];

const mysql = await import('mysql2/promise');
const conn = await mysql.default.createConnection(process.env.DATABASE_URL);

await conn.execute('DELETE FROM hero_slides');
console.log('기존 슬라이드 삭제 완료');

for (const s of NEW_SLIDES) {
  await conn.execute(
    `INSERT INTO hero_slides 
     (videoUrl, posterUrl, yearLabel, mainTitle, subTitle, bibleRef, 
      btn1Text, btn1Href, btn2Text, btn2Href, sortOrder, isVisible)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [s.videoUrl, s.posterUrl, SHARED_TEXT.yearLabel, SHARED_TEXT.mainTitle,
     SHARED_TEXT.subTitle, SHARED_TEXT.bibleRef,
     SHARED_TEXT.btn1Text, SHARED_TEXT.btn1Href,
     SHARED_TEXT.btn2Text, SHARED_TEXT.btn2Href, s.sortOrder]
  );
  console.log(`슬라이드 ${s.sortOrder} 추가 완료`);
}

const [result] = await conn.execute('SELECT id, sortOrder, videoUrl FROM hero_slides ORDER BY sortOrder');
console.log('\n새 슬라이드 목록:');
result.forEach(r => console.log(` ${r.sortOrder}. [${r.id}] ${r.videoUrl?.substring(0, 80)}`));

await conn.end();
console.log('\n완료!');
