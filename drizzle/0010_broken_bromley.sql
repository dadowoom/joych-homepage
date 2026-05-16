CREATE TABLE `member_social_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`member_id` int NOT NULL,
	`provider` enum('google','kakao') NOT NULL,
	`provider_user_id` varchar(191) NOT NULL,
	`email` varchar(254),
	`display_name` varchar(128),
	`profile_image_url` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `member_social_accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `member_social_provider_user_unique` UNIQUE(`provider`,`provider_user_id`),
	CONSTRAINT `member_social_member_provider_unique` UNIQUE(`member_id`,`provider`)
);
--> statement-breakpoint
CREATE INDEX `member_social_member_id_idx` ON `member_social_accounts` (`member_id`);