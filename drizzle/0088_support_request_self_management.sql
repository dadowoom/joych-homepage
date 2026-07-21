ALTER TABLE `visit_requests`
  ADD COLUMN `member_id` int NULL AFTER `id`,
  ADD COLUMN `manage_token_hash` varchar(64) NULL AFTER `member_id`,
  ADD KEY `visit_requests_member_created_idx` (`member_id`, `created_at`),
  ADD UNIQUE KEY `visit_requests_manage_token_hash_unique` (`manage_token_hash`);
