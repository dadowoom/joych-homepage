-- Repair menu pages that were saved using a Korean nested URL. CMS pages are
-- rendered only through the `/page/...` route, so these otherwise result in a 404.
UPDATE menu_items
SET href = '/page/교회소개-3대-비전-9대-전략1'
WHERE id = 180032
  AND href = '/교회소개/3대-비전-9대-전략1';
