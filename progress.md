Original prompt: 写一个能在github上搭建的多人链接小游戏平台，然后在平台里加入一个五子棋的小游戏；后续要求首页选游戏、五子棋房间与战绩、长链接刷新恢复、加入大富翁/飞行棋/跳棋/斗地主、所有游戏支持房间号加入、美化 UI、大富翁使用常规地图、斗地主增加常规出牌提示按钮。

## 2026-07-07

- Added room panels and room badges to Ludo, Checkers, and Landlord using `room-common.js`.
- Changed Ludo and Checkers so host must create/join a room before starting.
- Added Landlord `提示` button and hint logic for single, pair, triple, straight, bomb, and rocket plays.
- Updated Landlord robot play to reuse the same hint finder.
- Updated smoke tests so room creation is exercised before starting Ludo, Checkers, and Landlord.
- TODO: Ludo and Checkers are functional but could still be visually upgraded further if the next request focuses on those boards.
