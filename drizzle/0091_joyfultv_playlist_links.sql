INSERT INTO `youtube_playlists` (`id`, `title`, `description`)
VALUES
  (90007, '[주일 1부]샬롬 찬양대', NULL),
  (90008, '[주일 2부]호산나 찬양대', NULL),
  (90009, '[주일 3부]시온 찬양대', NULL),
  (90010, '[주일 찬양팀]조이언스', NULL),
  (90011, '[수요 찬양팀]디사이플스', NULL),
  (90015, '[금요 찬양팀]카리스', NULL),
  (90016, '[청년부 찬양팀]리빌드', NULL),
  (90017, '예배특송', NULL)
ON DUPLICATE KEY UPDATE
  `title` = VALUES(`title`),
  `updatedAt` = CURRENT_TIMESTAMP;

UPDATE `menu_sub_items` AS sub
INNER JOIN `menu_items` AS item ON item.`id` = sub.`menuItemId`
INNER JOIN `menus` AS menu ON menu.`id` = item.`menuId`
SET
  sub.`playlistId` = CASE sub.`label`
    WHEN '[주일 1부]샬롬 찬양대' THEN 90007
    WHEN '[주일 2부]호산나 찬양대' THEN 90008
    WHEN '[주일 3부]시온 찬양대' THEN 90009
    WHEN '[주일 찬양팀]조이언스' THEN 90010
    WHEN '[수요 찬양팀]디사이플스' THEN 90011
    WHEN '[금요 찬양팀]카리스' THEN 90015
    WHEN '[청년부 찬양팀]리빌드' THEN 90016
    WHEN '예배특송' THEN 90017
    ELSE sub.`playlistId`
  END,
  sub.`pageType` = 'youtube',
  sub.`isVisible` = true,
  sub.`updatedAt` = CURRENT_TIMESTAMP
WHERE REPLACE(LOWER(menu.`label`), ' ', '') IN ('조이풀tv', '조이풀티비')
  AND item.`label` = '찬양'
  AND sub.`label` IN (
    '[주일 1부]샬롬 찬양대',
    '[주일 2부]호산나 찬양대',
    '[주일 3부]시온 찬양대',
    '[주일 찬양팀]조이언스',
    '[수요 찬양팀]디사이플스',
    '[금요 찬양팀]카리스',
    '[청년부 찬양팀]리빌드',
    '예배특송'
  );
