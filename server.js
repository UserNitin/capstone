var http = require("http");
var fs = require("fs");
var path = require("path");
var DatabaseSync = require("node:sqlite").DatabaseSync;
var handle = require("./lib/routes").handle;
var createSqliteStore = require("./lib/sqlite-store").createSqliteStore;

var root = __dirname;
var port = Number(process.env.PORT) || 3000;
var dataDir = path.join(root, "data");
fs.mkdirSync(dataDir, { recursive: true });

var db = new DatabaseSync(path.join(dataDir, "bloodconnect.db"));
db.exec("PRAGMA foreign_keys = ON");
db.exec(
  "CREATE TABLE IF NOT EXISTS users (" +
    "id INTEGER PRIMARY KEY AUTOINCREMENT," +
    "name TEXT NOT NULL," +
    "role TEXT NOT NULL," +
    "email TEXT NOT NULL UNIQUE COLLATE NOCASE," +
    "blood TEXT," +
    "city TEXT," +
    "available INTEGER NOT NULL DEFAULT 0," +
    "password_hash TEXT NOT NULL," +
    "created_at TEXT NOT NULL" +
  ")"
);
db.exec(
  "CREATE TABLE IF NOT EXISTS sessions (" +
    "token TEXT PRIMARY KEY," +
    "user_id INTEGER NOT NULL," +
    "created_at TEXT NOT NULL," +
    "FOREIGN KEY (user_id) REFERENCES users(id)" +
  ")"
);
db.exec(
  "CREATE TABLE IF NOT EXISTS requests (" +
    "id INTEGER PRIMARY KEY AUTOINCREMENT," +
    "name TEXT NOT NULL," +
    "email TEXT NOT NULL," +
    "blood TEXT NOT NULL," +
    "units TEXT NOT NULL," +
    "city TEXT NOT NULL," +
    "urgency TEXT NOT NULL," +
    "hospital TEXT NOT NULL," +
    "notes TEXT," +
    "created_at TEXT NOT NULL" +
  ")"
);

var store = createSqliteStore(db);
var types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
};

function sendJson(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(body));
}

function readJson(req, callback) {
  var chunks = [];
  var size = 0;
  req.on("data", function (chunk) {
    size += chunk.length;
    if (size > 1000000) req.destroy();
    else chunks.push(chunk);
  });
  req.on("end", function () {
    if (!chunks.length) {
      callback(null, {});
      return;
    }
    try {
      callback(null, JSON.parse(Buffer.concat(chunks).toString("utf8")));
    } catch (error) {
      callback(error);
    }
  });
  req.on("error", function (error) {
    callback(error);
  });
}

function serveFile(req, res) {
  var pathname = "/";
  try {
    pathname = decodeURIComponent(new URL(req.url, "http://127.0.0.1").pathname);
  } catch (error) {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Bad request");
    return;
  }

  if (pathname.indexOf("/api/") === 0) {
    readJson(req, function (error, body) {
      if (error) {
        sendJson(res, 400, { error: "Send the form as JSON." });
        return;
      }
      handle(store, {
        method: req.method,
        path: pathname,
        headers: req.headers,
        body: body
      }).then(function (result) {
        sendJson(res, result.status, result.body);
      }).catch(function (failure) {
        console.error(failure);
        sendJson(res, 500, { error: "The server could not save that." });
      });
    });
    return;
  }

  var relative = pathname === "/" ? "index.html" : pathname.replace(/^[/\\]+/, "");
  var filePath = path.resolve(root, relative);
  var rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
  if (filePath !== root && filePath.indexOf(rootWithSep) !== 0) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }
  if (filePath.indexOf(dataDir) === 0) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, function (err, data) {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    var ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream" });
    res.end(data);
  });
}

var server = http.createServer(serveFile);
server.on("error", function (err) {
  if (err.code === "EADDRINUSE") console.error("Port " + port + " is already in use.");
  else console.error(err.message);
  process.exit(1);
});
server.listen(port, function () {
  console.log("BloodConnect 360 is running at http://localhost:" + port);
  console.log("Database: data/bloodconnect.db");
});
