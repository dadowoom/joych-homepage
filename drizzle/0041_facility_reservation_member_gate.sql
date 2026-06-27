ALTER TABLE `church_members` ADD `can_reserve_facility` boolean NOT NULL DEFAULT false;

UPDATE `church_members`
SET `can_reserve_facility` = true
WHERE `status` = 'approved'
  AND COALESCE(
    NULLIF(TRIM(`registered_at`), ''),
    NULLIF(TRIM(`district`), ''),
    NULLIF(TRIM(`department`), ''),
    NULLIF(TRIM(`position`), ''),
    NULLIF(TRIM(`baptism_type`), '')
  ) IS NOT NULL
  AND LOWER(CONCAT_WS(' ', `position`, `department`, `district`, `baptism_type`, `admin_memo`, `join_path`)) NOT LIKE '%타교%'
  AND LOWER(CONCAT_WS(' ', `position`, `department`, `district`, `baptism_type`, `admin_memo`, `join_path`)) NOT LIKE '%외부%';
