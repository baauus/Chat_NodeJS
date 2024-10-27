/* Initate app -> npm run dev */
/* URL: localhost:3000 */

/* Imports */
import express from "express";
import logger from "morgan";
import dotenv from "dotenv";
import { createClient } from "@libsql/client";
import { Server } from "socket.io";
import { createServer } from "node:http";

/* Initiate .env variables */
dotenv.config();

const port = process.env.PORT ?? 3000;
const app = express();
const server = createServer(app);
const io = new Server(server, {
	connectionStateRecovery: {},
});

/* DDBB Connection */
const db = createClient({
	url: process.env.URL_BBDD,
	authToken: process.env.DB_TOKEN,
});

/* DDBB Creation */
await db.execute(`
    CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT,
    username TEXT
    );
`);

/* Socket.io JS*/
io.on("connection", async (socket) => {
	console.log("a user has connected!");

	socket.on("disconnect", () => {
		console.log("an user has disconnected");
	});

	socket.on("chat message", async (msg) => {
		let result;
		let username = socket.handshake.auth.username ?? "anonymous";
		try {
			result = await db.execute({
				sql: `INSERT INTO messages (content, username) VALUES (:msg, :username)`,
				args: { msg, username },
			});
		} catch (e) {
			console.log(e);
			return;
		}
		io.emit("chat message", msg, result.lastInsertRowid.toString(), username);
	});

	if (!socket.recovered) {
		try {
			const results = await db.execute({
				sql: "SELECT id, content, username FROM messages WHERE id > ?",
				args: [socket.handshake.auth.serverOffset ?? 0],
			});

			results.rows.forEach((row) => {
				socket.emit("chat message", row.content, row.id.toString(), row.username);
			});
		} catch (e) {
			console.log(e);
		}
	}
});

app.use(logger("dev"));

app.get("/", (req, res) => {
	res.sendFile(process.cwd() + "/client/index.html");
});

server.listen(port, () => {
	console.log(`Server running on port ${port}`);
});
