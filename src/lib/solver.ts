/**
 * solver.ts —— 字体回退链求解。
 *
 * 问题建模：给定按用户偏好排序的字体列表 F = [f0, f1, ...]（下标越小越优先）
 * 与字素簇集合 C，每个字体 fi 覆盖 C 的子集。求一条回退链（F 的有序子序列），
 * 使链中字体的覆盖并集包含所有可被覆盖的簇；每个簇由链中第一个覆盖它的字体承接
 * （与 CSS font-family 的回退语义一致）。
 *
 * 两种策略：
 *  - optimal：链长最短优先；并列最短的解中，偏好下标之和最小（即尽量靠前）。
 *    采用 BigInt 位图 + 迭代加深 DFS（分支限界），字体数较多时自动降级为贪心。
 *  - greedy：严格按偏好顺序扫描，保留"能带来新覆盖"的字体，其余剔除。
 *    链可能更长，但最大限度尊重用户排序。
 */

export type Strategy = 'optimal' | 'greedy';

export interface SolveInput {
  /** 字体 id，数组顺序即偏好顺序 */
  fontIds: string[];
  /** 唯一字素簇数量 */
  clusterCount: number;
  /** covers[fontIdx][clusterIdx] = 该字体是否覆盖该簇 */
  covers: boolean[][];
}

export interface SolveResult {
  /** 是否所有簇均被链覆盖（存在任何字体都无法覆盖的簇时为 false） */
  feasible: boolean;
  /** 回退链（字体 id，按回退顺序排列） */
  chain: string[];
  /** 每个簇的承接字体 id；无字体覆盖时为 null */
  assignment: (string | null)[];
  /** 任何字体都无法覆盖的簇下标 */
  missingClusters: number[];
  /** 链实际覆盖的簇数量 */
  coveredCount: number;
  /** 实际使用的策略（optimal 超限时会降级为 greedy） */
  strategyUsed: Strategy;
  /** 是否发生了策略降级 */
  degraded: boolean;
}

/** optimal 策略的字体数量上限，超过则降级为贪心（避免指数级搜索） */
export const OPTIMAL_FONT_LIMIT = 24;

export function solveFallbackChain(input: SolveInput, strategy: Strategy): SolveResult {
  const { fontIds, clusterCount, covers } = input;
  const n = fontIds.length;

  // 每个字体的覆盖位图：第 j 位表示是否覆盖第 j 个簇
  const masks: bigint[] = covers.map((row) => {
    let m = 0n;
    for (let j = 0; j < row.length; j++) {
      if (row[j]) m |= 1n << BigInt(j);
    }
    return m;
  });

  const universe = clusterCount === 0 ? 0n : (1n << BigInt(clusterCount)) - 1n;
  let coverable = 0n;
  for (const m of masks) coverable |= m;
  // 目标：覆盖所有"至少被一种字体覆盖"的簇
  const target = coverable & universe;

  let strategyUsed: Strategy = strategy;
  let degraded = false;
  let chosen: number[];

  if (strategy === 'optimal') {
    if (n > OPTIMAL_FONT_LIMIT) {
      strategyUsed = 'greedy';
      degraded = true;
      chosen = greedyOrder(masks, target);
    } else {
      chosen = optimalSet(masks, target);
    }
  } else {
    chosen = greedyOrder(masks, target);
  }

  // 链内顺序遵循用户偏好（下标升序），与 CSS 回退语义一致
  chosen.sort((a, b) => a - b);

  // 每个簇由链中第一个覆盖它的字体承接
  const assignment: (string | null)[] = [];
  let coveredMask = 0n;
  for (let j = 0; j < clusterCount; j++) {
    const bit = 1n << BigInt(j);
    let assigned: string | null = null;
    for (const fi of chosen) {
      if ((masks[fi] & bit) !== 0n) {
        assigned = fontIds[fi];
        break;
      }
    }
    assignment.push(assigned);
    if (assigned) coveredMask |= bit;
  }

  const missingClusters: number[] = [];
  for (let j = 0; j < clusterCount; j++) {
    if (((coverable >> BigInt(j)) & 1n) === 0n) missingClusters.push(j);
  }

  return {
    feasible: (coveredMask & universe) === universe,
    chain: chosen.map((i) => fontIds[i]),
    assignment,
    missingClusters,
    coveredCount: popcount(coveredMask),
    strategyUsed,
    degraded,
  };
}

/**
 * 贪心保序：按偏好顺序扫描，字体若能覆盖"尚未被已选字体覆盖"的簇则入选。
 */
function greedyOrder(masks: bigint[], target: bigint): number[] {
  const chosen: number[] = [];
  let covered = 0n;
  for (let i = 0; i < masks.length; i++) {
    const gain = masks[i] & target & ~covered;
    if (gain !== 0n) {
      chosen.push(i);
      covered |= masks[i];
      if ((covered & target) === target) break;
    }
  }
  return chosen;
}

/**
 * 最优解：迭代加深搜索最小链长 k；
 * 在长度为 k 的可行解中，最小化偏好下标之和（cost），
 * 从而在"链最短"与"尊重偏好顺序"之间取得平衡。
 */
function optimalSet(masks: bigint[], target: bigint): number[] {
  const n = masks.length;
  if (target === 0n) return [];

  // 后缀或：suffixOr[i] = masks[i] | ... | masks[n-1]，用于剪枝
  const suffixOr: bigint[] = new Array<bigint>(n + 1).fill(0n);
  for (let i = n - 1; i >= 0; i--) suffixOr[i] = suffixOr[i + 1] | masks[i];

  for (let k = 1; k <= n; k++) {
    let best: number[] | null = null;
    let bestCost = Infinity;
    const chosen: number[] = [];

    const dfs = (i: number, covered: bigint, cost: number): void => {
      if (cost >= bestCost) return; // 代价不可能更优
      if ((covered & target) === target) {
        best = [...chosen];
        bestCost = cost;
        return;
      }
      if (chosen.length >= k || i >= n) return;
      // 剩余字体全部选上也无法覆盖目标 → 剪枝
      if (((covered | suffixOr[i]) & target) !== target) return;

      // 先尝试选入（下标小的优先探索，平局时自然偏向更靠前的字体）
      chosen.push(i);
      dfs(i + 1, covered | masks[i], cost + i);
      chosen.pop();
      dfs(i + 1, covered, cost);
    };

    dfs(0, 0n, 0);
    if (best) return best;
  }
  return [];
}

function popcount(x: bigint): number {
  let c = 0;
  while (x !== 0n) {
    x &= x - 1n;
    c++;
  }
  return c;
}
