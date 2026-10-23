var crypto = require("crypto");
var getStore = require("@netlify/blobs").getStore;

function bucket() {
  // Eventual consistency works with Lambda Blobs credentials from connectLambda.
  // "strong" needs uncachedEdgeURL, which Lambda mode does not provide.
  return getStore("bloodconnect");
}

function load(key, fallback) {
  return bucket().get(key, { type: "json" }).then(function (value) {
    return value == null ? fallback : value;
  });
}

function save(key, value) {
  return bucket().setJSON(key, value);
}

function emptyUsers() {
  return { nextId: 1, rows: [] };
}

function emptyRequests() {
  return { nextId: 1, rows: [] };
}

function createBlobStore() {
  return {
    kind: "netlify-blobs",
    getUserByEmail: function (email) {
      return load("users", emptyUsers()).then(function (data) {
        var wanted = String(email || "").toLowerCase();
        var i;
        for (i = 0; i < data.rows.length; i++) {
          if (String(data.rows[i].email).toLowerCase() === wanted) return data.rows[i];
        }
        return null;
      });
    },
    getUserByToken: function (token) {
      return load("sessions", { tokens: {} }).then(function (sessions) {
        var session = sessions.tokens[token];
        if (!session) return null;
        return load("users", emptyUsers()).then(function (data) {
          var i;
          for (i = 0; i < data.rows.length; i++) {
            if (data.rows[i].id === session.userId) return data.rows[i];
          }
          return null;
        });
      });
    },
    insertUser: function (user) {
      return load("users", emptyUsers()).then(function (data) {
        var row = {
          id: data.nextId,
          name: user.name,
          role: user.role,
          email: user.email,
          blood: user.blood,
          city: user.city,
          available: user.available ? 1 : 0,
          password_hash: user.password_hash,
          created_at: user.created_at
        };
        data.nextId += 1;
        data.rows.push(row);
        return save("users", data).then(function () { return row; });
      });
    },
    updateUser: function (id, user) {
      return load("users", emptyUsers()).then(function (data) {
        var i;
        var row = null;
        for (i = 0; i < data.rows.length; i++) {
          if (data.rows[i].id === id) {
            data.rows[i].name = user.name;
            data.rows[i].role = user.role;
            data.rows[i].email = user.email;
            data.rows[i].blood = user.blood;
            data.rows[i].city = user.city;
            data.rows[i].available = user.available ? 1 : 0;
            data.rows[i].password_hash = user.password_hash;
            row = data.rows[i];
          }
        }
        return save("users", data).then(function () { return row; });
      });
    },
    createSession: function (userId) {
      var token = crypto.randomBytes(24).toString("hex");
      return load("sessions", { tokens: {} }).then(function (sessions) {
        sessions.tokens[token] = { userId: userId, created_at: new Date().toISOString() };
        return save("sessions", sessions).then(function () { return token; });
      });
    },
    deleteSession: function (token) {
      if (!token) return Promise.resolve();
      return load("sessions", { tokens: {} }).then(function (sessions) {
        delete sessions.tokens[token];
        return save("sessions", sessions);
      });
    },
    listDonors: function () {
      return load("users", emptyUsers()).then(function (data) {
        var donors = [];
        var i;
        for (i = 0; i < data.rows.length; i++) {
          if (data.rows[i].role === "donor") donors.push(data.rows[i]);
        }
        donors.sort(function (a, b) {
          return String(a.name).toLowerCase().localeCompare(String(b.name).toLowerCase());
        });
        return donors;
      });
    },
    listRequests: function () {
      return load("requests", emptyRequests()).then(function (data) {
        return data.rows.slice().sort(function (a, b) { return a.id - b.id; });
      });
    },
    insertRequest: function (request) {
      return load("requests", emptyRequests()).then(function (data) {
        var row = {
          id: data.nextId,
          name: request.name,
          email: request.email,
          blood: request.blood,
          units: request.units,
          city: request.city,
          urgency: request.urgency,
          hospital: request.hospital,
          notes: request.notes,
          created_at: request.created_at
        };
        data.nextId += 1;
        data.rows.push(row);
        return save("requests", data).then(function () { return row; });
      });
    },
    stats: function () {
      return Promise.all([
        load("users", emptyUsers()),
        load("requests", emptyRequests())
      ]).then(function (parts) {
        var users = parts[0].rows;
        var donors = 0;
        var available = 0;
        var i;
        for (i = 0; i < users.length; i++) {
          if (users[i].role === "donor") {
            donors += 1;
            if (users[i].available === 1) available += 1;
          }
        }
        return { donors: donors, available: available, requests: parts[1].rows.length };
      });
    }
  };
}

module.exports = { createBlobStore: createBlobStore };
