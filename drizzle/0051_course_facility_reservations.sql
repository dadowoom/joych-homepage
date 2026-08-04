ALTER TABLE `courses`
  ADD COLUMN `imageUrl` text NULL AFTER `summary`,
  ADD COLUMN `facilityId` int NULL AFTER `capacity`,
  ADD COLUMN `facilityReservationId` int NULL AFTER `facilityId`;
-- --> statement-breakpoint
ALTER TABLE `courses`
  MODIFY COLUMN `status` enum('draft','open','closed','cancelled','archived') NOT NULL DEFAULT 'draft';
-- --> statement-breakpoint
ALTER TABLE `reservations`
  MODIFY COLUMN `reservationType` enum('member','external','course') NOT NULL DEFAULT 'member';
-- --> statement-breakpoint
CREATE INDEX `courses_facility_idx` ON `courses` (`facilityId`);
-- --> statement-breakpoint
CREATE INDEX `courses_facility_reservation_idx` ON `courses` (`facilityReservationId`);
-- --> statement-breakpoint
INSERT INTO `menus` (`label`, `href`, `sortOrder`, `isVisible`)
SELECT '강좌', '/education/courses', nextSort, 1
FROM (SELECT COALESCE(MAX(`sortOrder`), 0) + 1 AS nextSort FROM `menus`) AS sort_source
WHERE NOT EXISTS (
  SELECT 1 FROM `menus`
  WHERE `href` = '/education/courses' OR `label` = '강좌'
);
