import { spawnSync } from 'child_process';

const testFiles = [
  'tests/fees.test.ts',
  'tests/fee-wiring.test.ts',
  'tests/ledger.test.ts',
  'tests/ledger.safety.test.ts',
  'tests/workstream.test.ts',
  'tests/security.test.ts',
  'tests/auto-accept.test.ts',
  'tests/safe-file-link.test.ts',
  'tests/phase3-workspace-invariants.test.ts',
  'tests/ssr.test.ts',
  'tests/postgres-persistence.test.ts',
  'tests/gig-cancellation-clearance.test.ts',
  'tests/architecture-invariants.test.ts',
  'tests/finance-vault-invariants.test.ts',
  'tests/marketplace-and-uploads-invariants.test.ts',
  'tests/phase9-production-hardening.test.ts'
];

const isWindows = process.platform === 'win32';
const npxCmd = isWindows ? 'npx.cmd' : 'npx';

console.log(`\n==================================================`);
console.log(`Running ${testFiles.length} test suites with NODE_ENV=test...`);
console.log(`==================================================\n`);

for (const testFile of testFiles) {
  console.log(`\n>>> RUNNING: ${testFile}`);
  
  const result = spawnSync(npxCmd, ['tsx', testFile], {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'test' },
    shell: true
  });

  if (result.status !== 0) {
    console.error(`\n❌ TEST SUITE FAILED: ${testFile} (exit code: ${result.status})`);
    process.exit(result.status || 1);
  }
}

console.log('\n==================================================');
console.log(`🎉 ALL ${testFiles.length} TEST SUITES PASSED SUCCESSFULLY (100%)!`);
console.log('==================================================\n');
process.exit(0);
