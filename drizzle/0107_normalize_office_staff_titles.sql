-- The office category does not have a separately editable title field.
-- Normalize legacy per-person values so public cards use the category label.
UPDATE `church_staff`
SET `title` = '교회직원'
WHERE `category` = 'office'
  AND `title` <> '교회직원';
