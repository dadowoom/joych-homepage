INSERT INTO `vehicles` (
  `name`,
  `description`,
  `plate_number`,
  `location`,
  `driver_info`,
  `capacity`,
  `slot_minutes`,
  `min_slots`,
  `max_slots`,
  `approval_type`,
  `is_reservable`,
  `is_visible`,
  `notice`,
  `caution`,
  `sort_order`,
  `open_time`,
  `close_time`
)
SELECT
  '스타리아',
  '교회 행사와 사역 이동을 위한 현대 STARIA 차량입니다.',
  NULL,
  '교회 주차장',
  '관리자 승인 후 배정',
  11,
  60,
  1,
  8,
  'manual',
  true,
  true,
  '차량 사용 목적, 탑승 인원, 사용 시간을 입력해 신청해주세요.',
  '예약 신청 후 관리자 승인까지 완료되어야 사용할 수 있습니다.',
  1,
  '09:00',
  '22:00'
WHERE NOT EXISTS (
  SELECT 1 FROM `vehicles` WHERE `name` = '스타리아' LIMIT 1
);

SET @staria_vehicle_id := (
  SELECT `id`
  FROM `vehicles`
  WHERE `name` = '스타리아'
  ORDER BY `id`
  LIMIT 1
);

UPDATE `vehicles`
SET
  `description` = COALESCE(NULLIF(`description`, ''), '교회 행사와 사역 이동을 위한 현대 STARIA 차량입니다.'),
  `location` = COALESCE(NULLIF(`location`, ''), '교회 주차장'),
  `driver_info` = COALESCE(NULLIF(`driver_info`, ''), '관리자 승인 후 배정'),
  `capacity` = 11,
  `slot_minutes` = 60,
  `min_slots` = 1,
  `max_slots` = 8,
  `approval_type` = 'manual',
  `is_reservable` = true,
  `is_visible` = true,
  `notice` = COALESCE(NULLIF(`notice`, ''), '차량 사용 목적, 탑승 인원, 사용 시간을 입력해 신청해주세요.'),
  `caution` = COALESCE(NULLIF(`caution`, ''), '예약 신청 후 관리자 승인까지 완료되어야 사용할 수 있습니다.'),
  `open_time` = '09:00',
  `close_time` = '22:00',
  `sort_order` = CASE WHEN `sort_order` = 0 THEN 1 ELSE `sort_order` END
WHERE `id` = @staria_vehicle_id;

INSERT INTO `vehicle_images` (
  `vehicle_id`,
  `image_url`,
  `file_key`,
  `caption`,
  `is_thumbnail`,
  `sort_order`
)
SELECT
  @staria_vehicle_id,
  'https://www.hyundai.com/content/dam/hyundai/ww/en/images/find-a-car/pip/mpv/staria-full-page/highlights/staria-us4-highlights-kv-pc.jpg',
  NULL,
  '현대 STARIA 공식 이미지',
  true,
  0
WHERE @staria_vehicle_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM `vehicle_images`
    WHERE `vehicle_id` = @staria_vehicle_id
      AND `image_url` = 'https://www.hyundai.com/content/dam/hyundai/ww/en/images/find-a-car/pip/mpv/staria-full-page/highlights/staria-us4-highlights-kv-pc.jpg'
    LIMIT 1
  );

UPDATE `vehicle_images`
SET `is_thumbnail` = false
WHERE `vehicle_id` = @staria_vehicle_id
  AND `image_url` <> 'https://www.hyundai.com/content/dam/hyundai/ww/en/images/find-a-car/pip/mpv/staria-full-page/highlights/staria-us4-highlights-kv-pc.jpg';

UPDATE `vehicle_images`
SET
  `is_thumbnail` = true,
  `caption` = '현대 STARIA 공식 이미지',
  `sort_order` = 0
WHERE `vehicle_id` = @staria_vehicle_id
  AND `image_url` = 'https://www.hyundai.com/content/dam/hyundai/ww/en/images/find-a-car/pip/mpv/staria-full-page/highlights/staria-us4-highlights-kv-pc.jpg';
