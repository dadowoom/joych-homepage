DELETE older_hours
FROM `facility_hours` older_hours
INNER JOIN `facility_hours` newer_hours
  ON older_hours.`facilityId` = newer_hours.`facilityId`
  AND older_hours.`dayOfWeek` = newer_hours.`dayOfWeek`
  AND older_hours.`id` < newer_hours.`id`;
--> statement-breakpoint
ALTER TABLE `facility_hours` ADD CONSTRAINT `facility_hours_facility_day_unique` UNIQUE(`facilityId`,`dayOfWeek`);
