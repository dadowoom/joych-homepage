CREATE TABLE IF NOT EXISTS `dynamic_boards` (
  `id` int AUTO_INCREMENT NOT NULL,
  `menu_item_id` int,
  `menu_sub_item_id` int,
  `title` varchar(128) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `dynamic_boards_id` PRIMARY KEY(`id`),
  CONSTRAINT `dynamic_boards_menu_item_idx` UNIQUE(`menu_item_id`),
  CONSTRAINT `dynamic_boards_menu_sub_item_idx` UNIQUE(`menu_sub_item_id`)
);

CREATE TABLE IF NOT EXISTS `dynamic_board_posts` (
  `id` int AUTO_INCREMENT NOT NULL,
  `board_id` int NOT NULL,
  `title` varchar(256) NOT NULL,
  `content` text,
  `thumbnail_url` text,
  `is_published` boolean NOT NULL DEFAULT true,
  `is_pinned` boolean NOT NULL DEFAULT false,
  `author_id` int,
  `view_count` int NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `dynamic_board_posts_id` PRIMARY KEY(`id`)
);

CREATE INDEX `dynamic_board_posts_board_visible_idx`
  ON `dynamic_board_posts` (`board_id`, `is_published`, `created_at`);
