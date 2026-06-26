ALTER TABLE `facilities`
  ADD COLUMN `isExternalReservable` boolean NOT NULL DEFAULT false AFTER `isReservable`;

ALTER TABLE `reservations`
  MODIFY `userId` int NULL,
  ADD COLUMN `reservationType` enum('member','external') NOT NULL DEFAULT 'member' AFTER `userId`,
  MODIFY `status` enum('pending','checking','approved','rejected','cancelled') NOT NULL DEFAULT 'pending';

UPDATE `reservations`
SET `reservationType` = 'member'
WHERE `reservationType` IS NULL;
