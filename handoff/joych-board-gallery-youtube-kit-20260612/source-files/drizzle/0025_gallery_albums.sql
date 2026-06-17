ALTER TABLE `gallery_items`
	ADD COLUMN `albumKey` varchar(96),
	ADD COLUMN `albumTitle` varchar(160);
--> statement-breakpoint
CREATE INDEX `gallery_items_album_key_idx` ON `gallery_items` (`albumKey`);
