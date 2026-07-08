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

## 2026-07-07 Landlord Bidding and Chinese Checkers Board

- Rebuilt `landlord.html` and `landlord.js` as clean UTF-8.
- Added landlord bidding flow, 3-card bottom stack, landlord assignment, multiplier updates, and doubled multiplier on bomb/rocket.
- Non-self hands in Landlord now render as side-view card backs and only expose hand counts in text state.
- Rebuilt `checkers.html` and `checkers.js` as clean UTF-8 and replaced the square board with a star-shaped Chinese Checkers board matching the provided reference style.
- Verified with `npm test` and screenshots at `outputs/landlord-bidding-hidden-hands.png` and `outputs/checkers-star-board-v3.png`.

## 2026-07-07 Gomoku Result Panel Visibility

- Changed Gomoku result UI from a centered blocking modal to a bottom-right floating panel so the winning five-stone line remains visible on the board.
- Kept the same `resultModal`, replay, and exit controls so the existing interaction and tests remain intact.
- Verified with `node tests/gomoku-smoke.cjs` and the updated `outputs/gomoku-modal.png`.

## 2026-07-07 Gomoku Remote Signaling Fix

- Investigated the provided screenshot showing Gomoku status `信令不可用`; the root issue is PeerJS public signaling not being reachable from that network/region, so remote peers cannot reliably connect or sync moves.
- Added explicit PeerJS Cloud connection options, default STUN servers, and URL-configurable custom PeerServer/TURN parameters.
- Room share links now preserve `peerHost`, `peerPort`, `peerPath`, `peerSecure`, `peerKey`, `turnUrls`, `turnUsername`, and `turnCredential` so custom networking config survives remote joins.
- Verified Gomoku with a two-browser remote-style sync test: host created a room, guest joined by room link, black move synced to guest, and white move synced back to host.
- Verified with `node tests/gomoku-smoke.cjs` and full `npm test`.

## 2026-07-07 Shared Self-Hosted Signaling Upgrade

- Added `server.js` so `npm start` now runs the static site and a built-in same-origin PeerServer at `/peerjs`.
- Vendored `peerjs.min.js` into `vendor/peerjs.min.js` so browser clients no longer depend on `unpkg` being reachable.
- Updated Gomoku to prefer same-origin `/peerjs` on normal Node hosting and only fall back to PeerJS Cloud on `file:` / `github.io`.
- Upgraded `room-common.js` from local-only room badges to a reusable PeerJS room transport layer.
- Connected Ludo, Monopoly, Chinese Checkers, and Landlord room panels to real room state sync, with host-authoritative state broadcast after game actions.
- Landlord remote sync now treats host as seat A and guest as seat B so each human player only sees their own hand while still seeing the shared desk state.

## 2026-07-07 Gomoku Supabase Realtime Migration

- Added `config.js` and vendored `vendor/supabase.js` for browser-side Supabase configuration on a static GitHub Pages deployment.
- Replaced Gomoku main page logic with `gomoku-app.js`, a clean UTF-8 implementation that keeps the existing board, replay, and record UI but switches cross-device room sync to Supabase Realtime channels.
- When `config.js` is not configured, Gomoku now fails loudly with a clear Supabase setup message instead of pretending PeerJS cross-device rooms are stable.
- Updated `tests/gomoku-smoke.cjs` so local gameplay, replay, and result-panel verification still run without requiring Supabase credentials.

## 2026-07-08 Shared Realtime Rooms + UI Round

- Replaced shared `room-common.js` PeerJS room transport with Supabase Realtime while keeping the existing game-side API shape, then updated `ludo.html`, `monopoly.html`, `checkers.html`, and `landlord.html` to load `config.js` + `vendor/supabase.js`.
- Added room-entered lock state across shared room panels: after entering a room, create/join inputs are hidden or disabled and a `退出房间` button is shown instead.
- Tightened `gomoku-app.js` room UX so entering a room hides create/join/local controls, added explicit sidebar `退出房间`, kept result-panel `退出` returning to lobby, and hid the debug `重新开始` button on GitHub Pages.
- Rebuilt `monopoly.js` as clean UTF-8 and changed property purchase from auto-buy to explicit player choice via `购买 / 跳过`, with center-board status copy, stronger piece tokens, owner/house markers, and side-vs-mobile asset layout hooks.
- Rebuilt `landlord.js` as clean UTF-8, kept hidden-hand / bidding / robot / hint rules, and moved bidding + play buttons into the center table area with side-player last-play display and standard suit symbols.
- Updated `tests/gomoku-smoke.cjs` for the new Gomoku room-entered UX and re-ran the full suite with `BASE_URL=http://127.0.0.1:8096`.

## 2026-07-08 Shared Room Layer For Gomoku

- Added room-common.js to gomoku.html and rebuilt gomoku-app.js so Gomoku now uses the same shared room creation, join, leave, share-link, and Supabase Realtime channel layer as the other four games.
- Kept Gomoku-specific behavior inside gomoku-app.js: board drawing, move validation, win detection, current-room record, replay, undo, local mode, and result dialog.
- Added a shared 10-minute idle room timeout in room-common.js; create/join, sent state, and received state all refresh the timer, and inactive rooms auto-close by leaving the room.
- Verified with BASE_URL=http://127.0.0.1:8096 npm test; Gomoku now reports transportKind: shared-supabase.

