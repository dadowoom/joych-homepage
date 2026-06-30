ALTER TABLE `push_subscriptions`
  MODIFY COLUMN `member_id` int NULL,
  ADD COLUMN `user_id` int NULL AFTER `member_id`;

CREATE INDEX `push_subscriptions_user_id_idx` ON `push_subscriptions` (`user_id`);
