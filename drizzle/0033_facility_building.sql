ALTER TABLE `facilities` ADD `building` varchar(32) NOT NULL DEFAULT 'hayoungin';
--> statement-breakpoint
CREATE INDEX `facilities_building_visible_sort_idx` ON `facilities` (`building`, `isVisible`, `sortOrder`);
