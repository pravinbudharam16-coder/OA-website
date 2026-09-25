const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");

const root = __dirname;
const port = positiveInt(process.env.PORT, 4173);
const sessions = new Map();
const rateBuckets = new Map();
const rateConfig = Object.freeze({
  windowMs: positiveInt(process.env.SMARTOA_RATE_WINDOW_MS, 60_000),
  authIpMax: positiveInt(process.env.SMARTOA_AUTH_IP_MAX_ATTEMPTS, 10),
  authAccountMax: positiveInt(process.env.SMARTOA_AUTH_ACCOUNT_MAX_ATTEMPTS, 5),
  authBaseBackoffMs: positiveInt(process.env.SMARTOA_AUTH_BASE_BACKOFF_MS, 30_000),
  authMaxBackoffMs: positiveInt(process.env.SMARTOA_AUTH_MAX_BACKOFF_MS, 10 * 60_000),
  publicMax: positiveInt(process.env.SMARTOA_PUBLIC_RATE_MAX, 120),
  authenticatedMax: positiveInt(process.env.SMARTOA_AUTHENTICATED_RATE_MAX, 600),
  bodyMaxBytes: positiveInt(process.env.SMARTOA_MAX_JSON_BYTES, 8_192),
});

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json",
  ".json": "application/json; charset=utf-8",
};

const PUBLIC_PATHS = new Set([
  "/", "/index.html", "/login.html", "/privacy.html", "/terms.html", "/manifest.webmanifest", "/sw.js",
  "/02_Frontend/assets/css/login.css", "/02_Frontend/assets/css/legal.css", "/02_Frontend/assets/css/styles.css",
  "/02_Frontend/assets/js/login.js", "/02_Frontend/assets/js/app.js",
  "/02_Frontend/assets/images/smartoa-logo.png", "/02_Frontend/assets/images/icon.svg",
  "/02_Frontend/assets/images/icon-192.png", "/02_Frontend/assets/images/icon-512.png",
  "/02_Frontend/assets/images/oa-risk-marker.svg",
]);

const AUTH_ROUTES = new Set(["POST /api/login"]);
const PUBLIC_API_ROUTES = new Set(["GET /api/session"]);
const AUTHENTICATED_API_ROUTES = new Set(["POST /api/logout", "GET /api/ml/model-stats", "POST /api/ml/predict-risk"]);
const LOG_DIR = path.join(root, "logs");
const SECURITY_LOG = path.join(LOG_DIR, "security.log");

function positiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function logSecurity(level, message, details = {}) {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    const entry = JSON.stringify({
      time: new Date().toISOString(),
      level,
      message,
      ...details,
    });
    fs.appendFileSync(SECURITY_LOG, `${entry}\n`, { encoding: "utf8" });
  } catch (error) {
    console.error("Security log write failed:", error.message);
  }
}

function parseCookies(header = "") {
  const cookies = {};
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    try { cookies[key] = decodeURIComponent(value); } catch (_) {}
  }
  return cookies;
}

function sendJson(res, status, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...extraHeaders,
  });
  res.end(body);
}

function getSession(req) {
  const token = parseCookies(req.headers.cookie).smartoa_session;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return { token, ...session };
}

function hashPassword(password, salt, iterations = 120000) {
  return crypto.pbkdf2Sync(password, Buffer.from(salt, "base64"), iterations, 32, "sha256");
}

function verifyPassword(password, user) {
  const actual = hashPassword(password, user.salt, user.iterations);
  const expected = Buffer.from(user.passwordHash, "base64");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function readUsers() {
  try {
    const file = JSON.parse(fs.readFileSync(path.join(root, "04_Data", "users.json"), "utf8"));
    return Array.isArray(file.users) ? file.users : [];
  } catch (error) {
    logSecurity("error", "User store could not be read", { error: error.stack });
    throw new Error("User store unavailable");
  }
}

function validateLoginPayload(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, message: "Invalid request." };
  const keys = Object.keys(body).sort();
  if (keys.length !== 2 || keys[0] !== "password" || keys[1] !== "username") return { ok: false, message: "Invalid request." };
  if (typeof body.username !== "string" || !/^[A-Za-z0-9._-]{3,64}$/.test(body.username.trim())) return { ok: false, message: "Invalid healthcare worker ID." };
  if (typeof body.password !== "string" || body.password.length < 8 || body.password.length > 128) return { ok: false, message: "Invalid password format." };
  return { ok: true, username: body.username.trim().toLowerCase(), password: body.password };
}

function requestBody(req) {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers["content-length"] || 0);
    if (declared > rateConfig.bodyMaxBytes) {
      reject(Object.assign(new Error("Request body too large"), { statusCode: 413, publicMessage: "Request is too large." }));
      return;
    }
    let body = "";
    let rejected = false;
    req.on("data", chunk => {
      if (rejected) return;
      body += chunk.toString("utf8");
      if (Buffer.byteLength(body, "utf8") > rateConfig.bodyMaxBytes) {
        rejected = true;
        reject(Object.assign(new Error("Request body too large"), { statusCode: 413, publicMessage: "Request is too large." }));
        req.resume();
      }
    });
    req.on("end", () => {
      if (rejected) return;
      try { resolve(JSON.parse(body || "{}")); }
      catch (error) { reject(Object.assign(error, { statusCode: 400, publicMessage: "Invalid request." })); }
    });
    req.on("error", error => {
      if (!rejected) reject(error);
    });
  });
}

