CREATE TABLE IF NOT EXISTS `history_decades` (
  `id` int AUTO_INCREMENT NOT NULL,
  `title` varchar(64) NOT NULL,
  `start_year` int NOT NULL,
  `end_year` int NOT NULL,
  `sort_order` int NOT NULL DEFAULT 0,
  `is_visible` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `history_decades_id` PRIMARY KEY(`id`)
);

CREATE INDEX `history_decades_visible_sort_idx`
  ON `history_decades` (`is_visible`, `sort_order`, `start_year`);

CREATE TABLE IF NOT EXISTS `history_items` (
  `id` int AUTO_INCREMENT NOT NULL,
  `decade_id` int NOT NULL,
  `year` int NOT NULL,
  `month` int NOT NULL,
  `content` text NOT NULL,
  `sort_order` int NOT NULL DEFAULT 0,
  `is_visible` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `history_items_id` PRIMARY KEY(`id`)
);

CREATE INDEX `history_items_decade_visible_sort_idx`
  ON `history_items` (`decade_id`, `is_visible`, `sort_order`, `year`, `month`);
