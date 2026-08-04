ALTER TABLE menu_items
  ADD COLUMN defaultViewMode VARCHAR(10) DEFAULT 'list';
-- --> statement-breakpoint
ALTER TABLE menu_sub_items
  ADD COLUMN defaultViewMode VARCHAR(10) DEFAULT 'list';
-- --> statement-breakpoint
UPDATE menu_items
SET defaultViewMode = 'grid'
WHERE pageType = 'gallery';
-- --> statement-breakpoint
UPDATE menu_sub_items
SET defaultViewMode = 'grid'
WHERE pageType = 'gallery';