function clientIp(req) {
  return req.socket.remoteAddress || "local";
}

function rateLimitCheck({ category, ip, account = "" }) {
  const now = Date.now();
  const windowMs = rateConfig.windowMs;
  const max = category === "auth" ? rateConfig.authIpMax : category === "authenticated" ? rateConfig.authenticatedMax : rateConfig.publicMax;
  const keys = category === "auth" && account ? [`${category}:ip:${ip}`, `${category}:account:${account}`] : [`${category}:ip:${ip}`];
  let maxWait = 0;
  for (const key of keys) {
    let bucket = rateBuckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs, failures: 0, backoffUntil: 0 };
      rateBuckets.set(key, bucket);
    }
    if (category === "auth" && bucket.backoffUntil > now) maxWait = Math.max(maxWait, bucket.backoffUntil - now);
    if (bucket.count >= max) maxWait = Math.max(maxWait, bucket.resetAt - now);
  }
  if (maxWait > 0) return { allowed: false, waitMs: maxWait };
  for (const key of keys) rateBuckets.get(key).count += 1;
  return { allowed: true, keys };
}

function recordAuthFailure(keys) {
  const now = Date.now();
  for (const key of keys || []) {
    const bucket = rateBuckets.get(key);
    if (!bucket) continue;
    bucket.failures += 1;
    if (key.includes(":account:")) {
      const exponent = Math.max(0, bucket.failures - 1);
      const delay = Math.min(rateConfig.authMaxBackoffMs, rateConfig.authBaseBackoffMs * (2 ** exponent));
      bucket.backoffUntil = now + delay;
    }
  }
}

function resetAuthFailures(account, ip) {
  rateBuckets.delete(`auth:account:${account}`);
  rateBuckets.delete(`auth:ip:${ip}`);
}

function cleanupRateBuckets() {
  const now = Date.now();
  for (const [key, bucket] of rateBuckets) {
    if (bucket.resetAt <= now && bucket.backoffUntil <= now) rateBuckets.delete(key);
  }
}
setInterval(cleanupRateBuckets, Math.max(30_000, rateConfig.windowMs)).unref();

function rateLimitResponse(res, waitMs) {
  const seconds = Math.max(1, Math.ceil(waitMs / 1000));
  sendJson(res, 429, { ok: false, message: "Too many requests. Please try again later." }, { "Retry-After": String(seconds) });
}

