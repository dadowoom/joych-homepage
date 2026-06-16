ALTER TABLE `gallery_items`
	ADD COLUMN `albumSortOrder` int NOT NULL DEFAULT 0 AFTER `albumTitle`;
--> statement-breakpoint
CREATE INDEX `gallery_items_album_sort_order_idx` ON `gallery_items` (`albumSortOrder`);
