import { describe, expect, it } from 'vitest';
import {
  countCodePoints,
  displayCluster,
  mergeRanges,
  parseRanges,
  segmentGraphemes,
} from './unicode';

describe('parseRanges', () => {
  it('解析单码位与区间', () => {
    const { ranges, errors } = parseRanges('U+0041-005A, 0061 U+4E00');
    expect(errors).toEqual([]);
    expect(ranges).toEqual([
      [0x41, 0x5a],
      [0x61, 0x61],
      [0x4e00, 0x4e00],
    ]);
  });

  it('合并重叠与相邻区间', () => {
    expect(mergeRanges([[0x41, 0x50], [0x45, 0x60], [0x61, 0x61]])).toEqual([[0x41, 0x61]]);
  });

  it('拒绝非法输入', () => {
    const { errors } = parseRanges('hello U+005A-0041 U+110000');
    expect(errors).toHaveLength(3);
  });

  it('统计码位数量', () => {
    expect(countCodePoints([[0x41, 0x5a]])).toBe(26);
  });
});

describe('segmentGraphemes', () => {
  it('按字素簇切分普通文本', () => {
    expect(segmentGraphemes('Hi 世界')).toEqual(['H', 'i', ' ', '世', '界']);
  });

  it('组合附加符号不拆分', () => {
    // e + U+0301（café 的分解形式）
    expect(segmentGraphemes('café')).toEqual(['c', 'a', 'f', 'é']);
  });

  it('ZWJ emoji 序列保持为一个簇', () => {
    expect(segmentGraphemes('👨‍👩‍👧‍👦')).toEqual(['👨‍👩‍👧‍👦']);
  });

  it('区域指示符两两成对', () => {
    expect(segmentGraphemes('🇨🇳🇺🇸')).toEqual(['🇨🇳', '🇺🇸']);
  });

  it('肤色修饰符与 keycap 不拆分', () => {
    expect(segmentGraphemes('👍🏽')).toEqual(['👍🏽']);
    expect(segmentGraphemes('1️⃣')).toEqual(['1️⃣']);
  });
});

describe('displayCluster', () => {
  it('空白字符可见化', () => {
    expect(displayCluster(' ')).toBe('␣');
    expect(displayCluster('\n')).toBe('⏎');
  });
});
