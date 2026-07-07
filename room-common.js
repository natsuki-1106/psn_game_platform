(function () {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const CLOUD_PEER_HOST = "0.peerjs.com";
  const CLOUD_PEER_PORT = 443;
  const CLOUD_PEER_PATH = "/";
  const ICE_SERVERS = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ];

  function makeRoomId(prefix) {
    let code = prefix.toUpperCase().slice(0, 2);
    for (let i = 0; i < 6; i += 1) code += alphabet[Math.floor(Math.random() * alphabet.length)];
    return code;
  }

  function storageKey(gameKey) {
    return `linkplay-room-${gameKey}`;
  }

  function currentParams() {
    return new URLSearchParams(window.location.search);
  }

  function parseBool(value, fallback) {
    if (value == null) return fallback;
    return value !== "false" && value !== "0";
  }

  function preferCloudPeer() {
    const { protocol, hostname } = window.location;
    return protocol === "file:" || /\.github\.io$/i.test(hostname);
  }

  function buildIceServers(params) {
    const iceServers = [...ICE_SERVERS];
    const turnUrls = (params.get("turnUrls") || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const turnUsername = params.get("turnUsername") || "";
    const turnCredential = params.get("turnCredential") || "";
    if (turnUrls.length && turnUsername && turnCredential) {
      iceServers.push({ urls: turnUrls, username: turnUsername, credential: turnCredential });
    }
    return iceServers;
  }

  function peerOptions() {
    const params = currentParams();
    const useCloud = preferCloudPeer();
    const host = params.get("peerHost") || (useCloud ? CLOUD_PEER_HOST : window.location.hostname);
    const port = Number(params.get("peerPort") || (useCloud ? CLOUD_PEER_PORT : window.location.port || (window.location.protocol === "https:" ? 443 : 80)));
    const path = params.get("peerPath") || (useCloud ? CLOUD_PEER_PATH : "/peerjs");
    const options = {
      host,
      port,
      path,
      secure: parseBool(params.get("peerSecure"), useCloud ? true : window.location.protocol === "https:"),
      config: { iceServers: buildIceServers(params) },
      debug: 1,
    };
    const key = params.get("peerKey");
    if (key) options.key = key;
    return options;
  }

  function applyPeerParams(url) {
    const params = currentParams();
    ["peerHost", "peerPort", "peerPath", "peerSecure", "peerKey", "turnUrls", "turnUsername", "turnCredential"].forEach((key) => {
      const value = params.get(key);
      if (value) url.searchParams.set(key, value);
    });
  }

  function safeJson(value) {
    return JSON.parse(JSON.stringify(value));
  }

  window.initRoomPanel = function initRoomPanel({ gameKey, prefix, onRoomChange, onRemoteState, getSnapshot }) {
    const roomStatus = document.querySelector("#roomStatus");
    const nicknameInput = document.querySelector("#nicknameInput");
    const roomInput = document.querySelector("#roomInput");
    const shareInput = document.querySelector("#shareInput");
    const hostBtn = document.querySelector("#hostBtn");
    const joinBtn = document.querySelector("#joinBtn");
    const copyBtn = document.querySelector("#copyBtn");
    const state = { roomId: "", role: "none", nickname: "", online: "idle" };
    const peers = { peer: null, conn: null, conns: [] };

    function roomPeerId(roomId) {
      return `${gameKey}-${roomId}`.toLowerCase();
    }

    function save() {
      localStorage.setItem(storageKey(gameKey), JSON.stringify(state));
    }

    function statusText() {
      if (!state.roomId) return "未进房";
      if (state.online === "error") return state.role === "host" ? "房主 信令失败" : "加入失败";
      if (state.online === "connecting") return "连接中";
      if (state.online === "online") return state.role === "host" ? `房主 ${peers.conns.length}人` : "已联机";
      return state.role === "host" ? "房主" : "已进房";
    }

    function updateStatus() {
      if (roomStatus) {
        roomStatus.textContent = statusText();
        roomStatus.style.color = state.roomId && state.online !== "error" ? "var(--accent)" : "var(--warn)";
      }
      if (roomInput) roomInput.value = state.roomId;
      if (shareInput && state.roomId) {
        const url = new URL(window.location.href);
        url.searchParams.set("room", state.roomId);
        applyPeerParams(url);
        shareInput.value = url.toString();
      }
      onRoomChange?.({ ...state });
      window.dispatchEvent(new CustomEvent("linkplay-room-change", { detail: { ...state } }));
    }

    function cleanupPeer() {
      peers.conns.forEach((conn) => conn.close());
      peers.conns = [];
      peers.conn?.close();
      peers.conn = null;
      peers.peer?.destroy();
      peers.peer = null;
    }

    function sendSnapshot(conn) {
      const snapshot = getSnapshot?.();
      if (!snapshot || !conn?.open) return;
      conn.send({ type: "state", payload: safeJson(snapshot) });
    }

    function broadcast(payload) {
      if (!state.roomId) return;
      const message = { type: "state", payload: safeJson(payload) };
      if (state.role === "host") {
        peers.conns.filter((conn) => conn.open).forEach((conn) => conn.send(message));
      } else if (peers.conn?.open) {
        peers.conn.send(message);
      }
    }

    function handleMessage(data, fromConn) {
      if (!data || data.type !== "state") return;
      onRemoteState?.(data.payload);
      if (state.role === "host") {
        peers.conns.filter((conn) => conn !== fromConn && conn.open).forEach((conn) => conn.send(data));
      }
    }

    function attachConn(conn) {
      conn.on("open", () => {
        if (state.role === "host") {
          if (!peers.conns.includes(conn)) peers.conns.push(conn);
          state.online = "online";
          sendSnapshot(conn);
        } else {
          peers.conn = conn;
          state.online = "online";
        }
        updateStatus();
      });
      conn.on("data", (data) => handleMessage(data, conn));
      conn.on("close", () => {
        peers.conns = peers.conns.filter((item) => item !== conn);
        if (peers.conn === conn) peers.conn = null;
        state.online = state.role === "host" ? "online" : "idle";
        updateStatus();
      });
      conn.on("error", () => {
        state.online = "error";
        updateStatus();
      });
    }

    function startHost() {
      if (!window.Peer || !state.roomId) return;
      cleanupPeer();
      state.online = "connecting";
      const peer = new Peer(roomPeerId(state.roomId), peerOptions());
      peers.peer = peer;
      peer.on("open", () => {
        state.online = "online";
        updateStatus();
      });
      peer.on("connection", attachConn);
      peer.on("error", () => {
        state.online = "error";
        updateStatus();
      });
    }

    function startGuest() {
      if (!window.Peer || !state.roomId) return;
      cleanupPeer();
      state.online = "connecting";
      const peer = new Peer(undefined, peerOptions());
      peers.peer = peer;
      peer.on("open", () => {
        attachConn(peer.connect(roomPeerId(state.roomId), { reliable: true }));
      });
      peer.on("error", () => {
        state.online = "error";
        updateStatus();
      });
    }

    function enterRoom(roomId, role) {
      state.roomId = roomId.trim().toUpperCase();
      state.role = role;
      state.nickname = nicknameInput?.value.trim() || "玩家";
      state.online = "connecting";
      const url = new URL(window.location.href);
      url.searchParams.set("room", state.roomId);
      applyPeerParams(url);
      history.replaceState(null, "", url);
      save();
      updateStatus();
      if (role === "host") startHost();
      else startGuest();
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
    state.online = state.roomId ? "connecting" : "idle";
    updateStatus();
    if (state.roomId && state.role === "host") startHost();
    if (state.roomId && state.role === "guest") startGuest();

    return {
      state,
      broadcast,
      isHost: () => state.role === "host",
      isGuest: () => state.role === "guest",
      connectionCount: () => (state.role === "host" ? peers.conns.length : peers.conn?.open ? 1 : 0),
      hasRoom: () => Boolean(state.roomId),
      localSeatIndex: () => (state.role === "guest" ? 1 : 0),
      requireHost: () => {
        if (!state.roomId) return "请先创建或加入房间。";
        if (state.role !== "host") return "只有房主可以开始游戏。";
        return "";
      },
    };
  };
})();
