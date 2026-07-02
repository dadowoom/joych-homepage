ALTER TABLE `menu_items`
  MODIFY COLUMN `pageType` enum('image','gallery','board','youtube','editor','course') NOT NULL DEFAULT 'image';

ALTER TABLE `menu_sub_items`
  MODIFY COLUMN `pageType` enum('image','gallery','board','youtube','editor','course') NOT NULL DEFAULT 'image';

ALTER TABLE `courses`
  ADD COLUMN `audience` enum('all','member') NOT NULL DEFAULT 'all' AFTER `isVisible`,
  ADD COLUMN `pageHref` varchar(255) NULL AFTER `audience`,
  ADD COLUMN `applicationFields` text NULL AFTER `pageHref`;

ALTER TABLE `course_applications`
  ADD COLUMN `customAnswers` text NULL AFTER `memo`;

UPDATE `courses`
SET `pageHref` = '/education/courses'
WHERE `pageHref` IS NULL OR `pageHref` = '';
