CREATE TABLE IF NOT EXISTS `member_districts` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `member_id` int NOT NULL,
  `district` varchar(64) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `member_districts_member_district_unique` UNIQUE (`member_id`, `district`)
);

CREATE INDEX `member_districts_member_id_idx` ON `member_districts` (`member_id`);
CREATE INDEX `member_districts_district_idx` ON `member_districts` (`district`);
