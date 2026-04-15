import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// 기존 갤러리 데이터를 실제 교회 사진으로 교체
const updates = [
  {
    id: 1,
    imageUrl: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663470178900/KASTcRBzh5rwhJEekrJN6E/church-exterior-3_afd5ff8f.jpg',
    caption: '기쁨의교회 야경',
    gridSpan: 'col-span-2 row-span-2',
  },
  {
    id: 2,
    imageUrl: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663470178900/KASTcRBzh5rwhJEekrJN6E/church-worship-1_2868612a.webp',
    caption: '찬양 집회',
    gridSpan: 'col-span-1 row-span-1',
  },
  {
    id: 3,
    imageUrl: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663470178900/KASTcRBzh5rwhJEekrJN6E/church-worship-sunday_ba272a5e.jpg',
    caption: '주일 예배',
    gridSpan: 'col-span-1 row-span-1',
  },
  {
    id: 4,
    imageUrl: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663470178900/KASTcRBzh5rwhJEekrJN6E/church-exterior-2_d8b70083.jpg',
    caption: '교회 전경 (주간)',
    gridSpan: 'col-span-1 row-span-1',
  },
  {
    id: 5,
    imageUrl: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663470178900/KASTcRBzh5rwhJEekrJN6E/church-exterior-1_2b64f07a.webp',
    caption: '교회 전경 (개관식)',
    gridSpan: 'col-span-1 row-span-1',
  },
  {
    id: 6,
    imageUrl: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663470178900/KASTcRBzh5rwhJEekrJN6E/church-worship-praise_968523a7.webp',
    caption: '찬양 예배',
    gridSpan: 'col-span-2 row-span-1',
  },
];

for (const item of updates) {
  await conn.execute(
    'UPDATE gallery_items SET imageUrl = ?, caption = ?, gridSpan = ? WHERE id = ?',
    [item.imageUrl, item.caption, item.gridSpan, item.id]
  );
  console.log(`✅ 갤러리 ${item.id}번 업데이트: ${item.caption}`);
}

console.log('\n✅ 갤러리 DB 업데이트 완료!');
await conn.end();
