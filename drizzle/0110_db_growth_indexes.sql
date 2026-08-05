-- MySQL does not support CREATE INDEX IF NOT EXISTS. Each index is therefore
-- selected conditionally so this migration can resume after partial DDL commits.
-- INPLACE/NONE are requirements: unsupported tables fail instead of falling back
-- to a table-copying or write-blocking DDL algorithm.
-- Fail quickly instead of waiting indefinitely for a metadata lock held by traffic.
SET SESSION lock_wait_timeout = 5;
-- --> statement-breakpoint
SET @joych_index_sql = IF(
  EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'facility_blocked_dates' AND INDEX_NAME = 'facility_blocked_dates_facility_date_idx'),
  'SELECT 1',
  'ALTER TABLE `facility_blocked_dates` ADD INDEX `facility_blocked_dates_facility_date_idx` (`facilityId`,`blockedDate`), ALGORITHM=INPLACE, LOCK=NONE'
);
-- --> statement-breakpoint
PREPARE joych_index_statement FROM @joych_index_sql;
-- --> statement-breakpoint
EXECUTE joych_index_statement;
-- --> statement-breakpoint
DEALLOCATE PREPARE joych_index_statement;
-- --> statement-breakpoint
SET @joych_index_sql = IF(
  EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notices' AND INDEX_NAME = 'notices_published_created_idx'),
  'SELECT 1',
  'ALTER TABLE `notices` ADD INDEX `notices_published_created_idx` (`isPublished`,`createdAt`), ALGORITHM=INPLACE, LOCK=NONE'
);
-- --> statement-breakpoint
PREPARE joych_index_statement FROM @joych_index_sql;
-- --> statement-breakpoint
EXECUTE joych_index_statement;
-- --> statement-breakpoint
DEALLOCATE PREPARE joych_index_statement;
-- --> statement-breakpoint
SET @joych_index_sql = IF(
  EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notices' AND INDEX_NAME = 'notices_category_published_created_idx'),
  'SELECT 1',
  'ALTER TABLE `notices` ADD INDEX `notices_category_published_created_idx` (`category`,`isPublished`,`createdAt`), ALGORITHM=INPLACE, LOCK=NONE'
);
-- --> statement-breakpoint
PREPARE joych_index_statement FROM @joych_index_sql;
-- --> statement-breakpoint
EXECUTE joych_index_statement;
-- --> statement-breakpoint
DEALLOCATE PREPARE joych_index_statement;
-- --> statement-breakpoint
SET @joych_index_sql = IF(
  EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reservations' AND INDEX_NAME = 'reservations_facility_date_status_time_idx'),
  'SELECT 1',
  'ALTER TABLE `reservations` ADD INDEX `reservations_facility_date_status_time_idx` (`facilityId`,`reservationDate`,`status`,`startTime`,`endTime`), ALGORITHM=INPLACE, LOCK=NONE'
);
-- --> statement-breakpoint
PREPARE joych_index_statement FROM @joych_index_sql;
-- --> statement-breakpoint
EXECUTE joych_index_statement;
-- --> statement-breakpoint
DEALLOCATE PREPARE joych_index_statement;
-- --> statement-breakpoint
SET @joych_index_sql = IF(
  EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reservations' AND INDEX_NAME = 'reservations_user_created_idx'),
  'SELECT 1',
  'ALTER TABLE `reservations` ADD INDEX `reservations_user_created_idx` (`userId`,`createdAt`), ALGORITHM=INPLACE, LOCK=NONE'
);
-- --> statement-breakpoint
PREPARE joych_index_statement FROM @joych_index_sql;
-- --> statement-breakpoint
EXECUTE joych_index_statement;
-- --> statement-breakpoint
DEALLOCATE PREPARE joych_index_statement;
-- --> statement-breakpoint
SET @joych_index_sql = IF(
  EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reservations' AND INDEX_NAME = 'reservations_status_created_idx'),
  'SELECT 1',
  'ALTER TABLE `reservations` ADD INDEX `reservations_status_created_idx` (`status`,`createdAt`), ALGORITHM=INPLACE, LOCK=NONE'
);
-- --> statement-breakpoint
PREPARE joych_index_statement FROM @joych_index_sql;
-- --> statement-breakpoint
EXECUTE joych_index_statement;
-- --> statement-breakpoint
DEALLOCATE PREPARE joych_index_statement;
-- --> statement-breakpoint
SET @joych_index_sql = IF(
  EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reservations' AND INDEX_NAME = 'reservations_created_idx'),
  'SELECT 1',
  'ALTER TABLE `reservations` ADD INDEX `reservations_created_idx` (`createdAt`), ALGORITHM=INPLACE, LOCK=NONE'
);
-- --> statement-breakpoint
PREPARE joych_index_statement FROM @joych_index_sql;
-- --> statement-breakpoint
EXECUTE joych_index_statement;
-- --> statement-breakpoint
DEALLOCATE PREPARE joych_index_statement;
-- --> statement-breakpoint
SET @joych_index_sql = IF(
  EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'youtube_videos' AND INDEX_NAME = 'youtube_videos_playlist_date_idx'),
  'SELECT 1',
  'ALTER TABLE `youtube_videos` ADD INDEX `youtube_videos_playlist_date_idx` (`playlistId`,`sermonDate`,`id`), ALGORITHM=INPLACE, LOCK=NONE'
);
-- --> statement-breakpoint
PREPARE joych_index_statement FROM @joych_index_sql;
-- --> statement-breakpoint
EXECUTE joych_index_statement;
-- --> statement-breakpoint
DEALLOCATE PREPARE joych_index_statement;
-- --> statement-breakpoint
SET @joych_index_sql = IF(
  EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'youtube_videos' AND INDEX_NAME = 'youtube_videos_playlist_visible_date_idx'),
  'SELECT 1',
  'ALTER TABLE `youtube_videos` ADD INDEX `youtube_videos_playlist_visible_date_idx` (`playlistId`,`isVisible`,`sermonDate`,`id`), ALGORITHM=INPLACE, LOCK=NONE'
);
-- --> statement-breakpoint
PREPARE joych_index_statement FROM @joych_index_sql;
-- --> statement-breakpoint
EXECUTE joych_index_statement;
-- --> statement-breakpoint
DEALLOCATE PREPARE joych_index_statement;
