UPDATE `church_staff` AS staff
JOIN (
  SELECT
    `id`,
    ROW_NUMBER() OVER (
      PARTITION BY `category`
      ORDER BY
        CASE WHEN `sort_order` > 0 THEN `sort_order` ELSE 2147483647 END,
        `id`
    ) AS `next_sort_order`
  FROM `church_staff`
) AS ranked ON ranked.`id` = staff.`id`
SET staff.`sort_order` = ranked.`next_sort_order`
WHERE staff.`sort_order` <> ranked.`next_sort_order`;
