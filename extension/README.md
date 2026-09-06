# Save Page as HTML 浏览器扩展

把当前浏览器页面保存为干净、可直接打开的 `.html` 文件。转换完全在浏览器本地执行，不上传内容；Markdown 作为次要导出格式保留。

## 安装（Chrome / Edge / Brave）

1. 打开扩展管理页：Chrome 为 `chrome://extensions`，Edge 为 `edge://extensions`。
2. 开启右上角的“开发者模式”。
3. 点击“加载已解压的扩展程序”。
4. 选择本目录 `extension/`。
5. 打开任意普通网页，点击工具栏中的扩展图标。

如果要保存本地 `file://` 页面，请在扩展详情页开启“允许访问文件网址”。

## 功能

- 使用 Mozilla Readability + 站点正文规则 + 启发式算法三级提取正文。
- 导出智能识别的正文、完整网页、当前选区或手动框选的页面区域。
- HTML 是默认和主要导出格式；弹窗直接显示内容状态、有效图片数和代码块数，不再显示 Markdown 预览。
- 自定义文件名，一键保存为可独立打开的 HTML；Markdown 下载和复制作为次要操作保留。
- Markdown 保留标题、链接、图片、引用、列表、表格与代码块，并自动修正文章标题层级。
- 支持微信公众号等站点的懒加载原图，自动过滤无法恢复的 1×1 占位图。
- 修复富文本代码中的换行和不间断空格，并尽可能识别代码语言。
- 自动补全作者、站点与发布时间；可选清理正文末尾的关注、二维码等推广内容。
- HTML 整页模式保存当前 DOM，并移除脚本与嵌入对象；正文模式生成带标题、作者、来源和发布时间的干净独立文档。
- Markdown 可选写入 YAML Front Matter、来源 URL、作者、发布时间与保存时间。
- 支持右键保存正文、完整网页或当前选区为 HTML，所有选项会自动记忆。
- 弹窗提供“问题反馈”入口，可填写问题类型、联系邮箱和问题描述，并发送至 `support@mdtohtml.app`。
- 快捷键默认保存 HTML：macOS `Control+Shift+M`，Windows/Linux `Alt+Shift+M`。
- 仅需当前标签页临时权限，不申请全部网站的永久读取权限。

## 已知限制

- 浏览器内部页面（如 `chrome://extensions`）不允许扩展读取。
- HTML 会保留图片和样式表的远程地址；离线时这些远程资源可能无法显示。
- 画布、跨域 iframe、视频流和由脚本运行后才生成的交互状态无法完整离线保存。

## 发布前

开发包已包含 16、32、48、128 px 的 PNG 图标。提交扩展商店前仍需准备商店截图、宣传图和完整隐私披露。

## 验证

仓库中的 `tests/extension-smoke.html` 覆盖正文过滤、Front Matter、嵌套列表、任务列表、表格、代码语言与相对链接；`tests/wechat-extension-smoke.html` 覆盖微信公众号懒加载图片、代码换行、元信息、标题层级和推广清理；`tests/content-cdp-test.mjs` 和 `tests/popup-cdp-test.mjs` 可通过 Chrome DevTools Protocol 执行浏览器级验证。

正文提取使用 `@mozilla/readability` 0.6.0，许可证位于 `vendor/READABILITY-LICENSE.md`。
