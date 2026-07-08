(function () {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const ROOM_VERSION = 2;

  function makeRoomId(prefix) {
    let code = prefix.toUpperCase().slice(0, 2);
    for (let i = 0; i < 6; i += 1) code += alphabet[Math.floor(Math.random() * alphabet.length)];
    return code;
  }

  function storageKey(gameKey) {
    return `linkplay-room-${gameKey}-v${ROOM_VERSION}`;
  }

  function currentParams() {
    return new URLSearchParams(window.location.search);
  }

  function safeJson(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function hasSupabaseConfig() {
    const config = window.LINKPLAY_SUPABASE || {};
    return Boolean(window.supabase?.createClient && config.url && config.anonKey);
  }

  function createClient() {
    if (!hasSupabaseConfig()) return null;
    const config = window.LINKPLAY_SUPABASE;
    return window.supabase.createClient(config.url, config.anonKey, {
      realtime: { params: { eventsPerSecond: 8 } },
    });
  }

  function normalizeRoomId(value) {
    return (value || "").trim().toUpperCase();
  }

  window.initRoomPanel = function initRoomPanel({ gameKey, prefix, onRoomChange, onRemoteState, getSnapshot }) {
    const roomStatus = document.querySelector("#roomStatus");
    const nicknameInput = document.querySelector("#nicknameInput");
    const roomInput = document.querySelector("#roomInput");
    const shareInput = document.querySelector("#shareInput");
    const hostBtn = document.querySelector("#hostBtn");
    const joinBtn = document.querySelector("#joinBtn");
    const copyBtn = document.querySelector("#copyBtn");
    const leaveBtn = document.querySelector("#leaveRoomBtn");
    const state = {
      roomId: "",
      role: "none",
      nickname: "",
      online: "idle",
      members: {},
      sessionId: crypto.randomUUID ? crypto.randomUUID() : `session-${Date.now()}`,
    };
    const transport = {
      client: null,
      channel: null,
      connected: false,
    };

    function save() {
      if (!state.roomId) {
        localStorage.removeItem(storageKey(gameKey));
        return;
      }
      localStorage.setItem(
        storageKey(gameKey),
        JSON.stringify({
          roomId: state.roomId,
          role: state.role,
          nickname: state.nickname,
        }),
      );
    }

    function setButtonsInRoom(inRoom) {
      if (hostBtn) hostBtn.hidden = inRoom;
      if (joinBtn) joinBtn.hidden = inRoom;
      if (leaveBtn) leaveBtn.hidden = !inRoom;
      if (roomInput) roomInput.disabled = inRoom;
      if (nicknameInput) nicknameInput.disabled = inRoom;
    }

    function updateShareLink() {
      if (!shareInput) return;
      if (!state.roomId) {
        shareInput.value = "";
        return;
      }
      const url = new URL(window.location.href);
      url.searchParams.set("room", state.roomId);
      shareInput.value = url.toString();
    }

    function roomLabel() {
      if (!state.roomId) return "未进入房间";
      if (!hasSupabaseConfig()) return "需要 Supabase 配置";
      if (state.online === "error") return "连接失败";
      if (state.online === "connecting") return "连接中";
      if (state.online === "online") {
        return state.role === "host" ? `房主 ${connectionCount()} 人` : "已加入";
      }
      return "已进入";
    }

    function updateStatus() {
      if (roomStatus) {
        roomStatus.textContent = roomLabel();
        roomStatus.style.color = state.roomId && state.online !== "error" ? "var(--accent)" : "var(--warn)";
      }
      if (roomInput) roomInput.value = state.roomId;
      updateShareLink();
      setButtonsInRoom(Boolean(state.roomId));
      onRoomChange?.({
        ...state,
        members: Object.values(state.members),
      });
      window.dispatchEvent(
        new CustomEvent("linkplay-room-change", {
          detail: {
            ...state,
            members: Object.values(state.members),
          },
        }),
      );
    }

    async function send(payload) {
      if (!transport.channel) return;
      await transport.channel.send({
        type: "broadcast",
        event: "room-event",
        payload: {
          ...payload,
          gameKey,
          roomId: state.roomId,
          senderId: state.sessionId,
          senderRole: state.role,
          senderName: state.nickname,
        },
      });
    }

    async function publishSnapshot(targetId) {
      const snapshot = getSnapshot?.();
      if (!snapshot) return;
      await send({
        type: "snapshot",
        targetId,
        snapshot: safeJson(snapshot),
      });
    }

    async function announcePresence() {
      if (!state.roomId) return;
      state.members[state.sessionId] = { id: state.sessionId, role: state.role, name: state.nickname };
      updateStatus();
      await send({ type: "presence" });
      if (state.role === "guest") {
        await send({ type: "request-sync" });
      }
    }

    function clearTransport() {
      if (transport.channel) {
        transport.channel.unsubscribe();
      }
      transport.channel = null;
      transport.connected = false;
      if (transport.client) {
        transport.client.removeAllChannels();
      }
      transport.client = null;
    }

    function clearRoomState() {
      state.roomId = "";
      state.role = "none";
      state.online = "idle";
      state.members = {};
      history.replaceState(null, "", `${window.location.pathname}`);
      save();
      updateStatus();
    }

    function receive(payload) {
      if (!payload || payload.senderId === state.sessionId) return;
      if (payload.gameKey !== gameKey || payload.roomId !== state.roomId) return;

      if (payload.type === "presence") {
        state.members[payload.senderId] = {
          id: payload.senderId,
          role: payload.senderRole,
          name: payload.senderName || "玩家",
        };
        updateStatus();
        if (state.role === "host") publishSnapshot(payload.senderId);
        return;
      }

      if (payload.type === "request-sync") {
        if (state.role === "host") publishSnapshot(payload.senderId);
        return;
      }

      if (payload.targetId && payload.targetId !== state.sessionId) return;

      if (payload.type === "snapshot" || payload.type === "state") {
        state.members[payload.senderId] = {
          id: payload.senderId,
          role: payload.senderRole,
          name: payload.senderName || "玩家",
        };
        state.online = "online";
        transport.connected = true;
        onRemoteState?.(payload.snapshot || payload.payload);
        updateStatus();
        return;
      }

      if (payload.type === "leave") {
        delete state.members[payload.senderId];
        updateStatus();
      }
    }

    async function connect() {
      clearTransport();
      const client = createClient();
      if (!client) {
        state.online = "error";
        updateStatus();
        return false;
      }
      transport.client = client;
      transport.channel = client.channel(`room:${gameKey}:${state.roomId}`, {
        config: { broadcast: { self: false, ack: false } },
      });
      transport.channel.on("broadcast", { event: "room-event" }, ({ payload }) => receive(payload));

      return new Promise((resolve) => {
        transport.channel.subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            state.online = "online";
            transport.connected = true;
            save();
            updateStatus();
            await announcePresence();
            resolve(true);
            return;
          }
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            state.online = "error";
            transport.connected = false;
            updateStatus();
            resolve(false);
          }
        });
      });
    }

    async function enterRoom(roomId, role) {
      const nextRoomId = normalizeRoomId(roomId);
      if (!nextRoomId || state.roomId) return;
      state.roomId = nextRoomId;
      state.role = role;
      state.nickname = nicknameInput?.value.trim() || `玩家${Math.floor(1000 + Math.random() * 9000)}`;
      state.online = "connecting";
      state.members = {};
      const url = new URL(window.location.href);
      url.searchParams.set("room", state.roomId);
      history.replaceState(null, "", url);
      updateStatus();
      await connect();
    }

    async function leaveRoom() {
      if (!state.roomId) return;
      await send({ type: "leave" });
      clearTransport();
      clearRoomState();
    }

    function broadcast(payload) {
      if (!state.roomId || !transport.connected) return;
      const message = {
        type: "state",
        snapshot: safeJson(payload),
      };
      send(message);
    }

    function connectionCount() {
      return Math.max(0, Object.keys(state.members).length - 1);
    }

    hostBtn?.addEventListener("click", () => enterRoom(makeRoomId(prefix), "host"));
    joinBtn?.addEventListener("click", () => enterRoom(roomInput?.value, "guest"));
    leaveBtn?.addEventListener("click", leaveRoom);
    copyBtn?.addEventListener("click", async () => {
      if (shareInput?.value) await navigator.clipboard.writeText(shareInput.value);
    });

    nicknameInput.value = localStorage.getItem("linkplay-name") || `玩家${Math.floor(1000 + Math.random() * 9000)}`;
    nicknameInput.addEventListener("change", () => localStorage.setItem("linkplay-name", nicknameInput.value.trim()));

    const roomFromUrl = normalizeRoomId(currentParams().get("room"));
    const saved = JSON.parse(localStorage.getItem(storageKey(gameKey)) || "null");
    if (roomFromUrl) {
      state.roomId = roomFromUrl;
      state.role = saved?.roomId === roomFromUrl ? saved.role : "guest";
      state.nickname = nicknameInput.value.trim();
      state.online = "connecting";
    } else if (saved?.roomId) {
      state.roomId = saved.roomId;
      state.role = saved.role;
      state.nickname = saved.nickname || nicknameInput.value.trim();
      state.online = "connecting";
    }

    updateStatus();
    if (state.roomId) connect();

    return {
      state,
      broadcast,
      leaveRoom,
      isHost: () => state.role === "host",
      isGuest: () => state.role === "guest",
      connectionCount,
      hasRoom: () => Boolean(state.roomId),
      localSeatIndex: () => (state.role === "guest" ? 1 : 0),
      requireHost: () => {
        if (!state.roomId) return "请先创建或加入房间。";
        if (state.role !== "host") return "只有房主可以开始游戏。";
        if (!hasSupabaseConfig()) return "当前缺少 Supabase 配置。";
        return "";
      },
    };
  };
})();
