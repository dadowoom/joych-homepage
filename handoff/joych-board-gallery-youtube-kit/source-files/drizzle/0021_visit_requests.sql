CREATE TABLE `visit_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organization_name` varchar(128) NOT NULL,
	`applicant_name` varchar(64) NOT NULL,
	`phone` varchar(32) NOT NULL,
	`email` varchar(320),
	`visit_date` varchar(10) NOT NULL,
	`visit_time` varchar(5),
	`headcount` int NOT NULL DEFAULT 1,
	`visitor_type` enum('church','institution','individual','other') NOT NULL DEFAULT 'church',
	`purpose` varchar(128) NOT NULL,
	`message` text,
	`status` enum('new','contacted','scheduled','completed','archived') NOT NULL DEFAULT 'new',
	`admin_memo` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `visit_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `visit_requests_status_created_idx` ON `visit_requests` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `visit_requests_date_idx` ON `visit_requests` (`visit_date`);
