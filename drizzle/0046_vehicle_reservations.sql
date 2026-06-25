CREATE TABLE `vehicles` (
  `id` int AUTO_INCREMENT NOT NULL,
  `name` varchar(128) NOT NULL,
  `description` text,
  `plate_number` varchar(64),
  `location` varchar(128),
  `driver_info` varchar(128),
  `capacity` int NOT NULL DEFAULT 5,
  `slot_minutes` int NOT NULL DEFAULT 60,
  `min_slots` int NOT NULL DEFAULT 1,
  `max_slots` int NOT NULL DEFAULT 8,
  `approval_type` enum('auto','manual') NOT NULL DEFAULT 'manual',
  `is_reservable` boolean NOT NULL DEFAULT true,
  `is_visible` boolean NOT NULL DEFAULT true,
  `notice` text,
  `caution` text,
  `sort_order` int NOT NULL DEFAULT 0,
  `open_time` varchar(5) NOT NULL DEFAULT '09:00',
  `close_time` varchar(5) NOT NULL DEFAULT '22:00',
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `vehicles_id` PRIMARY KEY(`id`)
);

CREATE INDEX `vehicles_visible_sort_idx` ON `vehicles` (`is_visible`,`sort_order`);

CREATE TABLE `vehicle_images` (
  `id` int AUTO_INCREMENT NOT NULL,
  `vehicle_id` int NOT NULL,
  `image_url` text NOT NULL,
  `file_key` varchar(512),
  `caption` varchar(128),
  `is_thumbnail` boolean NOT NULL DEFAULT false,
  `sort_order` int NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `vehicle_images_id` PRIMARY KEY(`id`)
);

CREATE INDEX `vehicle_images_vehicle_order_idx` ON `vehicle_images` (`vehicle_id`,`is_thumbnail`,`sort_order`);

CREATE TABLE `vehicle_reservations` (
  `id` int AUTO_INCREMENT NOT NULL,
  `vehicle_id` int NOT NULL,
  `user_id` int NOT NULL,
  `reserver_name` varchar(64) NOT NULL,
  `reserver_phone` varchar(32),
  `reservation_date` varchar(10) NOT NULL,
  `start_time` varchar(5) NOT NULL,
  `end_time` varchar(5) NOT NULL,
  `purpose` varchar(256) NOT NULL,
  `department` varchar(128),
  `passengers` int NOT NULL DEFAULT 1,
  `notes` text,
  `status` enum('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending',
  `admin_comment` text,
  `processed_by` int,
  `processed_at` timestamp NULL,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `vehicle_reservations_id` PRIMARY KEY(`id`)
);

CREATE INDEX `vehicle_reservations_vehicle_date_idx` ON `vehicle_reservations` (`vehicle_id`,`reservation_date`);
CREATE INDEX `vehicle_reservations_status_created_idx` ON `vehicle_reservations` (`status`,`created_at`);
CREATE INDEX `vehicle_reservations_user_created_idx` ON `vehicle_reservations` (`user_id`,`created_at`);

CREATE TABLE `vehicle_reservation_access_rules` (
  `id` int AUTO_INCREMENT NOT NULL,
  `field_type` varchar(32) NOT NULL,
  `field_value` varchar(64) NOT NULL,
  `is_active` boolean NOT NULL DEFAULT true,
  `sort_order` int NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `vehicle_reservation_access_rules_id` PRIMARY KEY(`id`),
  CONSTRAINT `vehicle_access_field_value_unique` UNIQUE(`field_type`,`field_value`)
);

CREATE INDEX `vehicle_access_active_idx` ON `vehicle_reservation_access_rules` (`is_active`,`sort_order`);
