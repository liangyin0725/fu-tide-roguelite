export const BETA_MODE_PASSPHRASE = '作者真厉害';

export function isBetaModePassphrase(value: string): boolean {
  return value.trim() === BETA_MODE_PASSPHRASE;
}
