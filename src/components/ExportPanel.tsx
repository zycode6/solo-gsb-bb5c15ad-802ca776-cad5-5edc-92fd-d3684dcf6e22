import { useState } from 'react';

interface Props {
  css: string;
  report: object;
}

type CopyTarget = 'css' | 'json';

export default function ExportPanel({ css, report }: Props) {
  const [copied, setCopied] = useState<CopyTarget | null>(null);
  const json = JSON.stringify(report, null, 2);

  const copy = async (target: CopyTarget, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
    } catch {
      // 剪贴板 API 不可用（如非安全上下文）时退回 execCommand
      const ta = document.createElement('textarea');
      ta.value = content;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(target);
    window.setTimeout(() => setCopied(null), 1500);
  };

  const downloadJson = () => {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'font-fallback-audit.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="card">
      <h2>导出</h2>

      <div className="export-block">
        <div className="export-head">
          <h3>CSS font-family</h3>
          <button type="button" className="btn" onClick={() => copy('css', css)}>
            {copied === 'css' ? '✓ 已复制' : '复制 CSS'}
          </button>
        </div>
        <pre className="code-block">
          <code>{css}</code>
        </pre>
      </div>

      <div className="export-block">
        <div className="export-head">
          <h3>审计 JSON</h3>
          <div className="btn-row">
            <button type="button" className="btn" onClick={() => copy('json', json)}>
              {copied === 'json' ? '✓ 已复制' : '复制 JSON'}
            </button>
            <button type="button" className="btn" onClick={downloadJson}>
              下载 JSON
            </button>
          </div>
        </div>
        <pre className="code-block json-block">
          <code>{json}</code>
        </pre>
      </div>
    </div>
  );
}
