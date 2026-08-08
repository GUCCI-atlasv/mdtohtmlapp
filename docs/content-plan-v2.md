# mdtohtml.app 内容优化方案 v2.0

**文档类型：** Content / SEO 建设规范
**替代：** `mdtohtml_content_seo_optimization_PRD_v1.md`（9 页方案）
**日期：** 2026-08-08

---

## 0. 与 v1 方案的差异

v1 规划了 9 个语法页 + 1 个 Hub，共 10 个 URL、9 套定制交互组件。本方案收敛为 **1 个页面**，理由有三：

第一，`markdown table`、`markdown link` 这类词的 SERP 被 markdownguide.org、GitHub Docs、Stack Overflow 占据，它们是十几年积累的高权重参考站。新域名用"再写一篇语法说明"的方式正面竞争，胜算很低。

第二，真正没人占据的位置是**转换过程中的问题**。"为什么我的换行没了""为什么表格没渲染出来""为什么图片全挂了"——这些查询量不小、答案有难度、且高度依赖渲染器差异。一个转换器站点讲这个，权威性天然成立，而纯文档站反而讲不透（它们不负责转换，看不到输出）。

第三，工程成本。9 套定制 Builder 里只有表格生成器有独立搜索需求，其余（标题生成器、删除线生成器）对用户增益接近于零。砍掉后省下的时间应投入内容深度。

**新定位一句话：**

> 不是"Markdown 语法大全"，而是**"Markdown 转 HTML 的对照表 + 排错手册"**——每个元素给出语法、渲染结果、精确 HTML 输出、以及会出什么错。

---

## 1. 页面规划

### 1.1 URL 与关键词

| 项 | 内容 |
|---|---|
| URL | `/markdown-cheatsheet/`（目录形式，与现网 `/html-to-markdown/` 一致） |
| Primary | `markdown cheat sheet` |
| Secondary | markdown syntax, markdown to html reference, markdown table not rendering, markdown line break not working, markdown image not showing, markdown syntax guide |
| Title | `Markdown Cheat Sheet — Syntax, Exact HTML Output & Fixes` |
| H1 | `Markdown Cheat Sheet: Syntax, HTML Output & Common Fixes` |
| Description | `Every Markdown element with its exact HTML output, live preview, and the mistakes that break it. Free, no signup — test any snippet in the converter.` |

**为什么用 cheatsheet 而不是 markdown-to-html-guide：** `markdown cheat sheet` 搜索量远高于任何"guide"变体，且意图明确（找语法速查）。页面内部再用 H2/H3 锚点承接大量长尾——Google 的段落索引会把 `markdown table not rendering` 这类查询直接定位到页面内的具体小节。

**不放在首页锚点（区别于 markdowntohtml.com）：** 它们的 cheatsheet 是首页 `#cheatsheet` 锚点。这样做首页主题被稀释，cheatsheet 内容也无法独立获得排名。我们用独立 URL，首页只放一条紧凑的语法速查条引流过去。

### 1.2 页面结构

```
Breadcrumb: Home › Markdown Cheat Sheet

H1 + 一句话定位
↓
Quick Reference Table（全元素速查表，可复制，10 秒找到语法）
↓
Live Playground（可编辑 Markdown | Preview | Exact HTML）
↓
Element Reference（14 个元素，每个一节，锚点可直达）
  每节：Syntax → Preview → HTML Output → Gotchas → Compatibility → Try it
↓
Troubleshooting（12 个典型故障：症状 → 原因 → 修复）★ 核心差异化
↓
CommonMark vs GFM 对照表
↓
FAQ（内容形式，不做 schema，见 §5.1）
↓
CTA: Open the converter / 其他工具
```

---

## 2. 向 markdowntohtml.com 学习的三个细节（并做得更好）

### 2.1 语法标记的视觉区分（红色文字）

**它做对了什么：** 速查表里的语法 token 用红色等宽字渲染（Bootstrap 默认 `<code>` 样式 `#c7254e` + 浅粉底）。效果是**语法和说明文字在扫视时一眼分离**，不用逐字读。这是它的 cheatsheet 比大多数同类好读的主要原因。

**我们目前的问题：** 现网 `#preview code` 用的是 `background: var(--accent-soft)`（`#fafafa`），几乎没有对比度，行内代码和正文混在一起。

**我们的做法（并优于它）：** 用品牌色 `#D97757`（Claude 橙，本身就是偏红的赤陶色）作为语法色——既达到"红色标识"的辨识效果，又不引入第二套配色。同时加浅色底和细边框，比 Bootstrap 的纯色文字层次更清晰。

