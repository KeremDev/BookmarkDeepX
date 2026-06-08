importScripts("x-parser.js");

const BOOKMARKS_KEY = "bookmarkdeepx.workspace.v1";
const FOLDERS_KEY = "bookmarkdeepx.folders.v1";
const SYNC_KEY = "bookmarkdeepx.sync.v1";
const AUTO_SYNC_KEY = "bookmarkdeepx.autoSync.v1";
const BOOKMARK_TEMPLATE_KEY = "bookmarkdeepx.bookmarkTemplate.v1";
const DELETE_TEMPLATE_KEY = "bookmarkdeepx.deleteTemplate.v1";
const DEFAULT_FOLDERS = ["Design", "Research", "Product", "Personal", "Moodboard"];
let backgroundSyncRunning = false;

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL("index.html") });
});

chrome.runtime.onInstalled.addListener(async () => {
  await ensureFolderSeed();
  await setSyncStatus({ state: "idle", message: "X bookmark sayfası bekleniyor" });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then((response) => sendResponse(response))
    .catch((error) => {
      console.error("[BookmarkDeepX] message error", error);
      sendResponse({ ok: false, error: error.message || "Bilinmeyen hata" });
    });
  return true;
});

async function handleMessage(message, sender) {
  if (!message || !message.type) return { ok: false, error: "Mesaj tipi yok" };

  if (message.type === "BDX_CAPTURE_TIMELINE") {
    return captureTimeline(message, sender);
  }

  if (message.type === "BDX_STORE_BOOKMARK_TEMPLATE") {
    await storeBookmarkTemplate(message.template, sender.tab?.id || null);
    return { ok: true };
  }

  if (message.type === "BDX_STORE_DELETE_TEMPLATE") {
    await storeDeleteTemplate(message.template, sender.tab?.id || null);
    return { ok: true };
  }

  if (message.type === "BDX_OPEN_X_BOOKMARKS") {
    const backgroundSync = await startBackgroundSyncFromStoredTemplate();
    if (backgroundSync.ok) return backgroundSync;

    const tab = await findExistingXBookmarkTab();
    if (tab?.id) {
      await setAutoSyncRequest(tab.id);
      const started = await startFullSync(tab.id);
      return { ok: true, tabId: tab.id, fullSync: started, usingExistingTab: true };
    }

    await setSyncStatus({
      state: "needs_x_tab",
      message: "Arka plan sync için X bookmark sayfasını bir kez aç",
      missingTemplate: true,
    });
    return {
      ok: false,
      missingTemplate: true,
      error: "Arka plan sync için X bookmark sayfasını bir kez açıp tekrar deneyin",
    };
  }

  if (message.type === "BDX_OPEN_X_BOOKMARKS_VISIBLE") {
    const tab = await openOrFocusXBookmarks();
    return { ok: true, tabId: tab.id };
  }

  if (message.type === "BDX_REMOVE_BOOKMARK") {
    return removeBookmarkFromX(message.bookmark);
  }

  if (message.type === "BDX_GET_SYNC_STATUS") {
    return { ok: true, status: await getSyncStatus() };
  }

  if (message.type === "BDX_CAPTURE_DOM_AUTHORS") {
    const updated = await applyAuthorPatches(message.authors || []);
    return { ok: true, updated };
  }

  if (message.type === "BDX_CONTENT_READY") {
    const tabId = sender.tab?.id || null;
    await setSyncStatus({ state: "ready", message: "X sayfası hazır", tabId });
    await maybeStartPendingSync(sender.tab);
    return { ok: true };
  }

  if (message.type === "BDX_SYNC_PROGRESS") {
    const total = (await getBookmarks()).length;
    const now = Date.now();
    await setSyncStatus({
      state: "full_sync",
      message: total ? `Arka planda taranıyor · ${total} bookmark` : message.message || "Arka planda taranıyor",
      tabId: sender.tab?.id || null,
      step: message.step || 0,
      total,
      phase: "scroll_fallback",
      lastProgressAt: now,
      updatedAt: now,
    });
    return { ok: true };
  }

  if (message.type === "BDX_SYNC_COMPLETE") {
    const total = (await getBookmarks()).length;
    const completedAt = Date.now();
    await clearAutoSyncRequest(sender.tab?.id);
    await setSyncStatus({
      state: "complete",
      message: `Tam tarama tamamlandı · ${total} bookmark`,
      tabId: sender.tab?.id || null,
      total,
      steps: message.steps || 0,
      mode: message.mode || "content",
      lastProgressAt: completedAt,
      completedAt,
    });
    return { ok: true, total };
  }

  if (message.type === "BDX_SYNC_FAILED") {
    await clearAutoSyncRequest(sender.tab?.id);
    await setSyncStatus({
      state: "failed",
      message: message.error || "Tam tarama başarısız",
      tabId: sender.tab?.id || null,
      failedAt: Date.now(),
    });
    return { ok: true };
  }

  if (message.type === "BDX_REMOVE_RESULT") {
    return { ok: true };
  }

  return { ok: false, error: `Desteklenmeyen mesaj: ${message.type}` };
}

