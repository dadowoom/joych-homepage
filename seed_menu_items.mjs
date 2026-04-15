import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// 현재 메뉴 ID 확인
const [menus] = await conn.execute('SELECT id, label FROM menus ORDER BY sortOrder');
console.log('현재 메뉴:', menus);

// 메뉴별 하위 항목 정의
const menuItemsData = {
  '교회소개': [
    { label: '담임목사 소개', href: '/about/pastor', sortOrder: 1 },
    { label: '예배안내', href: '/worship/schedule', sortOrder: 2 },
    { label: '섬기는 분', href: '/about/staff', sortOrder: 3 },
    { label: '교회백서', href: '/about/whitebook', sortOrder: 4 },
    { label: '사역원리', href: '/about/principle', sortOrder: 5 },
    { label: 'CI', href: '/about/ci', sortOrder: 6 },
    { label: '시설물 안내', href: '/facility', sortOrder: 7 },
    { label: '오시는 길', href: '/about/directions', sortOrder: 8 },
    { label: '셔틀버스', href: '/about/shuttle', sortOrder: 9 },
  ],
  '조이풀TV': [
    { label: '실시간 예배영상', href: '/worship/tv', sortOrder: 1 },
    { label: '주일예배', href: '/worship/tv/sunday', sortOrder: 2 },
    { label: '헤브론 수요예배', href: '/worship/tv/hebron', sortOrder: 3 },
    { label: '쉐키나 금요기도회', href: '/worship/tv/shekhinah', sortOrder: 4 },
    { label: '새벽 글로리아 성서학당', href: '/worship/tv/gloria', sortOrder: 5 },
    { label: '박진석 목사 시리즈설교', href: '/worship/tv/pastor-series', sortOrder: 6 },
    { label: '하영인 새벽기도회 설교', href: '/worship/tv/hayoungin', sortOrder: 7 },
    { label: '특별예배', href: '/worship/tv/special', sortOrder: 8 },
    { label: '특집', href: '/worship/tv/feature', sortOrder: 9 },
    { label: '간증', href: '/worship/tv/testimony', sortOrder: 10 },
    { label: '찬양', href: '/worship/tv/praise', sortOrder: 11 },
  ],
  '양육/훈련': [
    { label: '헤세드아시아포재팬', href: '/education/hesed', sortOrder: 1 },
    { label: '제자훈련', href: '/education/disciple2', sortOrder: 2 },
    { label: '장로훈련', href: '/education/elder', sortOrder: 3 },
    { label: '일대일 양육', href: '/education/one-on-one', sortOrder: 4 },
    { label: '선생님학교', href: '/education/sunseumschool', sortOrder: 5 },
    { label: '생선 컨퍼런스', href: '/education/saengseon', sortOrder: 6 },
    { label: '세계선교', href: '/ministry/world-mission', sortOrder: 7 },
    { label: '전도', href: '/ministry/evangelism', sortOrder: 8 },
    { label: '기도사역', href: '/ministry/prayer', sortOrder: 9 },
    { label: '복지사역', href: '/ministry/welfare', sortOrder: 10 },
    { label: '비전대학교', href: '/ministry/vision-univ', sortOrder: 11 },
    { label: '조이랩', href: '/ministry/joylab', sortOrder: 12 },
  ],
  '교회학교': [
    { label: '영아부', href: '/school/infant', sortOrder: 1 },
    { label: '유아부', href: '/school/infant', sortOrder: 2 },
    { label: '유치부', href: '/school/kinder', sortOrder: 3 },
    { label: '초등부', href: '/school/elementary', sortOrder: 4 },
    { label: '중고등부', href: '/school/youth', sortOrder: 5 },
    { label: '청년부', href: '/school/young-adult', sortOrder: 6 },
    { label: 'AWANA', href: '/school/awana', sortOrder: 7 },
  ],
  '선교보고': [
    { label: '선교보고 목록', href: '/mission', sortOrder: 1 },
  ],
  '커뮤니티': [
    { label: '순모임', href: '/community/soon', sortOrder: 1 },
    { label: '자치기관', href: '/community/organization', sortOrder: 2 },
    { label: '동호회', href: '/community/club', sortOrder: 3 },
    { label: '사진', href: '/community/photo', sortOrder: 4 },
    { label: '기쁨톡', href: '/community/joytalk', sortOrder: 5 },
    { label: 'HOT NEWS', href: '/community/news', sortOrder: 6 },
    { label: '공지사항', href: '/community/news', sortOrder: 7 },
  ],
  '행정지원': [
    { label: '주보', href: '/worship/bulletin', sortOrder: 1 },
    { label: '자막 신청', href: '/admin/subtitle', sortOrder: 2 },
    { label: '온라인사무국', href: '/admin/office', sortOrder: 3 },
    { label: '탐방신청', href: '/admin/tour', sortOrder: 4 },
    { label: '조이풀빌리지', href: '/admin/store', sortOrder: 5 },
    { label: '기부금 영수증', href: '/admin/donation', sortOrder: 6 },
  ],
};

// 기존 menu_items 삭제
await conn.execute('DELETE FROM menu_items');
console.log('기존 하위 메뉴 삭제 완료');

// 새 하위 메뉴 삽입
let totalInserted = 0;
for (const menu of menus) {
  const items = menuItemsData[menu.label];
  if (!items) {
    console.log(`⚠️ ${menu.label} 메뉴의 하위 항목 없음`);
    continue;
  }
  for (const item of items) {
    await conn.execute(
      'INSERT INTO menu_items (menuId, label, href, sortOrder, isVisible) VALUES (?, ?, ?, ?, 1)',
      [menu.id, item.label, item.href, item.sortOrder]
    );
    totalInserted++;
  }
  console.log(`✅ ${menu.label}: ${items.length}개 하위 메뉴 삽입`);
}

console.log(`\n총 ${totalInserted}개 하위 메뉴 삽입 완료!`);
await conn.end();
