ALTER TABLE `member_password_reset_requests`
  MODIFY COLUMN `status` enum('pending','approved','resolved','cancelled') NOT NULL DEFAULT 'pending',
  ADD COLUMN `reset_token_hash` varchar(64) NULL AFTER `requested_at`,
  ADD COLUMN `reset_token_expires_at` timestamp NULL DEFAULT NULL AFTER `reset_token_hash`,
  ADD COLUMN `approved_by` int NULL AFTER `reset_token_expires_at`,
  ADD COLUMN `approved_at` timestamp NULL DEFAULT NULL AFTER `approved_by`,
  ADD UNIQUE KEY `member_password_reset_requests_token_hash_unique` (`reset_token_hash`);