async function captureTimeline(message, sender) {
  const parsed = self.BookmarkDeepXParser.parseBookmarkPayload(message.payload, {
    sourceUrl: message.url,
    capturedAt: message.capturedAt,
  });

  if (!parsed.bookmarks.length) {
    const total = (await getBookmarks()).length;
    const now = Date.now();
    await setSyncStatus({
      state: "watching",
      message: total ? `Taranıyor · ${total} bookmark kaydedildi` : "X bookmark isteği yakalandı, bookmark bulunamadı",
      tabId: sender.tab?.id || null,
      count: total,
      lastBatchCount: 0,
      newCount: 0,
      lastProgressAt: now,
      lastCaptureAt: now,
    });
    return { ok: true, count: 0 };
  }

  const current = await getBookmarks();
  const beforeKeys = new Set(current.map((item) => item.tweetId || item.id));
  const newCount = parsed.bookmarks.filter((item) => !beforeKeys.has(item.tweetId || item.id)).length;
  const merged = mergeBookmarks(current, parsed.bookmarks);
  await setBookmarks(merged);
  await rememberFolders(merged.map((item) => item.folder).filter(Boolean));
  const now = Date.now();
  await setSyncStatus({
    state: "capturing",
    message: newCount > 0 ? `${merged.length} bookmark kaydedildi` : `${merged.length} bookmark güncel`,
    count: merged.length,
    lastBatchCount: parsed.bookmarks.length,
    newCount,
    cursor: parsed.cursor || null,
    tabId: sender.tab?.id || null,
    lastProgressAt: now,
    lastCaptureAt: now,
  });

  return { ok: true, count: parsed.bookmarks.length, total: merged.length, cursor: parsed.cursor || null };
}

function mergeBookmarks(current, incoming) {
  const byId = new Map(current.map((item) => [item.tweetId || item.id, item]));

  for (const captured of incoming) {
    const key = captured.tweetId || captured.id;
    const existing = byId.get(key);
    const capturedHasUser = hasKnownUser(captured);
    const existingHasUser = hasKnownUser(existing);

    byId.set(key, {
      ...captured,
      ...(existing || {}),
      ...captured,
      author: capturedHasUser ? captured.author : existingHasUser ? existing.author : captured.author,
      handle: capturedHasUser ? captured.handle : existingHasUser ? existing.handle : captured.handle,
      avatar: captured.avatar || existing?.avatar || "",
      url: capturedHasUser ? captured.url : existing?.url || captured.url,
      title: existing?.title ?? existing?.localTitle ?? captured.title ?? "",
      localTitle: existing?.localTitle ?? existing?.title ?? captured.localTitle ?? "",
      tags: existing?.tags || captured.tags || [],
      folder: existing?.folder ?? existing?.localFolder ?? captured.folder ?? "",
      localFolder: existing?.localFolder ?? existing?.folder ?? captured.localFolder ?? "",
      task: existing?.task || captured.task || { title: "", done: false, due: "" },
      syncState: existing?.syncState === "pending_remove" ? "pending_remove" : "synced",
      lastSeenAt: new Date().toISOString(),
      lastSyncedAt: new Date().toISOString(),
    });
  }

  return [...byId.values()].filter((item) => item.syncState !== "removed");
}

