import DiffMatchPatch from 'diff-match-patch';

const dmp = new DiffMatchPatch();

export interface TextDiffWord {
  type: 'equal' | 'delete' | 'insert';
  text: string;
}

export interface TextDiffLine {
  lineNumberLeft: number | null;
  lineNumberRight: number | null;
  type: 'equal' | 'delete' | 'insert' | 'modify';
  leftText?: string;
  rightText?: string;
  leftWords?: TextDiffWord[];
  rightWords?: TextDiffWord[];
}

/**
 * Converts Note HTML or plain text into clean line-separated text
 * preserving block structures (<p>, <div>, <li>, <br>).
 */
export function convertHtmlToCleanLines(input: string): string {
  if (!input) return '';
  if (typeof input !== 'string') return String(input);

  const norm = input.replace(/\r\n/g, '\n');
  if (!norm.includes('<') || !norm.includes('>')) {
    return norm;
  }

  let html = norm;

  // Replace block tags with newline breaks
  html = html.replace(/<br\s*\/?>/gi, '\n');
  html = html.replace(/<\/p>/gi, '\n');
  html = html.replace(/<\/div>/gi, '\n');
  html = html.replace(/<\/h[1-6]>/gi, '\n');
  html = html.replace(/<\/li>/gi, '\n');
  html = html.replace(/<li[^>]*>/gi, '- ');

  if (typeof DOMParser !== 'undefined') {
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const text = doc.body.textContent || '';
      return text.replace(/\n\s*\n/g, '\n').trim();
    } catch {
      // Fallback regex strip
    }
  }

  const stripped = html.replace(/<[^>]+>/g, '');
  return stripped.replace(/\n\s*\n/g, '\n').trim();
}

/**
 * Line-oriented side-by-side diff generator.
 */
export function diffTextLines(oldText: string, newText: string): TextDiffLine[] {
  const cleanOld = convertHtmlToCleanLines(oldText);
  const cleanNew = convertHtmlToCleanLines(newText);

  const oldLines = cleanOld ? cleanOld.split('\n') : [];
  const newLines = cleanNew ? cleanNew.split('\n') : [];

  // Encode lines as characters for dmp line-by-line diffing
  const lineArray: string[] = [];
  const lineHash: Record<string, number> = {};

  function encodeLines(lines: string[]): string {
    let encoded = '';
    for (const line of lines) {
      if (Object.prototype.hasOwnProperty.call(lineHash, line)) {
        encoded += String.fromCharCode(lineHash[line]);
      } else {
        const id = lineArray.length + 1;
        lineHash[line] = id;
        lineArray.push(line);
        encoded += String.fromCharCode(id);
      }
    }
    return encoded;
  }

  const encodedOld = encodeLines(oldLines);
  const encodedNew = encodeLines(newLines);

  const lineDiffs = dmp.diff_main(encodedOld, encodedNew);
  dmp.diff_cleanupSemantic(lineDiffs);

  const result: TextDiffLine[] = [];
  let leftLineNum = 1;
  let rightLineNum = 1;

  let i = 0;
  while (i < lineDiffs.length) {
    const [op, chars] = lineDiffs[i];

    if (op === 0) {
      // Equal line block
      for (let c = 0; c < chars.length; c++) {
        const lineText = lineArray[chars.charCodeAt(c) - 1];
        result.push({
          lineNumberLeft: leftLineNum++,
          lineNumberRight: rightLineNum++,
          type: 'equal',
          leftText: lineText,
          rightText: lineText,
        });
      }
      i++;
    } else if (op === -1 && i + 1 < lineDiffs.length && lineDiffs[i + 1][0] === 1) {
      // Deletion block followed by Insertion block -> Modified lines
      const delChars = chars;
      const insChars = lineDiffs[i + 1][1];

      const delLineTexts = Array.from(delChars).map(ch => lineArray[ch.charCodeAt(0) - 1]);
      const insLineTexts = Array.from(insChars).map(ch => lineArray[ch.charCodeAt(0) - 1]);

      const pairCount = Math.min(delLineTexts.length, insLineTexts.length);

      for (let p = 0; p < pairCount; p++) {
        const leftLine = delLineTexts[p];
        const rightLine = insLineTexts[p];

        const wordDiffs = dmp.diff_main(leftLine, rightLine);
        dmp.diff_cleanupSemantic(wordDiffs);

        const leftWords: TextDiffWord[] = [];
        const rightWords: TextDiffWord[] = [];

        wordDiffs.forEach(([wOp, wText]) => {
          if (wOp === 0) {
            leftWords.push({ type: 'equal', text: wText });
            rightWords.push({ type: 'equal', text: wText });
          } else if (wOp === -1) {
            leftWords.push({ type: 'delete', text: wText });
          } else if (wOp === 1) {
            rightWords.push({ type: 'insert', text: wText });
          }
        });

        result.push({
          lineNumberLeft: leftLineNum++,
          lineNumberRight: rightLineNum++,
          type: 'modify',
          leftText: leftLine,
          rightText: rightLine,
          leftWords,
          rightWords,
        });
      }

      // Remaining deleted lines
      for (let d = pairCount; d < delLineTexts.length; d++) {
        result.push({
          lineNumberLeft: leftLineNum++,
          lineNumberRight: null,
          type: 'delete',
          leftText: delLineTexts[d],
        });
      }

      // Remaining inserted lines
      for (let ins = pairCount; ins < insLineTexts.length; ins++) {
        result.push({
          lineNumberLeft: null,
          lineNumberRight: rightLineNum++,
          type: 'insert',
          rightText: insLineTexts[ins],
        });
      }

      i += 2;
    } else if (op === -1) {
      // Pure deletion block
      for (let c = 0; c < chars.length; c++) {
        const lineText = lineArray[chars.charCodeAt(c) - 1];
        result.push({
          lineNumberLeft: leftLineNum++,
          lineNumberRight: null,
          type: 'delete',
          leftText: lineText,
        });
      }
      i++;
    } else if (op === 1) {
      // Pure insertion block
      for (let c = 0; c < chars.length; c++) {
        const lineText = lineArray[chars.charCodeAt(c) - 1];
        result.push({
          lineNumberLeft: null,
          lineNumberRight: rightLineNum++,
          type: 'insert',
          rightText: lineText,
        });
      }
      i++;
    }
  }

  return result;
}

