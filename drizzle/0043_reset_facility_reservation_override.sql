-- can_reserve_facility is now used as a reservation rule override flag.
-- Existing true values came from the former "eligible member" behavior.
UPDATE `church_members`
SET `can_reserve_facility` = false
WHERE `can_reserve_facility` = true;
