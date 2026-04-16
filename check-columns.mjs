import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute('DESCRIBE church_members');
console.log('=== church_members 컬럼 목록 ===');
console.log(rows.map(r => r.Field).join('\n'));
await conn.end();
