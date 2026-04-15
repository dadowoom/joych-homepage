CREATE TABLE `church_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(64) NOT NULL,
	`age` int,
	`gender` varchar(8),
	`district` varchar(64),
	`position` varchar(32),
	`ministry` varchar(128),
	`phone` varchar(32),
	`address` varchar(256),
	`registeredAt` varchar(16),
	`faithPlusUserId` int,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `church_members_id` PRIMARY KEY(`id`)
);
