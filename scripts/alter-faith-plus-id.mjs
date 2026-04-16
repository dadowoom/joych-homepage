import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

try {
  // faith_plus_user_id 컬럼을 int에서 varchar(64)로 변경
  await conn.execute(`
    ALTER TABLE church_members 
    MODIFY COLUMN faith_plus_user_id VARCHAR(64) NULL
  `);
  console.log('✅ faith_plus_user_id 컬럼 타입을 varchar(64)로 변경 완료');
} catch (err) {
  console.error('❌ 오류:', err.message);
} finally {
  await conn.end();
}