function serveFile(req, res, requestPath) {
  const resolvedRoot = path.resolve(root);
  const filePath = path.resolve(root, `.${requestPath}`);
  if (filePath !== resolvedRoot && !filePath.startsWith(`${resolvedRoot}${path.sep}`)) {
    logSecurity("warn", "Blocked path traversal attempt", { ip: clientIp(req), requestPath });
    sendJson(res, 403, { ok: false, message: "Access denied." });
    return;
  }
  fs.readFile(filePath, (error, data) => {
    if (error) {
      logSecurity("info", "Static file request failed", { ip: clientIp(req), requestPath, error: error.stack });
      sendJson(res, error.code === "ENOENT" ? 404 : 500, { ok: false, message: error.code === "ENOENT" ? "Resource not found." : "Server error." });
      return;
    }
    res.writeHead(200, {
      "Content-Type": types[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(data);
  });
}

http.createServer(async (req, res) => {
  try {
    let requestPath;
    try {
      requestPath = decodeURIComponent(req.url.split("?")[0]);
    } catch (error) {
      logSecurity("warn", "Malformed request path", { ip: clientIp(req), error: error.stack });
      sendJson(res, 400, { ok: false, message: "Invalid request." });
      return;
    }

    const routeKey = `${req.method} ${requestPath}`;
    const ip = clientIp(req);

    if (AUTH_ROUTES.has(routeKey)) {
      if (req.headers["content-type"]?.split(";")[0].trim().toLowerCase() !== "application/json") {
        sendJson(res, 415, { ok: false, message: "Unsupported request format." });
        return;
      }
      let rawBody;
      try { rawBody = await requestBody(req); }
      catch (error) {
        logSecurity("warn", "Rejected login request body", { ip, error: error.stack });
        sendJson(res, error.statusCode || 400, { ok: false, message: error.publicMessage || "Invalid request." });
        return;
      }
      const validation = validateLoginPayload(rawBody);
      if (!validation.ok) {
        sendJson(res, 400, { ok: false, message: validation.message });
        return;
      }
      const limit = rateLimitCheck({ category: "auth", ip, account: validation.username });
      if (!limit.allowed) {
        logSecurity("warn", "Authentication rate limit applied", { ip, account: validation.username, waitMs: limit.waitMs });
        rateLimitResponse(res, limit.waitMs);
        return;
      }
      const user = readUsers().find(item => typeof item.username === "string" && item.username.toLowerCase() === validation.username);
      if (!user || !verifyPassword(validation.password, user)) {
        recordAuthFailure(limit.keys);
        sendJson(res, 401, { ok: false, message: "Invalid healthcare worker ID or password." });
        return;
      }
      resetAuthFailures(validation.username, ip);
      const token = crypto.randomBytes(32).toString("hex");
      sessions.set(token, {
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        expiresAt: Date.now() + 8 * 60 * 60 * 1000,
      });
      sendJson(res, 200, { ok: true, user: { username: user.username, displayName: user.displayName, role: user.role } }, {
        "Set-Cookie": `smartoa_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800`,
      });
      return;
    }

    const session = getSession(req);
    const isPublic = PUBLIC_PATHS.has(requestPath);
    if (!session && !isPublic) {
      if (requestPath.startsWith("/api/")) sendJson(res, 401, { ok: false, message: "Authentication required." });
      else { res.writeHead(302, { Location: "/login.html" }); res.end(); }
      return;
    }

    const category = AUTHENTICATED_API_ROUTES.has(routeKey) || session ? "authenticated" : "public";
    if (PUBLIC_API_ROUTES.has(routeKey) || AUTHENTICATED_API_ROUTES.has(routeKey)) {
      const limit = rateLimitCheck({ category, ip });
      if (!limit.allowed) {
        logSecurity("warn", "API rate limit applied", { ip, route: routeKey, category, waitMs: limit.waitMs });
        rateLimitResponse(res, limit.waitMs);
        return;
      }
    }

    if (req.method === "GET" && requestPath === "/api/session") {
      if (!session) { sendJson(res, 401, { ok: false }); return; }
      sendJson(res, 200, { ok: true, user: { username: session.username, displayName: session.displayName, role: session.role } });
      return;
    }

    if (req.method === "POST" && requestPath === "/api/logout") {
      if (session) sessions.delete(session.token);
      sendJson(res, 200, { ok: true }, { "Set-Cookie": "smartoa_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0" });
      return;
    }

    if (req.method === "GET" && requestPath === "/api/ml/model-stats") {
      const statsFile = path.join(root, "04_Data", "model_eval_results.json");
      fs.readFile(statsFile, "utf8", (err, data) => {
        if (err) {
          sendJson(res, 500, { ok: false, message: "Model statistics unavailable." });
          return;
        }
        try {
          const stats = JSON.parse(data);
          sendJson(res, 200, { ok: true, stats });
        } catch (e) {
          sendJson(res, 500, { ok: false, message: "Invalid model statistics format." });
        }
      });
      return;
    }

    if (req.method === "POST" && requestPath === "/api/ml/predict-risk") {
      let reqBody;
      try { reqBody = await requestBody(req); }
      catch (error) {
        sendJson(res, error.statusCode || 400, { ok: false, message: error.publicMessage || "Invalid payload." });
        return;
      }
      
      const scriptPath = path.join(root, "07_ML_Model", "predict_knee_oa.py");
      const pyProcess = spawn("python", [scriptPath]);
      let stdoutData = "";
      let stderrData = "";
      
      pyProcess.stdout.on("data", (chunk) => { stdoutData += chunk.toString("utf8"); });
      pyProcess.stderr.on("data", (chunk) => { stderrData += chunk.toString("utf8"); });
      
      pyProcess.on("close", (code) => {
        if (code !== 0) {
          logSecurity("error", "ML prediction script error", { stderr: stderrData });
          sendJson(res, 500, { ok: false, message: "ML inference failed." });
          return;
        }
        try {
          const result = JSON.parse(stdoutData.trim());
          sendJson(res, 200, result);
        } catch (e) {
          sendJson(res, 500, { ok: false, message: "Failed to parse prediction output." });
        }
      });
      
      pyProcess.stdin.write(JSON.stringify(reqBody));
      pyProcess.stdin.end();
      return;
    }

    let fileRequest = requestPath;
    if (fileRequest === "/") fileRequest = session ? "/index.html" : "/login.html";
    if (!PUBLIC_PATHS.has(fileRequest) && fileRequest !== "/index.html") {
      sendJson(res, 404, { ok: false, message: "Resource not found." });
      return;
    }
    serveFile(req, res, fileRequest);
  } catch (error) {
    logSecurity("error", "Unhandled server error", { ip: clientIp(req), method: req.method, url: req.url, error: error.stack });
    if (!res.headersSent) sendJson(res, 500, { ok: false, message: "Server error. Please try again." });
    else res.end();
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`SmartOA secured UI running at http://127.0.0.1:${port}`);
  console.log(`Rate limits: auth ${rateConfig.authIpMax}/IP + ${rateConfig.authAccountMax}/account, public ${rateConfig.publicMax}, authenticated ${rateConfig.authenticatedMax}`);
});
