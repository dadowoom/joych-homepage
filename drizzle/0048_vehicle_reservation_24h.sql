ALTER TABLE `vehicles`
  MODIFY `open_time` varchar(5) NOT NULL DEFAULT '00:00',
  MODIFY `close_time` varchar(5) NOT NULL DEFAULT '24:00';

UPDATE `vehicles`
SET
  `open_time` = '00:00',
  `close_time` = '24:00'
WHERE `open_time` <> '00:00'
   OR `close_time` <> '24:00';
