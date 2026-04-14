/**
 * 기쁨의교회 홈페이지 초기 데이터 입력 스크립트
 * 실행: node scripts/seed.mjs
 */
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as dotenv from "dotenv";

dotenv.config();

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection);

console.log("🌱 시드 데이터 입력 시작...");

// ── 1. sections (섹션 순서 정의) ──────────────────────
await db.execute(`
  INSERT IGNORE INTO sections (type, sortOrder, isVisible, title) VALUES
  ('hero',       1, 1, '히어로 섹션'),
  ('quick_menu', 2, 1, '퀵 메뉴'),
  ('content',    3, 1, '조이풀TV & 교회소식'),
  ('vision',     4, 1, '교회 비전'),
  ('worship',    5, 1, '함께 드리는 예배'),
  ('gallery',    6, 1, '교회 갤러리'),
  ('affiliates', 7, 1, '관련 기관')
`);
console.log("✅ sections 입력 완료");

// ── 2. menus (상단 네비게이션) ────────────────────────
await db.execute(`
  INSERT IGNORE INTO menus (label, sortOrder, isVisible) VALUES
  ('교회소개',  1, 1),
  ('조이풀TV',  2, 1),
  ('양육/훈련', 3, 1),
  ('교회학교',  4, 1),
  ('선교보고',  5, 1),
  ('커뮤니티',  6, 1),
  ('행정지원',  7, 1)
`);
console.log("✅ menus 입력 완료");

// ── 3. quick_menus (퀵 메뉴 아이콘 버튼) ─────────────
await db.execute(`
  INSERT IGNORE INTO quick_menus (icon, label, href, sortOrder, isVisible) VALUES
  ('fa-user-tie',      '담임목사 인사',   '/about/pastor',      1, 1),
  ('fa-hands-praying', '선교보고서',       '/mission',           2, 1),
  ('fa-newspaper',     '주보 보기',        '/worship/bulletin',  3, 1),
  ('fa-clock',         '예배시간 안내',    '/worship/schedule',  4, 1),
  ('fa-building',      '시설사용예약',     '/facility',          5, 1),
  ('fa-store',         '조이플스토어',     '/admin/store',       6, 1),
  ('fa-user-plus',     '새가족 안내',      '/admin/new-member',  7, 1),
  ('fa-bus',           '차량운행 안내',    '/admin/vehicle',     8, 1),
  ('fa-map-marker-alt','오시는 길',        '/about/directions',  9, 1)
`);
console.log("✅ quick_menus 입력 완료");

// ── 4. hero_slides (히어로 영상 슬라이드) ────────────
await db.execute(`
  INSERT IGNORE INTO hero_slides (videoUrl, posterUrl, yearLabel, mainTitle, subTitle, bibleRef, btn1Text, btn1Href, btn2Text, btn2Href, sortOrder, isVisible) VALUES
  (
    'https://d2xsxph8kpxj0f.cloudfront.net/310519663470178900/KASTcRBzh5rwhJEekrJN6E/church-video-2_9d9fb792.mp4',
    'https://d2xsxph8kpxj0f.cloudfront.net/310519663470178900/KASTcRBzh5rwhJEekrJN6E/hero-church-XWJBwHDycyRoBg9dY4aj5r.webp',
    '2026 JOYFUL',
    '처음 익은 열매로\\n여호와를 공경하라',
    '네 재물과 네 소산물의 처음 익은 열매로 여호와를 공경하라',
    '잠언 3장 9절',
    '새가족 등록', '#',
    '예배 안내',   '#',
    1, 1
  ),
  (
    'https://d2xsxph8kpxj0f.cloudfront.net/310519663470178900/KASTcRBzh5rwhJEekrJN6E/church-video-3_1b86687f.mp4',
    'https://d2xsxph8kpxj0f.cloudfront.net/310519663470178900/KASTcRBzh5rwhJEekrJN6E/hero-church-XWJBwHDycyRoBg9dY4aj5r.webp',
    '2026 JOYFUL',
    '처음 익은 열매로\\n여호와를 공경하라',
    '네 재물과 네 소산물의 처음 익은 열매로 여호와를 공경하라',
    '잠언 3장 9절',
    '새가족 등록', '#',
    '예배 안내',   '#',
    2, 1
  )
`);
console.log("✅ hero_slides 입력 완료");

