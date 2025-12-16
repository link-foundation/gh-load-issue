// Test script to verify use-m patch for Windows path handling
import { pathToFileURL } from 'url';

console.log('Testing path conversions:');

const testPaths = [
  'C:\\npm\\prefix\\node_modules\\octokit-rest-v-22.0.0',
  '/usr/local/lib/node_modules/yargs-v-17.7.2/index.cjs',
  'https://unpkg.com/some-package',
];

testPaths.forEach((p) => {
  console.log(`\nOriginal: ${p}`);

  // Check if it's an absolute Windows path
  if (/^[A-Za-z]:[\\/]/.test(p)) {
    console.log(`  -> Windows path detected`);
    console.log(`  -> File URL: ${pathToFileURL(p)}`);
  } else if (p.startsWith('/')) {
    console.log(`  -> Unix absolute path`);
    console.log(`  -> File URL: ${pathToFileURL(p)}`);
  } else if (p.match(/^https?:/)) {
    console.log(`  -> HTTP(S) URL: ${p}`);
  } else {
    console.log(`  -> Relative or module path: ${p}`);
  }
});
