INSERT INTO `member_field_options` (`field_type`, `label`, `sort_order`, `is_active`)
SELECT 'district', '교육부공동체', 9, true
WHERE NOT EXISTS (
  SELECT 1
  FROM `member_field_options`
  WHERE `field_type` = 'district'
    AND `label` = '교육부공동체'
);

UPDATE `member_field_options`
SET
  `sort_order` = CASE `label`
    WHEN '1공동체' THEN 1
    WHEN '2공동체' THEN 2
    WHEN '3공동체' THEN 3
    WHEN '4공동체' THEN 4
    WHEN '5공동체' THEN 5
    WHEN '6공동체' THEN 6
    WHEN '새가족공동체' THEN 7
    WHEN '청년공동체' THEN 8
    WHEN '교육부공동체' THEN 9
    WHEN '교역자공동체' THEN 10
    ELSE `sort_order`
  END,
  `is_active` = CASE
    WHEN `label` = '교육부공동체' THEN true
    ELSE `is_active`
  END
WHERE `field_type` = 'district'
  AND `label` IN (
    '1공동체',
    '2공동체',
    '3공동체',
    '4공동체',
    '5공동체',
    '6공동체',
    '새가족공동체',
    '청년공동체',
    '교육부공동체',
    '교역자공동체'
  );
