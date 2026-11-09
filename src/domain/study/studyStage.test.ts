import { describe, expect, it } from 'vitest';
import { ageBandOf, checkConsent, consentRecords } from './consentRecords';
import { stageIndex, studyStage, type StudyFacts } from './studyStage';

const fresh: StudyFacts = {
  withdrawn: false,
  consented: false,
  background: false,
  deviceChecked: false,
  preTest: 'none',
  course: { started: false, frontierLevel: 0, endReason: null },
  postTest: 'none',
  survey: { openedAt: null, confirmedAt: null },
};
const at = (over: Partial<StudyFacts>) => studyStage({ ...fresh, ...over });
const ready = { consented: true, background: true, deviceChecked: true, preTest: 'finished' as const };

describe("the study's order", () => {
  it('opens each step only after the one before it', () => {
    expect(at({})).toBe('consent');
    expect(at({ consented: true })).toBe('background');
    expect(at({ consented: true, background: true })).toBe('device');
    expect(at({ consented: true, background: true, deviceChecked: true })).toBe('pre-test');
    expect(at({ consented: true, background: true, deviceChecked: true, preTest: 'open' })).toBe('pre-test');
    expect(at(ready)).toBe('tutorial');
  });

  it('reads the course only through its seam: started, the level Continue enters, and why it ended', () => {
    expect(at({ ...ready, course: { started: true, frontierLevel: 0, endReason: null } })).toBe('tutorial');
    expect(at({ ...ready, course: { started: true, frontierLevel: 1, endReason: null } })).toBe('levels');
    expect(at({ ...ready, course: { started: true, frontierLevel: 11, endReason: null } })).toBe('levels');
    expect(at({ ...ready, course: { started: true, frontierLevel: 12, endReason: null } })).toBe('final');
    const certified = { started: true, frontierLevel: null, endReason: 'certified' as const };
    expect(at({ ...ready, course: certified })).toBe('post-test');
    expect(at({ ...ready, course: certified, postTest: 'open' })).toBe('post-test');
    expect(at({ ...ready, course: certified, postTest: 'finished' })).toBe('survey');
    expect(at({ ...ready, course: certified, postTest: 'finished', survey: { openedAt: 5, confirmedAt: null } })).toBe('survey');
    expect(at({ ...ready, course: certified, postTest: 'finished', survey: { openedAt: 5, confirmedAt: 6 } })).toBe('done');
  });

  it('never skips a step on facts that arrived out of order, and a withdrawal ends it all', () => {
    // A post-test finished before the course would be refused by the screens; the order still waits on the course.
    expect(at({ ...ready, course: { started: true, frontierLevel: 4, endReason: null }, postTest: 'finished' })).toBe('levels');
    expect(at({ ...ready, preTest: 'open', postTest: 'finished' })).toBe('pre-test');
    expect(at({ ...ready, withdrawn: true })).toBe('withdrawn');
    expect(stageIndex('withdrawn')).toBe(-1);
    expect(stageIndex('consent')).toBe(0);
    expect(stageIndex('done')).toBe(9);
  });
});

describe('the consent form', () => {
  const form = { fullName: '  Juan   dela Cruz ', typedSignature: 'juan DELA cruz', age: '24', agreed: true };

  it('accepts a name signed again, an adult age and the box ticked', () => {
    expect(checkConsent(form)).toEqual({ kind: 'ok', fullName: 'Juan dela Cruz', typedSignature: 'juan DELA cruz', age: 24 });
  });

  it('stops for anyone under 18, before anything else is asked of them', () => {
    expect(checkConsent({ ...form, age: '17' })).toEqual({ kind: 'minor' });
    expect(checkConsent({ ...form, age: '16', typedSignature: '', agreed: false })).toEqual({ kind: 'minor' });
    expect(checkConsent({ ...form, age: '18' }).kind).toBe('ok');
  });

  it('asks again for a missing name, an age that is not a number, a signature that differs, or no agreement', () => {
    for (const bad of [{ fullName: 'J' }, { age: 'twenty' }, { age: '24.5' }, { age: '130' }, { typedSignature: 'Juan Cruz' }, { agreed: false }]) {
      expect(checkConsent({ ...form, ...bad }).kind).toBe('problem');
    }
  });

  it('writes the name and exact age only to the consent record; the marker the flow reads holds the age band', () => {
    const { consent, marker } = consentRecords({ participantCode: 'P-0001', fullName: 'Juan dela Cruz', typedSignature: 'Juan dela Cruz', age: 24, language: 'en', at: 9 });
    expect(consent).toMatchObject({ participantCode: 'P-0001', fullName: 'Juan dela Cruz', age: 24, variant: 'adult', guardian: null });
    expect(marker).toEqual({ schemaVersion: 1, consentVersion: consent.consentVersion, consentLanguage: 'en', variant: 'adult', ageBand: '18-24', agreedAt: 9 });
    expect(consent.consentLanguage).toBe('en');
  });

  it('bands every age at the bands the rules compute', () => {
    expect([18, 24, 25, 34, 35, 44, 45, 54, 55, 100].map(ageBandOf)).toEqual([
      '18-24', '18-24', '25-34', '25-34', '35-44', '35-44', '45-54', '45-54', '55+', '55+',
    ]);
  });
});
