<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { project } from '$lib/stores/project.svelte';
  import hljs from 'highlight.js/lib/core';
  import type { HLJSApi, Language } from 'highlight.js';

  function hcl(_hljs: HLJSApi): Language {
    return {
      name: 'HCL',
      aliases: ['terraform', 'tf'],
      keywords: {
        keyword: 'resource data variable output locals module provider terraform',
        literal: 'true false null',
        built_in: 'var local module each count self path terraform',
      },
      contains: [
        _hljs.HASH_COMMENT_MODE,
        { className: 'comment', begin: '//', end: '$' },
        _hljs.C_BLOCK_COMMENT_MODE,
        { className: 'string', begin: '<<-?\\s*\\w+', end: '^\\s*\\w+', contains: [{ className: 'variable', begin: '\\$\\{', end: '\\}' }] },
        { className: 'string', begin: '"', end: '"', contains: [{ className: 'variable', begin: '\\$\\{', end: '\\}' }] },
        { className: 'number', begin: '\\b\\d+(\\.\\d+)?\\b' },
        { className: 'type', begin: '\\b(string|number|bool|list|map|set|object|tuple|any)\\b' },
        { className: 'function', begin: '[a-zA-Z_]\\w*\\s*\\(' , returnBegin: true, contains: [{ className: 'title.function', begin: '[a-zA-Z_]\\w*' }] },
        { className: 'attr', begin: '\\b[a-zA-Z_][a-zA-Z0-9_-]*\\s*=' , returnBegin: true, contains: [{ className: 'attr', begin: '[a-zA-Z_][a-zA-Z0-9_-]*' }] },
      ],
    };
  }

  hljs.registerLanguage('hcl', hcl);

  let { filename }: { filename: string } = $props();
  let content = $state<string | null>(null);
  let highlighted = $derived(
    content !== null ? hljs.highlight(content, { language: 'hcl' }).value : null
  );
  let error = $state<string | null>(null);

  async function loadFile() {
    if (!project.path) return;
    try {
      content = await invoke<string>('read_terraform_file', {
        projectPath: project.path,
        filename,
      });
      error = null;
    } catch (e) {
      error = String(e);
      content = null;
    }
  }

  // Reload when filename changes or component mounts
  $effect(() => {
    filename;
    loadFile();
  });
</script>

<div class="file-preview">
  {#if error}
    <div class="preview-error">{error}</div>
  {:else if highlighted !== null}
    <pre class="preview-content"><code class="hljs">{@html highlighted}</code></pre>
  {:else}
    <div class="preview-loading">Loading...</div>
  {/if}
</div>

<style>
  .file-preview {
    flex: 1;
    overflow: auto;
    background: var(--color-bg);
  }
  .preview-content {
    margin: 0;
    padding: 12px 16px;
    font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
    font-size: 13px;
    line-height: 1.6;
    color: var(--color-text);
    white-space: pre;
    tab-size: 2;
  }
  .preview-content code {
    font-family: inherit;
    font-size: inherit;
  }

  /* HCL syntax highlighting — VS Code dark+ inspired */
  .preview-content :global(.hljs) {
    color: #d4d4d4;
    background: transparent;
  }
  .preview-content :global(.hljs-keyword),
  .preview-content :global(.hljs-selector-tag) {
    color: #c586c0; /* purple — resource, variable, data, module, etc. */
  }
  .preview-content :global(.hljs-type),
  .preview-content :global(.hljs-title) {
    color: #4ec9b0; /* teal — type names */
  }
  .preview-content :global(.hljs-string),
  .preview-content :global(.hljs-template-variable) {
    color: #ce9178; /* orange — string values */
  }
  .preview-content :global(.hljs-number),
  .preview-content :global(.hljs-literal) {
    color: #b5cea8; /* green — numbers, true/false/null */
  }
  .preview-content :global(.hljs-comment) {
    color: #6a9955; /* green — comments */
    font-style: italic;
  }
  .preview-content :global(.hljs-attr),
  .preview-content :global(.hljs-attribute) {
    color: #9cdcfe; /* light blue — attribute names */
  }
  .preview-content :global(.hljs-built_in) {
    color: #dcdcaa; /* yellow — built-in functions */
  }
  .preview-content :global(.hljs-variable) {
    color: #9cdcfe; /* light blue — variable references */
  }
  .preview-content :global(.hljs-symbol) {
    color: #d4d4d4;
  }

  .preview-error {
    padding: 16px;
    color: #ef4444;
    font-size: 12px;
  }
  .preview-loading {
    padding: 16px;
    color: var(--color-text-muted);
    font-size: 12px;
  }
</style>
