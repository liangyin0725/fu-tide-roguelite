import { describe, expect, it } from 'vitest';
import { isBetaModePassphrase } from '../../src/testing/betaMode';

describe('beta mode passphrase', () => {
  it('accepts the creator passphrase and rejects near matches', () => {
    expect(isBetaModePassphrase('作者真厉害')).toBe(true);
    expect(isBetaModePassphrase('作者真厉害 ')).toBe(true);
    expect(isBetaModePassphrase('作者好厉害')).toBe(false);
  });
});
