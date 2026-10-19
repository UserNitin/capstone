function createSqliteStore(db) {
  return {
    kind: "sqlite",
    getUserByEmail: function (email) {
      return Promise.resolve(db.prepare("SELECT * FROM users WHERE email = ?").get(email) || null);
    },
    getUserByToken: function (token) {
      return Promise.resolve(db.prepare(
        "SELECT users.* FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token = ?"
      ).get(token) || null);
    },
    insertUser: function (user) {
      var created = db.prepare(
        "INSERT INTO users (name, role, email, blood, city, available, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(
        user.name,
        user.role,
        user.email,
        user.blood,
        user.city,
        user.available ? 1 : 0,
        user.password_hash,
        user.created_at
      );
      return Promise.resolve(db.prepare("SELECT * FROM users WHERE id = ?").get(created.lastInsertRowid));
    },
    updateUser: function (id, user) {
      db.prepare(
        "UPDATE users SET name = ?, role = ?, email = ?, blood = ?, city = ?, available = ?, password_hash = ? WHERE id = ?"
      ).run(user.name, user.role, user.email, user.blood, user.city, user.available ? 1 : 0, user.password_hash, id);
      return Promise.resolve(db.prepare("SELECT * FROM users WHERE id = ?").get(id));
    },
    createSession: function (userId) {
      var token = require("crypto").randomBytes(24).toString("hex");
      db.prepare("INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)").run(
        token,
        userId,
        new Date().toISOString()
      );
      return Promise.resolve(token);
    },
    deleteSession: function (token) {
      if (token) db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
      return Promise.resolve();
    },
    listDonors: function () {
      return Promise.resolve(db.prepare(
        "SELECT * FROM users WHERE role = 'donor' ORDER BY name COLLATE NOCASE"
      ).all());
    },
    listRequests: function () {
      return Promise.resolve(db.prepare("SELECT * FROM requests ORDER BY id ASC").all());
    },
    insertRequest: function (request) {
      var inserted = db.prepare(
        "INSERT INTO requests (name, email, blood, units, city, urgency, hospital, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(
        request.name,
        request.email,
        request.blood,
        request.units,
        request.city,
        request.urgency,
        request.hospital,
        request.notes,
        request.created_at
      );
      return Promise.resolve(db.prepare("SELECT * FROM requests WHERE id = ?").get(inserted.lastInsertRowid));
    },
    stats: function () {
      return Promise.resolve({
        donors: db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'donor'").get().count,
        available: db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'donor' AND available = 1").get().count,
        requests: db.prepare("SELECT COUNT(*) AS count FROM requests").get().count
      });
    }
  };
}

module.exports = { createSqliteStore: createSqliteStore };
