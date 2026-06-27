CREATE TABLE IF NOT EXISTS `church_staff_title_options` (
  `id` int AUTO_INCREMENT NOT NULL,
  `category_key` varchar(64) NOT NULL,
  `label` varchar(64) NOT NULL,
  `sort_order` int NOT NULL DEFAULT 0,
  `is_builtin` boolean NOT NULL DEFAULT false,
  `is_visible` boolean NOT NULL DEFAULT true,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `church_staff_title_options_id` PRIMARY KEY(`id`),
  CONSTRAINT `church_staff_title_options_category_label_unique` UNIQUE(`category_key`, `label`)
);
--> statement-breakpoint
CREATE INDEX `church_staff_title_options_category_sort_idx` ON `church_staff_title_options` (`category_key`, `is_visible`, `sort_order`);
--> statement-breakpoint
INSERT INTO `church_staff_title_options` (`category_key`, `label`, `sort_order`, `is_builtin`, `is_visible`) VALUES
  ('elder', '시무장로', 1, true, true),
  ('elder', '휴무장로', 2, true, true),
  ('elder', '원로장로', 3, true, true),
  ('elder', '은퇴장로', 4, true, true),
  ('cooperation', '협력사역자', 1, true, true),
  ('cooperation', '파송선교사', 2, true, true),
  ('cooperation', '협력선교사', 3, true, true),
  ('other', '이사장', 1, true, true),
  ('other', '감사', 2, true, true),
  ('other', '이사', 3, true, true),
  ('other', '법인사무처', 4, true, true),
  ('other', '창포종합사회복지관', 5, true, true),
  ('other', '경북동부 노인보호전문기관', 6, true, true),
  ('other', '경상북도학대피해 노인전용쉼터', 7, true, true),
  ('other', '경북남부 노인보호전문기관', 8, true, true),
  ('other', '은빛빌리지', 9, true, true),
  ('other', '시립창포어린이집', 10, true, true),
  ('other', '기쁨의지역아동센터', 11, true, true),
  ('other', '창포지역아동센터', 12, true, true),
  ('other', '포항시가족센터', 13, true, true)
ON DUPLICATE KEY UPDATE
  `sort_order` = VALUES(`sort_order`),
  `is_builtin` = true,
  `is_visible` = true;