```css
/* 行内语法 token */
code.syntax, .cheat-table code, .content p code, .content li code {
  font-family: var(--mono);
  font-size: .875em;
  color: #C2410C;                                   /* 亮色模式：加深的橙红，保证 AA 对比度 */
  background: color-mix(in srgb, var(--brand) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--brand) 18%, transparent);
  padding: 1.5px 5px;
  border-radius: 5px;
  white-space: nowrap;
}
[data-theme="dark"] code.syntax,
[data-theme="dark"] .cheat-table code { color: #F0A88C; }
```

> **无障碍要求：** `#D97757` 在白底上对比度约 3.1:1，不满足正文 AA（4.5:1）。因此亮色模式必须用加深的 `#C2410C`（约 4.6:1），暗色模式用 `#F0A88C`。不要直接套用品牌色。

**再进一步（它没有的）：** 在 Syntax 代码块里，把**语法字符本身**和**用户内容**分色高亮。比如 `[text](url)` 中，`[` `]` `(` `)` 用橙色，`text` / `url` 用常规色。让人一眼看出"哪些是必须照抄的符号，哪些是要替换的内容"。这是它们完全没做的一层，实现上只需要在构建时对示例做一次简单的 token 包裹。

### 2.2 图片

**它做对了什么：** 速查表里的图片示例是**真的渲染出一张图**（placebear.com 的熊），而不是只写一行 `![alt](url)` 了事。用户能立刻确认"哦，这样写就会出图"。

**它的问题：** 依赖 placebear.com 这类第三方占位图服务。这类服务经常挂掉或变慢——一旦挂了，页面上就是一个碎图，讽刺地出现在讲图片的章节里，还拖慢 LCP。

**我们的做法：**

1. **自托管一张示例图** `/assets/demo/landscape.jpg`（约 40KB，600×400，WebP + JPG 回退），永不失效，可控。
2. **示例图本身要有信息量**——不用无意义的占位图，用一张能同时演示 alt 文本、title 提示、点击跳转的实拍图。
3. **专门演示"坏图"**：用一个故意写错的相对路径，展示浏览器渲染 alt 文本的样子。这是"图片不显示"故障的可视化，比文字描述有效得多。
4. 所有示例图加 `loading="lazy"` + 显式 `width`/`height`（防 CLS，对应 §5.3）。

### 2.3 Cheatsheet 结构

**它做对了什么：** 分类清晰（Basic Formatting / Headings / Links / Images / Lists / Code / Blockquotes），语法和效果并置，整体可扫视。

**它的三个短板，正是我们的机会：**

| 它的短板 | 我们的做法 |
|---|---|
| 只有 Markdown 语法，**不给 HTML 输出** | 每个元素显式给出精确 HTML，且由站内引擎生成（§4.1） |
| **不区分 CommonMark / GFM**，用户不知道哪些语法换个环境就失效 | 每个元素带兼容性徽章 + 独立对照表 |
| 完全**没有排错内容** | 每个元素带 Gotchas，另设完整 Troubleshooting 章节 |
| 静态文本，无法试 | 每个元素一键 "Try it" 载入 Playground / 跳转 Converter |

---

## 3. 内容清单

### 3.1 Quick Reference（页面顶部速查表）

一张表覆盖全部元素，语法列用 §2.1 的红色 token 样式，每行带复制按钮和跳转本页锚点的链接。

| Element | Markdown | HTML | Spec |
|---|---|---|---|
| Heading | `# H1` … `###### H6` | `<h1>`–`<h6>` | CommonMark |
| Bold | `**text**` | `<strong>` | CommonMark |
| Italic | `*text*` | `<em>` | CommonMark |
| Bold + Italic | `***text***` | `<em><strong>` | CommonMark |
| Strikethrough | `~~text~~` | `<del>` | GFM |
| Line break | 行尾 `\` 或两个空格 | `<br>` | CommonMark |
| Blockquote | `> quote` | `<blockquote>` | CommonMark |
| Unordered list | `- item` | `<ul><li>` | CommonMark |
| Ordered list | `1. item` | `<ol><li>` | CommonMark |
| Task list | `- [x] done` | `<input type="checkbox">` | GFM |
| Inline code | `` `code` `` | `<code>` | CommonMark |
| Code block | ``` ```js ``` | `<pre><code class="language-js">` | CommonMark |
| Link | `[text](url)` | `<a href>` | CommonMark |
| Image | `![alt](src)` | `<img src alt>` | CommonMark |
| Table | `\| a \| b \|` | `<table>` | GFM |
| Horizontal rule | `---` | `<hr>` | CommonMark |
| Escape | `\*` | 字面量 `*` | CommonMark |

