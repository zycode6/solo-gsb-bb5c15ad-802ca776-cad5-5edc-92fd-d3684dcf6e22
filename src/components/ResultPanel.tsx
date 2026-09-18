import { AuditResult } from '../lib/audit';

interface Props {
  audit: AuditResult;
  hasText: boolean;
}

export default function ResultPanel({ audit, hasText }: Props) {
  const { chain, feasible, missing, assignedCount, degraded, strategyUsed } = audit;

  return (
    <div className="card">
      <div className="card-header">
        <h2>回退链方案</h2>
        {hasText && chain.length > 0 && (
          <span className={`badge ${feasible ? 'badge-ok' : 'badge-bad'}`}>
            {feasible ? '✓ 可行：全部簇已覆盖' : `✕ 存在 ${missing.length} 个未覆盖簇`}
          </span>
        )}
      </div>

      {!hasText && <p className="empty">请先输入待审计文本。</p>}
      {hasText && chain.length === 0 && <p className="empty">请至少添加一种有效字体。</p>}

      {hasText && chain.length > 0 && (
        <>
          <ol className="chain">
            {chain.map((font, i) => (
              <li key={font.id} className="chain-item">
                <span className="chain-pos">{i + 1}</span>
                <span className="chain-name">{font.name}</span>
                <span className="chain-load">承接 {assignedCount.get(font.id) ?? 0} 簇</span>
                {i < chain.length - 1 && <span className="chain-arrow">→</span>}
              </li>
            ))}
          </ol>
          <p className="hint">
            链长 {chain.length} · 策略：{strategyUsed === 'optimal' ? '最短链优先' : '偏好顺序优先'}
            {degraded && '（字体数量过多，已自动降级为贪心策略）'}
          </p>
        </>
      )}

      {missing.length > 0 && (
        <div className="missing-box">
          <strong>缺失项：</strong>以下字素簇未被任何字体覆盖，请补充字体或调整覆盖范围：
          <div className="missing-list">
            {missing.map((row) => (
              <span key={row.index} className="chip chip-missing" title={row.codePoints.map((cp) => 'U+' + cp.toString(16).toUpperCase().padStart(4, '0')).join(' ')}>
                {row.display}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
