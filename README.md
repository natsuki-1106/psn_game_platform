# LinkPlay 小游戏平台

一个可以直接部署到 GitHub Pages 的静态多人小游戏平台示例。

## 页面结构

- `index.html`：游戏大厅，只负责选择游戏。
- `gomoku.html`：五子棋专属页面，包含创建房间、加入房间、本地对战、战绩和棋盘。
- `monopoly.html`：大富翁房间制 2 到 4 人版，采用常规环形图谱。
- `ludo.html`：飞行棋本地 2 到 4 人版。
- `checkers.html`：跳棋本地 2 到 6 人轮流版。
- `landlord.html`：斗地主两名真人位，可补 1 个机器人。
- `app.js`：五子棋房间与对局逻辑。
- `styles.css`：大厅和游戏页共用样式。

## 功能

- 纯前端页面，无需自建服务器。
- 首页游戏大厅入口，点击后进入具体游戏页面。
- 五子棋页面支持创建房间、复制邀请链接、输入房间码加入。
- 房主创建的是稳定房间链接，同一浏览器刷新后会自动恢复当前房间、棋盘和战绩。
- 大富翁支持房间号进入，房主选 2 到 4 人后开始，并使用常规四边环形图谱。
- 飞行棋支持 2 到 4 人，房主选人数后开始。
- 跳棋支持 2 到 6 人，人数大于等于 2 时房主即可开始。
- 斗地主保留 2 个真人位；未满时可启动 1 个机器人，满人后不能继续加机器人。
- 这些新增游戏目前仍是本地轮流游玩版本，暂未接入联机房间。

## 本地预览

```bash
npm start
```

然后访问 `http://localhost:8080`。

## 测试

```bash
npm test
```

测试会验证大厅跳转、五子棋稳定房间链接刷新恢复、五子棋结算弹窗，以及新增四个游戏的人数/机器人开局规则。

## 部署到 GitHub Pages

1. 把本目录提交到 GitHub 仓库。
2. 进入仓库 `Settings` -> `Pages`。
3. `Source` 选择 `Deploy from a branch`。
4. 分支选择 `main`，目录选择 `/root`。
5. 保存后等待 GitHub 生成访问链接。

## 联机说明

GitHub Pages 只能托管静态文件，不能运行 WebSocket 服务。五子棋使用 PeerJS 公共信令服务器完成房间发现，实际对局数据通过玩家浏览器之间的 WebRTC 连接传输。

当前的刷新恢复使用浏览器 `localStorage` 保存同一浏览器里的房间状态；如果换设备、换浏览器或清除缓存，就不能恢复历史棋盘。生产环境如果需要跨设备持久房间，可以把房间状态放到自建 PeerServer、Firebase、Supabase 或 Colyseus。

## Self-hosted PeerServer

`npm start` now launches a Node server that serves both the static site and a built-in PeerServer on the same origin.

- Site: `http://127.0.0.1:8080`
- Peer signaling: `http://127.0.0.1:8080/peerjs`
- Browser PeerJS bundle: `vendor/peerjs.min.js`

On a normal Node host, Gomoku, Ludo, Monopoly, Chinese Checkers, and Landlord now prefer the same-origin PeerServer by default. GitHub Pages still cannot host the WebSocket signaling service, so pure Pages deployment falls back to public PeerJS Cloud only for pages that need remote signaling.
