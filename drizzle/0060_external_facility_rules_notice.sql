ALTER TABLE facilities
  ADD COLUMN externalNotice TEXT DEFAULT NULL;

INSERT INTO site_settings (settingKey, settingValue, description)
VALUES (
  'external_facility_rules',
  '가능하시면 장소를 직접 확인해주시기 바랍니다.
신청서 작성 전 교회 사무국에 장소와 금액을 확인 후 작성해주시기 바랍니다.
신청서 제출방법: Fax 054-270-1005 / E-mail: joych1946@daum.net
사용료 입금 시 입금자 이름과 신청자 이름을 맞춰 주세요.
신청 단체 사정으로 인해 취소할 경우 반환수수료를 제외한 금액을 반환 조치합니다.
시설 내 음주, 흡연, 가무, 고성방가 행위 등은 허용하지 않으며 상황에 따라 퇴실 조치 및 추후 이용이 제한될 수 있습니다.
각 부속시설에 있는 음향장비 및 영상장비는 사용이 불가합니다. 필요 시 사용 측에서 준비해주시기 바랍니다.',
  '외부인 시설사용 주의사항'
)
ON DUPLICATE KEY UPDATE
  description = VALUES(description);
