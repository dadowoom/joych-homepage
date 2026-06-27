CREATE TABLE IF NOT EXISTS `external_facility_hours` (
  `id` int AUTO_INCREMENT NOT NULL,
  `facilityId` int NOT NULL,
  `dayOfWeek` int NOT NULL,
  `isOpen` boolean NOT NULL DEFAULT true,
  `openTime` varchar(5) NOT NULL DEFAULT '09:00',
  `closeTime` varchar(5) NOT NULL DEFAULT '22:00',
  `breakStart` varchar(5),
  `breakEnd` varchar(5),
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `external_facility_hours_id` PRIMARY KEY(`id`),
  CONSTRAINT `external_facility_hours_facility_day_unique` UNIQUE(`facilityId`, `dayOfWeek`)
);

INSERT INTO `external_facility_hours` (
  `facilityId`,
  `dayOfWeek`,
  `isOpen`,
  `openTime`,
  `closeTime`,
  `breakStart`,
  `breakEnd`
)
SELECT
  fh.`facilityId`,
  fh.`dayOfWeek`,
  fh.`isOpen`,
  fh.`openTime`,
  fh.`closeTime`,
  fh.`breakStart`,
  fh.`breakEnd`
FROM `facility_hours` fh
INNER JOIN `facilities` f ON f.`id` = fh.`facilityId`
WHERE f.`isExternalReservable` = true
ON DUPLICATE KEY UPDATE
  `isOpen` = VALUES(`isOpen`),
  `openTime` = VALUES(`openTime`),
  `closeTime` = VALUES(`closeTime`),
  `breakStart` = VALUES(`breakStart`),
  `breakEnd` = VALUES(`breakEnd`);
