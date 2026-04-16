/**
 * DB 현재 상태 확인 스크립트
 * 실행: npx tsx check-db-state.mjs
 */
import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

console.log('=== church_members 테이블 현재 컬럼 목록 ===\n');
const [columns] = await conn.execute('DESCRIBE church_members');
columns.forEach((col, i) => {
  console.log(`${i + 1}. ${col.Field} | ${col.Type} | NULL: ${col.Null} | Default: ${col.Default ?? 'none'}`);
});

console.log('\n=== schema.ts에서 기대하는 컬럼 목록 ===\n');
const expected = [
  'id', 'email', 'password_hash', 'name', 'phone', 'birth_date',
  'gender', 'address', 'emergency_phone', 'join_path',
  'position', 'department', 'district', 'baptism_type', 'baptism_date',
  'registered_at', 'pastor', 'admin_memo', 'status',
  'faith_plus_user_id', 'created_at', 'updated_at'
];
expected.forEach((col, i) => console.log(`${i + 1}. ${col}`));

const actual = columns.map(c => c.Field);
const missing = expected.filter(c => !actual.includes(c));
const extra = actual.filter(c => !expected.includes(c));

console.log('\n=== 비교 결과 ===');
if (missing.length === 0 && extra.length === 0) {
  console.log('✅ 완벽하게 일치! 추가 작업 불필요');
} else {
  if (missing.length > 0) {
    console.log(`\n⚠ DB에 없는 컬럼 (추가 필요): ${missing.join(', ')}`);
  }
  if (extra.length > 0) {
    console.log(`\n⚠ DB에 있지만 schema에 없는 컬럼 (삭제 필요): ${extra.join(', ')}`);
  }
}

console.log('\n=== 현재 저장된 성도 수 ===');
const [[{ count }]] = await conn.execute('SELECT COUNT(*) as count FROM church_members');
console.log(`총 ${count}명`);

await conn.end();
