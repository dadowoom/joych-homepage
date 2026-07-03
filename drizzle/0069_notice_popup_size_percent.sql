ALTER TABLE notice_popups
  ADD COLUMN size_percent int NOT NULL DEFAULT 100 AFTER priority;
