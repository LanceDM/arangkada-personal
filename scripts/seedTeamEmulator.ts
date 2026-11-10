/**
 * Fills the local emulators with placeholder Short Quiz items, so a level's
 * Drive step unlocks. A level whose quiz bank is empty is blocked on purpose.
 *
 *   npm run seed
 *   npm run seed -- --admin you@example.com   also makes that signed-up account an admin
 *
 * It names the emulators and the demo project itself, and uses no key, so it
 * cannot reach a real project. Emulator data is gone when the emulators stop:
 * run this again after each start.
 */
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

const main = async () => {
  const { initializeApp } = await import('firebase-admin/app');
  const { getAuth } = await import('firebase-admin/auth');
  const { getFirestore } = await import('firebase-admin/firestore');
  const { COMPETENCIES } = await import('@/domain/learner/profile');
  const { LEVELS } = await import('@/features/driving-sim/domain/scenario/levelCatalog');

  initializeApp({ projectId: 'demo-arangkada' });
  const db = getFirestore();
  const now = Date.now();

  const batch = db.batch();
  for (const { id: level, moduleId } of LEVELS) {
    for (let i = 0; i < 10; i++) {
      const n = String(i + 1).padStart(2, '0');
      const id = `PH-QUIZ-L${String(level).padStart(2, '0')}-${n}`;
      batch.set(db.doc(`quiz_items/${id}`), {
        schemaVersion: 1,
        id,
        moduleId,
        question: `PLACEHOLDER quiz item ${n} for Level ${level}: not a real question. Pick "Keyed answer".`,
        options: ['Keyed answer', 'Wrong answer A', 'Wrong answer B', 'Wrong answer C'],
        correctIndex: 0,
        explanation: 'Placeholder for testing on the emulators only.',
        image: '',
        competency: COMPETENCIES[(level + i) % COMPETENCIES.length],
        source: 'Placeholder',
        use: 'quiz',
        isActive: true,
        order: i + 1,
        revision: 1,
        createdAt: now,
        updatedAt: now,
        updatedBy: 'team-seed',
      });
    }
  }
  await batch.commit();
  console.log(`Seeded 10 placeholder quiz items for each of ${LEVELS.length} levels.`);

  const at = process.argv.indexOf('--admin');
  if (at >= 0) {
    const email = process.argv[at + 1];
    if (!email) throw new Error('--admin needs the email of an account already signed up.');
    const user = await getAuth().getUserByEmail(email);
    await getAuth().setCustomUserClaims(user.uid, { admin: true });
    console.log(`${email} is now an admin. Sign out and back in for it to take effect.`);
  }
};

main().then(
  () => process.exit(0),
  error => {
    console.error(error instanceof Error ? error.message : error);
    console.error('Are the emulators running? Start them with `npm run emulators`.');
    process.exit(1);
  }
);
