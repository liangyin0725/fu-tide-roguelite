import { describe, expect, it } from 'vitest';
import {
  getTribulationChoiceModifiers,
  getTribulationChoices,
} from '../../src/sim/tribulationChoices';
import { getTribulationEndMs } from '../../src/sim/tribulations';

describe('tribulation choices', () => {
  it('maps every non-calm tribulation to two choices and exposes their multipliers', () => {
    expect(getTribulationChoices('thunder')).toEqual(['thunder-conduit', 'thunder-seal']);
    expect(getTribulationChoices('blood-moon')).toEqual(['blood-pact', 'blood-calm']);
    expect(getTribulationChoices('frost')).toEqual(['frost-edge', 'frost-ward']);
    expect(getTribulationChoices('calm')).toEqual([]);
    expect(getTribulationChoiceModifiers('blood-pact')).toMatchObject({
      experience: 1.35,
      enemyDamage: 1.25,
    });
    expect(getTribulationChoiceModifiers(null)).toEqual({
      playerDamage: 1,
      experience: 1,
      enemyDamage: 1,
      enemyProjectileSpeed: 1,
      playerSpeed: 1,
      enemySpeed: 1,
    });
    expect(getTribulationEndMs(255_000)).toBe(480_000);
  });
});
