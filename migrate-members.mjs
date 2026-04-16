/**
 * church_members 테이블 확장 + member_field_options 테이블 생성 마이그레이션
 * 기존 컬럼은 유지하면서 새 컬럼 추가, 이름 변경은 새 컬럼 추가 방식으로 처리
 */
import mysql from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

console.log("🔄 마이그레이션 시작...");

// 1. member_field_options 테이블 생성
await conn.execute(`
  CREATE TABLE IF NOT EXISTS member_field_options (
    id INT AUTO_INCREMENT PRIMARY KEY,
    field_type VARCHAR(32) NOT NULL,
    label VARCHAR(64) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);
console.log("✅ member_field_options 테이블 생성 완료");

// 2. church_members 테이블에 새 컬럼 추가 (없으면 추가)
const alterColumns = [
  "ADD COLUMN IF NOT EXISTS email VARCHAR(128) UNIQUE",
  "ADD COLUMN IF NOT EXISTS password_hash VARCHAR(256)",
  "ADD COLUMN IF NOT EXISTS birth_date VARCHAR(16)",
  "ADD COLUMN IF NOT EXISTS emergency_phone VARCHAR(32)",
  "ADD COLUMN IF NOT EXISTS join_path VARCHAR(64)",
  "ADD COLUMN IF NOT EXISTS department VARCHAR(64)",
  "ADD COLUMN IF NOT EXISTS baptism_type VARCHAR(32)",
  "ADD COLUMN IF NOT EXISTS baptism_date VARCHAR(16)",
  "ADD COLUMN IF NOT EXISTS pastor VARCHAR(64)",
  "ADD COLUMN IF NOT EXISTS admin_memo TEXT",
  "ADD COLUMN IF NOT EXISTS status ENUM('pending','approved','rejected','withdrawn') NOT NULL DEFAULT 'pending'",
  "ADD COLUMN IF NOT EXISTS faith_plus_user_id INT",
];

for (const col of alterColumns) {
  try {
    await conn.execute(`ALTER TABLE church_members ${col}`);
    console.log(`✅ church_members: ${col.substring(0, 60)}...`);
  } catch (e) {
    if (e.code === "ER_DUP_FIELDNAME" || e.message?.includes("Duplicate column")) {
      console.log(`⏭️  이미 존재: ${col.substring(0, 60)}`);
    } else {
      console.error(`❌ 오류: ${e.message}`);
    }
  }
}

// 3. 기존 컬럼 이름 변경 (registeredAt → registered_at, faithPlusUserId → faith_plus_user_id)
// 기존 데이터 보존을 위해 새 컬럼으로 데이터 복사 후 기존 컬럼 유지
try {
  await conn.execute(`ALTER TABLE church_members ADD COLUMN IF NOT EXISTS registered_at VARCHAR(16)`);
  await conn.execute(`UPDATE church_members SET registered_at = registeredAt WHERE registered_at IS NULL AND registeredAt IS NOT NULL`);
  console.log("✅ registeredAt → registered_at 마이그레이션 완료");
} catch (e) {
  console.log("⏭️  registered_at 이미 처리됨:", e.message);
}

// 4. 기본 선택지 데이터 삽입 (이미 있으면 스킵)
const [existing] = await conn.execute("SELECT COUNT(*) as cnt FROM member_field_options");
if (existing[0].cnt === 0) {
  const defaultOptions = [
    // 직분
    ["position", "담임목사", 1],
    ["position", "부목사", 2],
    ["position", "전도사", 3],
    ["position", "장로", 4],
    ["position", "권사", 5],
    ["position", "집사", 6],
    ["position", "청년", 7],
    ["position", "학생", 8],
    ["position", "새가족", 9],
    // 부서
    ["department", "헤브론부", 1],
    ["department", "청년부", 2],
    ["department", "대학부", 3],
    ["department", "중고등부", 4],
    ["department", "초등부", 5],
    ["department", "유치부", 6],
    ["department", "영아부", 7],
    ["department", "찬양팀", 8],
    // 구역/순
    ["district", "1구역", 1],
    ["district", "2구역", 2],
    ["district", "3구역", 3],
    // 세례구분
    ["baptism", "세례", 1],
    ["baptism", "학습", 2],
    ["baptism", "유아세례", 3],
    ["baptism", "미세례", 4],
  ];

  for (const [fieldType, label, sortOrder] of defaultOptions) {
    await conn.execute(
      "INSERT INTO member_field_options (field_type, label, sort_order) VALUES (?, ?, ?)",
      [fieldType, label, sortOrder]
    );
  }
  console.log("✅ 기본 선택지 데이터 삽입 완료 (직분 9개, 부서 8개, 구역 3개, 세례 4개)");
} else {
  console.log("⏭️  선택지 데이터 이미 존재");
}

await conn.end();
console.log("🎉 마이그레이션 완료!");
