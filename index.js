import express from "express";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Server } from "socket.io";
import sqlite3 from "sqlite3";
import { open } from "sqlite";

const db = await open({ filename: "chat.db", driver: sqlite3.Database });
await db.exec(`
  CREATE TABLE IF NOT EXISTS message (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_offset TEXT UNIQUE,
    content TEXT
  );
  `);

const port = 3000;
const app = express();
const server = createServer(app);
const io = new Server(server, { connectionStateRecovery: {} });

const __dirname = dirname(fileURLToPath(import.meta.url));

app.get("/", (req, res) => {
  res.sendFile(join(__dirname, "index.html"));
});

io.on("connection", async (socket) => {
  console.log("a user connected");

  socket.on("disconnect", () => {
    console.log("user disconnected");
  });

  socket.on("chat message", async (msg, client_offset, callback) => {
    let result;

    try {
      result = await db.run(`INSERT INTO message (content, client_offset) VALUES (?, ?)`, msg, client_offset);
    } catch (err) {
      if (err.errno === 19) {
        callback();
      } else {
        // alert("Terjadi kesalahan!");
        console.error(err);
      }

      return;
    }

    io.emit("chat message", msg, result.lastID);
    callback();
  });

  if (!socket.recovered) {
    try {
      await db.each("SELECT id, content FROM message WHERE id > ?", [socket.handshake.auth.serverOffset || 0], (_err, row) => {
        socket.emit("chat message", row.content, row.id);
      });
    } catch (err) {
      alert("Terjadi kesalahan!");

      return console.error(err);
    }
  }
});

server.listen(port, () => {
  console.log(`server running at http://localhost:${port}`);
});