### 3.2 Element Reference（14 节，每节含 Gotchas）

以下是每个元素**必须覆盖的坑**。这部分是内容专业度的实质，不能省。

**1. Headings**
- `#Title` 缺空格 → 不是标题，原样输出（CommonMark 强制要求空格）
- `## Title ##` 尾部 `#` 会被吃掉，属于合法写法
- 7 个及以上 `#` 不构成标题
- Setext：文字下方 `===` 是 H1、`---` 是 H2；但 `---` **单独成行**是 `<hr>`——两者只差一个空行，是最常见的"莫名多了条横线"来源
- 锚点 ID 由渲染器决定，不是 Markdown 规范的一部分（GitHub 会 slug 化，marked 默认不生成）

**2. Bold / Italic**
- **最高频意外**：`snake_case_name` 中的下划线不会触发斜体（CommonMark 禁用词内 `_`），但星号会——`a*b*c` 会变成 `a<em>b</em>c`。写变量名、文件名时用反引号包起来。
- 词内加粗只能用 `*`：`un**bel**ievable` 生效，`un__bel__ievable` 不生效
- 星号两侧不能有空格：`** text **` 不是加粗
- `***x***` → `<em><strong>x</strong></em>`（嵌套顺序由解析器定）

**3. Line breaks ★ 重点章节**
- 单个换行 = 软换行，HTML 里只变成一个空格，段落不断——这是"我的换行没了"的根本原因
- 行尾两个空格 → `<br>`，但**空格不可见，而且绝大多数编辑器保存时会自动删除行尾空白**，所以这个方法极不可靠
- 行尾反斜杠 `\` → `<br>`，可见、不会被编辑器清理，**推荐做法**
- 空行 → 新的 `<p>`
- `breaks` 选项差异：GitHub 的评论框/Issue 里每个换行都变 `<br>`，但 `.md` 文件渲染时不会。这就是"在 GitHub 评论里好好的，放进 README 就全粘一起了"的原因。**明确标注本站转换器的默认行为（`breaks: false`，遵循 CommonMark）。**

**4. Lists**
- 序号不必连续，`1. 1. 1.` 也能正确编号；但**第一个数字决定 `<ol start>`**
- 嵌套缩进要对齐父项内容起始位置：`- ` 后是 2 空格，`1. ` 后是 3 空格。缩进不足会被当成同级，过多会变成代码块
- Tab 与空格混用是嵌套失败的常见原因
- **松散列表 vs 紧凑列表**：项之间有空行时，每个 `<li>` 内容会被 `<p>` 包裹，视觉上行距变大。这是"列表间距突然变宽"的原因
- 正文里的年份 `2024. 那年…` 会被误判成有序列表，需转义 `2024\.`
- 段落后紧跟列表需要空行分隔

**5. Task lists**（GFM）
- `- [x]` / `- [ ]`，方括号内必须有 x 或空格，`-[x]` 缺空格失效
- 必须位于列表项内，独立成行的 `[x]` 无效
- 输出 `<li><input type="checkbox" disabled checked>`，**默认 disabled**——静态 HTML 里点不动是正常的，交互性由渲染平台（GitHub）额外实现
- 无障碍：纯 checkbox 无 label，屏幕阅读器体验差，正式文档慎用

**6. Links**
- 行内 `[text](url)`、带 title `[text](url "title")`、引用式 `[text][ref]`
- URL 含空格必须编码成 `%20` 或用尖括号 `[a](<my file.pdf>)`
- URL 含括号需转义 `\)`
- 裸 URL 自动成链是 GFM 扩展，CommonMark 需要 `<https://...>`
- **没有原生 `target="_blank"` 语法**——需要写 HTML，且很多渲染器会清洗掉
- 相对链接相对于**渲染位置**解析，文件搬家或转成 HTML 后大量失效
- 本站转换器会对 URL 做安全清洗（DOMPurify），`javascript:` 协议会被移除

