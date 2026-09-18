import { ClusterRow, FontSpec } from '../lib/audit';
import { formatCodePoint } from '../lib/unicode';

const MAX_ROWS = 200;

interface Props {
  rows: ClusterRow[];
  fonts: FontSpec[];
  /** 字体 id → 链中位置（从 1 开始） */
  chainIndex: Map<string, number>;
}

export default function ClusterTable({ rows, fonts, chainIndex }: Props) {
  if (rows.length === 0) {
    return (
      <div className="card">
        <h2>字素簇明细</h2>
        <p className="empty">输入文本后，这里将列出每个字素簇的覆盖与承接情况。</p>
      </div>
    );
  }

  const fontName = (id: string) => fonts.find((f) => f.id === id)?.name ?? id;
  const shown = rows.slice(0, MAX_ROWS);

  return (
    <div className="card">
      <div className="card-header">
        <h2>字素簇明细</h2>
        <span className="hint">
          {rows.length} 个唯一簇{rows.length > MAX_ROWS ? `，仅显示前 ${MAX_ROWS} 个` : ''}
        </span>
      </div>
      <div className="table-wrap">
        <table className="cluster-table">
          <thead>
            <tr>
              <th>簇</th>
              <th>码位</th>
              <th>次数</th>
              <th>可覆盖字体</th>
              <th>承接字体</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => (
              <tr key={row.index} className={row.missing ? 'row-missing' : ''}>
                <td className="glyph" title={row.text}>
                  {row.display}
                </td>
                <td className="mono small">{row.codePoints.map(formatCodePoint).join(' ')}</td>
                <td>{row.count}</td>
                <td>
                  {row.coveredBy.length === 0 ? (
                    <span className="muted">—</span>
                  ) : (
                    <span className="tag-list">
                      {row.coveredBy.map((id) => (
                        <span key={id} className="tag">
                          {fontName(id)}
                        </span>
                      ))}
                    </span>
                  )}
                </td>
                <td>
                  {row.assignedFont ? (
                    <span className="assigned">
                      {fontName(row.assignedFont)}
                      <em className="chain-pos-tag">链 #{chainIndex.get(row.assignedFont)}</em>
                    </span>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td>
                  {row.missing ? (
                    <span className="badge badge-bad">缺失</span>
                  ) : (
                    <span className="badge badge-ok">已覆盖</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
