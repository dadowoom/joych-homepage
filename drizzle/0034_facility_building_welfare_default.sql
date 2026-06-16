UPDATE `facilities`
SET `building` = 'welfare';
--> statement-breakpoint
ALTER TABLE `facilities`
ALTER `building` SET DEFAULT 'welfare';
