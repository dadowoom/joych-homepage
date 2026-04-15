CREATE TABLE `menu_sub_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`menuItemId` int NOT NULL,
	`label` varchar(64) NOT NULL,
	`href` varchar(256),
	`sortOrder` int NOT NULL DEFAULT 0,
	`isVisible` boolean NOT NULL DEFAULT true,
	`pageType` enum('image','gallery','board','youtube','editor') NOT NULL DEFAULT 'image',
	`pageImageUrl` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `menu_sub_items_id` PRIMARY KEY(`id`)
);
