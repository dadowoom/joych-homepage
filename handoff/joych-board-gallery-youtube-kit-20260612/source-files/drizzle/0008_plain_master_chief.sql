ALTER TABLE `youtube_videos` MODIFY COLUMN `videoId` varchar(32);--> statement-breakpoint
ALTER TABLE `youtube_videos` ADD `videoUrl` text;