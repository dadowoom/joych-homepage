CREATE TABLE `free_board_posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`author_member_id` int NOT NULL,
	`title` varchar(256) NOT NULL,
	`content` text NOT NULL,
	`status` enum('published','hidden','deleted') NOT NULL DEFAULT 'published',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `free_board_posts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `free_board_posts_status_created_idx` ON `free_board_posts` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `free_board_posts_author_idx` ON `free_board_posts` (`author_member_id`);