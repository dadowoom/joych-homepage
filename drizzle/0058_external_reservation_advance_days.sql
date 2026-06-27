ALTER TABLE facilities
  ADD COLUMN externalAdvanceDaysOverride INT NULL;

INSERT INTO site_settings (settingKey, settingValue, description)
VALUES (
  'external_reservation_advance_days_default',
  '14',
  '외부인 예약 기본 가능 기간(일)'
)
ON DUPLICATE KEY UPDATE
  description = VALUES(description);
