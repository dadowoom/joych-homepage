INSERT INTO `member_field_options` (`field_type`, `label`, `sort_order`, `is_active`)
SELECT 'district', '새가족', 7, true
WHERE NOT EXISTS (
  SELECT 1
  FROM `member_field_options`
  WHERE `field_type` = 'district'
    AND `label` = '새가족'
);

INSERT INTO `member_field_options` (`field_type`, `label`, `sort_order`, `is_active`)
SELECT 'district', '청년부', 8, true
WHERE NOT EXISTS (
  SELECT 1
  FROM `member_field_options`
  WHERE `field_type` = 'district'
    AND `label` = '청년부'
);

INSERT INTO `member_field_options` (`field_type`, `label`, `sort_order`, `is_active`)
SELECT 'district', '교육부', 9, true
WHERE NOT EXISTS (
  SELECT 1
  FROM `member_field_options`
  WHERE `field_type` = 'district'
    AND `label` = '교육부'
);

UPDATE `church_members`
SET `district` = CASE `district`
  WHEN '새가족공동체' THEN '새가족'
  WHEN '청년공동체' THEN '청년부'
  WHEN '교육부공동체' THEN '교육부'
  ELSE `district`
END
WHERE `district` IN ('새가족공동체', '청년공동체', '교육부공동체');

DELETE old_districts
FROM `member_districts` old_districts
JOIN `member_districts` existing_districts
  ON existing_districts.`member_id` = old_districts.`member_id`
 AND existing_districts.`district` = CASE old_districts.`district`
    WHEN '새가족공동체' THEN '새가족'
    WHEN '청년공동체' THEN '청년부'
    WHEN '교육부공동체' THEN '교육부'
  END
WHERE old_districts.`district` IN ('새가족공동체', '청년공동체', '교육부공동체');

UPDATE `member_districts`
SET `district` = CASE `district`
  WHEN '새가족공동체' THEN '새가족'
  WHEN '청년공동체' THEN '청년부'
  WHEN '교육부공동체' THEN '교육부'
  ELSE `district`
END
WHERE `district` IN ('새가족공동체', '청년공동체', '교육부공동체');

UPDATE `member_field_options`
SET `is_active` = false
WHERE `field_type` = 'district'
  AND `label` IN ('새가족공동체', '청년공동체', '교육부공동체');

UPDATE `member_field_options`
SET
  `sort_order` = CASE `label`
    WHEN '1공동체' THEN 1
    WHEN '2공동체' THEN 2
    WHEN '3공동체' THEN 3
    WHEN '4공동체' THEN 4
    WHEN '5공동체' THEN 5
    WHEN '6공동체' THEN 6
    WHEN '새가족' THEN 7
    WHEN '청년부' THEN 8
    WHEN '교육부' THEN 9
    WHEN '교역자공동체' THEN 10
    ELSE `sort_order`
  END,
  `is_active` = true
WHERE `field_type` = 'district'
  AND `label` IN (
    '1공동체',
    '2공동체',
    '3공동체',
    '4공동체',
    '5공동체',
    '6공동체',
    '새가족',
    '청년부',
    '교육부',
    '교역자공동체'
  );
