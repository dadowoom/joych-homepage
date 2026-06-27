CREATE TABLE `member_field_options` (
	`id` int AUTO_INCREMENT NOT NULL,
	`field_type` varchar(32) NOT NULL,
	`label` varchar(64) NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `member_field_options_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `page_blocks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`menuItemId` int,
	`menuSubItemId` int,
	`blockType` varchar(32) NOT NULL,
	`content` text NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`isVisible` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `page_blocks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `school_departments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(64) NOT NULL,
	`category` enum('church_school','youth') NOT NULL DEFAULT 'church_school',
	`ageRange` varchar(64),
	`worshipTime` varchar(128),
	`worshipPlace` varchar(128),
	`description` text,
	`educationGoals` text,
	`prayerTopics` text,
	`staffInfo` text,
	`imageUrl` varchar(512),
	`sortOrder` int NOT NULL DEFAULT 0,
	`isVisible` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `school_departments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `school_post_files` (
	`id` int AUTO_INCREMENT NOT NULL,
	`postId` int NOT NULL,
	`fileName` varchar(256) NOT NULL,
	`fileUrl` varchar(512) NOT NULL,
	`fileSize` int,
	`mimeType` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `school_post_files_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `school_posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`departmentId` int NOT NULL,
	`title` varchar(256) NOT NULL,
	`content` text,
	`authorName` varchar(64) NOT NULL,
	`memberId` int,
	`viewCount` int NOT NULL DEFAULT 0,
	`isNotice` boolean NOT NULL DEFAULT false,
	`isVisible` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `school_posts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `youtube_playlists` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(128) NOT NULL,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `youtube_playlists_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `youtube_videos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`playlistId` int NOT NULL,
	`videoId` varchar(32) NOT NULL,
	`title` varchar(256) NOT NULL,
	`thumbnailUrl` text,
	`description` text,
	`sortOrder` int NOT NULL DEFAULT 0,
	`isVisible` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `youtube_videos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `church_members` MODIFY COLUMN `position` varchar(64);--> statement-breakpoint
ALTER TABLE `church_members` ADD `email` varchar(128);--> statement-breakpoint
ALTER TABLE `church_members` ADD `password_hash` varchar(256);--> statement-breakpoint
ALTER TABLE `church_members` ADD `birth_date` varchar(16);--> statement-breakpoint
ALTER TABLE `church_members` ADD `emergency_phone` varchar(32);--> statement-breakpoint
ALTER TABLE `church_members` ADD `join_path` varchar(64);--> statement-breakpoint
ALTER TABLE `church_members` ADD `department` varchar(64);--> statement-breakpoint
ALTER TABLE `church_members` ADD `baptism_type` varchar(32);--> statement-breakpoint
ALTER TABLE `church_members` ADD `baptism_date` varchar(16);--> statement-breakpoint
ALTER TABLE `church_members` ADD `registered_at` varchar(16);--> statement-breakpoint
ALTER TABLE `church_members` ADD `pastor` varchar(64);--> statement-breakpoint
ALTER TABLE `church_members` ADD `admin_memo` text;--> statement-breakpoint
ALTER TABLE `church_members` ADD `status` enum('pending','approved','rejected','withdrawn') DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `church_members` ADD `faith_plus_user_id` varchar(64);--> statement-breakpoint
ALTER TABLE `church_members` ADD `created_at` timestamp DEFAULT (now()) NOT NULL;--> statement-breakpoint
ALTER TABLE `church_members` ADD `updated_at` timestamp DEFAULT (now()) NOT NULL ON UPDATE CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE `facilities` ADD `openTime` varchar(5) DEFAULT '09:00' NOT NULL;--> statement-breakpoint
ALTER TABLE `facilities` ADD `closeTime` varchar(5) DEFAULT '22:00' NOT NULL;--> statement-breakpoint
ALTER TABLE `menu_items` ADD `playlistId` int;--> statement-breakpoint
ALTER TABLE `menu_sub_items` ADD `playlistId` int;--> statement-breakpoint
ALTER TABLE `church_members` ADD CONSTRAINT `church_members_email_unique` UNIQUE(`email`);--> statement-breakpoint
ALTER TABLE `church_members` DROP COLUMN `age`;--> statement-breakpoint
ALTER TABLE `church_members` DROP COLUMN `ministry`;--> statement-breakpoint
ALTER TABLE `church_members` DROP COLUMN `registeredAt`;--> statement-breakpoint
ALTER TABLE `church_members` DROP COLUMN `faithPlusUserId`;--> statement-breakpoint
ALTER TABLE `church_members` DROP COLUMN `isActive`;--> statement-breakpoint
ALTER TABLE `church_members` DROP COLUMN `createdAt`;--> statement-breakpoint
ALTER TABLE `church_members` DROP COLUMN `updatedAt`;