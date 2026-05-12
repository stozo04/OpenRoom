import { describe, it, expect } from 'vitest';
import {
  ACTION_COLLECT_EVIDENCE,
  ACTION_EXAMINE_LOCATION,
  ACTION_FINISH_INVESTIGATION_TURN,
  ACTION_GET_MYSTERY_STATE,
  ACTION_INTERROGATE,
  ACTION_MAKE_ACCUSATION,
  ACTION_READ_DOSSIER,
  ACTION_SET_ACCUSATION_READY,
  MYSTERY_APP_ACTION_TYPES,
  MYSTERY_GM_ACTIONS,
} from '../actions/constants';

describe('MysteryApp actions/constants', () => {
  it('MYSTERY_GM_ACTIONS lists GM round-trip actions only', () => {
    expect(MYSTERY_GM_ACTIONS).toContain(ACTION_INTERROGATE);
    expect(MYSTERY_GM_ACTIONS).toContain(ACTION_MAKE_ACCUSATION);
    expect(MYSTERY_GM_ACTIONS).not.toContain(ACTION_FINISH_INVESTIGATION_TURN);
    expect(MYSTERY_GM_ACTIONS).not.toContain(ACTION_GET_MYSTERY_STATE);
  });

  it('MYSTERY_APP_ACTION_TYPES includes local duo-play actions', () => {
    expect(MYSTERY_APP_ACTION_TYPES).toEqual(
      expect.arrayContaining([
        ACTION_EXAMINE_LOCATION,
        ACTION_COLLECT_EVIDENCE,
        ACTION_READ_DOSSIER,
        ACTION_FINISH_INVESTIGATION_TURN,
        ACTION_GET_MYSTERY_STATE,
        ACTION_SET_ACCUSATION_READY,
      ]),
    );
  });
});
