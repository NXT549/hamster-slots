// golden.mjs — records the golden run (tests/golden/golden.json) and the save
// fixtures (tests/fixtures/) from the scripted sessions in tests/golden/sessions.js.
//
// The golden run is the migration's safety net: tests/golden.test.js checks that
// the game still plays EXACTLY like the recording. So only re-record when a change
// to how the game plays is intended and approved (a balance change, a new
// feature), never to make a failing test pass. Then say so in the commit message.
//
// Run it from the hamster_slots folder:
//     node tools/golden.mjs             (only if there's no recording yet)
//     node tools/golden.mjs --confirm   (replace the recording on purpose)
//     node tools/golden.mjs --fixtures  (only add save fixtures for a new save version;
//                                        the recording is left alone)
// Fixtures that already exist are never overwritten: old ones are the old-format
// saves the migrations are tested against.

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { SESSIONS, FIXTURES, data } from '../tests/golden/sessions.js';

const goldenFile = new URL('../tests/golden/golden.json', import.meta.url);
const fixturesDir = new URL('../tests/fixtures/', import.meta.url);
const onlyFixtures = process.argv.includes('--fixtures');

if (!onlyFixtures && existsSync(goldenFile) && !process.argv.includes('--confirm')) {
  console.log('tests/golden/golden.json already exists. Re-recording replaces what the game is checked against,');
  console.log('so only do it for an intended, approved gameplay change: node tools/golden.mjs --confirm');
  console.log('(To add save fixtures for a new save version: node tools/golden.mjs --fixtures)');
  process.exit(1);
}

const sessions = {};
for (const [name, run] of Object.entries(SESSIONS)) {
  const started = Date.now();
  sessions[name] = run();
  console.log(`${name}: ${sessions[name].length} checkpoints (${Date.now() - started} ms)`);
}
if (!onlyFixtures) {
  const recording = { recordedWith: { schemaVersion: data.schemaVersion }, sessions };
  writeFileSync(goldenFile, JSON.stringify(recording, null, 1) + '\n');
  console.log('wrote tests/golden/golden.json');
}

mkdirSync(fixturesDir, { recursive: true });
for (const [session, label, name] of FIXTURES) {
  const cp = sessions[session].find((c) => c.label === label);
  if (!cp) throw new Error(`no checkpoint "${label}" in ${session}`);
  const file = `save-v${cp.save.saveVersion}-${name}.json`;
  if (existsSync(new URL(file, fixturesDir))) {
    console.log(`kept tests/fixtures/${file} (it already exists)`);
    continue;
  }
  writeFileSync(new URL(file, fixturesDir), JSON.stringify(cp.save, null, 1) + '\n');
  console.log(`wrote tests/fixtures/${file} (${label})`);
}
