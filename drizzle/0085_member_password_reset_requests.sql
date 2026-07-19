CREATE TABLE IF NOT EXISTS `member_password_reset_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `member_id` int NOT NULL,
  `status` enum('pending','resolved','cancelled') NOT NULL DEFAULT 'pending',
  `requested_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `resolved_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `member_password_reset_requests_member_idx` (`member_id`),
  KEY `member_password_reset_requests_status_requested_idx` (`status`, `requested_at`)
);
