ALTER TABLE `menus`
  ADD COLUMN `allowGuest` boolean NOT NULL DEFAULT true AFTER `isVisible`,
  ADD COLUMN `allowMember` boolean NOT NULL DEFAULT true AFTER `allowGuest`;
