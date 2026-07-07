# LinkPlay 小游戏平台

一个可以直接部署到 GitHub Pages 的静态多人小游戏平台示例。

## 页面结构

- `index.html`：游戏大厅，只负责选择游戏。
- `gomoku.html`：五子棋专属页面，包含创建房间、加入房间、本地对战和棋盘。
- `app.js`：五子棋房间与对局逻辑。
- `styles.css`：大厅和游戏页共用样式。

## 功能

- 纯前端页面，无需自建服务器。
- 首页游戏大厅入口，点击后进入具体游戏页面。
- 五子棋页面支持创建房间、复制邀请链接、输入房间码加入。
- 支持本地双人对战、重新开始、悔棋、胜负判断。
- 通过 PeerJS 公共信令服务建立 WebRTC 点对点连接。

## 本地预览

```bash
npm start
```

然后访问 `http://localhost:8080`。

## 测试

```bash
npm test
```

测试会打开 `gomoku.html`，启动本地对战并验证黑棋五连胜。

## 部署到 GitHub Pages

1. 把本目录提交到 GitHub 仓库。
2. 进入仓库 `Settings` -> `Pages`。
3. `Source` 选择 `Deploy from a branch`。
4. 分支选择 `main`，目录选择 `/root`。
5. 保存后等待 GitHub 生成访问链接。

## 联机说明

GitHub Pages 只能托管静态文件，不能运行 WebSocket 服务。本项目使用 PeerJS 的公共信令服务器完成房间发现，实际对局数据通过玩家浏览器之间的 WebRTC 连接传输。生产环境如果需要更稳定的房间服务，可以把 PeerJS 信令替换为自建 PeerServer、Firebase、Supabase 或 Colyseus。
