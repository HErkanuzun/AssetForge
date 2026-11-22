# 界面语言覆盖审计

本清单基于当前起点 `61b126a` 的源码检查，所有条目均为**待实施、待运行验收**；不是声称已完成视觉检查。实施时每行补充词典键范围、en/zh-CN 验收结果和证据。页面路径相对 `src/renderer/src/`，shared/main 另注明。

## 页面与操作覆盖矩阵

| 区域 / 来源 | 需要切换的细节 | 必验交互与状态 |
| --- | --- | --- |
| `App.tsx` | 主/次导航、页标题、Brief 面包屑、加载、资产计数、排队/生产计数、API 缺失提示、助手开关、只读提示、角色及退出 | 所有导航、助手展开、viewer、Web 身份、排队与延迟任务 |
| `pages/HomePage.tsx` | 欢迎标题、资产种类卡及说明、示例建议、输入占位、最近 brief、空状态、相对时间、操作提示 | 每种卡片、快捷建议、创建/继续 brief、空列表/有记录 |
| `pages/BriefPage.tsx` | 返回、发送/停止、引用/图片/资产选择、组别、问题卡选项、brief/规格标题、三角预算/LOD/色板、生成操作、错误及进度 | 图片与资产附加、候选选择、打开资源列表、brief 空/解析中/完成/失败；AI 回复内容保留 |
| `pages/LibraryPage.tsx` | 图库/表格、类型筛选、搜索、数量、资源状态、空态、选择栏、流水线选项、运行提示 | 两种视图、选择/取消、筛选无结果、生产中、旧 `Üretildi` 状态与自定义状态 |
| `pages/AssetsPage.tsx` | Excel/CSV 导入、增删、表头、类型标签、过滤/搜索、批量操作、详情编辑字段/下拉、优先级/状态、确认及 toast | 有/无资源、导入成功/失败、详情展开、全部可选项、删除确认、已有项目字段不变 |
| `pages/AnimPage.tsx` | Kimodo 安装/服务卡、角色列表、模式标签、新 clip、描述/分段、时长、生成建议/提交、进度、提示及错误 | 无角色、选角色、单 clip/系统模式、服务离线、分段编辑、计划失败 |
| `components/AnimSystems.tsx` | 系统图库、类型/标题/说明、角色、状态、clip/分组/风格、QA、生成/构建/删除、说明面板、构建时间 | 全部系统模板、图表提示、单 clip、取消/重试、删除确认、QA 成功/警告/失败 |
| `pages/PipelinePage.tsx` | 生产线选择/新建/模板/删除、节点分组与搜索、画布控件、参数标签/help/下拉、未配置/已删除选项、运行资源选择框 | 每种 node/param、动态服务器/模型/MCP/后端下拉、端口提示、运行弹层、失败提示 |
| `components/ForgeNode.tsx` | 节点标题、类别、输入/输出端口、运行状态/进度/错误 | 未运行/运行中/失败、选择与悬浮；port/type/value 不变 |
| `pages/JobsPage.tsx` | 队列/详情标题、总花费/积分、空状态、任务状态、步骤数、时间、产物统计、质量校验、取消/重试、警告 | 排队/运行/成功/失败/取消/跳过、详情与输出文件、QA、日志；外部原始日志保留 |
| `pages/DesignPage.tsx` | 标签页、AI 生成/改写、说明和确认、核心想法、机制/循环图、故事、角色、屏幕/组件/转换、引擎选择、连接、导出 | 所有 tab、展开子编辑、每个枚举/选项、删除/覆盖确认、图控件、失败提示 |
| `pages/BiblePage.tsx` | PDF 提取、身份/氛围、技术参数、纹理分辨率/PBR、命名前缀说明、分类规则、色板、材质列表、增删/提示 | 提取失败、规则/色板/材质的空/有数据状态、字段 help、下拉完整展开 |
| `pages/SettingsPage.tsx` 公共部分 | 语言标签及选项、搜索、9 类标题/说明/关键词、徽标与工具提示、无匹配、保存/测试反馈 | 语言入口不被搜索隐藏，缺 key 自动进入连接页仍可找到；切换成功/失败 |
| 设置：connect / `QuickConnect.tsx` | 连接流程、提供商说明、登录/粘贴/状态、API key 的 help/占位/保存/删除/测试及余额 | 已有/无 key、连接成功/失败；secret 与 URL 保持原样 |
| 设置：models / `ConnectionsSettings.tsx`, `AgentClis.tsx` | 预设、推荐/成本说明、模型列表、任务角色、添加/删除/测试、vision/web 开关、CLI 探测/路径/订阅说明 | 自定义供应商与 CLI、全部角色和模型下拉、探测失败、toast |
| 设置：project | 项目目录、选择/打开、并发、音频格式说明及全部选项 | 选目录/取消、格式下拉、保存提示、不改路径 |
| 设置：tools / `ComfyLocal.tsx`, `ComfyServers.tsx` | Blender/ComfyUI、安装/启动/停止/检测/移动、服务器/自动选择、状态/产物类别、地址/token help | 本地/远程、有/无服务、探测/操作失败、动态默认选项 |
| 设置：tools / `ComfyLibrary.tsx`, `CustomBackends.tsx` | 工作流导入/默认/替换/复制/删除、模型/节点/输入标签、兼容性、后端配方及安装管理 | 空/有工作流、兼容性检查、未识别输出、配方校验失败、删除反馈 |
| 设置：anim | Kimodo native/WSL 选择、安装依赖、模型下载/授权、运行/检测/目录与日志说明 | 两种 backend、缺依赖/失败/就绪；脚本输出作为原始详情 |
| 设置：unreal | Remote Execution/MCP、检测结果、IK Rig、安装/帮助和路径字段 | 已连接/未连接、检测异常、全部字段 help |
| 设置：mcp / `ConnectionsSettings.tsx` | 暴露服务、token/端口/复制、客户端预设、外部 MCP 添加/删除/状态/权限/工具 | stdio/HTTP、连接/断开、全部预设、复制和失败提示 |
| 设置：web / `WebSettings.tsx` | 服务/端口/LAN/headless、地址与复制、成员/角色/邀请/权限、撤销/删除/在线列表 | 服务开关、editor/viewer 邀请、撤销确认、在线/离线、权限错误 |
| 设置：about | 版本/许可证/支持链接标签、诊断/日志及导出反馈 | 诊断保存成功/取消/失败、链接文字 |
| `components/ui.tsx`, `Thumb.tsx`, `KindArt.tsx`, `BvhViewer.tsx` | 状态胶囊、相对时间、资产类别、预览加载/错误及控件、通用默认辅助文字 | 所有 job 状态、相对时间单位、预览失败、禁用按钮 tooltip |
| `components/Markdown.tsx` 等辅助组件 | 检查应用添加的代码块/链接/空态/控制文字；SVG 或纯图形若无文字记录无需翻译 | 区分渲染内容和应用附加控件，不改用户 Markdown |

