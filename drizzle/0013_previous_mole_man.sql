CREATE TABLE `notice_popups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(160) NOT NULL,
	`content` text,
	`image_url` text,
	`link_label` varchar(64),
	`link_href` varchar(512),
	`placement` enum('modal','top_banner','bottom_sheet') NOT NULL DEFAULT 'modal',
	`audience` enum('all','guest','member') NOT NULL DEFAULT 'all',
	`is_active` boolean NOT NULL DEFAULT true,
	`is_dismissible` boolean NOT NULL DEFAULT true,
	`dismiss_period_hours` int NOT NULL DEFAULT 24,
	`priority` int NOT NULL DEFAULT 0,
	`start_at` timestamp,
	`end_at` timestamp,
	`author_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `notice_popups_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `notice_popups_active_schedule_idx` ON `notice_popups` (`is_active`,`start_at`,`end_at`);--> statement-breakpoint
CREATE INDEX `notice_popups_priority_idx` ON `notice_popups` (`priority`,`created_at`);