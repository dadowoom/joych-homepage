import mysql from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config();

async function run() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);

  console.log("교회학교 테이블 생성 시작...");

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS school_departments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(64) NOT NULL,
      category ENUM('church_school','youth') NOT NULL DEFAULT 'church_school',
      ageRange VARCHAR(64),
      worshipTime VARCHAR(128),
      worshipPlace VARCHAR(128),
      description TEXT,
      educationGoals TEXT,
      prayerTopics TEXT,
      staffInfo TEXT,
      imageUrl VARCHAR(512),
      sortOrder INT NOT NULL DEFAULT 0,
      isVisible BOOLEAN NOT NULL DEFAULT TRUE,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  console.log("✓ school_departments 생성");

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS school_posts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      departmentId INT NOT NULL,
      title VARCHAR(256) NOT NULL,
      content TEXT,
      authorName VARCHAR(64) NOT NULL,
      memberId INT,
      viewCount INT NOT NULL DEFAULT 0,
      isNotice BOOLEAN NOT NULL DEFAULT FALSE,
      isVisible BOOLEAN NOT NULL DEFAULT TRUE,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  console.log("✓ school_posts 생성");

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS school_post_files (
      id INT AUTO_INCREMENT PRIMARY KEY,
      postId INT NOT NULL,
      fileName VARCHAR(256) NOT NULL,
      fileUrl VARCHAR(512) NOT NULL,
      fileSize INT,
      mimeType VARCHAR(128),
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log("✓ school_post_files 생성");

  // 기본 부서 데이터 삽입
  const [existing] = await conn.execute("SELECT COUNT(*) as cnt FROM school_departments");
  if (existing[0].cnt === 0) {
    const departments = [
      // 교회학교
      ["영아부", "church_school", "13~30개월", "주일 오전 11시", "2층 영아부실", "하나님의 나라를 확장해가는 믿음의 아이들이 되기를 소망합니다.", 1],
      ["유아부", "church_school", "31개월~5세", "주일 오전 11시", "2층 유아부실", "예수님의 사랑과 평안을 경험하며 반짝반짝 예수님 닮은 아이로 자라갑니다.", 2],
      ["유치부", "church_school", "6~7세", "주일 오전 11시", "3층 유치부실", "말씀과 찬양으로 하나님을 알아가는 유치부입니다.", 3],
      ["초등부", "church_school", "초등 1~4학년", "주일 오전 11시", "3층 초등부실", "하나님의 말씀 위에 믿음의 기초를 세우는 초등부입니다.", 4],
      ["중고등부", "church_school", "중학교 1학년~고등학교 3학년", "주일 오전 11시", "4층 중고등부실", "다음세대를 이끌어갈 청소년들이 예수님의 제자로 성장합니다.", 5],
      // 청년부
      ["청년부", "youth", "19~39세", "주일 오후 2시", "본당", "기쁨의교회 청년부는 하나님 나라를 위해 헌신하는 청년 공동체입니다.", 6],
    ];

    for (const [name, category, ageRange, worshipTime, worshipPlace, description, sortOrder] of departments) {
      await conn.execute(
        `INSERT INTO school_departments (name, category, ageRange, worshipTime, worshipPlace, description, sortOrder) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [name, category, ageRange, worshipTime, worshipPlace, description, sortOrder]
      );
    }
    console.log("✓ 기본 부서 데이터 6개 삽입");
  } else {
    console.log("ℹ 부서 데이터 이미 존재, 삽입 건너뜀");
  }

  await conn.end();
  console.log("완료!");
}

run().catch((e) => {
  console.error("오류:", e);
  process.exit(1);
});
