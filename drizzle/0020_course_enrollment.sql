CREATE TABLE `courses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(128) NOT NULL,
	`summary` varchar(500),
	`description` text,
	`instructor` varchar(64),
	`location` varchar(128),
	`target` varchar(128),
	`fee` varchar(128),
	`capacity` int NOT NULL DEFAULT 0,
	`startDate` varchar(10),
	`endDate` varchar(10),
	`startTime` varchar(5),
	`endTime` varchar(5),
	`applyStartDate` varchar(10),
	`applyEndDate` varchar(10),
	`status` enum('draft','open','closed','archived') NOT NULL DEFAULT 'draft',
	`isVisible` boolean NOT NULL DEFAULT true,
	`applicationNotice` text,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `courses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `course_applications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`courseId` int NOT NULL,
	`memberId` int NOT NULL,
	`applicantName` varchar(64) NOT NULL,
	`applicantPhone` varchar(32),
	`applicantEmail` varchar(320),
	`memo` text,
	`status` enum('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending',
	`adminComment` text,
	`processedBy` int,
	`processedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `course_applications_id` PRIMARY KEY(`id`),
	CONSTRAINT `course_applications_course_member_unique` UNIQUE(`courseId`,`memberId`)
);
--> statement-breakpoint
CREATE INDEX `courses_status_visible_sort_idx` ON `courses` (`status`,`isVisible`,`sortOrder`);--> statement-breakpoint
CREATE INDEX `courses_apply_window_idx` ON `courses` (`applyStartDate`,`applyEndDate`);--> statement-breakpoint
CREATE INDEX `course_applications_course_status_idx` ON `course_applications` (`courseId`,`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `course_applications_member_created_idx` ON `course_applications` (`memberId`,`createdAt`);
