ALTER TABLE `courses`
  MODIFY COLUMN `facilityRepeatMode` enum('none','daily','weekly','monthly-weekday','custom') NOT NULL DEFAULT 'none';
