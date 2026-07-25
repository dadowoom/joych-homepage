-- The education category does not have a separately editable title field.
-- Normalize legacy per-person values so public cards use the category label.
UPDATE `church_staff`
SET `title` = '교회학교 교역자'
WHERE `category` = 'education'
  AND `title` <> '교회학교 교역자';
