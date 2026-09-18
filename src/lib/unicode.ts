/**
 * unicode.ts —— Unicode 范围解析、字素簇切分与码位工具。
 */

/** 闭区间码位范围 [start, end]（含端点） */
export type CodeRange = [number, number];

export const MAX_CODE_POINT = 0x10ffff;

/**
 * 默认可忽略码位：ZWJ 与变体选择符。
 * 它们参与塑形/语义，但不要求字体提供独立字形，
 * 审计时可选择不对这些码位做覆盖要求。
 */
export const DEFAULT_IGNORABLE_RANGES: CodeRange[] = [
  [0x200d, 0x200d], // ZERO WIDTH JOINER
  [0xfe00, 0xfe0f], // 变体选择符 1-16
  [0xe0100, 0xe01ef], // 变体选择符补充
];

export function isInRanges(cp: number, ranges: CodeRange[]): boolean {
  for (const [a, b] of ranges) {
    if (cp >= a && cp <= b) return true;
  }
  return false;
}

export function isDefaultIgnorable(cp: number): boolean {
  return isInRanges(cp, DEFAULT_IGNORABLE_RANGES);
}

/** 合并重叠/相邻区间并排序，便于统计与展示 */
export function mergeRanges(ranges: CodeRange[]): CodeRange[] {
  const sorted = [...ranges].sort((x, y) => x[0] - y[0]);
  const out: CodeRange[] = [];
  for (const [a, b] of sorted) {
    const last = out[out.length - 1];
    if (last && a <= last[1] + 1) {
      last[1] = Math.max(last[1], b);
    } else {
      out.push([a, b]);
    }
  }
  return out;
}

export function countCodePoints(ranges: CodeRange[]): number {
  return ranges.reduce((sum, [a, b]) => sum + (b - a + 1), 0);
}

export interface ParseResult {
  ranges: CodeRange[];
  errors: string[];
}

const TOKEN_RE = /^(?:U\+)?([0-9A-Fa-f]{1,6})(?:-(?:U\+)?([0-9A-Fa-f]{1,6}))?$/;

/**
 * 解析用户录入的覆盖范围，例如：
 *   "U+0000-007F, U+4E00-9FFF U+1F600"
 * 逗号、分号、空白均可作为分隔符；"U+" 前缀可省略；单码位与区间均可。
 */
export function parseRanges(input: string): ParseResult {
  const errors: string[] = [];
  const ranges: CodeRange[] = [];
  const tokens = input.split(/[\s,;，、]+/).filter(Boolean);
  for (const token of tokens) {
    const m = TOKEN_RE.exec(token);
    if (!m) {
      errors.push(`无法解析「${token}」`);
      continue;
    }
    const start = parseInt(m[1], 16);
    const end = m[2] ? parseInt(m[2], 16) : start;
    if (start > MAX_CODE_POINT || end > MAX_CODE_POINT) {
      errors.push(`「${token}」超出最大码位 U+10FFFF`);
      continue;
    }
    if (start > end) {
      errors.push(`「${token}」区间起点大于终点`);
      continue;
    }
    ranges.push([start, end]);
  }
  return { ranges: mergeRanges(ranges), errors };
}

// ---------------------------------------------------------------------------
// 字素簇切分
// ---------------------------------------------------------------------------

interface SegmenterLike {
  segment(text: string): Iterable<{ segment: string }>;
}
interface SegmenterCtor {
  new (locale?: string, options?: { granularity: string }): SegmenterLike;
}

/**
 * 按字素簇（grapheme cluster）切分文本。
 * 优先使用标准 Intl.Segmenter；不可用时退回到内置的简化 UAX #29 实现，
 * 覆盖常见场景：组合附加符号、变体选择符、emoji 修饰符、
 * ZWJ 序列（如 👨‍👩‍👧‍👦）、区域指示符成对（如 🇨🇳）。
 */
export function segmentGraphemes(text: string): string[] {
  const Ctor = (Intl as unknown as { Segmenter?: SegmenterCtor }).Segmenter;
  if (Ctor) {
    const segmenter = new Ctor('zh-CN', { granularity: 'grapheme' });
    return Array.from(segmenter.segment(text), (s) => s.segment);
  }
  return fallbackSegment(text);
}

type GcbCategory = 'CR' | 'LF' | 'Control' | 'Extend' | 'ZWJ' | 'RI' | 'Other';

