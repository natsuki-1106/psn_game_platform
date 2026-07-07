(function () {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  function makeRoomId(prefix) {
    let code = prefix.toUpperCase().slice(0, 2);
    for (let i = 0; i < 6; i += 1) code += alphabet[Math.floor(Math.random() * alphabet.length)];
    return code;
  }

  function storageKey(gameKey) {
    return `linkplay-room-${gameKey}`;
  }

  window.initRoomPanel = function initRoomPanel({ gameKey, prefix, onRoomChange }) {
    const roomStatus = document.querySelector("#roomStatus");
    const nicknameInput = document.querySelector("#nicknameInput");
    const roomInput = document.querySelector("#roomInput");
    const shareInput = document.querySelector("#shareInput");
    const hostBtn = document.querySelector("#hostBtn");
    const joinBtn = document.querySelector("#joinBtn");
    const copyBtn = document.querySelector("#copyBtn");
    const state = { roomId: "", role: "none", nickname: "" };

    function save() {
      localStorage.setItem(storageKey(gameKey), JSON.stringify(state));
    }

    function updateStatus() {
      if (!state.roomId) {
        roomStatus.textContent = "未进房";
        roomStatus.style.color = "var(--warn)";
      } else {
        roomStatus.textContent = state.role === "host" ? "房主" : "已进房";
        roomStatus.style.color = "var(--accent)";
      }
      if (roomInput) roomInput.value = state.roomId;
      if (shareInput && state.roomId) {
        const url = new URL(window.location.href);
        url.searchParams.set("room", state.roomId);
        shareInput.value = url.toString();
      }
      onRoomChange?.({ ...state });
      window.dispatchEvent(new CustomEvent("linkplay-room-change", { detail: { ...state } }));
    }

    function enterRoom(roomId, role) {
      state.roomId = roomId.trim().toUpperCase();
      state.role = role;
      state.nickname = nicknameInput?.value.trim() || "玩家";
      const url = new URL(window.location.href);
      url.searchParams.set("room", state.roomId);
      history.replaceState(null, "", url);
      save();
      updateStatus();
    }

    hostBtn?.addEventListener("click", () => enterRoom(makeRoomId(prefix), "host"));
    joinBtn?.addEventListener("click", () => {
      if (!roomInput.value.trim()) return;
      enterRoom(roomInput.value, "guest");
    });
    copyBtn?.addEventListener("click", async () => {
      if (shareInput?.value) await navigator.clipboard.writeText(shareInput.value);
    });

    nicknameInput.value = localStorage.getItem("linkplay-name") || `玩家${Math.floor(1000 + Math.random() * 9000)}`;
    nicknameInput.addEventListener("change", () => localStorage.setItem("linkplay-name", nicknameInput.value.trim()));

    const roomFromUrl = new URLSearchParams(window.location.search).get("room");
    const saved = JSON.parse(localStorage.getItem(storageKey(gameKey)) || "null");
    if (roomFromUrl && saved?.roomId === roomFromUrl.toUpperCase()) {
      Object.assign(state, saved);
    } else if (roomFromUrl) {
      state.roomId = roomFromUrl.toUpperCase();
      state.role = "guest";
      state.nickname = nicknameInput.value.trim();
    } else if (saved?.roomId) {
      Object.assign(state, saved);
    }
    updateStatus();

    return {
      state,
      isHost: () => state.role === "host",
      hasRoom: () => Boolean(state.roomId),
      requireHost: () => {
        if (!state.roomId) return "请先创建或加入房间。";
        if (state.role !== "host") return "只有房主可以开始游戏。";
        return "";
      },
    };
  };
})();
