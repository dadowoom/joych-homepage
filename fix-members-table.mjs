import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

console.log('church_members 테이블 정리 시작...');

// 1. 중복/구버전 컬럼 삭제 (camelCase 버전 - 구버전)
const dropColumns = [
  'age',           // 구버전 (birthDate로 대체)
  'ministry',      // 구버전 (department로 대체)
  'isActive',      // 구버전 (status로 대체)
  'faithPlusUserId', // camelCase 중복 (faith_plus_user_id가 정식)
  'registeredAt',  // camelCase 중복 (registered_at이 정식)
];

for (const col of dropColumns) {
  try {
    await conn.execute(`ALTER TABLE church_members DROP COLUMN \`${col}\``);
    console.log(`✓ 삭제: ${col}`);
  } catch (e) {
    console.log(`- 스킵 (없음): ${col}`);
  }
}

// 2. 현재 컬럼 확인
const [rows] = await conn.execute('DESCRIBE church_members');
console.log('\n=== 정리 후 컬럼 목록 ===');
console.log(rows.map(r => r.Field).join('\n'));

await conn.end();
console.log('\n완료!');
