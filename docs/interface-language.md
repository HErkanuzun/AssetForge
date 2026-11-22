# 界面语言开发约定

设置中的“界面语言 / Interface language / Arayüz dili”提供 English、简体中文、Türkçe；保存成功后立即生效，无需重启。入口位于设置已有分类列表末尾；点击“界面语言”后在右侧面板设置。可通过本地化分类名或 English、简体中文、Türkçe 搜索；无匹配时清空搜索即可恢复分类列表。保存失败保留之前的语言并显示错误；可以重新选择重试。项目内容保持原始语言。实现已接入全部页面和设置面板，详细验证及尚未验收的流程以 OpenSpec 的 tasks.md 和 ui-audit.md 为准。

`settings.json` 中可选的历史字段 `locale` 在读取后归一化为 `en | zh-CN | tr`。有效的显式值优先；旧文件缺省/无效值根据系统语言选择，简体中文系统选 zh-CN，土耳其语系统选 tr，其他选 en。项目切换不改变此机器级设置。服务端浏览器界面跟随主机；编辑者和查看者不能写设置。

翻译定义在 `src/shared/i18n/`，英语定义消息键与参数类型；所有语言必须具有相同 key 和参数。使用 `translate(locale, key, params)` 或 React 的 `useLocale()`。动态名称、路径、外部错误详情通过参数插值，不用于查找翻译。HTML 页面仍须转义最终文字。

已保存的业务数据、内部状态、节点/端口标识及参数值不可因切换语言改写。静态元数据应保存消息键并在显示时翻译，避免模块加载时缓存译文。新增消息必须同时添加三语译文，运行 i18n 测试验证完整性。

`settings:locale` 事件只携带 locale，不携带 SettingsPublic 或 secrets；通过现有 IPC/SSE 发送给连接的界面。设置变更先校验再写盘，写盘失败回滚内存值。语言切换保持业务组件树和在途任务不变。

跨进程的应用错误、任务日志和 QA 使用可选的消息描述，旧字符串继续保存以保持兼容。界面根据当前语言渲染消息描述，包括已显示的 toast。旧版对话中的已知固定应用事件按精确格式投影；无法识别的旧诊断原样保留。切勿对用户/AI 消息调用历史事件适配器。外部工具、服务端和模型返回的原始内容不作机器翻译。

内置节点、流水线、系统、clip、分组和坐标轴通过 `metadata.ts` 等显示适配器本地化。只有稳定 ID 匹配且字段仍是原始默认值时才投影名称；自定义名称、枚举值、端口、提示词和参数不改写。

验证命令：`npm run typecheck`、`npm run lint`、`npm run format:check`、`npm run audit:interface`、`npm test`、`npm run build`。源码审计覆盖直接 JSX、可见属性与提示调用；`node scripts/audit-interface.mjs --inventory` 额外输出显示元数据和消息生产者清单。间接数据流还须结合元数据测试和界面验收，审计零残留不等于全部交互已人工验收。

构建后可运行 `node scripts/verify-interface.mjs <输出目录> <Edge可执行文件>`。脚本在隔离的无头浏览器中使用本地确定性 HTTP/SSE fixture，不访问真实 API 或改写个人项目，输出页面/控件快照、断言结果和三语截图。要求 Node.js 24.14+（使用 TypeScript 类型剥离、registerHooks 和内置 WebSocket）。它验证共享 renderer，不替代 Electron 托盘、跳转列表和系统文件对话框的实际验收。
