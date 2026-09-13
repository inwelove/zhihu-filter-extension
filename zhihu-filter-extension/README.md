# 知乎高赞筛选

一个 Chrome 扩展，用于筛选知乎回答，高亮或隐藏点赞数低于/高于指定阈值的内容。

## 功能

- 按点赞数筛选知乎回答
- 高亮显示高赞内容
- 隐藏低赞内容
- 可自定义点赞阈值
- 支持深色/浅色主题

## 安装

1. 打开 Chrome 浏览器，进入 `chrome://extensions/`
2. 开启"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择 `zhihu-filter-extension` 文件夹

## 使用

1. 点击浏览器工具栏中的扩展图标
2. 设置最低点赞数阈值
3. 开启/关闭筛选功能
4. 点击"保存"或"应用"

## 开发

### 启用 CDP MCP

扩展已配置 CDP MCP，用于调试：

```bash
# 启动 Chrome 调试模式
Start-Process "C:\Program Files\Google\Chrome\Application\chrome.exe" -ArgumentList "--remote-debugging-port=9222", "--user-data-dir=C:\temp\chrome-debug-profile"
```

### 项目结构

```
zhihu-filter-extension/
├── manifest.json      # 扩展配置
├── content.js         # 内容脚本
├── content.css        # 样式
├── popup.html         # 弹窗页面
├── popup.js           # 弹窗逻辑
├── background.js      # 后台脚本
├── icons/             # 图标
└── generate-icons.html # 图标生成工具
```
