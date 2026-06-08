# Security Policy

## Supported Version

Security updates target the latest public release.

## Reporting a Vulnerability

Please report security issues through GitHub Issues only if the report does not expose sensitive details. For sensitive reports, open a minimal issue asking for a private contact path.

## Privacy Model

BookmarkDeepX is local-first:

- It does not use the X API.
- It does not run a backend service.
- It does not send bookmark data to an external server.
- Bookmark metadata is stored in Chrome local storage on the user's device.

The extension observes X web requests in the user's active browser session to capture bookmark data and to remove bookmarks when requested by the user.
