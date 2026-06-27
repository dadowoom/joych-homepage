ALTER TABLE `gallery_items` ADD COLUMN `isHomeGallery` boolean NOT NULL DEFAULT false;
CREATE INDEX `gallery_items_home_gallery_idx` ON `gallery_items` (`isHomeGallery`, `isVisible`);

SET @has_home_gallery = (
  SELECT COUNT(*)
  FROM `gallery_items`
  WHERE `isHomeGallery` = true
);

UPDATE `gallery_items` gi
LEFT JOIN (
  SELECT `albumKey`, COUNT(*) AS item_count
  FROM `gallery_items`
  WHERE `albumKey` IS NOT NULL
  GROUP BY `albumKey`
) grouped_gallery_items ON grouped_gallery_items.`albumKey` = gi.`albumKey`
SET gi.`isHomeGallery` = true
WHERE @has_home_gallery = 0
  AND COALESCE(grouped_gallery_items.item_count, 1) = 1;
