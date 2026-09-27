const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const template = fs.readFileSync(path.join(root, 'templates/components/quarterly/content-archive.html'), 'utf8');
const helpers = template.slice(template.indexOf('  function getNowCaption('), template.indexOf('  function hasValue('));
const display = vm.runInNewContext(`${helpers}\ngetNowDisplayCaption`);
const { items } = JSON.parse(fs.readFileSync(path.join(root, 'functions/data/quarterly_now_artic.json'), 'utf8'));
const expected = [
  'dinnermode 1일차, 마지막 곡과 함께 퇴장하는 수민(@suminboutu).',
  "밴드 신인류(@shin_in_ryu)가 2년만의 단독 콘서트로 팬들을 찾았습니다. 발매된 지 한 달 남짓한 미니앨범 [1126611] 전곡, 데뷔 싱글 '너의 한마디', 한국 밴드 팬이라면 모를 수 없는 'Loveholic' 커버까지. 2시간 30분 간의 꽉 찬 퍼포먼스는 앵콜을 마친 뒤에도 팬들이 오래도록 공연장을 떠나지 못하게 했습니다.",
  'artic.이 진환민 작가(@hwwm_n)의 개인전 《Transcribed Breath》의 포문을 여는 오프닝 퍼포먼스 현장에 함께했습니다. 도예를 통해 호흡을 시각화하는 진환민 작가의 전시는 9월 5일까지 AOD 뮤지엄에서 만나볼 수 있습니다.',
  '리스닝 파티 끝나고 팬들과 셋로그 찍는 강지원(@kangziwon)',
];
items.forEach((item, index) => assert.equal(display(item), expected[index]));
assert.equal(display({caption: '공연 후기.\n\nEvent [Live]\n2026\nVenue | Seoul', eventTitle: 'Event [Live] 2026'}), '공연 후기.');
assert.equal(display({caption: 'Event [Live] 공연을 관람했습니다.', eventTitle: 'Event [Live]'}), 'Event [Live] 공연을 관람했습니다.');
assert.equal(display({caption: '후기. Event [Live]', eventTitle: 'Event [Live]'}), '후기.');
assert.equal(display({caption: 'Event [Live]', eventTitle: 'Event [Live]'}), '');
assert.equal(display({caption: '제목 없는 후기. Venue | Seoul'}), '제목 없는 후기.');
console.log('NOW ARTIC caption checks passed (four real captions and suffix edge cases)');