**7. Images ★ 配真实图片演示**
- `![alt](src)` → `<img src alt>`；`alt` 是无障碍必需，不是可选装饰
- **没有原生尺寸语法**——`![alt](img.png =100x)` 只在个别渲染器有效，不是标准。要控制尺寸只能写 `<img width>` HTML
- 可点击图片 = `[![alt](img.png)](https://target)`
- **相对路径是"图片全挂了"的头号原因**：`![](./images/a.png)` 在本地正常，转成独立 HTML 分享出去后基路径变了，全部失效。→ 明确建议：需要分享的文档一律用绝对 URL，或用本站"下载完整 HTML"后连同图片目录一起分发
- 文件名含空格需 `%20`
- 演示一张故意写错路径的图，展示 alt 文本的降级表现

**8. Code**
- 行内代码含反引号时用双反引号包裹：`` ``a ` b`` ``
- 围栏用 ``` 或 ~~~，语言标识生成 `<pre><code class="language-js">`
- **语法高亮不是 Markdown 的能力**——class 只是钩子，上色由 highlight.js / Prism / Shiki 等完成。本站输出内联样式，无需外部依赖
- 4 空格缩进也构成代码块（遗留语法），在列表内缩进内容时极易误触发
- 代码块内的 HTML 会被转义（`<` → `&lt;`），这是正确行为
- 列表内放围栏代码块需要跟随列表缩进
- 代码块里要展示三反引号，外层用四个反引号

**9. Blockquotes**
- `> text` → `<blockquote>`
- **懒惰续行**：后续行不写 `>` 仍会被并入同一引用，容易把不想引用的内容吸进去
- 引用内分段需要写单独的 `>` 空行
- `>>` 嵌套引用
- 引用内可放列表、代码块、标题

**10. Tables**（GFM）
- **分隔行 `|---|` 是必需的**，缺了就不是表格——"表格没渲染"的第一原因
- 对齐：`:---` 左、`:---:` 居中、`---:` 右
- **单元格内的 `|` 必须转义成 `\|`，即使它在行内代码里**——`` `a|b` `` 一样会截断表格，必须写 `` `a\|b` ``。这是最隐蔽的表格故障
- 首尾竖线可省略
- 列数由表头行决定，多出的单元格被丢弃
- **不支持 colspan / rowspan**，也不支持单元格内换行（需要用 `<br>`）
- 表格前必须有空行

**11. Strikethrough**（GFM）
- `~~text~~` → `<del>`
- GFM 允许单个或两个波浪线，但**多数其他解析器只认双波浪线**——为可移植性一律用 `~~`
- CommonMark 完全不支持，纯 CommonMark 环境下原样输出

**12. Horizontal rule**
- `---`、`***`、`___`（3 个以上）
- 紧跟在文字下方的 `---` 会被解析成 Setext H2 而非 `<hr>`，前面必须留空行

**13. Escaping**
- 反斜杠可转义 `\* \_ \# \` \[ \] \( \) \| \~ \\`
- `<` 和 `&` 会被自动转义为实体
- HTML 实体（`&copy;`）原样透传

**14. Raw HTML**
- CommonMark / GFM 允许内嵌 HTML，但**渲染平台通常会清洗**（本站用 DOMPurify，会移除 `<script>`、事件属性等）
- **HTML 块内部的 Markdown 不会被解析**——`<div>**bold**</div>` 中的加粗不生效，这是"HTML 里的 Markdown 失效"的原因
- 附加说明：`:smile:` 表情短码和 `[^1]` 脚注都不是 CommonMark，前者是 GitHub 平台功能，后者是部分渲染器的扩展

### 3.3 Troubleshooting ★ 核心差异化章节

以"症状"起头（用户就是这么搜的），而不是以"语法"起头。每条给出：症状 → 原因 → 修复 → 一键在转换器中验证。

