/**
 * Markdown-lite renderer for annotation nodes.
 * Supports: **bold**, _italic_, `- ` unordered lists, newlines.
 * HTML is escaped before processing to prevent XSS.
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderMarkdownLite(text: string): string {
  if (!text) return '';

  const escaped = escapeHtml(text);
  const lines = escaped.split('\n');
  const result: string[] = [];
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trimStart();

    if (trimmed.startsWith('- ')) {
      if (!inList) {
        result.push('<ul>');
        inList = true;
      }
      result.push(`<li>${applyInline(trimmed.slice(2))}</li>`);
    } else {
      if (inList) {
        result.push('</ul>');
        inList = false;
      }
      if (trimmed === '') {
        result.push('<br>');
      } else {
        result.push(`<span>${applyInline(trimmed)}</span><br>`);
      }
    }
  }

  if (inList) {
    result.push('</ul>');
  }

  // Remove trailing <br>
  const html = result.join('');
  return html.replace(/<br>$/, '');
}

function applyInline(text: string): string {
  // Bold: **text**
  let result = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italic: _text_
  result = result.replace(/(?<!\w)_(.+?)_(?!\w)/g, '<em>$1</em>');
  return result;
}
