CREATE TABLE `subtitle_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(160) NOT NULL,
	`author_name` varchar(64) NOT NULL,
	`phone` varchar(32) NOT NULL,
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
	CONSTRAINT `subtitle_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `subtitle_requests_status_created_idx` ON `subtitle_requests` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `subtitle_requests_date_idx` ON `subtitle_requests` (`requested_date`);
