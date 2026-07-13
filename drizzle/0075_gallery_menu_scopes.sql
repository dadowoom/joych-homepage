ALTER TABLE `menu_items` ADD COLUMN `galleryScopeKey` varchar(96) NULL;
ALTER TABLE `menu_sub_items` ADD COLUMN `galleryScopeKey` varchar(96) NULL;
ALTER TABLE `gallery_items` ADD COLUMN `galleryScopeKey` varchar(96) NULL;

UPDATE `menu_items`
SET `galleryScopeKey` = CONCAT('menu-item-', `id`)
WHERE `pageType` = 'gallery'
  AND (`galleryScopeKey` IS NULL OR `galleryScopeKey` = '');

UPDATE `menu_sub_items`
SET `galleryScopeKey` = CONCAT('menu-sub-item-', `id`)
WHERE `pageType` = 'gallery'
  AND (`galleryScopeKey` IS NULL OR `galleryScopeKey` = '');

UPDATE `gallery_items` AS `gallery`
JOIN (
  SELECT `galleryScopeKey`
  FROM (
    SELECT `galleryScopeKey`, `href`, `id`, 0 AS `menuLevel`
    FROM `menu_items`
    WHERE `pageType` = 'gallery'
    UNION ALL
    SELECT `galleryScopeKey`, `href`, `id`, 1 AS `menuLevel`
    FROM `menu_sub_items`
    WHERE `pageType` = 'gallery'
  ) AS `gallery_scopes`
  ORDER BY CASE
    WHEN `href` = '/page/%EC%BB%A4%EB%AE%A4%EB%8B%88%ED%8B%B0-%EC%B5%9C%EA%B7%BC-%ED%96%89%EC%82%AC-%EC%82%AC%EC%A7%84' THEN 0
    ELSE 1
  END, `menuLevel`, `id`
  LIMIT 1
) AS `event_gallery`
SET `gallery`.`galleryScopeKey` = `event_gallery`.`galleryScopeKey`
WHERE `gallery`.`isHomeGallery` = 0
  AND (`gallery`.`galleryScopeKey` IS NULL OR `gallery`.`galleryScopeKey` = '');

CREATE INDEX `gallery_items_scope_visible_idx`
ON `gallery_items` (`galleryScopeKey`, `isVisible`, `albumSortOrder`);
