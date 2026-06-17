CREATE TABLE `new_member_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(64) NOT NULL,
	`phone` varchar(32) NOT NULL,
	`age` int,
	`address` varchar(256),
	`how` varchar(64),
	`status` enum('new','contacted','archived') NOT NULL DEFAULT 'new',
	`admin_memo` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `new_member_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `prayer_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(64) NOT NULL,
	`category` varchar(32) NOT NULL,
	`content` text NOT NULL,
	`status` enum('new','reviewed','archived') NOT NULL DEFAULT 'new',
	`admin_memo` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `prayer_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `new_member_requests_status_created_idx` ON `new_member_requests` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `prayer_requests_status_created_idx` ON `prayer_requests` (`status`,`created_at`);