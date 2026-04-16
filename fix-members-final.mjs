/**
 * church_members 테이블 최종 정리 스크립트
 * 
 * 문제: 마이그레이션이 여러 번 실행되면서 camelCase 컬럼(createdAt, updatedAt)이
 *       snake_case 컬럼(created_at, updated_at)과 함께 존재하는 상태
 * 
 * 해결: camelCase 컬럼 삭제 → schema.ts와 DB 완전 일치
 * 
 * 실행일: 2026-04-16
 */
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

console.log('=== church_members 테이블 최종 정리 ===\n');

// 1. 현재 컬럼 목록 확인
const [before] = await conn.execute('DESCRIBE church_members');
console.log('정리 전 컬럼 목록:');
console.log(before.map(r => `  - ${r.Field}`).join('\n'));

// 2. created_at, updated_at이 있는지 확인 (있어야 삭제 가능)
const hasCreatedAt = before.some(r => r.Field === 'created_at');
const hasUpdatedAt = before.some(r => r.Field === 'updated_at');
const hasCreatedAtCamel = before.some(r => r.Field === 'createdAt');
const hasUpdatedAtCamel = before.some(r => r.Field === 'updatedAt');

console.log('\n확인:');
console.log(`  created_at (정식): ${hasCreatedAt ? '✓ 있음' : '✗ 없음'}`);
console.log(`  updated_at (정식): ${hasUpdatedAt ? '✓ 있음' : '✗ 없음'}`);
console.log(`  createdAt (구버전): ${hasCreatedAtCamel ? '⚠ 있음 → 삭제 예정' : '✓ 없음'}`);
console.log(`  updatedAt (구버전): ${hasUpdatedAtCamel ? '⚠ 있음 → 삭제 예정' : '✓ 없음'}`);

// 3. created_at이 없으면 먼저 생성
if (!hasCreatedAt) {
  await conn.execute(`ALTER TABLE church_members ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP`);
  console.log('\n✓ created_at 컬럼 생성');
}
if (!hasUpdatedAt) {
  await conn.execute(`ALTER TABLE church_members ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`);
  console.log('✓ updated_at 컬럼 생성');
}

// 4. camelCase 구버전 컬럼 삭제
if (hasCreatedAtCamel) {
  await conn.execute(`ALTER TABLE church_members DROP COLUMN \`createdAt\``);
  console.log('✓ createdAt (구버전) 삭제');
}
if (hasUpdatedAtCamel) {
  await conn.execute(`ALTER TABLE church_members DROP COLUMN \`updatedAt\``);
  console.log('✓ updatedAt (구버전) 삭제');
}

// 5. 최종 컬럼 목록 확인
const [after] = await conn.execute('DESCRIBE church_members');
console.log('\n=== 정리 완료 후 컬럼 목록 ===');
console.log(after.map(r => `  ${r.Field} (${r.Type})`).join('\n'));

// 6. schema.ts와 일치 여부 검증
const expectedColumns = [
  'id', 'email', 'password_hash', 'name', 'phone', 'birth_date',
  'gender', 'address', 'emergency_phone', 'join_path',
  'position', 'department', 'district', 'baptism_type', 'baptism_date',
  'registered_at', 'pastor', 'admin_memo', 'status',
  'faith_plus_user_id', 'created_at', 'updated_at'
];

const actualColumns = after.map(r => r.Field);
const missing = expectedColumns.filter(c => !actualColumns.includes(c));
const extra = actualColumns.filter(c => !expectedColumns.includes(c));

console.log('\n=== schema.ts 일치 검증 ===');
if (missing.length === 0 && extra.length === 0) {
  console.log('✅ 완벽하게 일치합니다!');
} else {
  if (missing.length > 0) console.log(`⚠ 누락 컬럼: ${missing.join(', ')}`);
  if (extra.length > 0) console.log(`⚠ 초과 컬럼: ${extra.join(', ')}`);
}

await conn.end();
console.log('\n정리 완료!');