// ── 5. notices (교회 소식) ────────────────────────────
await db.execute(`
  INSERT IGNORE INTO notices (category, title, thumbnailUrl, isPublished, isPinned) VALUES
  ('공지', '3월 18일 장학금 수여식 안내',           'https://images.unsplash.com/photo-1504052434569-70ad5836ab65?w=120&q=70', 1, 0),
  ('행사', '2026년 3월 12일~16일 히브리서 특별 강좌', 'https://images.unsplash.com/photo-1529070538774-1843cb3265df?w=120&q=70', 1, 0),
  ('행사', '2026년 3월 4일~6일 전교인 수련회',       'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=120&q=70', 1, 0),
  ('행사', '2026 리더십 성장 컨퍼런스',              'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=120&q=70', 1, 0),
  ('찬양', '제5회 24시간 찬양기도회',                'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=120&q=70', 1, 0)
`);
console.log("✅ notices 입력 완료");

// ── 6. gallery_items (갤러리 사진) ───────────────────
await db.execute(`
  INSERT IGNORE INTO gallery_items (imageUrl, caption, gridSpan, sortOrder, isVisible) VALUES
  ('https://images.unsplash.com/photo-1438032005730-c779502df39b?w=800&q=80', '교회 예배당',  'col-span-2 row-span-2', 1, 1),
  ('https://images.unsplash.com/photo-1529070538774-1843cb3265df?w=600&q=80', '찬양 예배',    'col-span-1 row-span-1', 2, 1),
  ('https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600&q=80', '찬양대',       'col-span-1 row-span-1', 3, 1),
  ('https://images.unsplash.com/photo-1504052434569-70ad5836ab65?w=600&q=80', '교회 행사',    'col-span-1 row-span-1', 4, 1),
  ('https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=600&q=80', '컨퍼런스',     'col-span-1 row-span-1', 5, 1),
  ('https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=800&q=80', '수련회',       'col-span-2 row-span-1', 6, 1)
`);
console.log("✅ gallery_items 입력 완료");

// ── 7. affiliates (관련 기관) ─────────────────────────
await db.execute(`
  INSERT IGNORE INTO affiliates (icon, label, href, sortOrder, isVisible) VALUES
  ('fa-hands-helping', '기쁨의복지재단',         '#',                                         1, 1),
  ('fa-building',      '창포종합사회복지관',      '#',                                         2, 1),
  ('fa-tree',          '조이플빌리지',            '#',                                         3, 1),
  ('fa-graduation-cap','조이아카데미 문화강좌',   '#',                                         4, 1),
  ('fa-heart',         '기쁨이 있는 곳',          'https://gippeum-arc-oawnrvau.manus.space/', 5, 1)
`);
console.log("✅ affiliates 입력 완료");

// ── 8. site_settings (교회 기본 정보) ────────────────
await db.execute(`
  INSERT IGNORE INTO site_settings (settingKey, settingValue, description) VALUES
  ('church_name',    '기쁨의교회',                    '교회 이름'),
  ('church_name_en', 'The Joyful Church',             '교회 영문 이름'),
  ('church_since',   '1946',                          '설립 연도'),
  ('denomination',   '대한예수교장로회',               '교단'),
  ('address',        '경북 포항시 북구 상통로 411',    '교회 주소'),
  ('tel',            '054) 270-1000',                 '전화번호'),
  ('fax',            '054) 270-1005',                 '팩스'),
  ('youtube_url',    '',                              '유튜브 채널 URL'),
  ('facebook_url',   '',                              '페이스북 URL'),
  ('instagram_url',  '',                              '인스타그램 URL'),
  ('vision_title',   '깊이있는 성장, 위대한 교회',    '비전 제목'),
  ('vision_desc',    '기쁨의교회는 복음의 능력으로 한 사람 한 사람을 세우고, 지역 사회와 열방을 섬기는 교회입니다.', '비전 설명')
`);
console.log("✅ site_settings 입력 완료");

await connection.end();
console.log("\n🎉 모든 시드 데이터 입력 완료!");
