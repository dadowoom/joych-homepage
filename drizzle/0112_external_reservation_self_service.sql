ALTER TABLE `reservations`
  ADD COLUMN `managePasswordHash` varchar(256) NULL,
  ALGORITHM=INSTANT;
-- --> statement-breakpoint
ALTER TABLE `reservations`
  ADD COLUMN `manageLookupKeyHash` varchar(64) NULL,
  ALGORITHM=INSTANT;
-- --> statement-breakpoint
ALTER TABLE `reservations`
  ADD UNIQUE INDEX `reservations_external_manage_lookup_uq` (`manageLookupKeyHash`),
  ALGORITHM=INPLACE,
  LOCK=NONE;
