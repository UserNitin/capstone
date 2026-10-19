var crypto = require("crypto");

var roles = { donor: true, requester: true, hospital: true, admin: true };

function text(value) {
  return String(value == null ? "" : value).trim();
}

function hashPassword(password, salt) {
  var useSalt = salt || crypto.randomBytes(16).toString("hex");
  var hash = crypto.scryptSync(String(password), useSalt, 32).toString("hex");
  return useSalt + ":" + hash;
}

function checkPassword(password, stored) {
  var parts = String(stored || "").split(":");
  if (parts.length !== 2) return false;
  var hash = crypto.scryptSync(String(password), parts[0], 32);
  var expected = Buffer.from(parts[1], "hex");
  if (hash.length !== expected.length) return false;
  return crypto.timingSafeEqual(hash, expected);
}

function publicUser(row) {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    email: row.email,
    blood: row.blood || "",
    city: row.city || "",
    available: row.available === 1 || row.available === true
  };
}

function publicRequest(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    blood: row.blood,
    units: row.units,
    city: row.city,
    urgency: row.urgency,
    hospital: row.hospital,
    notes: row.notes || "",
    date: new Date(row.created_at).toLocaleDateString()
  };
}

function tokenFrom(headers) {
  var header = headers.authorization || headers.Authorization || "";
  if (header.indexOf("Bearer ") !== 0) return "";
  return header.slice(7);
}

function handle(store, request) {
  var method = request.method;
  var pathname = request.path;
  var body = request.body || {};
  var headers = request.headers || {};

  function currentUser() {
    var token = tokenFrom(headers);
    if (!token) return Promise.resolve(null);
    return store.getUserByToken(token);
  }

  if (method === "GET" && pathname === "/api/health") {
    return Promise.resolve({ status: 200, body: { ok: true, database: store.kind } });
  }

  if (method === "GET" && pathname === "/api/me") {
    return currentUser().then(function (user) {
      if (!user) return { status: 401, body: { error: "Not signed in." } };
      return { status: 200, body: { user: publicUser(user) } };
    });
  }

  if (method === "DELETE" && pathname === "/api/session") {
    return store.deleteSession(tokenFrom(headers)).then(function () {
      return { status: 200, body: { ok: true } };
    });
  }

  if (method === "GET" && pathname === "/api/donors") {
    return store.listDonors().then(function (donors) {
      return { status: 200, body: { donors: donors.map(publicUser) } };
    });
  }

  if (method === "GET" && pathname === "/api/requests") {
    return store.listRequests().then(function (requests) {
      return { status: 200, body: { requests: requests.map(publicRequest) } };
    });
  }

  if (method === "GET" && pathname === "/api/stats") {
    return store.stats().then(function (stats) {
      return { status: 200, body: stats };
    });
  }

  if (method === "POST" && pathname === "/api/register") {
    var name = text(body.name);
    var email = text(body.email).toLowerCase();
    var role = text(body.role);
    var password = String(body.password || "");
    if (!name || !email || !roles[role]) {
      return Promise.resolve({ status: 400, body: { error: "Name, email, and role are required." } });
    }
    if (password.length < 4) {
      return Promise.resolve({ status: 400, body: { error: "Use a password with at least 4 characters." } });
    }
    return store.getUserByEmail(email).then(function (existing) {
      if (existing) {
        return { status: 409, body: { error: "That email is already registered. Sign in instead." } };
      }
      return store.insertUser({
        name: name,
        role: role,
        email: email,
        blood: text(body.blood),
        city: text(body.city),
        available: body.available ? 1 : 0,
        password_hash: hashPassword(password),
        created_at: new Date().toISOString()
      }).then(function (user) {
        return store.createSession(user.id).then(function (token) {
          return { status: 201, body: { token: token, user: publicUser(user) } };
        });
      });
    });
  }

  if (method === "POST" && pathname === "/api/login") {
    var loginEmail = text(body.email).toLowerCase();
    var loginPassword = String(body.password || "");
    return store.getUserByEmail(loginEmail).then(function (account) {
      if (!account || !checkPassword(loginPassword, account.password_hash)) {
        return { status: 401, body: { error: "Email or password is not correct." } };
      }
      return store.createSession(account.id).then(function (token) {
        return { status: 200, body: { token: token, user: publicUser(account) } };
      });
    });
  }

  if (method === "PUT" && pathname === "/api/profile") {
    return currentUser().then(function (signedIn) {
      if (!signedIn) return { status: 401, body: { error: "Please sign in again." } };
      var nextName = text(body.name);
      var nextRole = text(body.role);
      var nextEmail = text(body.email).toLowerCase();
      if (!nextName || !nextEmail || !roles[nextRole]) {
        return { status: 400, body: { error: "Name, email, and role are required." } };
      }
      return store.getUserByEmail(nextEmail).then(function (taken) {
        if (taken && taken.id !== signedIn.id) {
          return { status: 409, body: { error: "That email is already used by another account." } };
        }
        var nextHash = signedIn.password_hash;
        if (body.password) {
          if (String(body.password).length < 4) {
            return { status: 400, body: { error: "Use a password with at least 4 characters." } };
          }
          nextHash = hashPassword(String(body.password));
        }
        return store.updateUser(signedIn.id, {
          name: nextName,
          role: nextRole,
          email: nextEmail,
          blood: text(body.blood),
          city: text(body.city),
          available: body.available ? 1 : 0,
          password_hash: nextHash
        }).then(function (updated) {
          return { status: 200, body: { user: publicUser(updated) } };
        });
      });
    });
  }

  if (method === "POST" && pathname === "/api/requests") {
    var requestName = text(body.name);
    var requestEmail = text(body.email).toLowerCase();
    var blood = text(body.blood);
    var city = text(body.city);
    var hospital = text(body.hospital);
    if (!requestName || !requestEmail || !blood || !city || !hospital) {
      return Promise.resolve({
        status: 400,
        body: { error: "Name, email, blood group, city, and hospital are required." }
      });
    }
    return store.insertRequest({
      name: requestName,
      email: requestEmail,
      blood: blood,
      units: text(body.units) || "1",
      city: city,
      urgency: text(body.urgency) || "Urgent",
      hospital: hospital,
      notes: text(body.notes),
      created_at: new Date().toISOString()
    }).then(function (saved) {
      return { status: 201, body: { request: publicRequest(saved) } };
    });
  }

  return Promise.resolve({ status: 404, body: { error: "Not found" } });
}

module.exports = { handle: handle };
