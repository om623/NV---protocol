import assert from 'node:assert/strict';
import { getNVAgentLocaleFallback, isNVAgentLocaleSupported, NV_AGENT_LOCALE_NAMES } from '../src/lib/agentLocale';

const expected = ['pt-BR', 'en', 'es', 'fr', 'zh', 'ja', 'ko', 'hi', 'ar'];
assert.deepEqual(Object.keys(NV_AGENT_LOCALE_NAMES).sort(), [...expected].sort());
for (const locale of expected) {
  assert.equal(isNVAgentLocaleSupported(locale), true, locale);
  const fallback = getNVAgentLocaleFallback(locale);
  assert.ok(fallback.length > 20, `fallback missing for ${locale}`);
  assert.ok(!fallback.includes('I could not prepare'), `English fallback leaked into ${locale}`);
}
assert.equal(isNVAgentLocaleSupported('pt'), false);
assert.equal(getNVAgentLocaleFallback('unknown'), getNVAgentLocaleFallback('en'));
console.log(`NV Agent locale contract: ${expected.length}/${expected.length} locales passed`);
