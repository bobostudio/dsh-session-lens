# dsh-session-lens · 会话透镜

[English](README.en.md)

[![CI](https://github.com/bobostudio/dsh-session-lens/actions/workflows/ci.yml/badge.svg)](https://github.com/bobostudio/dsh-session-lens/actions/workflows/ci.yml)
[![DSH 适配](https://img.shields.io/badge/DSH%20适配-0.1.0--rc.6-blue)](#兼容性)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**DeepSeek Harness 会话洞察与一键分享插件**：给任意会话生成"深度体检报告"，并可导出为**自包含单文件 HTML 回放页**——双击离线打开、微信/QQ 直接发送、零外部依赖。

[![dshfind](https://dshfind.com/api/card/bobostudio/dsh-session-lens)](https://dshfind.com/en/plugins/bobostudio/dsh-session-lens?ref=badge)
> 与官方 Trajectory 视图互补：Trajectory 展示原始事件流，Lens 做**聚合分析**（token 分解、turn 时间线、工具统计）+ **对外分享**。

## 功能

**📊 洞察视图（会话内新 Tab）**

- Token 用量五段分解：输入 / 输出 / 缓存读 / 缓存写 / 思维链（含压缩摘要调用单列）
- 按 Turn 分解：每轮时长、token、工具调用数、错误数
- 工具统计：调用次数、错误率、耗时
- 活动统计：上下文压缩、审批、子 Agent、LLM 重试
- 会话进行中每 5 秒自动刷新（实时模式）

**📤 一键导出 HTML**

- 单文件、零 JavaScript、零外部请求：统计图表为内联 SVG，折叠区为原生 `<details>`
- 完整会话回放：用户消息、助手回复、思维链（折叠）、工具调用与结果、审批/压缩/子 Agent 标记
- 中英双语界面（导出语言可选）

**🔒 隐私优先（结构性保证）**

- **永不包含系统提示词**：导出只渲染白名单"故事事件"，`request/header`、内部 LLM 请求等事件从结构上无法进入导出文件
- 工具参数/结果默认截断（防文件内容泄漏），可选完整保留
- 本地路径自动脱敏为 `~`：会话工作目录 + 用户主目录（含正/反斜杠、盘符大小写、JSON 转义形态全变体）。注：工作目录之外的绝对路径（如同级仓库目录）默认保留原样以保持回放可读性
- 图片附件永不离开本机
- 内容安全策略 `default-src 'none'`：导出文件无任何脚本执行能力

## 安装

```bash
dsh plugin --profile web add github:bobostudio/dsh-session-lens
```

重启 DSH Web 后，打开任意会话，点击顶部的「**洞察**」Tab（与 Chat / Trajectory 并列）。

## 效果预览

截图来自本地 DSH Web（`http://127.0.0.1:17893/`）里的真实会话「把聊天按钮换成可爱狗头」。打开会话后，顶部与「对话 / 轨迹」并列的就是 **洞察**：

![洞察视图：token 五段分解、按 Turn 时间线、工具统计](docs/screenshots/lens.png)

怎么读这张图：

- **合计 17.6M token**，紫色「缓存读」占 17.2M——后续 Turn 几乎都在吃前缀缓存，而不是重新付完整输入
- **按 Turn 分解**一眼看出哪一轮最贵：第 4 轮 8.1M 输入+Cache、46 次工具；第 3 轮则只需 1 分 14 秒、3 次调用
- **工具统计**按调用次数排序：这次会话的墙钟主要花在 `pwsh`（66 次 / 4 分 30 秒），读改文件本身几乎不耗时

点「**导出 HTML**」得到的单文件报告（零 JavaScript、可离线打开、微信/QQ 直接发送）。下面是仓库里的交互示例，除了同样的统计表，还带会话回放、工具错误、审批和上下文压缩标记：

![导出 HTML：统计 + 会话回放](docs/screenshots/export.png)

完整可点示例：[docs/example.html](docs/example.html) · [English](docs/example.en.html)

## 使用

1. 打开一个会话 → 点击「洞察」Tab 查看实时分析
2. 点击「**导出 HTML**」下载单文件报告
3. 导出选项（自动记忆）：
   - **完整工具结果**：默认关闭（截断至 2000 字符）
   - **路径脱敏**：默认开启
   - **主题**：深色（默认）/ 跟随系统 / 浅色
   - **中/English**：导出文件界面语言

## 兼容性

面向 `@deepseek-ai/dsh >= 0.1.0-rc.6` 的 `web` profile。DSH 处于开发者预览阶段，插件依赖的内部接口（`sessions` / `sessionPersistence` / `conversation.view` slot）可能随版本变动；所有可选服务均做了降级处理，升级后如遇问题请提 Issue。

## 开发

```bash
npm install
npm run build     # esbuild → lib/（Node half + client half）
npm test          # 44 个单元/集成测试（node:test，无需构建）
npm run check     # tsc --noEmit
```

开发态挂载（不改 profile）：

```bash
dsh web --patch <本仓库路径>/cordis.patch.yml
```

结构：

```
src/
├── index.ts        # Node half：/api/session-lens/{analytics,export} 路由（仅回环、GET-only）
├── analytics.ts    # 纯函数：SessionEvent[] → 聚合统计
├── redact.ts       # 纯函数：隐私脱敏（白名单/截断/路径掩码）
├── export-html.ts  # 纯函数：→ 单文件 HTML
└── client/         # 浏览器 half：conversation.view「洞察」Tab
```

## License

[MIT](LICENSE)
