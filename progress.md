Original prompt: 写一个能在github上搭建的多人链接小游戏平台，然后在平台里加入一个五子棋的小游戏；后续要求首页选游戏、五子棋房间与战绩、长链接刷新恢复、加入大富翁/飞行棋/跳棋/斗地主、所有游戏支持房间号加入、美化 UI、大富翁使用常规地图、斗地主增加常规出牌提示按钮。

## 2026-07-07

- Added room panels and room badges to Ludo, Checkers, and Landlord using `room-common.js`.
- Changed Ludo and Checkers so host must create/join a room before starting.
- Added Landlord `提示` button and hint logic for single, pair, triple, straight, bomb, and rocket plays.
- Updated Landlord robot play to reuse the same hint finder.
- Updated smoke tests so room creation is exercised before starting Ludo, Checkers, and Landlord.
- TODO: Ludo and Checkers are functional but could still be visually upgraded further if the next request focuses on those boards.

## 2026-07-07 Landlord Card Face Polish

- Changed Landlord card rendering so internal IDs like `9C` are no longer shown on the card face.
- Added poker-style corner rank/suit labels, center suit pips, red/black suit coloring, and Joker cards.
- Verified with `npm test` and a Playwright screenshot at `outputs/landlord-cards.png`.

## 2026-07-07 Ludo and Monopoly Board Polish

- Rebuilt `ludo.html` and `ludo.js` as clean UTF-8 and changed the board to a classic four-corner airport + cross-route layout inspired by public Ludo board references.
- Rebuilt `monopoly.html` and `monopoly.js` as clean UTF-8 and changed the map to a global country estate board.
- Monopoly country cells now show CSS-drawn flag badges, country names, and prices so they render consistently on Windows instead of depending on emoji flags.
- Updated shared styles for the new Ludo board, Monopoly world-board center, flags, price labels, and board-table presentation.
- Verified with `npm test` and screenshots at `outputs/ludo-classic-board.png` and `outputs/monopoly-global-board-v3.png`.

## 2026-07-07 Ludo Symmetry and Monopoly Readability Fix

- Reworked Ludo visual routes into a symmetrical 15x15 cross board, with smaller 4x4 airport areas and a centered 3x3 finish zone.
- Kept Ludo gameplay state compatible with the existing simple movement test while using the improved visual route coordinates.
- Moved Monopoly asset cards below the board and enlarged board cells so flag, country name, and price labels no longer overlap.
- Verified with `npm test` and screenshots at `outputs/ludo-symmetric-v2.png` and `outputs/monopoly-readable-v2.png`.
