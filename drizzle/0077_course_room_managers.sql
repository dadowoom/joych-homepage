CREATE TABLE `course_room_managers` (
  `id` int AUTO_INCREMENT NOT NULL,
  `memberId` int NOT NULL,
  `pageHref` varchar(255) NOT NULL,
  `canManage` boolean NOT NULL DEFAULT true,
  `createdBy` int,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `course_room_managers_id` PRIMARY KEY(`id`),
  CONSTRAINT `course_room_managers_member_page_unique` UNIQUE(`memberId`,`pageHref`)
);
--> statement-breakpoint
CREATE INDEX `course_room_managers_page_access_idx` ON `course_room_managers` (`pageHref`,`canManage`);
