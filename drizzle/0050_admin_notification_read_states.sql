CREATE TABLE IF NOT EXISTS `admin_notification_read_states` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `group_key` varchar(128) NOT NULL,
  `last_seen_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `admin_notification_read_states_user_group_unique` (`user_id`, `group_key`),
  KEY `admin_notification_read_states_user_id_idx` (`user_id`)
);

INSERT INTO `site_settings` (`settingKey`, `settingValue`, `description`)
VALUES (
  'admin_notification_baseline_at',
  DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-%dT%H:%i:%s.000Z'),
  '관리자 새 알림 표시 시작 기준 시각'
)
ON DUPLICATE KEY UPDATE `settingValue` = `settingValue`;
