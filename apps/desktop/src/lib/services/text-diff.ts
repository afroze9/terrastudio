/**
 * Line-level text diff using a simplified Myers algorithm.
 * Used for side-by-side Terraform file comparisons.
 */

export type DiffLineType = 'added' | 'removed' | 'unchanged';

export interface DiffLine {
  type: DiffLineType;
  content: string;
  /** Line number in the original (left) file, or undefined for added lines */
  leftLine?: number;
  /** Line number in the modified (right) file, or undefined for removed lines */
  rightLine?: number;
}

export interface TextDiffResult {
  left: DiffLine[];
  right: DiffLine[];
  hasChanges: boolean;
}

/**
 * Compute a line-level diff between two text strings.
 * Returns aligned left/right arrays for side-by-side rendering.
 */
export function computeTextDiff(before: string, after: string): TextDiffResult {
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');

  const lcs = longestCommonSubsequence(beforeLines, afterLines);

  const left: DiffLine[] = [];
  const right: DiffLine[] = [];
  let hasChanges = false;

  let bi = 0;
  let ai = 0;
  let li = 0;

  while (bi < beforeLines.length || ai < afterLines.length) {
    if (li < lcs.length && bi < beforeLines.length && ai < afterLines.length) {
      // Emit removed lines before next LCS match
      while (bi < beforeLines.length && beforeLines[bi] !== lcs[li]) {
        left.push({ type: 'removed', content: beforeLines[bi], leftLine: bi + 1 });
        right.push({ type: 'removed', content: '', rightLine: undefined });
        bi++;
        hasChanges = true;
      }
      // Emit added lines before next LCS match
      while (ai < afterLines.length && afterLines[ai] !== lcs[li]) {
        left.push({ type: 'added', content: '', leftLine: undefined });
        right.push({ type: 'added', content: afterLines[ai], rightLine: ai + 1 });
        ai++;
        hasChanges = true;
      }
      // Emit the common line
      if (li < lcs.length) {
        left.push({ type: 'unchanged', content: beforeLines[bi], leftLine: bi + 1 });
        right.push({ type: 'unchanged', content: afterLines[ai], rightLine: ai + 1 });
        bi++;
        ai++;
        li++;
      }
    } else {
      // Past the end of LCS — remaining lines are additions or removals
      while (bi < beforeLines.length) {
        left.push({ type: 'removed', content: beforeLines[bi], leftLine: bi + 1 });
        right.push({ type: 'removed', content: '', rightLine: undefined });
        bi++;
        hasChanges = true;
      }
      while (ai < afterLines.length) {
        left.push({ type: 'added', content: '', leftLine: undefined });
        right.push({ type: 'added', content: afterLines[ai], rightLine: ai + 1 });
        ai++;
        hasChanges = true;
      }
    }
  }

  return { left, right, hasChanges };
}

/**
 * Compute the longest common subsequence of two string arrays.
 * Uses standard DP approach.
 */
function longestCommonSubsequence(a: string[], b: string[]): string[] {
  const m = a.length;
  const n = b.length;

  // Build DP table
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find the LCS
  const result: string[] = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      result.unshift(a[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return result;
}