async function startBackgroundSyncFromStoredTemplate() {
  const template = await getBookmarkTemplate();
  if (!template?.url) return { ok: false, missingTemplate: true };
  if (backgroundSyncRunning) return { ok: true, alreadyRunning: true };

  backgroundSyncRunning = true;
  syncFromBookmarkTemplate(template)
    .catch(async (error) => {
      await setSyncStatus({
        state: "failed",
        message: error.message || "Arka plan sync başarısız",
        failedAt: Date.now(),
      });
    })
    .finally(() => {
      backgroundSyncRunning = false;
    });

  return { ok: true, background: true };
}

async function syncFromBookmarkTemplate(template) {
  const startedAt = Date.now();
  await setSyncStatus({
    state: "full_sync",
    message: "Arka planda senkronize ediliyor",
    total: (await getBookmarks()).length,
    pages: 0,
    phase: "starting",
    startedAt,
    lastProgressAt: startedAt,
  });

  const seenCursors = new Set();
  let cursor = null;
  let pages = 0;
  const maxPages = 500;

  for (let index = 0; index < maxPages; index += 1) {
    const request = buildBookmarkTemplateRequest(template, cursor);
    const response = await fetch(request.url, {
      method: request.method,
      credentials: "include",
      headers: request.headers,
      body: request.body,
    });

    if (!response.ok) {
      throw new Error(`X bookmark request ${response.status}`);
    }

    const payload = await response.json();
    const parsed = self.BookmarkDeepXParser.parseBookmarkPayload(payload, {
      sourceUrl: request.url,
      capturedAt: new Date().toISOString(),
    });

    pages += 1;

    const current = await getBookmarks();
    const beforeKeys = new Set(current.map((item) => item.tweetId || item.id));
    const newCount = parsed.bookmarks.filter((item) => !beforeKeys.has(item.tweetId || item.id)).length;
    let total = current.length;

    if (parsed.bookmarks.length) {
      const merged = mergeBookmarks(current, parsed.bookmarks);
      await setBookmarks(merged);
      await rememberFolders(merged.map((item) => item.folder).filter(Boolean));
      total = merged.length;
    }

    const now = Date.now();
    await setSyncStatus({
      state: "full_sync",
      message: `Arka planda senkronize ediliyor · ${total}`,
      total,
      pages,
      lastBatchCount: parsed.bookmarks.length,
      newCount,
      cursor: parsed.cursor || null,
      phase: parsed.cursor ? "page_complete" : "finishing",
      startedAt,
      lastProgressAt: now,
    });

    if (!parsed.cursor || seenCursors.has(parsed.cursor)) break;
    seenCursors.add(parsed.cursor);
    cursor = parsed.cursor;
    await delay(450);
  }

  const total = (await getBookmarks()).length;
  const unknownCount = (await getBookmarks()).filter((bookmark) => !hasKnownUser(bookmark)).length;
  const completedAt = Date.now();
  await setSyncStatus({
    state: "complete",
    message: unknownCount ? `Senkron tamamlandı · ${unknownCount} yazar eksik` : `Senkron tamamlandı · ${total}`,
    total,
    unknownCount,
    pages,
    startedAt,
    lastProgressAt: completedAt,
    completedAt,
    durationMs: completedAt - startedAt,
  });
}

