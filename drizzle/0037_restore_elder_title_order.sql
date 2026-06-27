UPDATE `church_staff_title_options`
SET
  `sort_order` = CASE `label`
    WHEN '원로장로' THEN 1
    WHEN '은퇴장로' THEN 2
    WHEN '시무장로' THEN 3
    WHEN '휴무장로' THEN 4
    ELSE `sort_order`
  END,
  `is_builtin` = true,
  `is_visible` = true
WHERE `category_key` = 'elder'
  AND `label` IN ('원로장로', '은퇴장로', '시무장로', '휴무장로');
