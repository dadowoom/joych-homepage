ALTER TABLE `courses`
  ADD COLUMN `facilityRepeatMode` enum('none','weekly','monthly-weekday','custom') NOT NULL DEFAULT 'none' AFTER `facilityReservationId`,
  ADD COLUMN `facilityRepeatDays` text NULL AFTER `facilityRepeatMode`,
  ADD COLUMN `facilityCustomDates` text NULL AFTER `facilityRepeatDays`;
