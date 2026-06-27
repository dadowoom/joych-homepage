ALTER TABLE menu_items
  ADD COLUMN defaultViewMode VARCHAR(10) DEFAULT 'list';

ALTER TABLE menu_sub_items
  ADD COLUMN defaultViewMode VARCHAR(10) DEFAULT 'list';

UPDATE menu_items
SET defaultViewMode = 'grid'
WHERE pageType = 'gallery';

UPDATE menu_sub_items
SET defaultViewMode = 'grid'
WHERE pageType = 'gallery';
