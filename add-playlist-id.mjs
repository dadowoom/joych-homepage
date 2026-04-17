import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL not set'); process.exit(1); }

const conn = await mysql.createConnection(url);

try {
  // menu_items 테이블에 playlistId 컬럼 추가
  try {
    await conn.execute('ALTER TABLE menu_items ADD COLUMN playlistId INT NULL');
    console.log('✅ menu_items.playlistId 컬럼 추가 완료');
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log('ℹ️  menu_items.playlistId 이미 존재');
    } else throw e;
  }

  // menu_sub_items 테이블에 playlistId 컬럼 추가
  try {
    await conn.execute('ALTER TABLE menu_sub_items ADD COLUMN playlistId INT NULL');
    console.log('✅ menu_sub_items.playlistId 컬럼 추가 완료');
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log('ℹ️  menu_sub_items.playlistId 이미 존재');
    } else throw e;
  }

  // 확인
  const [rows] = await conn.execute('SHOW COLUMNS FROM menu_items LIKE "playlistId"');
  console.log('menu_items.playlistId 확인:', rows);

} finally {
  await conn.end();
}