/**
 * Deterministically sorts object keys recursively and formats JSON into a pretty string.
 */
export function normalizeAndFormatJson(val: any): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        const parsed = JSON.parse(trimmed);
        return JSON.stringify(sortKeys(parsed), null, 2);
      } catch {
        return val;
      }
    }
    return val;
  }
  return JSON.stringify(sortKeys(val), null, 2);
}

function sortKeys(obj: any): any {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sortKeys);
  const sorted: any = {};
  Object.keys(obj)
    .sort()
    .forEach(key => {
      sorted[key] = sortKeys(obj[key]);
    });
  return sorted;
}

export function normalizeUrl(urlStr: string): string {
  if (!urlStr) return '';
  let u = urlStr.trim().toLowerCase();
  u = u.replace(/^https?:\/\//, '');
  u = u.replace(/^www\./, '');
  if (u.endsWith('/')) u = u.slice(0, -1);
  return u;
}

export interface AlignedArrayRow<T> {
  type: 'added' | 'removed' | 'modified' | 'moved' | 'unchanged';
  prevItem: T | null;
  currentItem: T | null;
  prevIndex: number | null; // 1-indexed
  currentIndex: number | null; // 1-indexed
  fieldChanges?: string[];
}

export interface ArrayDiffSummary {
  addedCount: number;
  removedCount: number;
  modifiedCount: number;
  movedCount: number;
  unchangedCount: number;
}

export function alignStructuralArray<T>(
  prevList: T[],
  currentList: T[],
  getItemKey: (item: T) => string,
  areItemsModified: (prevItem: T, currentItem: T) => { isModified: boolean; changedFields: string[] }
): { rows: AlignedArrayRow<T>[]; summary: ArrayDiffSummary } {
  const prevKeys = prevList.map(item => getItemKey(item));
  const currentKeys = currentList.map(item => getItemKey(item));

  const matchedCurrentIndices = new Set<number>();
  const rows: AlignedArrayRow<T>[] = [];

  let addedCount = 0;
  let removedCount = 0;
  let modifiedCount = 0;
  let movedCount = 0;
  let unchangedCount = 0;

  prevList.forEach((prevItem, pIdx) => {
    const key = prevKeys[pIdx];
    const cIdx = currentKeys.findIndex((cKey, i) => cKey === key && !matchedCurrentIndices.has(i));

    if (cIdx === -1) {
      // Removed item
      removedCount++;
      rows.push({
        type: 'removed',
        prevItem,
        currentItem: null,
        prevIndex: pIdx + 1,
        currentIndex: null,
      });
    } else {
      matchedCurrentIndices.add(cIdx);
      const currentItem = currentList[cIdx];
      const { isModified, changedFields } = areItemsModified(prevItem, currentItem);
      const isMoved = pIdx !== cIdx;

      if (isModified) {
        modifiedCount++;
        rows.push({
          type: 'modified',
          prevItem,
          currentItem,
          prevIndex: pIdx + 1,
          currentIndex: cIdx + 1,
          fieldChanges: changedFields,
        });
      } else if (isMoved) {
        movedCount++;
        rows.push({
          type: 'moved',
          prevItem,
          currentItem,
          prevIndex: pIdx + 1,
          currentIndex: cIdx + 1,
        });
      } else {
        unchangedCount++;
        rows.push({
          type: 'unchanged',
          prevItem,
          currentItem,
          prevIndex: pIdx + 1,
          currentIndex: cIdx + 1,
        });
      }
    }
  });

  // Find pure additions in currentList
  currentList.forEach((currentItem, cIdx) => {
    if (!matchedCurrentIndices.has(cIdx)) {
      addedCount++;
      rows.push({
        type: 'added',
        prevItem: null,
        currentItem,
        prevIndex: null,
        currentIndex: cIdx + 1,
      });
    }
  });

  return {
    rows,
    summary: {
      addedCount,
      removedCount,
      modifiedCount,
      movedCount,
      unchangedCount,
    },
  };
}
