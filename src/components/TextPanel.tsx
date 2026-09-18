import { SAMPLE_TEXT } from '../App';

interface Props {
  text: string;
  onChange(text: string): void;
  totalClusters: number;
  uniqueClusters: number;
}

export default function TextPanel({ text, onChange, totalClusters, uniqueClusters }: Props) {
  return (
    <div className="card">
      <div className="card-header">
        <h2>待审计文本</h2>
        <div className="btn-row">
          <button type="button" className="btn btn-ghost" onClick={() => onChange(SAMPLE_TEXT)}>
            载入示例
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => onChange('')}>
            清空
          </button>
        </div>
      </div>
      <textarea
        className="text-input"
        rows={6}
        placeholder="粘贴待渲染的文本……"
        value={text}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
      />
      <p className="stat-line">
        共 <strong>{totalClusters}</strong> 个字素簇 · <strong>{uniqueClusters}</strong> 个唯一簇
      </p>
    </div>
  );
}
