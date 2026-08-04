ALTER TABLE `course_applications`
  ADD COLUMN `feePaid` boolean NOT NULL DEFAULT false AFTER `customAnswers`;
-- --> statement-breakpoint
ALTER TABLE `course_applications`
  ADD COLUMN `documentsSubmitted` boolean NOT NULL DEFAULT false AFTER `feePaid`;
