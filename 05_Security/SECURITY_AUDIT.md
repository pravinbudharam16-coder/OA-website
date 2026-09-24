# SmartOA Security Review

## Scope
Reviewed the complete project source, server routes, frontend JavaScript, static assets, data files, helper files, and documentation in this prototype.

## 1. Rate limiting
- Authentication: per-IP and per-account limits with configurable thresholds and exponential backoff.
- Public API: moderate configurable request limit.
- Authenticated API: looser configurable request limit.
- Limits are controlled through environment variables in `.env.example`.
- Rate limiting returns HTTP 429 and does not terminate or crash the server.
- Backoff is bounded by `SMARTOA_AUTH_MAX_BACKOFF_MS`; it is not a permanent lockout.

## 2. Input validation
- `/api/login` accepts a strict JSON object with exactly `username` and `password`.
- Username is validated for type, length and allowed characters.
- Password is validated for type and length before authentication.
- JSON body size is bounded by `SMARTOA_MAX_JSON_BYTES`.
- Content type is checked for the JSON authentication endpoint.
- Session cookie tokens are validated for the expected 64-hex-character format.

## 3. Secrets
- No plaintext API keys, bearer tokens, or passwords are present in frontend assets.
- Demo password strings were removed from documentation and the `_autologin.html` helper was removed.
- `04_Data/users.json` contains password hashes, not plaintext passwords, and is not included in the public static path allowlist.
- `.env` files are ignored by Git; `.env.example` contains configuration names only.

## 4. Dependency vulnerabilities
- The project has no `package.json`, `package-lock.json`, or third-party Node dependency tree.
- The server uses Node.js built-in modules only (`http`, `fs`, `path`, `crypto`).
- Therefore `npm audit` has no project dependency graph to audit. A dependency vulnerability scan should be rerun if third-party packages are added later.

## 5. Error handling and information leakage
- Client responses use generic error messages and do not expose stack traces or internal file paths.
- Detailed server errors are written to `logs/security.log` for debugging.
- Malformed URLs, invalid JSON, oversized bodies, missing resources, and unexpected server errors are handled without terminating the server.
- Static file access is constrained to the project root and an allowlist for public resources.

## 6. File upload safety
- No file upload endpoint or multipart upload functionality exists in this prototype.
- Therefore there is currently no upload storage/execution surface to secure.
- If uploads are added later, validate MIME/content, size, extension, and store files outside the web root with non-executable permissions.

## Operational note
This review intentionally applies the requested security controls without adding behavior that crashes the server or creates a permanent login lockout.