function buildBookmarkTemplateRequest(template, cursor) {
  const method = String(template.method || "GET").toUpperCase();
  const url = new URL(template.url);
  let body = template.body || "";

  if (url.searchParams.has("variables")) {
    const variables = parseJson(url.searchParams.get("variables")) || {};
    if (cursor) variables.cursor = cursor;
    url.searchParams.set("variables", JSON.stringify(variables));
  } else if (body) {
    const parsed = parseJson(body) || {};
    parsed.variables = parsed.variables || {};
    if (cursor) parsed.variables.cursor = cursor;
    body = JSON.stringify(parsed);
  }

  return {
    url: url.toString(),
    method,
    headers: {
      ...sanitizeHeaders(template.headers || {}),
      ...(method !== "GET" && body ? { "content-type": "application/json" } : {}),
    },
    body: method === "GET" ? undefined : body,
  };
}

function parseJson(value) {
  try {
    return JSON.parse(value || "{}");
  } catch {
    return null;
  }
}

function hasKnownUser(bookmark) {
  if (!bookmark) return false;
  return Boolean(
    bookmark.author &&
      bookmark.handle &&
      bookmark.author !== "unknown" &&
      bookmark.handle !== "@unknown" &&
      !bookmark.handle.endsWith("/unknown"),
  );
}

async function applyAuthorPatches(authors) {
  const useful = (Array.isArray(authors) ? authors : []).filter((author) => hasKnownUser(author) && author.tweetId);
  if (!useful.length) return 0;

  const patches = new Map(useful.map((author) => [String(author.tweetId), author]));
  const bookmarks = await getBookmarks();
  let updated = 0;

  const next = bookmarks.map((bookmark) => {
    const key = String(bookmark.tweetId || bookmark.id);
    const patch = patches.get(key);
    if (!patch) return bookmark;

    const shouldUpdate = !hasKnownUser(bookmark) || bookmark.author !== patch.author || bookmark.handle !== patch.handle;
    if (!shouldUpdate) return bookmark;

    updated += 1;
    return {
      ...bookmark,
      author: patch.author,
      handle: patch.handle,
      avatar: patch.avatar || bookmark.avatar || "",
      url: patch.url || `https://x.com/${patch.handle.replace("@", "")}/status/${key}`,
      lastAuthorResolvedAt: new Date().toISOString(),
    };
  });

  if (updated > 0) await setBookmarks(next);
  return updated;
}

async function storeBookmarkTemplate(template, tabId) {
  if (!template?.url || !String(template.url).includes("/i/api/graphql/")) return false;

  await chrome.storage.local.set({
    [BOOKMARK_TEMPLATE_KEY]: {
      url: template.url,
      method: template.method || "GET",
      headers: sanitizeHeaders(template.headers || {}),
      body: template.body || "",
      tabId,
      capturedAt: new Date().toISOString(),
    },
  });

  return true;
}

async function getBookmarkTemplate() {
  const result = await chrome.storage.local.get(BOOKMARK_TEMPLATE_KEY);
  return result[BOOKMARK_TEMPLATE_KEY] || null;
}

async function storeDeleteTemplate(template, tabId) {
  if (!template?.url || !String(template.url).includes("/i/api/graphql/")) return false;

  const body = template.body || "";
  if (!String(template.url).includes("DeleteBookmark") && !String(body).includes("DeleteBookmark")) return false;

  await chrome.storage.local.set({
    [DELETE_TEMPLATE_KEY]: {
      url: template.url,
      method: template.method || "POST",
      headers: sanitizeHeaders(template.headers || {}),
      body,
      tabId,
      capturedAt: new Date().toISOString(),
    },
  });

  return true;
}

async function getDeleteTemplate() {
  const result = await chrome.storage.local.get(DELETE_TEMPLATE_KEY);
  return result[DELETE_TEMPLATE_KEY] || null;
}

function sanitizeHeaders(headers) {
  const clean = {};

  for (const [key, value] of Object.entries(headers || {})) {
    const lower = key.toLowerCase();
    if (
      [
        "cookie",
        "content-length",
        "host",
        "origin",
        "referer",
        "sec-fetch-dest",
        "sec-fetch-mode",
        "sec-fetch-site",
      ].includes(lower)
    ) {
      continue;
    }
    clean[key] = value;
  }

  return clean;
}

async function findExistingXBookmarkTab() {
  const tabs = await chrome.tabs.query({ url: ["https://x.com/i/bookmarks*", "https://twitter.com/i/bookmarks*"] });
  return tabs[0] || null;
}

