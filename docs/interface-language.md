# 界面语言开发约定

设置中的“界面语言 / Interface language / Arayüz dili”提供 English、简体中文、Türkçe；保存成功后生效。项目内容保持原始语言。当前变更仍在开发，完整页面覆盖以 OpenSpec 的 tasks.md 和 ui-audit.md 为准。

`settings.json` 中可选的历史字段 `locale` 在读取后归一化为 `en | zh-CN | tr`。有效的显式值优先；旧文件缺省/无效值根据系统语言选择，简体中文系统选 zh-CN，土耳其语系统选 tr，其他选 en。项目切换不改变此机器级设置。服务端浏览器界面跟随主机；编辑者和查看者不能写设置。

翻译定义在 `src/shared/i18n/`，英语定义消息键与参数类型；所有语言必须具有相同 key 和参数。使用 `translate(locale, key, params)` 或 React 的 `useLocale()`。动态名称、路径、外部错误详情通过参数插值，不用于查找翻译。HTML 页面仍须转义最终文字。

已保存的业务数据、内部状态、节点/端口标识及参数值不可因切换语言改写。静态元数据应保存消息键并在显示时翻译，避免模块加载时缓存译文。新增消息必须同时添加三语译文，运行 i18n 测试验证完整性。

`settings:locale` 事件只携带 locale，不携带 SettingsPublic 或 secrets；通过现有 IPC/SSE 发送给连接的界面。设置变更先校验再写盘，写盘失败回滚内存值。语言切换保持业务组件树和在途任务不变。
