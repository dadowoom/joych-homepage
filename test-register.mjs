/**
 * 회원가입 API 직접 테스트 스크립트
 * 실행: npx tsx test-register.mjs
 */
import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
dotenv.config();

console.log('=== 회원가입 DB 직접 테스트 ===\n');

const conn = await mysql.createConnection(process.env.DATABASE_URL);

try {
  // 1. getMemberByEmail 쿼리 테스트
  console.log('1. getMemberByEmail 쿼리 테스트...');
  const [rows] = await conn.execute(
    'SELECT * FROM church_members WHERE email = ? LIMIT 1',
    ['test@test.com']
  );
  console.log('✅ getMemberByEmail 쿼리 성공! 결과:', rows.length, '건');

  // 2. INSERT 테스트 (실제 삽입 후 바로 삭제)
  console.log('\n2. INSERT 쿼리 테스트...');
  const [insertResult] = await conn.execute(
    `INSERT INTO church_members (name, email, password_hash, status) VALUES (?, ?, ?, ?)`,
    ['테스트성도', 'test_temp@test.com', '$2b$10$test', 'pending']
  );
  const insertId = insertResult.insertId;
  console.log('✅ INSERT 성공! ID:', insertId);

  // 3. 삽입된 데이터 확인
  const [inserted] = await conn.execute('SELECT * FROM church_members WHERE id = ?', [insertId]);
  console.log('✅ 삽입된 데이터:', inserted[0]);

  // 4. 테스트 데이터 삭제
  await conn.execute('DELETE FROM church_members WHERE id = ?', [insertId]);
  console.log('✅ 테스트 데이터 삭제 완료');

  console.log('\n✅ 모든 DB 쿼리 정상 동작! 회원가입 DB 문제 없음');
} catch (err) {
  console.error('❌ 에러 발생:', err.message);
  console.error('상세:', err);
} finally {
  await conn.end();
}
