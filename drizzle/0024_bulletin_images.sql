CREATE TABLE `bulletin_images` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bulletin_id` int NOT NULL,
	`file_name` varchar(255) NOT NULL,
	`file_url` varchar(512) NOT NULL,
	`file_size` int,
	`file_mime` varchar(128),
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bulletin_images_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `bulletin_images_bulletin_order_idx` ON `bulletin_images` (`bulletin_id`,`sort_order`);
--> statement-breakpoint
CREATE INDEX `bulletin_images_created_idx` ON `bulletin_images` (`created_at`);
