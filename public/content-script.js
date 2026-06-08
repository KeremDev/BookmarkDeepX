(function initBookmarkDeepXContentScript() {
  const injectedUrl = chrome.runtime.getURL("x-injected.js");
  let injected = false;
  let fullSyncRun = null;

  injectPageBridge();
  sendRuntimeMessage({ type: "BDX_CONTENT_READY" });
  scheduleDomAuthorCapture();

  window.addEventListener("message", (event) => {
    if (event.source !== window || !event.data || event.data.source !== "BookmarkDeepX:page") return;

    if (event.data.type === "BDX_X_CAPTURE") {
      sendRuntimeMessage({
        type: "BDX_CAPTURE_TIMELINE",
        payload: event.data.payload,
        url: event.data.url,
        capturedAt: event.data.capturedAt,
      });
    }

    if (event.data.type === "BDX_X_TEMPLATE") {
      sendRuntimeMessage({
        type: "BDX_STORE_BOOKMARK_TEMPLATE",
        template: event.data.template,
        capturedAt: event.data.capturedAt,
      });
    }

    if (event.data.type === "BDX_X_DELETE_TEMPLATE") {
      sendRuntimeMessage({
        type: "BDX_STORE_DELETE_TEMPLATE",
        template: event.data.template,
        capturedAt: event.data.capturedAt,
      });
    }

    if (event.data.type === "BDX_PAGE_REMOVE_RESULT") {
      sendRuntimeMessage({ type: "BDX_REMOVE_RESULT", result: event.data.result });
    }
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "BDX_REMOVE_BOOKMARK_ON_X") {
      removeBookmark(message)
        .then((result) => sendResponse(result))
        .catch((error) => sendResponse({ ok: false, error: error.message || "X kaldırma hatası" }));

      return true;
    }

    if (message?.type === "BDX_START_FULL_SYNC") {
      startFullSync()
        .then((result) => sendResponse(result))
        .catch((error) => {
          sendRuntimeMessage({ type: "BDX_SYNC_FAILED", error: error.message || "Tam tarama hatası" });
          sendResponse({ ok: false, error: error.message || "Tam tarama hatası" });
        });

      return true;
    }

    if (message?.type === "BDX_EXTRACT_VISIBLE_AUTHORS") {
      const authors = extractDomAuthors();
      if (authors.length) sendRuntimeMessage({ type: "BDX_CAPTURE_DOM_AUTHORS", authors });
      sendResponse({ ok: true, authors });
      return true;
    }

    return false;
  });

  function injectPageBridge() {
    if (injected || document.documentElement?.dataset.bookmarkdeepxInjected === "true") return;
    injected = true;
    document.documentElement.dataset.bookmarkdeepxInjected = "true";

    const script = document.createElement("script");
    script.src = injectedUrl;
    script.async = false;
    script.onload = () => script.remove();
    (document.head || document.documentElement).appendChild(script);
  }

  function sendRuntimeMessage(payload) {
    try {
      const response = chrome.runtime.sendMessage(payload);
      if (response?.catch) response.catch(() => {});
    } catch {
      // The X page can outlive an extension reload during development.
    }
  }

  function scheduleDomAuthorCapture() {
    let timer = null;

    const run = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const authors = extractDomAuthors();
        if (authors.length) sendRuntimeMessage({ type: "BDX_CAPTURE_DOM_AUTHORS", authors });
      }, 450);
    };

    run();

    const observer = new MutationObserver(run);
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  async function removeBookmark({ tweetId, url }) {
    const direct = await requestPageRemove(tweetId);
    if (direct.ok) return direct;

    const dom = await removeBookmarkViaDom(tweetId, url);
    if (dom.ok) return dom;

    return { ok: false, error: direct.error || dom.error || "Bookmark butonu bulunamadı" };
  }

  async function startFullSync() {
    if (!isBookmarkPage()) {
      location.assign("https://x.com/i/bookmarks");
      return { ok: true, navigating: true };
    }

    if (fullSyncRun) {
      return { ok: true, alreadyRunning: true };
    }

    fullSyncRun = runFullSync()
      .catch((error) => {
        sendRuntimeMessage({ type: "BDX_SYNC_FAILED", error: error.message || "Tam tarama başarısız" });
        return { ok: false, error: error.message || "Tam tarama başarısız" };
      })
      .finally(() => {
        fullSyncRun = null;
      });

    return { ok: true, started: true };
  }

  async function runFullSync() {
    sendRuntimeMessage({ type: "BDX_SYNC_PROGRESS", message: "Arka planda bookmarklar taranıyor", step: 0 });

    await waitForBookmarkTimeline();

    const replay = await requestPageBookmarkSync();
    if (replay.ok) {
      await delay(900);
      sendRuntimeMessage({ type: "BDX_SYNC_COMPLETE", steps: replay.pages || 0, mode: "network" });
      return { ok: true, mode: "network", pages: replay.pages || 0 };
    }

    if (document.visibilityState === "visible") {
      sendRuntimeMessage({
        type: "BDX_SYNC_FAILED",
        error: "Network şablonu yok; X bookmark sayfasını bir kez yenileyip tekrar senkronize edin",
      });
      return { ok: false, error: "Network pagination template bulunamadı" };
    }

    window.scrollTo(0, 0);
    await delay(700);

    let stableRounds = 0;
    let lastHeight = 0;
    let lastY = -1;
    let lastArticleFingerprint = "";
    const maxSteps = 180;

    for (let step = 1; step <= maxSteps; step += 1) {
      const height = getDocumentHeight();
      const currentY = Math.round(window.scrollY);
      const articleFingerprint = getArticleFingerprint();
      const nearBottom = currentY + window.innerHeight >= height - 48;
      const unchanged = height === lastHeight && currentY === lastY && articleFingerprint === lastArticleFingerprint;

      if (nearBottom && unchanged) {
        stableRounds += 1;
      } else {
        stableRounds = 0;
      }

      if (step === 1 || step % 5 === 0) {
        sendRuntimeMessage({ type: "BDX_SYNC_PROGRESS", message: "Arka planda bookmarklar taranıyor", step });
      }

      if (stableRounds >= 5) {
        sendRuntimeMessage({ type: "BDX_SYNC_COMPLETE", steps: step });
        return { ok: true, steps: step };
      }

      lastHeight = height;
      lastY = currentY;
      lastArticleFingerprint = articleFingerprint;
      window.scrollBy(0, Math.max(720, Math.floor(window.innerHeight * 0.82)));
      await delay(1100);
    }

    sendRuntimeMessage({ type: "BDX_SYNC_COMPLETE", steps: maxSteps, capped: true });
    return { ok: true, steps: maxSteps, capped: true };
  }

  function requestPageBookmarkSync() {
    return new Promise((resolve) => {
      const requestId = `bdx-sync-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const timeout = window.setTimeout(() => {
        window.removeEventListener("message", listener);
        resolve({ ok: false, error: "Network pagination template bulunamadı" });
      }, 90000);

      function listener(event) {
        if (event.source !== window || event.data?.source !== "BookmarkDeepX:page") return;
        if (event.data.type !== "BDX_PAGE_SYNC_RESULT" || event.data.requestId !== requestId) return;
        window.clearTimeout(timeout);
        window.removeEventListener("message", listener);
        resolve(event.data.result || { ok: false });
      }

      window.addEventListener("message", listener);
      window.postMessage(
        {
          source: "BookmarkDeepX:content",
          type: "BDX_PAGE_SYNC_BOOKMARKS",
          requestId,
          options: { maxPages: 300, delayMs: 550 },
        },
        window.location.origin,
      );
    });
  }

  function requestPageRemove(tweetId) {
    return new Promise((resolve) => {
      const requestId = `bdx-remove-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const timeout = window.setTimeout(() => {
        window.removeEventListener("message", listener);
        resolve({ ok: false, error: "DeleteBookmark template bulunamadı" });
      }, 6000);

      function listener(event) {
        if (event.source !== window || event.data?.source !== "BookmarkDeepX:page") return;
        if (event.data.type !== "BDX_PAGE_REMOVE_RESULT" || event.data.requestId !== requestId) return;
        window.clearTimeout(timeout);
        window.removeEventListener("message", listener);
        resolve(event.data.result || { ok: false });
      }

      window.addEventListener("message", listener);
      window.postMessage(
        {
          source: "BookmarkDeepX:content",
          type: "BDX_PAGE_REMOVE_BOOKMARK",
          requestId,
          tweetId,
        },
        window.location.origin,
      );
    });
  }

  async function removeBookmarkViaDom(tweetId, url) {
    const article = findArticle(tweetId);
    if (article) {
      const button = findBookmarkButton(article);
      if (button) {
        button.click();
        await delay(750);
        return { ok: true, method: "dom-click" };
      }
    }

    return {
      ok: false,
      error: url ? "Bu bookmark mevcut X sayfasında görünmüyor" : "Bookmark DOM hedefi bulunamadı",
    };
  }

  function findArticle(tweetId) {
    const links = [...document.querySelectorAll(`a[href*="/status/${tweetId}"]`)];
    for (const link of links) {
      const article = link.closest("article");
      if (article) return article;
    }
    return document.querySelector("article");
  }

  function findBookmarkButton(root) {
    const buttons = [...root.querySelectorAll("button, [role='button']")];
    return buttons.find((button) => {
      const label = `${button.getAttribute("aria-label") || ""} ${button.textContent || ""}`.toLowerCase();
      const testId = `${button.getAttribute("data-testid") || ""}`.toLowerCase();
      return (
        testId.includes("bookmark") ||
        label.includes("bookmark") ||
        label.includes("yer işareti") ||
        label.includes("kaydedilenlerden kaldır")
      );
    });
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function isBookmarkPage() {
    return /^https:\/\/(x|twitter)\.com\/i\/bookmarks/.test(location.href);
  }

  async function waitForBookmarkTimeline() {
    const startedAt = Date.now();
    while (Date.now() - startedAt < 12000) {
      if (document.querySelector("article") || document.querySelector('[data-testid="cellInnerDiv"]')) return;
      await delay(350);
    }
  }

  function getDocumentHeight() {
    return Math.max(
      document.body?.scrollHeight || 0,
      document.documentElement?.scrollHeight || 0,
      document.body?.offsetHeight || 0,
      document.documentElement?.offsetHeight || 0,
    );
  }

  function getArticleFingerprint() {
    const links = [...document.querySelectorAll('article a[href*="/status/"], [data-testid="cellInnerDiv"] a[href*="/status/"]')]
      .map((link) => link.getAttribute("href"))
      .filter(Boolean);
    return links.slice(-8).join("|");
  }

  function extractDomAuthors() {
    const roots = [...document.querySelectorAll("article, [data-testid='cellInnerDiv']")];
    const byTweet = new Map();

    for (const root of roots) {
      const status = findStatusIdentity(root);
      if (!status?.tweetId) continue;

      const user = readUserIdentity(root, status.handle);
      const handle = user.handle || status.handle;
      if (!handle || handle === "@unknown") continue;

      byTweet.set(status.tweetId, {
        tweetId: status.tweetId,
        handle,
        author: user.author || handle.replace("@", ""),
        avatar: user.avatar || "",
        url: `https://x.com/${handle.replace("@", "")}/status/${status.tweetId}`,
      });
    }

    return [...byTweet.values()];
  }

  function findStatusIdentity(root) {
    const links = [...root.querySelectorAll('a[href*="/status/"]')];
    for (const link of links) {
      const parsed = parseStatusHref(link.getAttribute("href") || link.href || "");
      if (parsed) return parsed;
    }
    return null;
  }

  function parseStatusHref(href) {
    const value = String(href || "");
    const match = value.match(/(?:https?:\/\/(?:x|twitter)\.com)?\/([^/?#]+)\/status\/(\d+)/);
    if (!match) return null;
    const handle = match[1];
    if (!handle || ["i", "intent"].includes(handle)) return { tweetId: match[2], handle: "" };
    return { tweetId: match[2], handle: `@${handle}` };
  }

  function readUserIdentity(root, fallbackHandle) {
    const userBox = root.querySelector('[data-testid="User-Name"]') || root;
    const profileHandle = findProfileHandle(userBox) || fallbackHandle || "";
    const handleText = readHandleText(userBox) || profileHandle;
    const handle = handleText ? `@${handleText.replace(/^@/, "")}` : "";
    const author = readAuthorName(userBox, handle);
    const avatar = root.querySelector('img[src*="profile_images"]')?.src || "";

    return { author, handle, avatar };
  }

  function findProfileHandle(root) {
    const links = [...root.querySelectorAll('a[href^="/"], a[href^="https://x.com/"], a[href^="https://twitter.com/"]')];
    for (const link of links) {
      const href = link.getAttribute("href") || link.href || "";
      if (href.includes("/status/")) continue;
      const match = href.match(/(?:https?:\/\/(?:x|twitter)\.com)?\/([^/?#]+)/);
      if (!match) continue;
      const handle = match[1];
      if (["i", "home", "explore", "notifications", "messages", "search"].includes(handle)) continue;
      return `@${handle}`;
    }
    return "";
  }

  function readHandleText(root) {
    const texts = [...root.querySelectorAll("span, a")]
      .map((node) => normalizeText(node.textContent))
      .filter(Boolean);
    const handle = texts.find((text) => /^@[A-Za-z0-9_]{1,20}$/.test(text));
    return handle || "";
  }

  function readAuthorName(root, handle) {
    const handleValue = handle.replace(/^@/, "").toLowerCase();
    const texts = [...root.querySelectorAll("span")]
      .map((node) => normalizeText(node.textContent))
      .filter(Boolean);

    const value =
      texts.find((text) => {
        const normalized = text.replace(/^@/, "").toLowerCase();
        return (
          text !== "·" &&
          !text.startsWith("@") &&
          normalized !== handleValue &&
          !/^\d/.test(text) &&
          !/^(bugün|dün|\d+s|\d+d|\d+sa|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)$/i.test(text)
        );
      }) || "";

    if (handle && value.includes(handle)) {
      return value.split(handle)[0].trim();
    }

    return value;
  }

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }
})();
