import 'dotenv/config';
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute(
  "SELECT id, name, email, status FROM church_members WHERE name LIKE '%이인식%' OR name LIKE '%인식%'"
);
console.log('검색 결과:', JSON.stringify(rows, null, 2));

const [all] = await conn.execute(
  "SELECT id, name, status FROM church_members ORDER BY created_at DESC LIMIT 10"
);
console.log('\n최근 10명:', JSON.stringify(all, null, 2));
await conn.end();