/** 常见 GCB=Extend 的码位（组合符、变体选择符、emoji 肤色修饰符等） */
const EXTEND_RANGES: CodeRange[] = [
  [0x0300, 0x036f],
  [0x0483, 0x0489],
  [0x0591, 0x05bd],
  [0x0610, 0x061a],
  [0x064b, 0x065f],
  [0x0670, 0x0670],
  [0x06d6, 0x06dc],
  [0x0e31, 0x0e31],
  [0x0e34, 0x0e3a],
  [0x0e47, 0x0e4e],
  [0x1ab0, 0x1aff],
  [0x1dc0, 0x1dff],
  [0x200c, 0x200c], // ZWNJ
  [0x20d0, 0x20ff], // 含 U+20E3 keycap
  [0xfe00, 0xfe0f],
  [0xfe20, 0xfe2f],
  [0x1f3fb, 0x1f3ff], // emoji 肤色
  [0xe0020, 0xe007f], // tag 字符
  [0xe0100, 0xe01ef],
];

function gcbCategory(cp: number): GcbCategory {
  if (cp === 0x0d) return 'CR';
  if (cp === 0x0a) return 'LF';
  if (cp === 0x200d) return 'ZWJ';
  if (cp >= 0x1f1e6 && cp <= 0x1f1ff) return 'RI';
  if (cp < 0x20 || (cp >= 0x7f && cp <= 0x9f)) return 'Control';
  if (isInRanges(cp, EXTEND_RANGES)) return 'Extend';
  return 'Other';
}

/** Extended_Pictographic 的近似（兜底切分足够用） */
function isExtendedPictographicApprox(cp: number): boolean {
  return (
    (cp >= 0x1f000 && cp <= 0x1faff) ||
    (cp >= 0x2600 && cp <= 0x27bf) ||
    (cp >= 0x2190 && cp <= 0x21ff) ||
    (cp >= 0x2b00 && cp <= 0x2bff) ||
    cp === 0x3030 ||
    cp === 0x303d ||
    cp === 0x3297 ||
    cp === 0x3299
  );
}

function fallbackSegment(text: string): string[] {
  const chars = Array.from(text);
  const clusters: string[] = [];
  let current = '';
  let prev: GcbCategory = 'Other';
  let riCount = 0;

  for (const ch of chars) {
    const cp = ch.codePointAt(0)!;
    const cat = gcbCategory(cp);
    let brk: boolean;

    if (current === '') brk = false;
    else if (prev === 'CR' && cat === 'LF') brk = false;
    else if (prev === 'CR' || prev === 'LF' || prev === 'Control') brk = true;
    else if (cat === 'CR' || cat === 'LF' || cat === 'Control') brk = true;
    else if (cat === 'Extend' || cat === 'ZWJ') brk = false;
    else if (prev === 'ZWJ' && isExtendedPictographicApprox(cp)) brk = false;
    else if (cat === 'RI' && prev === 'RI' && riCount % 2 === 1) brk = false;
    else brk = true;

    if (brk) {
      clusters.push(current);
      current = ch;
      riCount = cat === 'RI' ? 1 : 0;
    } else {
      current += ch;
      if (cat === 'RI') riCount += 1;
      else if (cat !== 'Extend' && cat !== 'ZWJ') riCount = 0;
    }
    prev = cat;
  }
  if (current !== '') clusters.push(current);
  return clusters;
}

// ---------------------------------------------------------------------------
// 码位展示工具
// ---------------------------------------------------------------------------

export function codePointsOf(cluster: string): number[] {
  return Array.from(cluster, (ch) => ch.codePointAt(0)!);
}

export function formatCodePoint(cp: number): string {
  return 'U+' + cp.toString(16).toUpperCase().padStart(4, '0');
}

/** 将簇渲染为可读文本：空白与控制字符以可见符号/转义显示 */
export function displayCluster(cluster: string): string {
  return Array.from(cluster)
    .map((ch) => {
      const cp = ch.codePointAt(0)!;
      if (cp === 0x20) return '␣';
      if (cp === 0x09) return '⇥';
      if (cp === 0x0a) return '⏎';
      if (cp === 0x0d) return '␍';
      if (cp === 0x200d) return 'ZWJ';
      if (cp < 0x20 || (cp >= 0x7f && cp < 0xa0)) return formatCodePoint(cp);
      return ch;
    })
    .join('');
}
