ALTER TABLE `menu_items` ADD `pageType` enum('image','gallery','board','youtube','editor') DEFAULT 'image' NOT NULL;--> statement-breakpoint
ALTER TABLE `menu_items` ADD `pageImageUrl` text;