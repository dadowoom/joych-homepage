/**
 * 기쁨의교회 CMS 데이터 업데이트 스크립트
 * - 기존 더미 교회 소식 삭제 후 실제 소식으로 교체
 * - 교회 기본 정보(주소, 전화번호, SNS 등) 업데이트
 */

import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { eq } from "drizzle-orm";
import * as dotenv from "dotenv";

dotenv.config();

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection);

// 테이블 스키마 직접 정의 (import 대신)
import { mysqlTable, int, varchar, text, boolean, timestamp } from "drizzle-orm/mysql-core";

const notices = mysqlTable("notices", {
  id: int("id").primaryKey().autoincrement(),
  category: varchar("category", { length: 32 }).notNull().default("공지"),
  title: varchar("title", { length: 256 }).notNull(),
  content: text("content"),
  thumbnailUrl: text("thumbnailUrl"),
  isPublished: boolean("isPublished").notNull().default(true),
  isPinned: boolean("isPinned").notNull().default(false),
  authorId: int("authorId"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

const siteSettings = mysqlTable("site_settings", {
  id: int("id").primaryKey().autoincrement(),
  settingKey: varchar("settingKey", { length: 100 }).notNull().unique(),
  settingValue: text("settingValue"),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

console.log("📰 교회 소식 업데이트 시작...");

// 기존 더미 소식 모두 삭제
const existingNotices = await db.select({ id: notices.id }).from(notices);
console.log(`  기존 소식 ${existingNotices.length}개 삭제 중...`);
for (const n of existingNotices) {
  await db.delete(notices).where(eq(notices.id, n.id));
}

// 실제 교회 소식 입력
const realNotices = [
  {
    category: "공지",
    title: "2026년 4월 교회 공동의회 안내",
    content: "2026년 4월 교회 공동의회가 개최됩니다. 성도 여러분의 많은 참여 바랍니다.",
    thumbnailUrl: "https://images.unsplash.com/photo-1529070538774-1843cb3265df?w=120&q=70",
    isPublished: true,
    isPinned: true,
  },
  {
    category: "공지",
    title: "2026년 부활절 연합예배 안내",
    content: "부활절을 맞이하여 연합예배를 드립니다. 온 가족이 함께 참여해주세요.",
    thumbnailUrl: "https://images.unsplash.com/photo-1504052434569-70ad5836ab65?w=120&q=70",
    isPublished: true,
    isPinned: false,
  },
  {
    category: "행사",
    title: "2026년 4월 새가족 환영회",
    content: "이번 달 새롭게 등록하신 성도님들을 위한 환영회가 있습니다.",
    thumbnailUrl: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=120&q=70",
    isPublished: true,
    isPinned: false,
  },
  {
    category: "행사",
    title: "2026 봄 성경학교 교사 모집",
    content: "여름 성경학교를 위한 교사를 모집합니다. 관심 있으신 분은 교육부로 연락해주세요.",
    thumbnailUrl: "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=120&q=70",
    isPublished: true,
    isPinned: false,
  },
  {
    category: "찬양",
    title: "2026년 4월 찬양의 밤 안내",
    content: "매월 마지막 주 금요일 쉐키나 찬양의 밤이 열립니다. 함께 찬양으로 하나님께 영광 돌려요.",
    thumbnailUrl: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=120&q=70",
    isPublished: true,
    isPinned: false,
  },
];

for (const notice of realNotices) {
  await db.insert(notices).values(notice);
  console.log(`  ✓ 소식 등록: [${notice.category}] ${notice.title}`);
}

console.log("\n⚙️  교회 기본 정보 업데이트 시작...");

// 교회 기본 정보 업데이트 (upsert)
const settingsToUpdate = [
  { key: "church_name", value: "기쁨의교회" },
  { key: "church_name_en", value: "The Joyful Church" },
  { key: "church_since", value: "1946" },
  { key: "denomination", value: "대한예수교장로회" },
  { key: "address", value: "경북 포항시 북구 상통로 411" },
  { key: "tel", value: "054) 270-1000" },
  { key: "fax", value: "054) 270-1005" },
  { key: "youtube_url", value: "https://www.youtube.com/@joychurch" },
  { key: "facebook_url", value: "https://www.facebook.com/joychurch" },
  { key: "instagram_url", value: "https://www.instagram.com/joychurch" },
  { key: "vision_title", value: "깊이있는 성장, 위대한 교회" },
  { key: "vision_desc", value: "기쁨의교회는 복음의 능력으로 한 사람 한 사람을 세우고, 지역 사회와 열방을 섬기는 교회입니다. 말씀과 기도, 예배와 교제를 통해 그리스도의 몸을 이루어 가고 있습니다." },
];

for (const setting of settingsToUpdate) {
  await db
    .insert(siteSettings)
    .values({ settingKey: setting.key, settingValue: setting.value })
    .onDuplicateKeyUpdate({ set: { settingValue: setting.value } });
  console.log(`  ✓ 설정 업데이트: ${setting.key} = ${setting.value}`);
}

console.log("\n✅ 모든 데이터 업데이트 완료!");
await connection.end();