| # | 症状 | 根因 | 修复 |
|---|---|---|---|
| 1 | 换行全部消失，几行挤成一段 | 单换行是软换行 | 行尾加 `\`，或空一行分段 |
| 2 | 行尾加了两个空格还是不换行 | 编辑器保存时删除了行尾空白 | 改用行尾反斜杠 |
| 3 | 表格显示成一行纯文本 | 缺少 `\|---\|` 分隔行 | 补上分隔行，表格前留空行 |
| 4 | 表格从中间断开 | 单元格内有未转义的 `\|`（含行内代码内） | 全部改为 `\|` |
| 5 | 图片不显示，只剩 alt 文字 | 相对路径在新位置失效 | 改用绝对 URL |
| 6 | 变量名 `some_var_name` 中间变成斜体 | 星号/下划线触发强调 | 用反引号包裹，或转义 |
| 7 | 嵌套列表被拉平成同级 | 缩进不足或 Tab/空格混用 | 按父项内容起始位置对齐缩进 |
| 8 | 列表项之间间距突然变大 | 松散列表，`<li>` 被 `<p>` 包裹 | 删除项之间的空行 |
| 9 | 正文中莫名出现一条横线 | 文字下方的 `---` 被当作 Setext H2 或 `<hr>` | `---` 前后留空行，或改用 `***` |
| 10 | `#标题` 没变成标题 | `#` 后缺空格 | 补空格 |
| 11 | 复选框不能点击 | 输出的是 `disabled` checkbox | 正常行为，交互性由平台实现 |
| 12 | 在 GitHub 上正常，转换后不对 | GFM 扩展 / `breaks` 选项差异 | 查兼容性表，改用 CommonMark 通用写法 |
| 13 | 写的 HTML 被删掉了 | 渲染器安全清洗 | 说明本站清洗规则，改用等效 Markdown |
| 14 | HTML 标签里的 Markdown 没生效 | HTML 块内不解析 Markdown | 用纯 Markdown 或纯 HTML，不混写 |

### 3.4 CommonMark vs GFM 对照表

一张表说清"哪些语法换个环境就废了"，这是很多用户真正需要但找不到的信息：

| 语法 | CommonMark | GFM | 本站转换器 |
|---|---|---|---|
| 标题 / 强调 / 列表 / 链接 / 图片 / 代码 / 引用 | ✅ | ✅ | ✅ |
| 表格 | ❌ | ✅ | ✅ |
| 任务列表 | ❌ | ✅ | ✅ |
| 删除线 | ❌ | ✅ | ✅ |
| 裸 URL 自动成链 | ❌ | ✅ | ✅ |
| 脚注 `[^1]` | ❌ | 部分 | 标注实际支持情况 |
| 表情短码 `:smile:` | ❌ | 平台功能 | ❌ |
| 每个换行都成 `<br>` | ❌ | 视上下文 | ❌（`breaks: false`） |

> 表格最后一列的取值必须由 §4.1 的自动化测试实测产出，不允许手填。

---

## 4. 技术实现要求

### 4.1 所有 HTML 输出必须由站内引擎生成 ★ 最重要

页面承诺"精确 HTML 输出"。一旦手写的示例 HTML 与转换器实际输出不一致（marked 升级、DOMPurify 规则变化），用户点 "Try it" 当场就能发现矛盾——**核心卖点会直接变成信任污点**。

实现方式：

1. 建 `content/cheatsheet.json`，只维护每个元素的**示例 Markdown 源码 + 说明文字**，不写 HTML。
2. 建 `build/gen-cheatsheet.js`：用 Node 载入与线上完全相同的 `marked` + GFM 配置 + `DOMPurify` 规则，把每段示例 Markdown 转成 HTML，注入静态页面模板，产出 `markdown-cheatsheet/index.html`。
3. 建 `test/cheatsheet.test.js`：断言页面里展示的每一段 HTML 与引擎当前输出逐字节相同；同时校验 §3.4 兼容性表的每一行（如"CommonMark 不支持表格"必须实测为真）。
4. 页面底部输出可信的时间戳：`Verified against marked 12.0.0 · CommonMark 0.31 · last tested 2026-08-08`。

这同时兑现了 v1 PRD 第 15 节要求但未给机制的 "Last updated / tested" 信任信号。**这是竞品都拿不出的 E-E-A-T 证据**——markdowntohtml.com、markdownguide.org 的示例全是手写的静态文本。

> 注意：这一步不引入前端框架。现网是零构建静态站，`gen-cheatsheet.js` 只是一个生成 HTML 文件的 Node 脚本，产物照旧是纯静态页。

### 4.2 交互组件：一个共享 Playground，不做 9 个 Builder

顶部放一个 Playground（可编辑 Markdown / 实时 Preview / 精确 HTML / 三个复制按钮），每个元素小节的 "Try it" 按钮把该元素的示例载入 Playground 并滚动定位。

复用 `assets/render.js` 现有引擎，**不新增依赖**。

唯一值得单独做定制生成器的是**表格**（`markdown table generator` 是独立高意图词，SERP 全是工具站）。但放到本页验证有效之后再单开 `/markdown-table/`，不在本轮范围。

### 4.3 无 JS 可读

