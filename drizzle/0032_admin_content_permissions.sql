CREATE TABLE `admin_content_permissions` (
  `id` int AUTO_INCREMENT NOT NULL,
  `user_id` int NOT NULL,
  `permission_key` varchar(128) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `admin_content_permissions_id` PRIMARY KEY(`id`),
  CONSTRAINT `admin_content_permissions_user_key_unique` UNIQUE(`user_id`,`permission_key`)
);

CREATE INDEX `admin_content_permissions_user_id_idx` ON `admin_content_permissions` (`user_id`);
CREATE INDEX `admin_content_permissions_permission_key_idx` ON `admin_content_permissions` (`permission_key`);
