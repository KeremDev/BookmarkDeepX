# Contributing

Thanks for helping improve BookmarkDeepX.

## Local Setup

```bash
npm ci
npm run dev
```

Open the Vite URL for UI work. To test the Chrome extension build:

```bash
npm test
npm run build
npm run package:extension
```

Then open `chrome://extensions`, enable Developer Mode, choose **Load unpacked**, and select the generated `dist` folder.

## Pull Requests

- Keep changes focused and small.
- Run `npm test` and `npm run build` before opening a PR.
- Update README or docs when behavior changes.
- Do not add network services, analytics, or telemetry without a clear proposal and privacy review.

## Code Style

- Follow the existing React and plain CSS style.
- Keep extension code local-first.
- Prefer small helpers over broad abstractions.
- Keep X-specific parsing isolated from the UI.
