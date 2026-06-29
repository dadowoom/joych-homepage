ALTER TABLE dynamic_board_posts
  ADD COLUMN attachment_name varchar(255) DEFAULT NULL,
  ADD COLUMN attachment_url varchar(512) DEFAULT NULL;
