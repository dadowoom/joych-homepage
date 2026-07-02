ALTER TABLE `notices`
  ADD COLUMN `isSecret` boolean NOT NULL DEFAULT false;

ALTER TABLE `dynamic_board_posts`
  ADD COLUMN `is_secret` boolean NOT NULL DEFAULT false;

ALTER TABLE `free_board_posts`
  ADD COLUMN `is_secret` boolean NOT NULL DEFAULT false;

ALTER TABLE `testimony_posts`
  ADD COLUMN `is_secret` boolean NOT NULL DEFAULT false;
