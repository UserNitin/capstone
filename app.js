var donorsCache = [];
var requestsCache = [];

function clean(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function showMessage(id, text, isError) {
  var box = document.getElementById(id);
  if (!box) return;
  box.className = isError ? "message error" : "message";
  box.textContent = text;
}

function api(path, options) {
  options = options || {};
  var headers = { "Content-Type": "application/json" };
  var token = localStorage.getItem("bc360_token");
  if (token) headers.Authorization = "Bearer " + token;
  return fetch(path, {
    method: options.method || "GET",
    headers: headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  }).then(function (response) {
    return response.json().catch(function () {
      return {};
    }).then(function (data) {
      if (!response.ok) {
        var message = data.error;
        if (!message) {
          message = response.status === 404
            ? "API not found. Open http://localhost:3000 and run: node server.js"
            : "The server could not save that.";
        }
        var error = new Error(message);
        error.status = response.status;
        throw error;
      }
      return data;
    });
  }).catch(function (error) {
    if (error && error.status) throw error;
    throw new Error("Cannot reach the API. Run node server.js and open http://localhost:3000");
  });
}

function saveSession(data) {
  localStorage.setItem("bc360_token", data.token);
  localStorage.setItem("bc360_currentUser", JSON.stringify(data.user));
}

function setupMenu() {
  var button = document.getElementById("menuBtn");
  var nav = document.getElementById("siteNav");
  if (!button || !nav) return;
  button.onclick = function () {
    var open = nav.className.indexOf("open") !== -1;
    nav.className = open ? "nav" : "nav open";
    button.textContent = open ? "Menu" : "Close";
  };
}

function drawDonors() {
  var table = document.getElementById("donorTable");
  var bloodFilter = document.getElementById("bloodFilter");
  var cityFilter = document.getElementById("cityFilter");
  var availabilityFilter = document.getElementById("availabilityFilter");
  var count = document.getElementById("resultCount");
  if (!table || !bloodFilter) return;

  var blood = bloodFilter.value;
  var city = cityFilter.value.toLowerCase();
  var availability = availabilityFilter.value;
  var shown = [];
  var html = "<tr><th>Name</th><th>Blood group</th><th>City</th><th>Status</th></tr>";
  var i;
  var row;
  var status;

  for (i = 0; i < donorsCache.length; i++) {
    row = donorsCache[i];
    status = row.available ? "Available" : "Not available";
    if (blood && row.blood !== blood) continue;
    if (city && String(row.city || "").toLowerCase().indexOf(city) === -1) continue;
    if (availability && status !== availability) continue;
    shown.push(row);
  }

  if (!shown.length) {
    html += "<tr><td colspan='4'>No donors found. Register as a donor to appear in this list.</td></tr>";
  }

  for (i = 0; i < shown.length; i++) {
    row = shown[i];
    status = row.available ? "Available" : "Not available";
    html += "<tr><td>" + clean(row.name) + "</td><td><b>" + clean(row.blood) + "</b></td><td>" + clean(row.city) + "</td><td><span class='" + (row.available ? "pill" : "wait") + "'>" + status + "</span></td></tr>";
  }

  table.innerHTML = html;
  count.textContent = "Showing " + shown.length + " of " + donorsCache.length + " donors";
}

function setupDonorPage() {
  var table = document.getElementById("donorTable");
  if (!table) return;
  document.getElementById("bloodFilter").onchange = drawDonors;
  document.getElementById("cityFilter").oninput = drawDonors;
  document.getElementById("availabilityFilter").onchange = drawDonors;
  document.getElementById("clearFilters").onclick = function () {
    document.getElementById("bloodFilter").value = "";
    document.getElementById("cityFilter").value = "";
    document.getElementById("availabilityFilter").value = "";
    drawDonors();
  };
  api("/api/donors").then(function (data) {
    donorsCache = data.donors || [];
    drawDonors();
  }).catch(function () {
    document.getElementById("resultCount").textContent = "Could not load donors. Start the site with node server.js.";
  });
}

function setupRegister() {
  var form = document.getElementById("registerForm");
  if (!form) return;
  var role = document.getElementById("regRole");
  var search = location.search;
  var editing = false;
  if (search.indexOf("role=donor") !== -1) role.value = "donor";
  if (search.indexOf("role=requester") !== -1) role.value = "requester";
  if (search.indexOf("role=hospital") !== -1) role.value = "hospital";
  if (search.indexOf("role=admin") !== -1) role.value = "admin";

  if (localStorage.getItem("bc360_token")) {
    api("/api/me").then(function (data) {
      editing = true;
      document.getElementById("regName").value = data.user.name || "";
      document.getElementById("regRole").value = data.user.role || "donor";
      document.getElementById("regEmail").value = data.user.email || "";
      document.getElementById("regBlood").value = data.user.blood || "";
      document.getElementById("regCity").value = data.user.city || "";
      document.getElementById("regAvailable").checked = !!data.user.available;
      document.getElementById("regPassword").required = false;
      document.getElementById("regPassword").placeholder = "Leave blank to keep your password";
      form.querySelector("button").textContent = "Save profile";
    }).catch(function () {
      localStorage.removeItem("bc360_token");
    });
  }

  form.onsubmit = function () {
    var profile = {
      name: document.getElementById("regName").value.trim(),
      role: role.value,
      email: document.getElementById("regEmail").value.trim(),
      blood: document.getElementById("regBlood").value,
      city: document.getElementById("regCity").value.trim(),
      available: document.getElementById("regAvailable").checked,
      password: document.getElementById("regPassword").value
    };
    var request = editing
      ? api("/api/profile", { method: "PUT", body: profile })
      : api("/api/register", { method: "POST", body: profile });

    request.then(function (data) {
      if (data.token) saveSession(data);
      else if (data.user) localStorage.setItem("bc360_currentUser", JSON.stringify(data.user));
      showMessage("registerMessage", "Account saved. Opening your dashboard...");
      setTimeout(function () { location.href = "dashboard.html"; }, 600);
    }).catch(function (error) {
      showMessage("registerMessage", error.message, true);
    });
    return false;
  };
}

function setupLogin() {
  var form = document.getElementById("loginForm");
  if (!form) return;
  form.onsubmit = function () {
    api("/api/login", {
      method: "POST",
      body: {
        email: document.getElementById("loginEmail").value.trim(),
        password: document.getElementById("loginPassword").value
      }
    }).then(function (data) {
      saveSession(data);
      location.href = "dashboard.html";
    }).catch(function (error) {
      showMessage("loginMessage", error.message, true);
    });
    return false;
  };
}

function drawRequests(tableId, list) {
  var table = document.getElementById(tableId);
  if (!table) return;
  var html = "<tr><th>Blood</th><th>City</th><th>Units</th><th>Urgency</th><th>Hospital</th><th>Date</th></tr>";
  var i;
  var item;
  if (!list.length) html += "<tr><td colspan='6'>No requests saved yet.</td></tr>";
  for (i = list.length - 1; i >= 0; i--) {
    item = list[i];
    if (!item) continue;
    html += "<tr><td><b>" + clean(item.blood) + "</b></td><td>" + clean(item.city) + "</td><td>" + clean(item.units) + "</td><td><span class='" + (item.urgency === "Urgent" ? "hot" : "wait") + "'>" + clean(item.urgency) + "</span></td><td>" + clean(item.hospital);
    if (item.notes) html += "<br>" + clean(item.notes);
    html += "</td><td>" + clean(item.date) + "</td></tr>";
  }
  table.innerHTML = html;
}

function setupRequest() {
  var form = document.getElementById("requestForm");
  if (!form) return;
  function refresh() {
    return api("/api/requests").then(function (data) {
      requestsCache = data.requests || [];
      drawRequests("requestList", requestsCache);
    });
  }
  refresh().catch(function () {
    drawRequests("requestList", []);
  });
  form.onsubmit = function () {
    api("/api/requests", {
      method: "POST",
      body: {
        name: document.getElementById("reqName").value.trim(),
        email: document.getElementById("reqEmail").value.trim(),
        blood: document.getElementById("reqBlood").value,
        units: document.getElementById("reqUnits").value,
        city: document.getElementById("reqCity").value.trim(),
        urgency: document.getElementById("reqUrgency").value,
        hospital: document.getElementById("reqHospital").value.trim(),
        notes: document.getElementById("reqNotes").value.trim()
      }
    }).then(function () {
      form.reset();
      showMessage("requestMessage", "Request saved in the database.");
      return refresh();
    }).catch(function (error) {
      showMessage("requestMessage", error.message, true);
    });
    return false;
  };
}

function setupDashboard() {
  var title = document.getElementById("dashboardTitle");
  if (!title) return;
  var names = {
    donor: "Donor Dashboard",
    requester: "Requester Dashboard",
    hospital: "Hospital Dashboard",
    admin: "Admin Dashboard"
  };
  var logout = document.getElementById("logoutBtn");
  if (logout) {
    logout.onclick = function () {
      api("/api/session", { method: "DELETE" }).catch(function () {}).then(function () {
        localStorage.removeItem("bc360_token");
        localStorage.removeItem("bc360_currentUser");
        location.href = "login.html";
      });
    };
  }

  Promise.all([
    api("/api/me").catch(function () { return { user: null }; }),
    api("/api/stats"),
    api("/api/requests")
  ]).then(function (results) {
    var user = results[0].user;
    var stats = results[1];
    if (user && names[user.role]) {
      title.textContent = names[user.role];
      document.getElementById("dashboardSubtitle").textContent = "Welcome, " + (user.name || "there") + ".";
      localStorage.setItem("bc360_currentUser", JSON.stringify(user));
    } else {
      title.textContent = "Dashboard";
      document.getElementById("dashboardSubtitle").textContent = "Sign in to see your account. Counts below come from the database.";
      if (logout) logout.style.display = "none";
    }
    document.getElementById("kpiDonors").textContent = String(stats.donors);
    document.getElementById("kpiAvailable").textContent = String(stats.available);
    document.getElementById("kpiRequests").textContent = String(stats.requests);
    drawRequests("dashboardRequests", results[2].requests || []);
  }).catch(function () {
    document.getElementById("dashboardSubtitle").textContent = "Could not reach the database. Start the site with node server.js.";
  });
}

function startApp() {
  setupMenu();
  setupDonorPage();
  setupRegister();
  setupLogin();
  setupRequest();
  setupDashboard();
}

startApp();
