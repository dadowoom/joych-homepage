import 'dotenv/config';
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// 수정 전 확인
const [before] = await conn.execute(
  "SELECT id, name, faith_plus_user_id FROM church_members WHERE name = '이인식'"
);
console.log('수정 전:', JSON.stringify(before, null, 2));

// 114로 수정
await conn.execute(
  "UPDATE church_members SET faith_plus_user_id = '114' WHERE name = '이인식'"
);

// 수정 후 확인
const [after] = await conn.execute(
  "SELECT id, name, faith_plus_user_id FROM church_members WHERE name = '이인식'"
);
console.log('수정 후:', JSON.stringify(after, null, 2));

await conn.end();
console.log('완료!');
