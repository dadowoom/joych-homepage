CREATE TABLE `testimony_comments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`post_id` int NOT NULL,
	`author_member_id` int NOT NULL,
	`content` text NOT NULL,
	`status` enum('published','hidden','deleted') NOT NULL DEFAULT 'published',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `testimony_comments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `testimony_post_images` (
	`id` int AUTO_INCREMENT NOT NULL,
	`post_id` int NOT NULL,
	`image_url` text NOT NULL,
	`caption` varchar(128),
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `testimony_post_images_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `testimony_posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`author_member_id` int NOT NULL,
	`title` varchar(256) NOT NULL,
	`content` text NOT NULL,
	`thumbnail_url` text,
	`status` enum('published','hidden','deleted') NOT NULL DEFAULT 'published',
	`view_count` int NOT NULL DEFAULT 0,
	`is_pinned` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `testimony_posts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `testimony_comments_post_status_idx` ON `testimony_comments` (`post_id`,`status`);--> statement-breakpoint
CREATE INDEX `testimony_comments_author_idx` ON `testimony_comments` (`author_member_id`);--> statement-breakpoint
CREATE INDEX `testimony_post_images_post_idx` ON `testimony_post_images` (`post_id`);--> statement-breakpoint
CREATE INDEX `testimony_posts_status_created_idx` ON `testimony_posts` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `testimony_posts_author_idx` ON `testimony_posts` (`author_member_id`);