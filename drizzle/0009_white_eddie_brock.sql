CREATE TABLE `mission_report_authors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`memberId` int NOT NULL,
	`missionaryId` int NOT NULL,
	`canWrite` boolean NOT NULL DEFAULT true,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mission_report_authors_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mission_report_images` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reportId` int NOT NULL,
	`imageUrl` text NOT NULL,
	`caption` varchar(128),
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mission_report_images_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mission_report_prayer_topics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reportId` int NOT NULL,
	`content` varchar(512) NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mission_report_prayer_topics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mission_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`missionaryId` int NOT NULL,
	`authorMemberId` int,
	`title` varchar(256) NOT NULL,
	`summary` text,
	`content` text,
	`thumbnailUrl` text,
	`reportDate` varchar(10) NOT NULL,
	`status` enum('draft','pending','published','rejected') NOT NULL DEFAULT 'pending',
	`publishedAt` timestamp,
	`reviewedBy` int,
	`reviewedAt` timestamp,
	`reviewComment` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mission_reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `missionaries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`region` varchar(128) NOT NULL,
	`continent` enum('asia','africa','americas','europe','oceania') NOT NULL DEFAULT 'asia',
	`sentYear` int NOT NULL DEFAULT 0,
	`profileImage` text,
	`organization` varchar(128),
	`description` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `missionaries_id` PRIMARY KEY(`id`)
);
