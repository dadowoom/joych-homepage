ALTER TABLE `menu_items`
  ADD COLUMN `allowGuest` boolean NOT NULL DEFAULT true AFTER `isVisible`,
  ADD COLUMN `allowMember` boolean NOT NULL DEFAULT true AFTER `allowGuest`;

ALTER TABLE `menu_sub_items`
  ADD COLUMN `allowGuest` boolean NOT NULL DEFAULT true AFTER `isVisible`,
  ADD COLUMN `allowMember` boolean NOT NULL DEFAULT true AFTER `allowGuest`;
