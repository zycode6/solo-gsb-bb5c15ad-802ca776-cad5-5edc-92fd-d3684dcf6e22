# Unicode 字体回退链审计台

无需登录的单页应用（React 18 + TypeScript + Vite）：粘贴待渲染文本、录入字体名称及其
Unicode 覆盖范围，系统按**字素簇**（grapheme cluster，UAX #29）计算每种字体可覆盖的
字符并标出缺失项；核心求解器在**保持字体顺序偏好**与**链长度最短**之间求出可行回退链，
解释每个字素簇由哪种字体承接，并导出 CSS `font-family` 与审计 JSON。

## 快速开始（Docker 一键启动）

```bash
docker compose up --build
```

启动后访问 **http://localhost:8080**（宿主机端口 8080 → 容器 nginx 80）。

也可以使用 Docker 直接构建运行：

```bash
docker build -t unicode-font-fallback-audit .
docker run --rm -p 8080:80 unicode-font-fallback-audit
```

## 本地开发

```bash
npm install        # 安装依赖
npm run dev        # 开发服务器 → http://localhost:5173
npm test           # 运行单元测试（vitest）
npm run build      # 类型检查并产出 dist/
npm run preview    # 预览构建产物
```

## 使用说明

1. **待审计文本**：粘贴需要渲染的文本，系统按字素簇切分（emoji ZWJ 序列、组合符号、
   国旗等不会被拆散），并统计唯一簇。
2. **字体与覆盖范围**：为每种字体录入名称与 Unicode 区间，格式如
   `U+0000-007F, U+4E00-9FFF, U+1F600`（`U+` 前缀可省略，逗号/空格分隔）。
   列表顺序即**偏好顺序**，可用 ↑↓ 调整；也可点击预设块快速添加常用区间。
3. **求解选项**：
   - **最短链优先**：求链长最短的回退链；并列最短时偏好顺序靠前者胜出（精确求解，
     字体数 > 24 时自动降级为贪心）。
   - **偏好顺序优先**：严格按列表顺序保留"有新增覆盖"的字体，链可能更长。
   - **忽略默认可忽略码位**：ZWJ、变体选择符不要求字体提供字形（默认开启）。
4. **结果**：回退链按顺序展示每种字体承接的簇数；明细表逐簇列出码位、可覆盖字体、
   承接字体（链中第一个覆盖该簇的字体，与 CSS 回退语义一致）与缺失状态。
5. **导出**：一键复制 CSS `font-family` 声明，复制/下载审计 JSON（含输入、选项、
   摘要与逐簇承接明细）。

## 求解模型

- 字体 `f` 覆盖簇 `c` ⟺ `c` 的全部有效码位都在 `f` 的范围内。
- 目标：选出字体的有序子序列（链），使链覆盖所有"可被覆盖"的簇；
  每个簇由链中**第一个**覆盖它的字体承接。
- `最短链优先` = 词序目标：先最小化链长，再最小化链内字体的偏好下标之和。
  实现为 BigInt 位图 + 迭代加深 DFS（后缀或剪枝 + 代价限界）。
- 任何字体都无法覆盖的簇记为**缺失项**，此时链为"尽力而为"，报告标记不可行。

## 项目结构

```
├── Dockerfile             # 多阶段：node 构建 → nginx 托管
├── docker-compose.yml     # 一键启动，端口 8080:80
├── nginx.conf             # SPA 路由回退 + 静态资源缓存
├── index.html
└── src/
    ├── lib/
    │   ├── unicode.ts     # 范围解析、字素簇切分（Intl.Segmenter + 兜底）
    │   ├── solver.ts      # 回退链求解（最优 / 贪心两种策略）
    │   ├── audit.ts       # 审计流水线 + CSS/JSON 导出
    │   └── *.test.ts      # vitest 单元测试
    ├── components/        # 文本、字体、结果、明细、导出五个面板
    └── App.tsx
```
