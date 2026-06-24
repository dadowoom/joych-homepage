ALTER TABLE `notices`
  ADD COLUMN `viewCount` int NOT NULL DEFAULT 0 AFTER `authorId`;
--> statement-breakpoint
ALTER TABLE `free_board_posts`
  ADD COLUMN `view_count` int NOT NULL DEFAULT 0 AFTER `status`;
--> statement-breakpoint
ALTER TABLE `bulletins`
  ADD COLUMN `view_count` int NOT NULL DEFAULT 0 AFTER `author_id`;
