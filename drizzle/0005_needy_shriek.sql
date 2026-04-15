CREATE TABLE `facilities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`description` text,
	`location` varchar(128),
	`capacity` int NOT NULL DEFAULT 10,
	`pricePerHour` int NOT NULL DEFAULT 0,
	`slotMinutes` int NOT NULL DEFAULT 60,
	`minSlots` int NOT NULL DEFAULT 1,
	`maxSlots` int NOT NULL DEFAULT 8,
	`approvalType` enum('auto','manual') NOT NULL DEFAULT 'manual',
	`isReservable` boolean NOT NULL DEFAULT true,
	`isVisible` boolean NOT NULL DEFAULT true,
	`notice` text,
	`caution` text,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `facilities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `facility_blocked_dates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`facilityId` int,
	`blockedDate` varchar(10) NOT NULL,
	`reason` varchar(128),
	`isPartialBlock` boolean NOT NULL DEFAULT false,
	`blockStart` varchar(5),
	`blockEnd` varchar(5),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `facility_blocked_dates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `facility_hours` (
	`id` int AUTO_INCREMENT NOT NULL,
	`facilityId` int NOT NULL,
	`dayOfWeek` int NOT NULL,
	`isOpen` boolean NOT NULL DEFAULT true,
	`openTime` varchar(5) NOT NULL DEFAULT '09:00',
	`closeTime` varchar(5) NOT NULL DEFAULT '22:00',
	`breakStart` varchar(5),
	`breakEnd` varchar(5),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `facility_hours_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `facility_images` (
	`id` int AUTO_INCREMENT NOT NULL,
	`facilityId` int NOT NULL,
	`imageUrl` text NOT NULL,
	`fileKey` varchar(512),
	`caption` varchar(128),
	`isThumbnail` boolean NOT NULL DEFAULT false,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `facility_images_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reservations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`facilityId` int NOT NULL,
	`userId` int NOT NULL,
	`reserverName` varchar(64) NOT NULL,
	`reserverPhone` varchar(32),
	`reservationDate` varchar(10) NOT NULL,
	`startTime` varchar(5) NOT NULL,
	`endTime` varchar(5) NOT NULL,
	`purpose` varchar(256) NOT NULL,
	`attendees` int NOT NULL DEFAULT 1,
	`notes` text,
	`status` enum('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending',
	`adminComment` text,
	`processedBy` int,
	`processedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reservations_id` PRIMARY KEY(`id`)
);
