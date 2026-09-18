import { describe, expect, it } from 'vitest';
import { AuditOptions, buildAudit, buildJsonReport, FontInput } from './audit';

const baseOptions: AuditOptions = {
  strategy: 'optimal',
  ignoreDefaultIgnorables: true,
  appendGeneric: true,
  genericFamily: 'sans-serif',
};

const font = (id: string, name: string, rangesText: string): FontInput => ({ id, name, rangesText });

describe('buildAudit', () => {
  it('拉丁 + CJK 双字体可行链', () => {
    const audit = buildAudit(
      'Hi 世',
      [font('a', 'Latin', 'U+0000-00FF'), font('b', 'CJK', 'U+4E00-9FFF')],
      baseOptions,
    );
    expect(audit.feasible).toBe(true);
    expect(audit.chain.map((f) => f.name)).toEqual(['Latin', 'CJK']);
    const assigned = Object.fromEntries(audit.rows.map((r) => [r.text, r.assignedFont]));
    expect(assigned['H']).toBe('a');
    expect(assigned[' ']).toBe('a');
    expect(assigned['世']).toBe('b');
    expect(audit.missing).toHaveLength(0);
  });

  it('未覆盖的簇被标记为缺失', () => {
    // 𠀀 = U+20000，不在任何字体范围内
    const audit = buildAudit('A𠀀', [font('a', 'Latin', 'U+0000-00FF')], baseOptions);
    expect(audit.feasible).toBe(false);
    expect(audit.missing.map((r) => r.text)).toEqual(['𠀀']);
    expect(audit.chain.map((f) => f.name)).toEqual(['Latin']);
  });

  it('忽略可忽略码位：ZWJ 序列只看基字', () => {
    const family = '👨‍👩‍👧‍👦';
    const emojiOnly = [font('e', 'Emoji', 'U+1F400-1F64F')];
    const on = buildAudit(family, emojiOnly, { ...baseOptions, ignoreDefaultIgnorables: true });
    expect(on.feasible).toBe(true);
    // 不忽略时 ZWJ(U+200D) 不在范围内 → 缺失
    const off = buildAudit(family, emojiOnly, { ...baseOptions, ignoreDefaultIgnorables: false });
    expect(off.feasible).toBe(false);
  });

  it('重复簇合并计数', () => {
    const audit = buildAudit('啊啊啊', [font('b', 'CJK', 'U+4E00-9FFF')], baseOptions);
    expect(audit.totalClusters).toBe(3);
    expect(audit.rows).toHaveLength(1);
    expect(audit.rows[0].count).toBe(3);
  });

  it('范围解析错误被记录', () => {
    const audit = buildAudit('A', [font('a', 'Bad', 'U+ZZZZ')], baseOptions);
    expect(audit.fonts[0].parseErrors.length).toBeGreaterThan(0);
  });
});

describe('buildCss', () => {
  it('生成 font-family 并追加通用族', () => {
    const audit = buildAudit(
      'A世',
      [font('a', 'Latin', 'U+0000-00FF'), font('b', 'CJK', 'U+4E00-9FFF')],
      baseOptions,
    );
    expect(audit.css).toBe('font-family: "Latin", "CJK", sans-serif;');
  });

  it('转义字体名中的引号与反斜杠', () => {
    const audit = buildAudit('A', [font('a', 'My "Font" \\', 'U+0000-00FF')], {
      ...baseOptions,
      appendGeneric: false,
    });
    expect(audit.css).toBe('font-family: "My \\"Font\\" \\\\";');
  });
});

describe('buildJsonReport', () => {
  it('包含摘要、链与逐簇承接信息', () => {
    const audit = buildAudit(
      'A𠀀',
      [font('a', 'Latin', 'U+0000-00FF')],
      baseOptions,
    );
    const report = buildJsonReport(audit, 'A𠀀', baseOptions);
    expect(report.summary.feasible).toBe(false);
    expect(report.summary.chain).toEqual(['Latin']);
    expect(report.clusters).toHaveLength(2);
    expect(report.clusters[0]).toMatchObject({ cluster: 'A', assignedFont: 'Latin', status: 'covered' });
    expect(report.clusters[1]).toMatchObject({ cluster: '𠀀', assignedFont: null, status: 'missing' });
    expect(report.css).toContain('font-family');
  });
});
