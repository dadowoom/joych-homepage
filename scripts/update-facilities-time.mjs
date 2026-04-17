import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  console.log('1. openTime, closeTime 컬럼 추가 중...');
  try {
    await conn.execute(`ALTER TABLE facilities ADD COLUMN openTime VARCHAR(5) NOT NULL DEFAULT '09:00'`);
    console.log('   ✅ openTime 컬럼 추가 완료');
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log('   ⚠️  openTime 컬럼 이미 존재 (스킵)');
    } else throw e;
  }

  try {
    await conn.execute(`ALTER TABLE facilities ADD COLUMN closeTime VARCHAR(5) NOT NULL DEFAULT '22:00'`);
    console.log('   ✅ closeTime 컬럼 추가 완료');
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log('   ⚠️  closeTime 컬럼 이미 존재 (스킵)');
    } else throw e;
  }

  console.log('\n2. 기존 더미 데이터(대예배실 3개) 삭제 중...');
  // 먼저 연관된 예약 데이터 확인
  const [reservations] = await conn.execute(
    `SELECT COUNT(*) as cnt FROM reservations WHERE facilityId IN (SELECT id FROM facilities)`
  );
  console.log(`   연관 예약 데이터: ${reservations[0].cnt}건`);

  // 더미 시설 삭제 (연관 이미지, 운영시간, 차단일, 예약도 함께)
  const [facilities] = await conn.execute(`SELECT id, name FROM facilities`);
  console.log(`   현재 시설 목록:`, facilities.map(f => `[${f.id}] ${f.name}`));

  // facility_images, facility_hours, facility_blocked_dates, reservations 먼저 삭제
  const facilityIds = facilities.map(f => f.id);
  if (facilityIds.length > 0) {
    const placeholders = facilityIds.map(() => '?').join(',');
    await conn.execute(`DELETE FROM facility_images WHERE facilityId IN (${placeholders})`, facilityIds);
    await conn.execute(`DELETE FROM facility_hours WHERE facilityId IN (${placeholders})`, facilityIds);
    await conn.execute(`DELETE FROM facility_blocked_dates WHERE facilityId IN (${placeholders})`, facilityIds);
    await conn.execute(`DELETE FROM reservations WHERE facilityId IN (${placeholders})`, facilityIds);
    await conn.execute(`DELETE FROM facilities WHERE id IN (${placeholders})`, facilityIds);
    console.log(`   ✅ 더미 시설 ${facilityIds.length}개 및 연관 데이터 모두 삭제 완료`);
  } else {
    console.log('   ℹ️  삭제할 시설 없음');
  }

  console.log('\n3. 최종 상태 확인...');
  const [finalFacilities] = await conn.execute(`SELECT id, name, openTime, closeTime FROM facilities`);
  console.log('   남은 시설:', finalFacilities.length === 0 ? '없음 (정상)' : finalFacilities);

  await conn.end();
  console.log('\n✅ 완료!');
}

run().catch(e => {
  console.error('❌ 오류:', e.message);
  process.exit(1);
});
