import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

try {
  // 1. videoId 컬럼을 nullable로 변경
  console.log('1. videoId 컬럼을 nullable로 변경...');
  await conn.execute(`
    ALTER TABLE youtube_videos
    MODIFY COLUMN videoId varchar(32) NULL
  `);
  console.log('   완료!');

  // 2. videoUrl 컬럼 추가 (이미 있으면 무시)
  console.log('2. videoUrl 컬럼 추가...');
  try {
    await conn.execute(`
      ALTER TABLE youtube_videos
      ADD COLUMN videoUrl text NULL AFTER videoId
    `);
    console.log('   완료!');
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log('   이미 존재함, 건너뜀');
    } else {
      throw e;
    }
  }

  // 3. 현재 테이블 구조 확인
  const [cols] = await conn.execute(`DESCRIBE youtube_videos`);
  console.log('\n현재 youtube_videos 테이블 구조:');
  console.table(cols);

} finally {
  await conn.end();
}
