ALTER TABLE `reservations`
  ADD COLUMN `recurrenceGroupId` varchar(64),
  ADD COLUMN `recurrenceLabel` varchar(160),
  ADD COLUMN `recurrenceSequence` int NOT NULL DEFAULT 0;
--> statement-breakpoint
CREATE INDEX `reservations_recurrence_group_idx` ON `reservations` (`recurrenceGroupId`);
