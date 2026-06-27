ALTER TABLE `subtitle_requests` ADD `member_id` int;
--> statement-breakpoint
CREATE INDEX `subtitle_requests_member_created_idx` ON `subtitle_requests` (`member_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `bulletins` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(160) NOT NULL,
	`bulletin_date` varchar(10) NOT NULL,
	`file_name` varchar(255) NOT NULL,
	`file_url` varchar(512) NOT NULL,
	`file_size` int,
	`file_mime` varchar(128),
	`status` enum('published','hidden','archived') NOT NULL DEFAULT 'published',
	`author_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bulletins_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `bulletins_status_date_idx` ON `bulletins` (`status`,`bulletin_date`);
--> statement-breakpoint
CREATE INDEX `bulletins_created_idx` ON `bulletins` (`created_at`);
--> statement-breakpoint
CREATE TABLE `bulletin_ad_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`member_id` int NOT NULL,
	`title` varchar(160) NOT NULL,
	`author_name` varchar(64) NOT NULL,
	`phone` varchar(32),
	`email` varchar(320),
	`requested_date` varchar(10),
	`content` text NOT NULL,
	`attachment_name` varchar(255),
	`attachment_url` varchar(512),
	`attachment_size` int,
	`attachment_mime` varchar(128),
	`status` enum('new','reviewed','completed','archived') NOT NULL DEFAULT 'new',
	`admin_memo` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bulletin_ad_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `bulletin_ad_requests_status_created_idx` ON `bulletin_ad_requests` (`status`,`created_at`);
--> statement-breakpoint
CREATE INDEX `bulletin_ad_requests_member_created_idx` ON `bulletin_ad_requests` (`member_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `bulletin_ad_requests_date_idx` ON `bulletin_ad_requests` (`requested_date`);
