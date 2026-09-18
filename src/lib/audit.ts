/**
 * audit.ts —— 审计流水线：文本 → 字素簇 → 覆盖矩阵 → 回退链 → 导出物。
 */
import {
  CodeRange,
  codePointsOf,
  countCodePoints,
  displayCluster,
  formatCodePoint,
  isDefaultIgnorable,
  isInRanges,
  parseRanges,
  segmentGraphemes,
} from './unicode';
import { solveFallbackChain, Strategy } from './solver';

/** 用户在编辑器中录入的字体 */
export interface FontInput {
  id: string;
  name: string;
  rangesText: string;
}

/** 解析后的字体（含覆盖区间与统计） */
export interface FontSpec extends FontInput {
  ranges: CodeRange[];
  parseErrors: string[];
  codePointCount: number;
}

export interface AuditOptions {
  strategy: Strategy;
  /** 是否忽略 ZWJ / 变体选择符等默认可忽略码位 */
  ignoreDefaultIgnorables: boolean;
  /** 导出 CSS 时是否追加通用字体族（如 sans-serif） */
  appendGeneric: boolean;
  genericFamily: string;
}

export interface ClusterRow {
  index: number;
  /** 簇原文 */
  text: string;
  /** 可读展示形式（空白/控制字符转义） */
  display: string;
  codePoints: number[];
  /** 在文本中出现次数 */
  count: number;
  /** 覆盖该簇的字体 id 列表 */
  coveredBy: string[];
  /** 回退链中承接该簇的字体 id；无字体覆盖时为 null */
  assignedFont: string | null;
  /** 是否任何字体都无法覆盖 */
  missing: boolean;
}

export interface AuditResult {
  fonts: FontSpec[];
  /** 文本中的簇总数（含重复） */
  totalClusters: number;
  rows: ClusterRow[];
  /** 求解出的回退链（按回退顺序） */
  chain: FontSpec[];
  feasible: boolean;
  missing: ClusterRow[];
  /** 每种链上字体承接的簇数（按出现次数计） */
  assignedCount: Map<string, number>;
  /** 每种字体覆盖的唯一簇数 */
  coveredCountByFont: Map<string, number>;
  strategyUsed: Strategy;
  degraded: boolean;
  css: string;
}

export function buildAudit(text: string, fontInputs: FontInput[], options: AuditOptions): AuditResult {
  const fonts: FontSpec[] = fontInputs.map((f) => {
    const { ranges, errors } = parseRanges(f.rangesText);
    return { ...f, ranges, parseErrors: errors, codePointCount: countCodePoints(ranges) };
  });

  // 1. 字素簇切分 + 去重（保留首次出现顺序，统计次数）
  const segments = segmentGraphemes(text);
  const metaByText = new Map<string, { codePoints: number[]; count: number }>();
  const order: string[] = [];
  for (const seg of segments) {
    const hit = metaByText.get(seg);
    if (hit) {
      hit.count += 1;
    } else {
      metaByText.set(seg, { codePoints: codePointsOf(seg), count: 1 });
      order.push(seg);
    }
  }

  // 2. 每个唯一簇的有效码位（可选剔除默认可忽略码位）
  const effectiveCps = order.map((seg) => {
    const cps = metaByText.get(seg)!.codePoints;
    return options.ignoreDefaultIgnorables ? cps.filter((cp) => !isDefaultIgnorable(cp)) : cps;
  });

  // 3. 覆盖矩阵：字体 × 簇。簇的全部有效码位都在字体范围内才算覆盖。
  //    有效码位为空（如纯 ZWJ 序列）时视为被所有字体覆盖。
  const covers = fonts.map((font) =>
    effectiveCps.map((cps) => cps.length === 0 || cps.every((cp) => isInRanges(cp, font.ranges))),
  );

  // 4. 求解回退链
  const solved = solveFallbackChain(
    { fontIds: fonts.map((f) => f.id), clusterCount: order.length, covers },
    options.strategy,
  );

  // 5. 汇总行数据
  const rows: ClusterRow[] = order.map((seg, i) => {
    const meta = metaByText.get(seg)!;
    const coveredBy = fonts.filter((_, fi) => covers[fi][i]).map((f) => f.id);
    return {
      index: i,
      text: seg,
      display: displayCluster(seg),
      codePoints: meta.codePoints,
      count: meta.count,
      coveredBy,
      assignedFont: solved.assignment[i],
      missing: coveredBy.length === 0,
    };
  });

  const fontById = new Map(fonts.map((f) => [f.id, f]));
  const chain = solved.chain.map((id) => fontById.get(id)!);

  const assignedCount = new Map<string, number>();
  const coveredCountByFont = new Map<string, number>();
  for (const row of rows) {
    if (row.assignedFont) {
      assignedCount.set(row.assignedFont, (assignedCount.get(row.assignedFont) ?? 0) + row.count);
    }
    for (const fid of row.coveredBy) {
      coveredCountByFont.set(fid, (coveredCountByFont.get(fid) ?? 0) + 1);
    }
  }

  const missing = rows.filter((r) => r.missing);
  const css = buildCss(chain, options);

  return {
    fonts,
    totalClusters: segments.length,
    rows,
    chain,
    feasible: solved.feasible,
    missing,
    assignedCount,
    coveredCountByFont,
    strategyUsed: solved.strategyUsed,
    degraded: solved.degraded,
    css,
  };
}

/** 生成 CSS font-family 声明 */
export function buildCss(chain: FontSpec[], options: AuditOptions): string {
  const names = chain.map((f) => `"${f.name.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`);
  if (options.appendGeneric && options.genericFamily.trim()) {
    names.push(options.genericFamily.trim());
  }
  return `font-family: ${names.join(', ')};`;
}

/** 生成审计报告 JSON 对象 */
export function buildJsonReport(audit: AuditResult, text: string, options: AuditOptions) {
  const fontName = (id: string | null): string | null =>
    id === null ? null : (audit.fonts.find((f) => f.id === id)?.name ?? null);

  return {
    tool: 'unicode-font-fallback-audit',
    version: 1,
    generatedAt: new Date().toISOString(),
    input: {
      text,
      fonts: audit.fonts.map((f) => ({ name: f.name, ranges: f.rangesText })),
    },
    options: {
      strategy: options.strategy,
      strategyUsed: audit.strategyUsed,
      ignoreDefaultIgnorables: options.ignoreDefaultIgnorables,
    },
    summary: {
      totalClusters: audit.totalClusters,
      uniqueClusters: audit.rows.length,
      coveredClusters: audit.rows.length - audit.missing.length,
      missingClusters: audit.missing.length,
      feasible: audit.feasible,
      chainLength: audit.chain.length,
      chain: audit.chain.map((f) => f.name),
    },
    css: audit.css,
    clusters: audit.rows.map((r) => ({
      cluster: r.text,
      display: r.display,
      codePoints: r.codePoints.map(formatCodePoint),
      occurrences: r.count,
      coveredBy: r.coveredBy.map((id) => fontName(id)),
      assignedFont: fontName(r.assignedFont),
      status: r.missing ? 'missing' : 'covered',
    })),
  };
}
