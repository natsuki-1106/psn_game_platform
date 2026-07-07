const express = require("express");
const { createServer } = require("http");
const { ExpressPeerServer } = require("peer");
const path = require("path");

const app = express();
const server = createServer(app);
const port = Number(process.env.PORT || 8080);
const rootDir = __dirname;

app.use(
  "/peerjs",
  ExpressPeerServer(server, {
    path: "/",
    proxied: true,
  })
);

app.get("/vendor/peerjs.min.js", (_req, res) => {
  res.sendFile(path.join(rootDir, "node_modules", "peerjs", "dist", "peerjs.min.js"));
});

app.use(express.static(rootDir));

server.listen(port, () => {
  console.log(`LinkPlay running at http://127.0.0.1:${port}`);
  console.log(`PeerServer running at ws://127.0.0.1:${port}/peerjs`);
});
