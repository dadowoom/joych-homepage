import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(conn);

// 직접 SQL로 확인
const [menus] = await conn.execute('SELECT * FROM menus LIMIT 5');
console.log('menus count:', menus.length);
console.log('first menu:', JSON.stringify(menus[0], null, 2));

const [items] = await conn.execute('SELECT * FROM menu_items LIMIT 10');
console.log('menu_items count:', items.length);
console.log('first item:', JSON.stringify(items[0], null, 2));

await conn.end();
