import { FontInput, FontSpec } from '../lib/audit';

let nextPresetId = 1000;
const genId = () => `font-${nextPresetId++}`;

interface Preset {
  name: string;
  ranges: string;
}

const PRESETS: Preset[] = [
  { name: '基本拉丁', ranges: 'U+0000-007F' },
  { name: '拉丁-1 补充', ranges: 'U+0080-00FF' },
  { name: '拉丁扩展', ranges: 'U+0100-024F, U+1E00-1EFF' },
  { name: '通用标点', ranges: 'U+2000-206F' },
  { name: 'CJK 统一表意', ranges: 'U+4E00-9FFF' },
  { name: 'CJK 扩展 A', ranges: 'U+3400-4DBF' },
  { name: '日文假名', ranges: 'U+3040-30FF' },
  { name: '韩文音节', ranges: 'U+AC00-D7AF, U+1100-11FF' },
  { name: '全角与 CJK 标点', ranges: 'U+3000-303F, U+FF00-FFEF' },
  { name: 'Emoji 表情', ranges: 'U+1F000-1FAFF, U+2600-27BF' },
];

interface Props {
  fonts: FontSpec[];
  /** 每种字体覆盖的唯一簇数 */
  coveredCounts: Map<string, number>;
  onChange(next: FontInput[]): void;
}

export default function FontPanel({ fonts, coveredCounts, onChange }: Props) {
  const update = (id: string, patch: Partial<FontInput>) => {
    onChange(fonts.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };

  const remove = (id: string) => onChange(fonts.filter((f) => f.id !== id));

  const move = (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= fonts.length) return;
    const next = [...fonts];
    [next[index], next[j]] = [next[j], next[index]];
    onChange(next);
  };

  const addFont = () => {
    onChange([...fonts, { id: genId(), name: `字体 ${fonts.length + 1}`, rangesText: '' }]);
  };

  const addPreset = (preset: Preset) => {
    onChange([...fonts, { id: genId(), name: preset.name, rangesText: preset.ranges }]);
  };

  return (
    <div className="card">
      <div className="card-header">
        <h2>字体与 Unicode 覆盖范围</h2>
        <button type="button" className="btn" onClick={addFont}>
          + 添加字体
        </button>
      </div>
      <p className="hint">
        列表顺序即偏好顺序（可用 ↑↓ 调整）。范围格式：<code>U+4E00-9FFF</code>、<code>U+0041</code>，多个区间用逗号或空格分隔。
      </p>

      <div className="preset-row">
        {PRESETS.map((p) => (
          <button key={p.name} type="button" className="chip chip-btn" title={p.ranges} onClick={() => addPreset(p)}>
            + {p.name}
          </button>
        ))}
      </div>

      {fonts.length === 0 && <p className="empty">尚未添加字体，点击"添加字体"或上方预设。</p>}

      <ul className="font-list">
        {fonts.map((font, i) => (
          <li key={font.id} className="font-item">
            <div className="font-item-head">
              <span className="font-order" title="偏好顺序">
                #{i + 1}
              </span>
              <input
                className="font-name"
                type="text"
                value={font.name}
                placeholder="字体名称"
                onChange={(e) => update(font.id, { name: e.target.value })}
              />
              <div className="font-actions">
                <button type="button" className="icon-btn" title="上移" disabled={i === 0} onClick={() => move(i, -1)}>
                  ↑
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  title="下移"
                  disabled={i === fonts.length - 1}
                  onClick={() => move(i, 1)}
                >
                  ↓
                </button>
                <button type="button" className="icon-btn danger" title="删除" onClick={() => remove(font.id)}>
                  ✕
                </button>
              </div>
            </div>
            <textarea
              className="ranges-input"
              rows={2}
              placeholder="U+0000-007F, U+4E00-9FFF"
              value={font.rangesText}
              onChange={(e) => update(font.id, { rangesText: e.target.value })}
              spellCheck={false}
            />
            <div className="font-meta">
              <span>{font.codePointCount.toLocaleString()} 个码位</span>
              <span>覆盖 {coveredCounts.get(font.id) ?? 0} 个唯一簇</span>
            </div>
            {font.parseErrors.length > 0 && (
              <ul className="parse-errors">
                {font.parseErrors.map((err) => (
                  <li key={err}>{err}</li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