function sendTabMessage(tabId, message) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      resolve(response || { ok: true });
    });
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function removeBookmarkFromX(bookmark) {
  if (!bookmark?.tweetId && !bookmark?.id) {
    return { ok: false, error: "Bookmark tweet id eksik" };
  }

  const tweetId = bookmark.tweetId || bookmark.id;
  await markBookmarkState(tweetId, "pending_remove");

  const templateResult = await removeBookmarkWithStoredTemplate(tweetId);
  if (templateResult.ok) {
    await deleteBookmarkLocal(tweetId);
    return { ok: true, method: templateResult.method || "background-template" };
  }

  const tabs = await chrome.tabs.query({ url: ["https://x.com/*", "https://twitter.com/*"] });
  let lastError = templateResult.error || null;

  for (const tab of tabs) {
    try {
      const response = await chrome.tabs.sendMessage(tab.id, {
        type: "BDX_REMOVE_BOOKMARK_ON_X",
        tweetId,
        url: bookmark.url || `https://x.com/i/status/${tweetId}`,
      });

      if (response?.ok) {
        await deleteBookmarkLocal(tweetId);
        return { ok: true };
      }

      lastError = response?.error || response?.reason || "X sekmesi kaldırmayı tamamlayamadı";
    } catch (error) {
      lastError = error.message;
    }
  }

  await markBookmarkState(tweetId, "failed");
  return {
    ok: false,
    error: lastError || "X kaldırma bağlantısı hazır değil. X bookmark sayfasını bir kez açık tutup tekrar deneyin.",
  };
}

async function removeBookmarkWithStoredTemplate(tweetId) {
  const template = await getDeleteTemplate();
  if (!template?.url) return { ok: false, error: "DeleteBookmark template yok" };

  try {
    const request = buildDeleteTemplateRequest(template, tweetId);
    const response = await fetch(request.url, {
      method: request.method,
      credentials: "include",
      headers: request.headers,
      body: request.body,
    });

    if (!response.ok) {
      return { ok: false, status: response.status, error: `DeleteBookmark request ${response.status}` };
    }

    return { ok: true, status: response.status, method: "background-template" };
  } catch (error) {
    return { ok: false, error: error.message || "Arka plan kaldırma başarısız" };
  }
}

function buildDeleteTemplateRequest(template, tweetId) {
  const method = String(template.method || "POST").toUpperCase();
  const url = new URL(template.url);
  let body = template.body || "";

  if (url.searchParams.has("variables")) {
    const variables = parseJson(url.searchParams.get("variables")) || {};
    rewriteDeleteVariables(variables, tweetId);
    url.searchParams.set("variables", JSON.stringify(variables));
  } else {
    body = rewriteDeleteBookmarkBody(body, tweetId);
  }

  return {
    url: url.toString(),
    method,
    headers: {
      ...sanitizeHeaders(template.headers || {}),
      ...(method !== "GET" ? { "content-type": "application/json" } : {}),
    },
    body: method === "GET" ? undefined : body,
  };
}

function rewriteDeleteBookmarkBody(bodyText, tweetId) {
  const parsed = parseJson(bodyText) || {};
  parsed.variables = parsed.variables || {};
  rewriteDeleteVariables(parsed.variables, tweetId);
  return JSON.stringify(parsed);
}

function rewriteDeleteVariables(variables, tweetId) {
  for (const key of ["tweet_id", "tweetId", "id", "tweetID"]) {
    if (key in variables) variables[key] = tweetId;
  }

  if (!("tweet_id" in variables) && !("tweetId" in variables) && !("id" in variables)) {
    variables.tweet_id = tweetId;
  }
}

async function openOrFocusXBookmarks() {
  const existing = await chrome.tabs.query({ url: ["https://x.com/i/bookmarks*", "https://twitter.com/i/bookmarks*"] });
  if (existing[0]?.id) {
    await chrome.tabs.update(existing[0].id, { active: true });
    return existing[0];
  }
  return chrome.tabs.create({ url: "https://x.com/i/bookmarks", active: true });
}