所有语法、示例、HTML 输出、Gotchas、Troubleshooting 在构建时就写进静态 HTML，禁用 JS 后全文完整可读可复制。JS 只负责：Playground 编辑、复制按钮、锚点平滑滚动。爬虫和 AI 抓取拿到的是完整内容。

### 4.4 性能与稳定性

- 示例图自托管，`loading="lazy"` + 显式宽高，防 CLS
- Playground 初始高度固定，避免加载后跳动
- 页面体积控制在 150KB 以内（不含图片）
- 长表格移动端横向滚动 + 视觉滚动提示

---

## 5. SEO 要求（含 v1 的修正）

### 5.1 结构化数据：不要做 FAQPage ★ v1 的过时假设

v1 给 9 个页面都规划了 FAQ schema。但 Google 自 2023 年 8 月起将 FAQ 富媒体结果限制为政府/医疗权威站点，并已于 **2026 年 6 月正式下线 FAQ search appearance**，Search Console API 支持将于 2026 年 8 月移除；HowTo 富媒体结果同样已取消。**现在做 FAQPage / HowTo markup 拿不到任何 SERP 展示收益。**

调整：

- FAQ **内容照写**——对用户有用，且是 AI Overviews / ChatGPT 引用的主要抓取形态
- FAQPage / HowTo **markup 不再投入**（现网三个页面上已有的留着无害，但不作为增长手段）
- **改做 `BreadcrumbList`**——这是仍然有效且能拿到展示的结构化数据
- 页面本身可标 `TechArticle`，配 `datePublished` / `dateModified`（对应 §4.1 的实测时间戳）

### 5.2 URL 与规范化

- 统一目录形式带斜杠：`/markdown-cheatsheet/`
- 单复数及近似变体做 301：`/markdown-cheat-sheet`、`/cheatsheet`、`/markdown-syntax` → `/markdown-cheatsheet/`
- canonical、OG、Twitter card 齐备
- 加入 `sitemap.xml`（现网 sitemap 需同步更新，v1 未提及）

### 5.3 站内链接

- 首页 Converter 下方加一条**紧凑语法速查条**（6–8 个最常用元素，一行一个），CTA 指向本页。**不要放 9 张大卡片**——会把 `#free` 区块和 FAQ 挤到很深的位置
- 本页每个元素的 "Try it" → 首页 Converter（带示例参数）
- 现有 `/html-to-markdown/`、`/markdown-to-pdf/` 页脚与正文各加一处指向本页的链接
- 本页底部导向三个工具 + 浏览器插件（v1 完全没提插件的交叉推广）

### 5.4 内容维护

- 每次升级 marked / DOMPurify，跑 §4.1 测试，更新实测时间戳
- 季度复查一次 Troubleshooting 章节，依据 GSC 的实际查询词补充新故障条目

---

## 6. 验收标准

功能层面，禁用 JS 后全部内容可读；页面展示的每段 HTML 与转换器实际输出逐字节一致（自动化测试通过）；每个元素可一键载入 Playground；所有代码块可一键复制；键盘可完整操作且焦点可见。

内容层面，14 个元素全部覆盖 Gotchas；Troubleshooting 不少于 14 条且均为真实故障；兼容性表每一行经实测验证；示例图自托管且含一个"坏图"演示。

视觉层面，行内语法 token 对比度达 WCAG AA（亮色 `#C2410C` / 暗色 `#F0A88C`);语法符号与用户内容分色;整体沿用现有 Geist + 黑白 + 橙色点缀体系,不引入新配色。

SEO 层面，独立 title / H1 / description / canonical；BreadcrumbList 生效；无 FAQPage / HowTo markup；已加入 sitemap；首页与另两个工具页均有入链。

---

## 7. 工作量与后续

单页方案相比 v1 的 10 页方案，工程量下降约六成，内容深度反而更高（Gotchas 与 Troubleshooting 在 v1 里只是每页几行 bullet，这里是主体）。

后续扩展看数据决定，不预先规划：

- 若本页的表格小节流量占比高 → 单独建 `/markdown-table/` 并做定制生成器（`markdown table generator` 是全站最值得攻的独立工具词，且 Excel/CSV → Markdown 表格是明确的高意图场景）
- 若 Troubleshooting 中某条持续获得曝光（如"换行不生效"）→ 拆成独立页深挖
- 其余元素页除非 GSC 出现明确需求，否则不建——避免制造薄内容

**判断依据：** GSC 的 impressions 与查询词，观察窗口不少于 3 个月。新域名权重低，3 个月内不看排名做决策。
