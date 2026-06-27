UPDATE `church_members`
SET `can_reserve_facility` = false
WHERE LOWER(CONCAT_WS(' ', `position`, `department`, `district`, `baptism_type`, `admin_memo`, `join_path`)) LIKE '%타교%'
   OR LOWER(CONCAT_WS(' ', `position`, `department`, `district`, `baptism_type`, `admin_memo`, `join_path`)) LIKE '%외부%';
