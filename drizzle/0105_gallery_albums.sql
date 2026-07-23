CREATE TABLE IF NOT EXISTS `gallery_albums` (
  `id` int AUTO_INCREMENT NOT NULL,
  `galleryScopeKey` varchar(96) NOT NULL,
  `albumKey` varchar(96) NOT NULL,
  `title` varchar(160) NOT NULL,
  `description` text,
  `albumSortOrder` int NOT NULL DEFAULT 0,
  `coverImageId` int,
  `isVisible` boolean NOT NULL DEFAULT true,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `gallery_albums_id` PRIMARY KEY (`id`),
  UNIQUE KEY `gallery_albums_scope_key_uq` (`galleryScopeKey`, `albumKey`),
  KEY `gallery_albums_scope_visible_sort_idx`
    (`galleryScopeKey`, `isVisible`, `albumSortOrder`),
  KEY `gallery_albums_cover_image_idx` (`coverImageId`),
  CONSTRAINT `gallery_albums_cover_image_fk`
    FOREIGN KEY (`coverImageId`) REFERENCES `gallery_items` (`id`)
    ON DELETE SET NULL
);
--> statement-breakpoint

UPDATE `gallery_items`
SET `albumKey` = CASE
  WHEN NULLIF(TRIM(`albumTitle`), '') IS NOT NULL THEN
    CONCAT(
      'legacy-',
      SUBSTRING(
        SHA2(
          CONCAT(
            TRIM(`galleryScopeKey`),
            ':',
            TRIM(`albumTitle`)
          ),
          256
        ),
        1,
        32
      )
    )
  ELSE 'legacy-recent-gallery'
END
WHERE `isHomeGallery` = false
  AND NULLIF(TRIM(`galleryScopeKey`), '') IS NOT NULL
  AND NULLIF(TRIM(`albumKey`), '') IS NULL;
--> statement-breakpoint

INSERT INTO `gallery_albums` (
  `galleryScopeKey`,
  `albumKey`,
  `title`,
  `description`,
  `albumSortOrder`,
  `coverImageId`,
  `isVisible`,
  `createdAt`
)
SELECT
  grouped.`galleryScopeKey`,
  grouped.`albumKey`,
  grouped.`title`,
  grouped.`description`,
  grouped.`albumSortOrder`,
  (
    SELECT cover_item.`id`
    FROM `gallery_items` AS cover_item
    WHERE cover_item.`isHomeGallery` = false
      AND cover_item.`galleryScopeKey` = grouped.`galleryScopeKey`
      AND cover_item.`albumKey` = grouped.`albumKey`
      AND cover_item.`isVisible` = true
    ORDER BY
      cover_item.`sortOrder` ASC,
      cover_item.`createdAt` DESC,
      cover_item.`id` ASC
    LIMIT 1
  ),
  grouped.`isVisible`,
  grouped.`createdAt`
FROM (
  SELECT
    TRIM(`galleryScopeKey`) AS `galleryScopeKey`,
    TRIM(`albumKey`) AS `albumKey`,
    COALESCE(
      MAX(NULLIF(TRIM(`albumTitle`), '')),
      '최근 행사 사진'
    ) AS `title`,
    MAX(NULLIF(`albumDescription`, '')) AS `description`,
    MAX(`albumSortOrder`) AS `albumSortOrder`,
    MAX(`isVisible`) AS `isVisible`,
    MAX(`createdAt`) AS `createdAt`
  FROM `gallery_items`
  WHERE `isHomeGallery` = false
    AND NULLIF(TRIM(`galleryScopeKey`), '') IS NOT NULL
    AND NULLIF(TRIM(`albumKey`), '') IS NOT NULL
  GROUP BY TRIM(`galleryScopeKey`), TRIM(`albumKey`)
) AS grouped
ON DUPLICATE KEY UPDATE
  `title` = VALUES(`title`),
  `description` = VALUES(`description`),
  `albumSortOrder` = VALUES(`albumSortOrder`),
  `coverImageId` = COALESCE(
    `coverImageId`,
    VALUES(`coverImageId`)
  ),
  `isVisible` = VALUES(`isVisible`);
