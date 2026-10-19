var handle = require("../../lib/routes").handle;
var createBlobStore = require("../../lib/blob-store").createBlobStore;

function json(status, body) {
  return {
    statusCode: status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(body)
  };
}

function apiPath(event) {
  var sources = [event.rawUrl, event.path];
  var i;
  var match;
  for (i = 0; i < sources.length; i++) {
    if (!sources[i]) continue;
    match = String(sources[i]).match(/\/api\/[A-Za-z0-9_-]+/);
    if (match) return match[0];
  }
  return "";
}

exports.handler = async function (event) {
  var pathname = apiPath(event);
  if (!pathname) return json(404, { error: "Not found" });

  var body = {};
  if (event.body) {
    var raw = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch (error) {
      return json(400, { error: "Send the form as JSON." });
    }
  }

  try {
    var result = await handle(createBlobStore(), {
      method: event.httpMethod,
      path: pathname,
      headers: event.headers || {},
      body: body
    });
    return json(result.status, result.body);
  } catch (error) {
    console.error(error);
    return json(500, { error: "The server could not save that." });
  }
};
