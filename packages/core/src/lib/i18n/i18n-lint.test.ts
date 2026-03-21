/**
 * i18n lint tests
 *
 * Test 1: Every t('key') call in Svelte/TS files references a key that exists in en.json
 * Test 2: Every Svelte component with visible text content imports t from '$lib/i18n'
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const DESKTOP_SRC = path.resolve(__dirname, '../../../../../apps/desktop/src');
const EN_JSON = path.join(DESKTOP_SRC, 'lib/i18n/locales/en.json');

/** Flatten nested JSON into dot-separated keys */
function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      keys.push(...flattenKeys(value as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

/** Recursively find files matching extensions */
function findFiles(dir: string, exts: string[]): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip node_modules, .svelte-kit, dist
      if (['node_modules', '.svelte-kit', 'dist', 'build'].includes(entry.name)) continue;
      results.push(...findFiles(full, exts));
    } else if (exts.some((ext) => entry.name.endsWith(ext))) {
      results.push(full);
    }
  }
  return results;
}

/** Extract all t('...') and t("...") key references from source code */
function extractTKeys(content: string): { key: string; line: number }[] {
  const results: { key: string; line: number }[] = [];
  const lines = content.split('\n');
  // Match t('key'), t("key"), t(`key`) — with optional second arg
  const pattern = /\bt\(\s*['"`]([^'"`]+)['"`]/g;
  for (let i = 0; i < lines.length; i++) {
    let match: RegExpExecArray | null;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(lines[i])) !== null) {
      results.push({ key: match[1], line: i + 1 });
    }
  }
  return results;
}

describe('i18n key completeness', () => {
  const enJson = JSON.parse(fs.readFileSync(EN_JSON, 'utf-8'));
  const validKeys = new Set(flattenKeys(enJson));

  const sourceFiles = findFiles(DESKTOP_SRC, ['.svelte', '.ts']);

  const violations: { file: string; line: number; key: string }[] = [];

  for (const file of sourceFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const keys = extractTKeys(content);
    for (const { key, line } of keys) {
      if (!validKeys.has(key)) {
        violations.push({
          file: path.relative(DESKTOP_SRC, file),
          line,
          key,
        });
      }
    }
  }

  it('all t() calls reference keys that exist in en.json', () => {
    if (violations.length > 0) {
      const report = violations
        .map((v) => `  ${v.file}:${v.line} → t('${v.key}')`)
        .join('\n');
      expect.fail(
        `Found ${violations.length} t() call(s) referencing missing en.json keys:\n${report}`,
      );
    }
  });

  // Also verify en.json has no duplicate leaf keys (sanity check)
  it('en.json has no empty string values', () => {
    const emptyKeys = flattenKeys(enJson).filter((k) => {
      const parts = k.split('.');
      let obj: any = enJson;
      for (const p of parts) obj = obj[p];
      return obj === '';
    });
    if (emptyKeys.length > 0) {
      expect.fail(`Empty translation values found:\n  ${emptyKeys.join('\n  ')}`);
    }
  });
});

describe('i18n import coverage', () => {
  const svelteFiles = findFiles(path.join(DESKTOP_SRC, 'lib/components'), ['.svelte']);

  /**
   * Check if a Svelte file has hardcoded user-facing text that should use t().
   *
   * Heuristic: look for text between HTML tags that isn't:
   * - Inside <script> or <style> blocks
   * - A Svelte expression {..}
   * - Empty or whitespace-only
   * - A known technical string (CSS class, SVG attribute, etc.)
   */
  function extractHardcodedStrings(
    content: string,
  ): { text: string; line: number }[] {
    const results: { text: string; line: number }[] = [];

    // Extract the template portion (between </script> and <style>)
    // This is a simplification — handles the common Svelte file structure
    const scriptEndIdx = content.lastIndexOf('</script>');
    const styleStartIdx = content.indexOf('<style');
    if (scriptEndIdx === -1) return results;

    const templateStart = scriptEndIdx + '</script>'.length;
    const templateEnd = styleStartIdx !== -1 ? styleStartIdx : content.length;
    const template = content.slice(templateStart, templateEnd);
    const templateStartLine =
      content.slice(0, templateStart).split('\n').length;

    const lines = template.split('\n');

    // Patterns for text between tags: >some text<
    const textBetweenTags = />([^<{]+)</g;

    // Allowlist patterns — these are not user-facing text
    const allowlist = [
      /^\s*$/,                     // whitespace only
      /^[\s\d.,:;|/\\#()+\-*=&@!?%$^~`<>[\]{}]+$/, // punctuation/numbers only
      /^\s*\{/,                    // starts with expression
      /^\s*<!--/,                  // comment
      /^\s*\|\s*$/,                // pipe separator
      /^\s*&[a-z]+;\s*$/,          // HTML entities
      /^\s*&#\d+;\s*$/,            // numeric HTML entities
      /^\s*[→←↑↓►▶◀▸▹▾▿]+\s*$/,  // arrows
      /.*\)\s*\}>/,                // function call leaking from attributes
      /.*aria-label=/,             // attribute content leaking
      /.*onclick=/,                // event handler leaking
    ];

    // Only flag strings with 3+ words — shorter strings are usually
    // labels, keywords, or technical terms with too many false positives
    const MIN_WORD_COUNT = 3;

    for (let i = 0; i < lines.length; i++) {
      let match: RegExpExecArray | null;
      textBetweenTags.lastIndex = 0;
      while ((match = textBetweenTags.exec(lines[i])) !== null) {
        const text = match[1].trim();
        if (!text) continue;
        if (allowlist.some((p) => p.test(text))) continue;
        // Must contain at least one letter to be user-facing
        if (!/[a-zA-Z]/.test(text)) continue;
        // Only flag multi-word phrases (3+ words) to reduce false positives
        const wordCount = text.split(/\s+/).filter((w) => w.length > 0).length;
        if (wordCount < MIN_WORD_COUNT) continue;
        results.push({ text, line: templateStartLine + i });
      }
    }

    return results;
  }

  // Known baseline — components that need i18n work but haven't been migrated yet.
  // Remove entries from this list as you fix them. The test fails on NEW violations only.
  const KNOWN_VIOLATIONS = new Set([
    'lib/components/bottom-panel/PlanTab.svelte',
    'lib/components/bottom-panel/SearchTab.svelte',
    'lib/components/ConnectionPointsModal.svelte',
    'lib/components/DependencyGraphView.svelte',
    'lib/components/DnDFlow.svelte',
    'lib/components/EdgeStylesSection.svelte',
    'lib/components/HandleMenu.svelte',
    'lib/components/KeyVaultAccessControlSection.svelte',
    'lib/components/ModuleNode.svelte',
    'lib/components/NodePlanDiff.svelte',
    'lib/components/PlanSummaryBanner.svelte',
    'lib/components/SubscriptionPicker.svelte',
  ]);

  // Collect files that have hardcoded strings but don't import t()
  const missing: { file: string; examples: { text: string; line: number }[] }[] =
    [];

  for (const file of svelteFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const importsT =
      /import\s+\{[^}]*\bt\b[^}]*\}\s+from\s+['"][$]lib\/i18n['"]/.test(
        content,
      );
    if (importsT) continue;

    const hardcoded = extractHardcodedStrings(content);
    if (hardcoded.length > 0) {
      const relPath = path.relative(DESKTOP_SRC, file).replace(/\\/g, '/');
      missing.push({
        file: relPath,
        examples: hardcoded.slice(0, 5), // show first 5
      });
    }
  }

  it('no new components with hardcoded text (known violations are baselined)', () => {
    const newViolations = missing.filter((m) => !KNOWN_VIOLATIONS.has(m.file));
    if (newViolations.length > 0) {
      const report = newViolations
        .map((m) => {
          const examples = m.examples
            .map((e) => `    L${e.line}: "${e.text}"`)
            .join('\n');
          return `  ${m.file}\n${examples}`;
        })
        .join('\n');
      expect.fail(
        `Found ${newViolations.length} NEW component(s) with hardcoded text but no t() import:\n${report}\n\nEither wrap these strings with t() or add the file to KNOWN_VIOLATIONS if intentional.`,
      );
    }
  });

  it('known violations list is not stale (remove fixed components)', () => {
    const fixed = [...KNOWN_VIOLATIONS].filter(
      (f) => !missing.some((m) => m.file === f),
    );
    if (fixed.length > 0) {
      expect.fail(
        `These components have been fixed — remove them from KNOWN_VIOLATIONS:\n  ${fixed.join('\n  ')}`,
      );
    }
  });
});
