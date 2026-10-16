import { isTruthyFlag } from '../../../src/config/env';

describe('MARKETPLACE_DEMO_PURCHASE_ENABLED parsing', () => {
  it.each(['true', 'True', 'TRUE', ' true ', '"true"', "'true'", '1', 'yes'])('treats %p as on', (value) => {
    expect(isTruthyFlag(value)).toBe(true);
  });

  it.each([undefined, '', 'false', 'False', '0', 'no', 'off', 'tru'])('treats %p as off', (value) => {
    expect(isTruthyFlag(value)).toBe(false);
  });
});
