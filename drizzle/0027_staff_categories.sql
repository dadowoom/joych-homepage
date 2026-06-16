CREATE TABLE `church_staff_categories` (
  `id` int AUTO_INCREMENT NOT NULL,
  `category_key` varchar(64) NOT NULL,
  `label` varchar(64) NOT NULL,
  `sort_order` int NOT NULL DEFAULT 0,
  `is_builtin` boolean NOT NULL DEFAULT false,
  `is_visible` boolean NOT NULL DEFAULT true,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `church_staff_categories_id` PRIMARY KEY(`id`),
  CONSTRAINT `church_staff_categories_category_key_unique` UNIQUE(`category_key`)
);
--> statement-breakpoint
CREATE INDEX `church_staff_categories_visible_sort_idx` ON `church_staff_categories` (`is_visible`,`sort_order`);
--> statement-breakpoint
INSERT INTO `church_staff_categories` (`category_key`, `label`, `sort_order`, `is_builtin`, `is_visible`) VALUES
('senior', '담임목사', 1, true, true),
('associate', '부교역자', 2, true, true),
('education', '교회학교 교역자', 3, true, true),
('cooperation', '협력사역자', 4, true, true),
('elder', '장로', 5, true, true),
('office', '교회직원', 6, true, true),
('other', '사회복지법인 기쁨의복지재단', 7, true, true)
ON DUPLICATE KEY UPDATE
  `label` = VALUES(`label`),
  `sort_order` = VALUES(`sort_order`),
  `is_builtin` = true,
  `is_visible` = true;
--> statement-breakpoint
ALTER TABLE `church_staff`
  MODIFY COLUMN `category` varchar(64) NOT NULL DEFAULT 'associate';