async function startFullSync(tabId) {
  if (!tabId) return { ok: false, queued: true };

  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: "BDX_START_FULL_SYNC" });
    if (response?.ok) {
      await setSyncStatus({ state: "full_sync", message: "Tüm bookmarklar taranıyor", tabId });
      return { ok: true, started: true };
    }
    await setSyncStatus({
      state: "opening",
      message: response?.error || "X sayfası yükleniyor; tarama otomatik başlayacak",
      tabId,
    });
    return { ok: true, queued: true };
  } catch {
    await setSyncStatus({ state: "needs_x_tab", message: "X bookmark sayfasını yenileyip tekrar deneyin", tabId });
    return { ok: false, needsReload: true };
  }
}

async function setAutoSyncRequest(tabId) {
  await chrome.storage.local.set({
    [AUTO_SYNC_KEY]: {
      tabId,
      requestedAt: Date.now(),
    },
  });
}

async function getAutoSyncRequest() {
  const result = await chrome.storage.local.get(AUTO_SYNC_KEY);
  return result[AUTO_SYNC_KEY] || null;
}

async function clearAutoSyncRequest(tabId) {
  const request = await getAutoSyncRequest();
  if (!request) return;
  if (tabId && request.tabId && request.tabId !== tabId) return;
  await chrome.storage.local.remove(AUTO_SYNC_KEY);
}

async function maybeStartPendingSync(tab) {
  if (!tab?.id || !isBookmarkTab(tab.url)) return;

  const request = await getAutoSyncRequest();
  if (!request) return;

  const isFresh = Date.now() - request.requestedAt < 2 * 60 * 1000;
  const matchesTab = !request.tabId || request.tabId === tab.id;
  if (!isFresh || !matchesTab) {
    await clearAutoSyncRequest(request.tabId);
    return;
  }

  await startFullSync(tab.id);
}

function isBookmarkTab(url) {
  return /https:\/\/(x|twitter)\.com\/i\/bookmarks/.test(String(url || ""));
}

async function markBookmarkState(tweetId, syncState) {
  const bookmarks = await getBookmarks();
  await setBookmarks(bookmarks.map((item) => ((item.tweetId || item.id) === tweetId ? { ...item, syncState } : item)));
}

async function deleteBookmarkLocal(tweetId) {
  const bookmarks = await getBookmarks();
  await setBookmarks(bookmarks.filter((item) => (item.tweetId || item.id) !== tweetId));
}

async function getBookmarks() {
  const result = await chrome.storage.local.get(BOOKMARKS_KEY);
  return Array.isArray(result[BOOKMARKS_KEY]) ? result[BOOKMARKS_KEY] : [];
}

async function setBookmarks(bookmarks) {
  await chrome.storage.local.set({ [BOOKMARKS_KEY]: bookmarks });
}

async function ensureFolderSeed() {
  const result = await chrome.storage.local.get(FOLDERS_KEY);
  const current = Array.isArray(result[FOLDERS_KEY]) ? result[FOLDERS_KEY] : [];
  await chrome.storage.local.set({ [FOLDERS_KEY]: [...new Set([...DEFAULT_FOLDERS, ...current])] });
}

async function rememberFolders(folders) {
  const result = await chrome.storage.local.get(FOLDERS_KEY);
  const current = Array.isArray(result[FOLDERS_KEY]) ? result[FOLDERS_KEY] : [];
  await chrome.storage.local.set({ [FOLDERS_KEY]: [...new Set([...DEFAULT_FOLDERS, ...current, ...folders])] });
}

async function getSyncStatus() {
  const result = await chrome.storage.local.get(SYNC_KEY);
  return result[SYNC_KEY] || { state: "idle", message: "X bookmark sayfası bekleniyor" };
}

async function setSyncStatus(status) {
  await chrome.storage.local.set({
    [SYNC_KEY]: {
      ...status,
      updatedAt: Date.now(),
    },
  });
}
