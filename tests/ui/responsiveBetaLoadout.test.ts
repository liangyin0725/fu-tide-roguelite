// Vitest runs in Node, while the browser-only app intentionally omits Node typings.
// @ts-expect-error -- Node is available to the test runner.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const styles = readFileSync(new URL('../../src/styles.css', import.meta.url), 'utf8');

describe('responsive beta loadout layout', () => {
  it('overrides the generic mobile upgrade offset so skills remain reachable', () => {
    const mobileStyles = styles.slice(styles.indexOf('@media (max-width: 720px)'));
    const genericUpgradeRule = mobileStyles.indexOf('.upgrade-panel {');
    const betaOverride = mobileStyles.indexOf('.beta-loadout-panel {');

    expect(genericUpgradeRule).toBeGreaterThanOrEqual(0);
    expect(betaOverride).toBeGreaterThan(genericUpgradeRule);
    expect(mobileStyles.slice(betaOverride)).toMatch(
      /\.beta-loadout-panel\s*{[^}]*top:\s*8px;[^}]*max-height:\s*calc\(100vh - 16px\);/s,
    );
  });
});
