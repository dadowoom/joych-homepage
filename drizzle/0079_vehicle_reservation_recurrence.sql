ALTER TABLE `vehicle_reservations`
  ADD COLUMN `recurrence_group_id` varchar(64),
  ADD COLUMN `recurrence_label` varchar(160),
  ADD COLUMN `recurrence_sequence` int NOT NULL DEFAULT 0;
--> statement-breakpoint
CREATE INDEX `vehicle_reservations_recurrence_group_idx`
  ON `vehicle_reservations` (`recurrence_group_id`);
