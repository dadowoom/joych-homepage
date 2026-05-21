CREATE TABLE `church_staff` (
	`id` int AUTO_INCREMENT NOT NULL,
	`category` enum('senior','associate','education','office','elder','other') NOT NULL DEFAULT 'associate',
	`name` varchar(64) NOT NULL,
	`title` varchar(64) NOT NULL,
	`department` varchar(128),
	`description` text,
	`profile` text,
	`image_url` text,
	`sort_order` int NOT NULL DEFAULT 0,
	`is_visible` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `church_staff_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `church_staff_category_visible_sort_idx` ON `church_staff` (`category`,`is_visible`,`sort_order`);
--> statement-breakpoint
INSERT INTO `church_staff` (`category`, `name`, `title`, `department`, `description`, `profile`, `image_url`, `sort_order`, `is_visible`)
VALUES (
	'associate',
	'샘플 부교역자',
	'부목사',
	'교구 · 새가족부',
	'기쁨의교회를 함께 섬기는 부교역자 소개 예시입니다. 실제 정보로 수정하거나 삭제할 수 있습니다.',
	'담당: 교구, 새가족부
소개: 관리자 화면에서 약력과 담당 사역을 줄 단위로 입력할 수 있습니다.',
	NULL,
	10,
	true
);
