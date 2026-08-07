-- Keep the member admin list responsive as the registry grows. MySQL does not
-- support CREATE INDEX IF NOT EXISTS, so each online DDL statement is guarded
-- and can safely resume after a partial deployment.
SET SESSION lock_wait_timeout = 5;
-- --> statement-breakpoint
SET @joych_index_sql = IF(
  EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'church_members' AND INDEX_NAME = 'church_members_created_id_idx'),
  'SELECT 1',
  'ALTER TABLE `church_members` ADD INDEX `church_members_created_id_idx` (`created_at`,`id`), ALGORITHM=INPLACE, LOCK=NONE'
);
-- --> statement-breakpoint
PREPARE joych_index_statement FROM @joych_index_sql;
-- --> statement-breakpoint
EXECUTE joych_index_statement;
-- --> statement-breakpoint
DEALLOCATE PREPARE joych_index_statement;
-- --> statement-breakpoint
SET @joych_index_sql = IF(
  EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'church_members' AND INDEX_NAME = 'church_members_status_created_id_idx'),
  'SELECT 1',
  'ALTER TABLE `church_members` ADD INDEX `church_members_status_created_id_idx` (`status`,`created_at`,`id`), ALGORITHM=INPLACE, LOCK=NONE'
);
-- --> statement-breakpoint
PREPARE joych_index_statement FROM @joych_index_sql;
-- --> statement-breakpoint
EXECUTE joych_index_statement;
-- --> statement-breakpoint
DEALLOCATE PREPARE joych_index_statement;
-- --> statement-breakpoint
SET @joych_index_sql = IF(
  EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'church_members' AND INDEX_NAME = 'church_members_name_created_id_idx'),
  'SELECT 1',
  'ALTER TABLE `church_members` ADD INDEX `church_members_name_created_id_idx` (`name`,`created_at`,`id`), ALGORITHM=INPLACE, LOCK=NONE'
);
-- --> statement-breakpoint
PREPARE joych_index_statement FROM @joych_index_sql;
-- --> statement-breakpoint
EXECUTE joych_index_statement;
-- --> statement-breakpoint
DEALLOCATE PREPARE joych_index_statement;