## 跨模块和桌面边界

| 来源 | 特别容易遗漏的内容 | 验收要求 |
| --- | --- | --- |
| `src/shared/nodes.ts` | CATEGORY_META、NODE_DEFS、参数/端口/枚举标签、help、后端显示名 | 每类节点至少打开一个，每个枚举扫描；保留 prompt/rules 与 API 值 |
| `src/shared/templates.ts`, `animSystems.ts`, `comfyServers.ts`, `design.ts` | 内置流水线、动画系统与 clip 名称/说明、产物类别、设计选项 | 用稳定 ID 映射显示，已有自定义名称不覆盖 |
| `store.tsx`, `src/main/engine/`, providers/integrations、shared QA/校验模块 | toast、任务阶段/警告/应用异常、QA 问题/摘要、无效输入说明 | 沿 renderer 读取字段追到生产者；应用消息全译，外部详情/AI 数据保留 |
| `src/main/index.ts`, `taskbar.ts` | 托盘菜单/tooltip、任务栏快捷项、文件/目录选择器标题与过滤器 | 切换后打开使用新语言；OS 自带按钮不要求跟随应用 |
| `src/main/diagnostics.ts` | 导出对话框与文件类型说明、导出反馈 | 不改变诊断原始内容；应用控件跟随语言 |
| `src/main/web/server.ts`, `access.ts` | 登录/加入表单、角色说明、密码要求、限流/认证/邀请错误、HTML lang/title | 主机语言、HTML escaping/CSP 不变，成功/失败/无效邀请都检查 |
| `main/settings.ts`, shared types、preload、webBridge/HTTP、事件通道 | locale 持久化/校验、Public/Patch、脱敏同步、权限 | 旧配置、无效输入、写失败、重启、viewer/editor 不提权、连接客户端即时更新 |
| renderer index/main、CSS、ReactFlow | document.lang、启动加载、中文字体、canvas 按钮与可访问性 | 无土语闪现、en/zh-CN 不裁切，画布缩放/适配/交互按钮全部覆盖 |

## 实施时的记录规则

1. 对每行记录词典键或对应翻译适配器、源码残留审计结果、en/zh-CN 逐项执行结果。没有打开或没有凭证验证的流程标为未验收，不写成通过。
2. 每页覆盖空/有数据、正常/禁用/加载/失败；展开所有下拉、抽屉、详情、确认框和悬浮说明。辅助标签也纳入。
3. 旧土耳其语 fixture 同时包含内置模板、自定义改名、已生成资产、任务和聊天；切换后比较项目结构与参数，不能因翻译写回项目。
4. 在有输入草稿、选中资源、运行任务、已显示 toast/助手面板时来回切换；确认选择与业务状态不丢失，后续反馈使用当前语言。
5. 新词典缺 key/参数的测试必须失败；源码审计例外限定为用户/外部数据、协议/路径、提示词/技术标识、纯图形，不能把未翻译应用文字列为例外。
