INSERT INTO `menu_items` (
  `menuId`,
  `label`,
  `href`,
  `sortOrder`,
  `isVisible`,
  `allowGuest`,
  `allowMember`,
  `pageType`
)
SELECT
  m.`id`,
  '시설 사용 예약',
  '/facility',
  COALESCE(
    (SELECT MAX(existing_order.`sortOrder`) + 1 FROM `menu_items` existing_order WHERE existing_order.`menuId` = m.`id`),
    0
  ),
  1,
  1,
  1,
  'image'
FROM `menus` m
WHERE m.`label` = '행정지원'
  AND NOT EXISTS (
    SELECT 1
    FROM `menu_items` existing
    WHERE existing.`menuId` = m.`id`
      AND (existing.`href` = '/facility' OR existing.`label` = '시설 사용 예약')
  );

UPDATE `menu_items` mi
JOIN `menus` m ON m.`id` = mi.`menuId`
SET mi.`allowGuest` = 1,
    mi.`allowMember` = 1,
    mi.`isVisible` = 1
WHERE m.`label` = '행정지원'
  AND (mi.`href` = '/facility' OR mi.`label` = '시설 사용 예약');
