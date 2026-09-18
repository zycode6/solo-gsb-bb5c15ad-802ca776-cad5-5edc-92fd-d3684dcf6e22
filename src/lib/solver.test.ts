import { describe, expect, it } from 'vitest';
import { solveFallbackChain, SolveInput } from './solver';

/** 便捷构造：fonts 中每个元素是该字体覆盖的簇下标集合 */
function makeInput(clusterCount: number, fontCovers: number[][]): SolveInput {
  return {
    fontIds: fontCovers.map((_, i) => `F${i}`),
    clusterCount,
    covers: fontCovers.map((set) =>
      Array.from({ length: clusterCount }, (_, j) => set.includes(j)),
    ),
  };
}

describe('solveFallbackChain / optimal', () => {
  it('单字体全覆盖 → 链长 1', () => {
    const r = solveFallbackChain(makeInput(3, [[0, 1, 2]]), 'optimal');
    expect(r.chain).toEqual(['F0']);
    expect(r.feasible).toBe(true);
    expect(r.assignment).toEqual(['F0', 'F0', 'F0']);
  });

  it('需要两种字体时按偏好顺序组成链', () => {
    const r = solveFallbackChain(makeInput(4, [[0, 1], [2, 3]]), 'optimal');
    expect(r.chain).toEqual(['F0', 'F1']);
    expect(r.assignment).toEqual(['F0', 'F0', 'F1', 'F1']);
    expect(r.feasible).toBe(true);
  });

  it('链长最短优先于偏好顺序：靠后的字体若能独挑则选它', () => {
    // F0、F1 各覆盖一个簇，F2 全覆盖 —— 最短链是 [F2]
    const r = solveFallbackChain(makeInput(2, [[0], [1], [0, 1]]), 'optimal');
    expect(r.chain).toEqual(['F2']);
    expect(r.assignment).toEqual(['F2', 'F2']);
  });

  it('同等链长下偏好顺序靠前者胜出', () => {
    const r = solveFallbackChain(makeInput(2, [[0, 1], [0, 1]]), 'optimal');
    expect(r.chain).toEqual(['F0']);
  });

  it('并列最短解中选择偏好代价更小的组合', () => {
    // 需要覆盖 {0,1,2}：F0={0} F1={1,2} F2={0} F3={1,2}
    // 长度 2 的解有 {F0,F1} 与 {F2,F3}，前者偏好代价更小
    const r = solveFallbackChain(makeInput(3, [[0], [1, 2], [0], [1, 2]]), 'optimal');
    expect(r.chain).toEqual(['F0', 'F1']);
  });

  it('存在任何字体都无法覆盖的簇 → 不可行并标出缺失', () => {
    const r = solveFallbackChain(makeInput(3, [[0], [1]]), 'optimal');
    expect(r.feasible).toBe(false);
    expect(r.missingClusters).toEqual([2]);
    expect(r.chain).toEqual(['F0', 'F1']);
    expect(r.assignment[2]).toBeNull();
  });

  it('空文本 → 空链且可行', () => {
    const r = solveFallbackChain(makeInput(0, [[]]), 'optimal');
    expect(r.chain).toEqual([]);
    expect(r.feasible).toBe(true);
  });
});

describe('solveFallbackChain / greedy', () => {
  it('严格保留偏好顺序，即使链更长', () => {
    // F0 只覆盖簇 0，F1 全覆盖：optimal 得 [F1]，greedy 得 [F0, F1]
    const input = makeInput(2, [[0], [0, 1]]);
    const greedy = solveFallbackChain(input, 'greedy');
    expect(greedy.chain).toEqual(['F0', 'F1']);
    expect(greedy.assignment).toEqual(['F0', 'F1']);
    const optimal = solveFallbackChain(input, 'optimal');
    expect(optimal.chain).toEqual(['F1']);
  });

  it('跳过无新增覆盖的字体', () => {
    const r = solveFallbackChain(makeInput(2, [[0, 1], [0], []]), 'greedy');
    expect(r.chain).toEqual(['F0']);
  });
});
