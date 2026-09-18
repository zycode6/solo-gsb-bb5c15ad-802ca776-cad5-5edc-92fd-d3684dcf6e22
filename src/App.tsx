import { useMemo, useState } from 'react';
import { buildAudit, buildJsonReport, FontInput } from './lib/audit';
import { Strategy } from './lib/solver';
import TextPanel from './components/TextPanel';
import FontPanel from './components/FontPanel';
import ResultPanel from './components/ResultPanel';
import ClusterTable from './components/ClusterTable';
import ExportPanel from './components/ExportPanel';

let nextId = 1;
const genId = () => `font-${nextId++}`;

export const SAMPLE_TEXT = 'Hello, 世界！Café ☕🌍 👨‍👩‍👧‍👦 𠀀';

export function sampleFonts(): FontInput[] {
  return [
    { id: genId(), name: 'Latin Core', rangesText: 'U+0000-00FF, U+2000-206F' },
    { id: genId(), name: 'CJK Unified', rangesText: 'U+3000-303F, U+4E00-9FFF, U+FF00-FFEF' },
    { id: genId(), name: 'Emoji Color', rangesText: 'U+2600-27BF, U+1F000-1FAFF' },
  ];
}

export default function App() {
  const [text, setText] = useState(SAMPLE_TEXT);
  const [fonts, setFonts] = useState<FontInput[]>(sampleFonts);
  const [strategy, setStrategy] = useState<Strategy>('optimal');
  const [ignoreDefaultIgnorables, setIgnoreDefaultIgnorables] = useState(true);
  const [appendGeneric, setAppendGeneric] = useState(true);
  const [genericFamily, setGenericFamily] = useState('sans-serif');

  const audit = useMemo(
    () =>
      buildAudit(text, fonts, {
        strategy,
        ignoreDefaultIgnorables,
        appendGeneric,
        genericFamily,
      }),
    [text, fonts, strategy, ignoreDefaultIgnorables, appendGeneric, genericFamily],
  );

  const report = useMemo(
    () =>
      buildJsonReport(audit, text, {
        strategy,
        ignoreDefaultIgnorables,
        appendGeneric,
        genericFamily,
      }),
    [audit, text, strategy, ignoreDefaultIgnorables, appendGeneric, genericFamily],
  );

  const chainIndex = useMemo(() => {
    const m = new Map<string, number>();
    audit.chain.forEach((f, i) => m.set(f.id, i + 1));
    return m;
  }, [audit.chain]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Unicode 字体回退链审计台</h1>
        <p className="subtitle">
          粘贴文本、录入字体覆盖范围，按字素簇审计覆盖情况，求解最短可行回退链并导出 CSS / JSON
        </p>
      </header>

      <main className="layout">
        <section className="col">
          <TextPanel text={text} onChange={setText} totalClusters={audit.totalClusters} uniqueClusters={audit.rows.length} />

          <FontPanel
            fonts={audit.fonts}
            coveredCounts={audit.coveredCountByFont}
            onChange={setFonts}
          />

          <div className="card">
            <h2>求解选项</h2>
            <div className="options">
              <fieldset>
                <legend>回退链策略</legend>
                <label className="radio">
                  <input
                    type="radio"
                    name="strategy"
                    checked={strategy === 'optimal'}
                    onChange={() => setStrategy('optimal')}
                  />
                  <span>
                    <strong>最短链优先</strong>
                    <small>链长最短；并列时优先选择偏好顺序靠前的字体</small>
                  </span>
                </label>
                <label className="radio">
                  <input
                    type="radio"
                    name="strategy"
                    checked={strategy === 'greedy'}
                    onChange={() => setStrategy('greedy')}
                  />
                  <span>
                    <strong>偏好顺序优先</strong>
                    <small>严格按列表顺序保留有新增覆盖的字体，链可能更长</small>
                  </span>
                </label>
              </fieldset>

              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={ignoreDefaultIgnorables}
                  onChange={(e) => setIgnoreDefaultIgnorables(e.target.checked)}
                />
                <span>
                  忽略默认可忽略码位
                  <small>ZWJ、变体选择符不要求字体提供字形</small>
                </span>
              </label>

              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={appendGeneric}
                  onChange={(e) => setAppendGeneric(e.target.checked)}
                />
                <span>
                  CSS 末尾追加通用字体族
                  <input
                    className="inline-input"
                    type="text"
                    value={genericFamily}
                    onChange={(e) => setGenericFamily(e.target.value)}
                    disabled={!appendGeneric}
                  />
                </span>
              </label>
            </div>
          </div>
        </section>

        <section className="col">
          <ResultPanel audit={audit} hasText={text.length > 0} />
          <ClusterTable rows={audit.rows} fonts={audit.fonts} chainIndex={chainIndex} />
          <ExportPanel css={audit.css} report={report} />
        </section>
      </main>

      <footer className="app-footer">
        字素簇切分基于 Intl.Segmenter（UAX #29）· 回退语义与 CSS font-family 一致：每个簇由链中第一个覆盖它的字体承接
      </footer>
    </div>
  );
}
