import {
  AlertCircle,
  ArrowDownUp,
  Bookmark,
  BookmarkMinus,
  Check,
  CheckSquare,
  ChevronDown,
  Circle,
  Clock3,
  Database,
  Download,
  ExternalLink,
  FileDown,
  Folder,
  Heart,
  Image,
  Info,
  Link,
  ListChecks,
  Loader2,
  MessageCircle,
  Moon,
  Radio,
  PlayCircle,
  Repeat2,
  Search,
  Settings,
  Sparkles,
  Tag,
  Trash,
  Trash2,
  Upload,
  Video,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  LANGUAGE_OPTIONS,
  formatMessage,
  getDefaultLanguage,
  getDictionary,
  getLocalizedFolderName,
} from "./i18n.js";

const STORAGE_KEY = "bookmarkdeepx.workspace.v1";
const FOLDERS_STORAGE_KEY = "bookmarkdeepx.folders.v1";
const SYNC_STORAGE_KEY = "bookmarkdeepx.sync.v1";
const SETTINGS_STORAGE_KEY = "bookmarkdeepx.settings.v1";
const DEFAULT_FOLDERS = ["Design", "Research", "Product", "Personal", "Moodboard"];
const DEFAULT_SYNC_STATUS = { state: "idle", message: "X bookmark sayfası bekleniyor" };
const DEFAULT_SETTINGS = {
  autoSync: false,
  debugMode: false,
  theme: "dark",
  density: "comfortable",
  language: getDefaultLanguage(),
};

const categoryThemes = {
  Design: { bg: "rgba(56, 189, 248, 0.14)", border: "rgba(56, 189, 248, 0.42)", color: "#9be3ff" },
  Research: { bg: "rgba(168, 85, 247, 0.14)", border: "rgba(168, 85, 247, 0.42)", color: "#d8b4fe" },
  Product: { bg: "rgba(52, 211, 153, 0.14)", border: "rgba(52, 211, 153, 0.42)", color: "#a7f3d0" },
  Personal: { bg: "rgba(251, 191, 36, 0.14)", border: "rgba(251, 191, 36, 0.42)", color: "#fde68a" },
  Moodboard: { bg: "rgba(244, 114, 182, 0.14)", border: "rgba(244, 114, 182, 0.42)", color: "#fbcfe8" },
  "Kategorisiz": { bg: "rgba(148, 163, 184, 0.11)", border: "rgba(148, 163, 184, 0.28)", color: "#cbd5e1" },
};

function getCategoryTheme(category) {
  return categoryThemes[category || "Kategorisiz"] || {
    bg: "rgba(96, 165, 250, 0.13)",
    border: "rgba(96, 165, 250, 0.36)",
    color: "#bfdbfe",
  };
}

function getCategoryStyle(category) {
  const theme = getCategoryTheme(category);
  return {
    "--category-bg": theme.bg,
    "--category-border": theme.border,
    "--category-color": theme.color,
  };
}

function getProfileUrl(handle) {
  return `https://x.com/${handle.replace(/^@/, "")}`;
}

const initialBookmarks = [
  {
    id: "bm_01",
    author: "Mert Can",
    handle: "@mertbuilds",
    date: "Bugün",
    createdAt: "2026-06-07T08:45:00",
    type: "image",
    title: "Uzay görseli referansı",
    text: "Great product interfaces do not shout. They help the user move faster without asking for attention first.",
    tags: ["ui", "inspiration"],
    folder: "Design",
    task: { title: "Kart yoğunluğunu kıyasla", done: false, due: "2026-06-09" },
    media: {
      src: "/media/orbit.png",
      alt: "Earth horizon from space",
      shape: "landscape",
    },
    metrics: { reply: 42, repost: 128, like: "1.2K" },
    popularity: 1200,
    url: "https://x.com/i/bookmarks",
    syncState: "synced",
  },
  {
    id: "bm_02",
    author: "Selin",
    handle: "@selinwrites",
    date: "2s",
    createdAt: "2026-06-07T07:16:00",
    type: "text",
    title: "",
    text: "Building in public is the best way to build in public.",
    tags: ["quote"],
    folder: "",
    task: { title: "", done: false, due: "" },
    metrics: { reply: 42, repost: 128, like: "1.2K" },
    popularity: 912,
    url: "https://x.com/i/bookmarks",
    syncState: "synced",
  },
  {
    id: "bm_03",
    author: "Arda Labs",
    handle: "@ardalabs",
    date: "Dün",
    createdAt: "2026-06-06T17:20:00",
    type: "image",
    title: "Dağ kompozisyonu",
    text: "A save-worthy visual rhythm: large image, tight copy, clear action affordance.",
    tags: ["visual"],
    folder: "Moodboard",
    task: { title: "", done: false, due: "" },
    media: {
      src: "/media/mountains.png",
      alt: "Mountain landscape",
      shape: "portrait",
    },
    metrics: { reply: 18, repost: 77, like: 640 },
    popularity: 640,
    url: "https://x.com/i/bookmarks",
    syncState: "synced",
  },
  {
    id: "bm_04",
    author: "Nora",
    handle: "@nora_motion",
    date: "5 Haz",
    createdAt: "2026-06-05T11:05:00",
    type: "video",
    title: "Video bookmark örneği",
    text: "Micro-interactions should feel like the interface has good manners.",
    tags: ["motion", "video"],
    folder: "Research",
    task: { title: "Animasyon notlarını çıkar", done: false, due: "2026-06-10" },
    media: {
      src: "/media/wave.png",
      alt: "Abstract dark wave",
      shape: "landscape",
    },
    metrics: { reply: 12, repost: 41, like: 384 },
    popularity: 384,
    url: "https://x.com/i/bookmarks",
    syncState: "synced",
  },
  {
    id: "bm_05",
    author: "X Product Notes",
    handle: "@productnotes",
    date: "4 Haz",
    createdAt: "2026-06-04T20:10:00",
    type: "image",
    title: "",
    text: "A private archive needs fast triage: save now, name later, find instantly.",
    tags: [],
    folder: "",
    task: { title: "", done: false, due: "" },
    media: {
      src: "/media/chair.png",
      alt: "Dark chair in a quiet room",
      shape: "landscape",
    },
    metrics: { reply: 8, repost: 23, like: 190 },
    popularity: 190,
    url: "https://x.com/i/bookmarks",
    syncState: "synced",
  },
  {
    id: "bm_06",
    author: "Deniz",
    handle: "@denizops",
    date: "3 Haz",
    createdAt: "2026-06-03T14:30:00",
    type: "text",
    title: "Görev fikri",
    text: "The best time to plant a tree was 20 years ago. The second best time is now.",
    tags: ["todo"],
    folder: "Personal",
    task: { title: "Hafta sonu tekrar oku", done: true, due: "2026-06-12" },
    metrics: { reply: 23, repost: 67, like: 512 },
    popularity: 512,
    url: "https://x.com/i/bookmarks",
    syncState: "synced",
  },
  {
    id: "bm_07",
    author: "Kerem",
    handle: "@keremux",
    date: "1 Haz",
    createdAt: "2026-06-01T09:35:00",
    type: "image",
    title: "Şehir gece kartı",
    text: "Collections should behave like muscle memory: filter, act, return to flow.",
    tags: ["systems", "ux"],
    folder: "Product",
    task: { title: "", done: false, due: "" },
    media: {
      src: "/media/city.png",
      alt: "City skyline at night",
      shape: "landscape",
    },
    metrics: { reply: 19, repost: 88, like: 732 },
    popularity: 732,
    url: "https://x.com/i/bookmarks",
    syncState: "synced",
  },
  {
    id: "bm_08",
    author: "Interface Index",
    handle: "@interfaceindex",
    date: "31 May",
    createdAt: "2026-05-31T12:02:00",
    type: "text",
    title: "",
    text: "A command surface should be compact enough to disappear, powerful enough to replace a sidebar.",
    tags: ["layout"],
    folder: "",
    task: { title: "", done: false, due: "" },
    metrics: { reply: 7, repost: 31, like: 286 },
    popularity: 286,
    url: "https://x.com/i/bookmarks",
    syncState: "synced",
  },
];

function getChromeApi() {
  return typeof globalThis !== "undefined" ? globalThis.chrome : undefined;
}

function hasExtensionStorage() {
  return Boolean(getChromeApi()?.storage?.local);
}

function hasExtensionRuntime() {
  return Boolean(getChromeApi()?.runtime?.sendMessage);
}

function readLocalJson(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocalJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be unavailable in restricted preview contexts.
  }
}

function getExtensionValue(key, fallback) {
  const api = getChromeApi();
  if (!api?.storage?.local) return Promise.resolve(fallback);

  return new Promise((resolve) => {
    api.storage.local.get(key, (result) => {
      if (api.runtime?.lastError) {
        resolve(fallback);
        return;
      }
      resolve(result?.[key] ?? fallback);
    });
  });
}

function setExtensionValue(key, value) {
  const api = getChromeApi();
  if (!api?.storage?.local) return Promise.resolve();

  return new Promise((resolve) => {
    api.storage.local.set({ [key]: value }, () => resolve());
  });
}

function sendExtensionMessage(message) {
  const api = getChromeApi();
  if (!api?.runtime?.sendMessage) return Promise.resolve({ ok: false, error: "Extension runtime yok" });

  return new Promise((resolve) => {
    api.runtime.sendMessage(message, (response) => {
      const error = api.runtime.lastError;
      if (error) {
        resolve({ ok: false, error: error.message });
        return;
      }
      resolve(response || { ok: true });
    });
  });
}

function baseFolderList(extraFolders = []) {
  return [...new Set([...DEFAULT_FOLDERS, ...initialBookmarks.map((item) => item.folder).filter(Boolean), ...extraFolders])];
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function useStoredBookmarks() {
  const [bookmarks, setBookmarks] = useState(() => readLocalJson(STORAGE_KEY, initialBookmarks));
  const [storageReady, setStorageReady] = useState(() => !hasExtensionStorage());

  useEffect(() => {
    const api = getChromeApi();
    if (!api?.storage?.local) return undefined;

    let mounted = true;

    getExtensionValue(STORAGE_KEY, null).then((saved) => {
      if (!mounted) return;
      const nextBookmarks = Array.isArray(saved) && saved.length ? saved : initialBookmarks;
      setBookmarks(nextBookmarks);
      setStorageReady(true);
      if (!Array.isArray(saved) || !saved.length) {
        setExtensionValue(STORAGE_KEY, nextBookmarks);
      }
    });

    const listener = (changes, areaName) => {
      if (areaName !== "local" || !changes[STORAGE_KEY]) return;
      const nextBookmarks = changes[STORAGE_KEY].newValue;
      if (Array.isArray(nextBookmarks)) setBookmarks(nextBookmarks);
    };

    api.storage.onChanged.addListener(listener);
    return () => {
      mounted = false;
      api.storage.onChanged.removeListener(listener);
    };
  }, []);

  useEffect(() => {
    if (hasExtensionStorage()) {
      if (storageReady) setExtensionValue(STORAGE_KEY, bookmarks);
      return;
    }
    writeLocalJson(STORAGE_KEY, bookmarks);
  }, [bookmarks, storageReady]);

  return [bookmarks, setBookmarks];
}

function useStoredFolders(bookmarks) {
  const [folders, setFolders] = useState(() => baseFolderList(readLocalJson(FOLDERS_STORAGE_KEY, [])));
  const [storageReady, setStorageReady] = useState(() => !hasExtensionStorage());

  useEffect(() => {
    const api = getChromeApi();
    if (!api?.storage?.local) return undefined;

    let mounted = true;

    getExtensionValue(FOLDERS_STORAGE_KEY, null).then((saved) => {
      if (!mounted) return;
      const nextFolders = baseFolderList(Array.isArray(saved) ? saved : []);
      setFolders(nextFolders);
      setStorageReady(true);
      if (!Array.isArray(saved) || !saved.length) {
        setExtensionValue(FOLDERS_STORAGE_KEY, nextFolders);
      }
    });

    const listener = (changes, areaName) => {
      if (areaName !== "local" || !changes[FOLDERS_STORAGE_KEY]) return;
      const nextFolders = changes[FOLDERS_STORAGE_KEY].newValue;
      if (Array.isArray(nextFolders)) setFolders(baseFolderList(nextFolders));
    };

    api.storage.onChanged.addListener(listener);
    return () => {
      mounted = false;
      api.storage.onChanged.removeListener(listener);
    };
  }, []);

  useEffect(() => {
    const bookmarkFolders = bookmarks.map((item) => item.folder).filter(Boolean);
    setFolders((current) => baseFolderList([...current, ...bookmarkFolders]));
  }, [bookmarks]);

  useEffect(() => {
    if (hasExtensionStorage()) {
      if (storageReady) setExtensionValue(FOLDERS_STORAGE_KEY, folders);
      return;
    }
    writeLocalJson(FOLDERS_STORAGE_KEY, folders);
  }, [folders, storageReady]);

  const rememberFolder = (folder) => {
    const value = folder.trim();
    if (!value) return;
    setFolders((current) => (current.includes(value) ? current : [...current, value]));
  };

  return [folders, rememberFolder];
}

function useSyncStatus() {
  const [syncStatus, setSyncStatus] = useState(DEFAULT_SYNC_STATUS);

  useEffect(() => {
    const api = getChromeApi();
    if (!api?.storage?.local) return undefined;

    let mounted = true;

    getExtensionValue(SYNC_STORAGE_KEY, DEFAULT_SYNC_STATUS).then((saved) => {
      if (!mounted) return;
      setSyncStatus(saved || DEFAULT_SYNC_STATUS);
    });

    const listener = (changes, areaName) => {
      if (areaName !== "local" || !changes[SYNC_STORAGE_KEY]) return;
      setSyncStatus(changes[SYNC_STORAGE_KEY].newValue || DEFAULT_SYNC_STATUS);
    };

    api.storage.onChanged.addListener(listener);
    return () => {
      mounted = false;
      api.storage.onChanged.removeListener(listener);
    };
  }, []);

  return syncStatus;
}

function useStoredSettings() {
  const [settings, setSettings] = useState(() => ({
    ...DEFAULT_SETTINGS,
    ...readLocalJson(SETTINGS_STORAGE_KEY, {}),
  }));
  const [storageReady, setStorageReady] = useState(() => !hasExtensionStorage());

  useEffect(() => {
    const api = getChromeApi();
    if (!api?.storage?.local) return undefined;

    let mounted = true;

    getExtensionValue(SETTINGS_STORAGE_KEY, null).then((saved) => {
      if (!mounted) return;
      const nextSettings = { ...DEFAULT_SETTINGS, ...(saved || {}) };
      setSettings(nextSettings);
      setStorageReady(true);
      if (!saved) setExtensionValue(SETTINGS_STORAGE_KEY, nextSettings);
    });

    const listener = (changes, areaName) => {
      if (areaName !== "local" || !changes[SETTINGS_STORAGE_KEY]) return;
      setSettings({ ...DEFAULT_SETTINGS, ...(changes[SETTINGS_STORAGE_KEY].newValue || {}) });
    };

    api.storage.onChanged.addListener(listener);
    return () => {
      mounted = false;
      api.storage.onChanged.removeListener(listener);
    };
  }, []);

  useEffect(() => {
    if (hasExtensionStorage()) {
      if (storageReady) setExtensionValue(SETTINGS_STORAGE_KEY, settings);
      return;
    }
    writeLocalJson(SETTINGS_STORAGE_KEY, settings);
  }, [settings, storageReady]);

  const updateSettings = (patch) => {
    setSettings((current) => ({ ...current, ...patch }));
  };

  return [settings, updateSettings];
}

function createUpdater(setBookmarks, id) {
  return (patch) => {
    setBookmarks((current) =>
      current.map((bookmark) =>
        bookmark.id === id
          ? {
              ...bookmark,
              ...(typeof patch === "function" ? patch(bookmark) : patch),
            }
          : bookmark,
      ),
    );
  };
}

function estimateBookmarkHeight(bookmark) {
  let score = 180;
  score += Math.min(bookmark.text.length * 0.9, 110);
  if (bookmark.media?.shape === "portrait") score += 360;
  if (bookmark.media?.shape === "landscape") score += 210;
  if (bookmark.task?.title) score += 34;
  score += Math.ceil(bookmark.tags.length / 3) * 28;
  return score;
}

function getResponsiveColumnCount() {
  if (typeof window === "undefined") return 4;
  if (window.matchMedia("(max-width: 620px)").matches) return 1;
  if (window.matchMedia("(max-width: 900px)").matches) return 2;
  if (window.matchMedia("(max-width: 1200px)").matches) return 3;
  return 4;
}

function useResponsiveColumnCount() {
  const [columnCount, setColumnCount] = useState(getResponsiveColumnCount);

  useEffect(() => {
    const update = () => setColumnCount(getResponsiveColumnCount());
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return columnCount;
}

function useNow() {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return now;
}

function distributeBookmarks(bookmarks, columnCount) {
  const columns = Array.from({ length: columnCount }, () => ({ height: 0, items: [] }));

  bookmarks.forEach((bookmark) => {
    const target = columns.reduce((shortest, column) => (column.height < shortest.height ? column : shortest), columns[0]);
    target.items.push(bookmark);
    target.height += estimateBookmarkHeight(bookmark);
  });

  return columns.map((column) => column.items);
}

const workingSyncStates = ["opening", "watching", "capturing", "full_sync", "author_repair"];

function formatElapsed(now, timestamp, t) {
  if (!timestamp) return "";
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 3) return t.time.justNow;
  if (seconds < 60) return formatMessage(t.time.secondsAgo, { count: seconds });
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return formatMessage(t.time.minutesAgo, { count: minutes });
  return formatMessage(t.time.hoursAgo, { count: Math.floor(minutes / 60) });
}

function getSyncDisplay(syncStatus, now, t) {
  const count = syncStatus.total || syncStatus.count || 0;
  const pages = syncStatus.pages || syncStatus.steps || 0;
  const progressAt = syncStatus.lastProgressAt || syncStatus.lastCaptureAt || syncStatus.updatedAt;
  const progressAge = progressAt ? now - progressAt : 0;
  const isWorking = workingSyncStates.includes(syncStatus.state);
  const isWaiting = isWorking && progressAge > 30000;
  const isStale = isWorking && progressAge > 90000;

  if (isStale) {
    return {
      label: count ? `${t.sync.stuck} · ${count}` : t.sync.stuck,
      detail: progressAt
        ? formatMessage(t.sync.stuckDetail, { time: formatElapsed(now, progressAt, t) })
        : t.sync.noProgress,
      tone: "stale",
      working: false,
    };
  }

  if (isWaiting) {
    return {
      label: count ? `${t.sync.waiting} · ${count}` : t.sync.waiting,
      detail: progressAt ? formatMessage(t.sync.waitingDetail, { time: formatElapsed(now, progressAt, t) }) : t.sync.waitingX,
      tone: "waiting",
      working: true,
    };
  }

  if (isWorking) {
    const detail = [
      pages ? formatMessage(t.sync.pages, { count: pages }) : "",
      syncStatus.newCount ? formatMessage(t.sync.newItems, { count: syncStatus.newCount }) : "",
      progressAt ? formatMessage(t.sync.lastProgress, { time: formatElapsed(now, progressAt, t) }) : "",
    ]
      .filter(Boolean)
      .join(" · ");

    return {
      label: count ? `${t.sync.syncing} · ${count}` : t.sync.syncing,
      detail: detail || t.sync.starting,
      tone: "active",
      working: true,
    };
  }

  if (syncStatus.state === "failed") {
    return {
      label: t.sync.failed,
      detail: syncStatus.message || t.sync.tryAgain,
      tone: "failed",
      working: false,
    };
  }

  if (
    syncStatus.state === "needs_x_tab" &&
    !syncStatus.missingTemplate &&
    (syncStatus.tweetId || String(syncStatus.message || "").includes("sekmesi bulunamadı"))
  ) {
    return {
      label: t.sync.idleLabel,
      detail: t.sync.idleDetail,
      tone: "idle",
      working: false,
    };
  }

  if (syncStatus.state === "needs_x_tab") {
    return {
      label: t.sync.needsX,
      detail: syncStatus.message || t.sync.openXOnce,
      tone: "waiting",
      working: false,
    };
  }

  if (syncStatus.state === "complete") {
    const detail = [
      pages ? formatMessage(t.sync.pages, { count: pages }) : "",
      syncStatus.newCount ? formatMessage(t.sync.newItems, { count: syncStatus.newCount }) : "",
      syncStatus.completedAt ? formatMessage(t.sync.finished, { time: formatElapsed(now, syncStatus.completedAt, t) }) : "",
    ]
      .filter(Boolean)
      .join(" · ");

    return {
      label: count ? `${t.sync.complete} · ${count}` : t.sync.complete,
      detail: detail || t.sync.completeDetail,
      tone: "complete",
      working: false,
    };
  }

  return {
    label: t.sync.idleLabel,
    detail: t.sync.idleDetail,
    tone: "idle",
    working: false,
  };
}

export function App() {
  const [bookmarks, setBookmarks] = useStoredBookmarks();
  const [folders, rememberFolder] = useStoredFolders(bookmarks);
  const [settings, updateSettings] = useStoredSettings();
  const t = getDictionary(settings.language);
  const syncStatus = useSyncStatus();
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [activeCategory, setActiveCategory] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [activePopover, setActivePopover] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [toast, setToast] = useState("");
  const [toastTone, setToastTone] = useState("success");
  const toastTimeoutRef = useRef(null);
  const importInputRef = useRef(null);
  const columnCount = useResponsiveColumnCount();
  const now = useNow();
  const syncDisplay = getSyncDisplay(syncStatus, now, t);
  const syncIsWorking = syncDisplay.working;
  const filters = useMemo(
    () => [
      { id: "all", label: t.filters.all, icon: Bookmark },
      { id: "image", label: t.filters.image, icon: Image },
      { id: "video", label: t.filters.video, icon: Video },
      { id: "text", label: t.filters.text, icon: ListChecks },
      { id: "task", label: t.filters.task, icon: CheckSquare },
      { id: "folder", label: t.filters.folder, icon: Folder },
      { id: "tag", label: t.filters.tag, icon: Tag },
    ],
    [t],
  );
  const sortOptions = useMemo(
    () => [
      { id: "newest", label: t.sort.newest },
      { id: "oldest", label: t.sort.oldest },
      { id: "popular", label: t.sort.popular },
    ],
    [t],
  );

  const categories = useMemo(() => {
    const counts = bookmarks.reduce((acc, item) => {
      const category = item.folder || "Kategorisiz";
      acc.set(category, (acc.get(category) || 0) + 1);
      return acc;
    }, new Map());

    const hasUncategorized = counts.has("Kategorisiz");

    return [...folders, ...(hasUncategorized ? ["Kategorisiz"] : [])]
      .map((name) => ({ name, count: counts.get(name) || 0 }))
      .sort((a, b) => {
        if (a.name === "Kategorisiz") return 1;
        if (b.name === "Kategorisiz") return -1;
        return a.name.localeCompare(b.name, t.locale);
      });
  }, [bookmarks, folders, t]);

  const tags = useMemo(
    () => [...new Set(bookmarks.flatMap((item) => item.tags).filter(Boolean))],
    [bookmarks],
  );

  const filteredBookmarks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    const matching = bookmarks.filter((bookmark) => {
      const searchable = [
        bookmark.title,
        bookmark.text,
        bookmark.author,
        bookmark.handle,
        bookmark.folder,
        ...bookmark.tags,
      ]
        .join(" ")
        .toLowerCase();

      const queryMatch = !normalizedQuery || searchable.includes(normalizedQuery);
      const filterMatch =
        activeFilter === "all" ||
        bookmark.type === activeFilter ||
        (activeFilter === "task" && bookmark.task?.title) ||
        (activeFilter === "folder" && bookmark.folder) ||
        (activeFilter === "tag" && bookmark.tags.length);
      const categoryMatch =
        activeCategory === "all" || (bookmark.folder || "Kategorisiz") === activeCategory;

      return queryMatch && filterMatch && categoryMatch;
    });

    return [...matching].sort((a, b) => {
      if (sortBy === "oldest") {
        return new Date(a.createdAt) - new Date(b.createdAt);
      }
      if (sortBy === "popular") {
        return b.popularity - a.popularity;
      }
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }, [activeCategory, activeFilter, bookmarks, query, sortBy]);

  const bookmarkColumns = useMemo(
    () => distributeBookmarks(filteredBookmarks, columnCount),
    [columnCount, filteredBookmarks],
  );

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
    document.documentElement.dataset.density = settings.density;
  }, [settings.density, settings.theme]);

  useEffect(() => {
    const handleKeydown = (event) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (event.key === "/") {
        event.preventDefault();
        document.querySelector("[data-search-input]")?.focus();
      }

      if (event.key === "Escape") {
        setActivePopover(null);
        setSelectedIds([]);
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, []);

  const showToast = (message, tone = "") => {
    const nextTone =
      tone ||
      (/başarısız|hata|hazır değil|bulunamadı|bulunmuyor|yok|açılamadı|gerekli|failed|invalid|could not|unable|missing|needs|required/i.test(message)
        ? "error"
        : /başladı|ediliyor|bekleniyor|deneniyor|started|syncing|waiting|running/i.test(message)
          ? "info"
          : "success");
    setToast(message);
    setToastTone(nextTone);
    window.clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = window.setTimeout(() => setToast(""), 1800);
  };

  const updateBookmark = (id, patch) => createUpdater(setBookmarks, id)(patch);

  const toggleSelection = (id) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const removeBookmarkRecord = async (bookmark, { quiet = false } = {}) => {
    if (!bookmark) return false;

    updateBookmark(bookmark.id, { syncState: "pending_remove" });
    if (!quiet) showToast(t.toast.removingStarted);

    if (hasExtensionRuntime()) {
      const response = await sendExtensionMessage({ type: "BDX_REMOVE_BOOKMARK", bookmark });
      if (response?.ok) {
        setBookmarks((current) => current.filter((item) => item.id !== bookmark.id));
        setSelectedIds((current) => current.filter((item) => item !== bookmark.id));
        if (!quiet) showToast(t.toast.removedFromX);
        return true;
      }

      updateBookmark(bookmark.id, { syncState: "failed" });
      if (!quiet) showToast(response?.error || t.toast.removeFailed);
      return false;
    }

    await wait(650);
    setBookmarks((current) => current.filter((item) => item.id !== bookmark.id));
    setSelectedIds((current) => current.filter((item) => item !== bookmark.id));
    if (!quiet) showToast(t.toast.devRemoved);
    return true;
  };

  const removeBookmark = async (id) => {
    const bookmark = bookmarks.find((item) => item.id === id);
    if (!bookmark) return;

    const confirmed = window.confirm(
      formatMessage(t.confirm.removeBookmark, { title: bookmark.title || bookmark.text.slice(0, 42) }),
    );

    if (!confirmed) return;

    await removeBookmarkRecord(bookmark);
  };

  const removeSelected = async () => {
    if (!selectedIds.length) return;
    const confirmed = window.confirm(formatMessage(t.confirm.removeSelected, { count: selectedIds.length }));
    if (!confirmed) return;

    const selectedBookmarks = bookmarks.filter((item) => selectedIds.includes(item.id));
    showToast(t.toast.bulkRemoving);

    for (const bookmark of selectedBookmarks) {
      await removeBookmarkRecord(bookmark, { quiet: true });
      await wait(320);
    }

    setSelectedIds([]);
    showToast(t.toast.bulkDone);
  };

  const batchTag = () => {
    const value = window.prompt(t.prompt.batchTag);
    if (!value) return;
    setBookmarks((current) =>
      current.map((item) =>
        selectedIds.includes(item.id) && !item.tags.includes(value)
          ? { ...item, tags: [...item.tags, value] }
          : item,
      ),
    );
    showToast(t.toast.batchTagsAdded);
  };

  const batchFolder = () => {
    const value = window.prompt(t.prompt.batchFolder)?.trim();
    if (!value) return;
    rememberFolder(value);
    setBookmarks((current) =>
      current.map((item) => (selectedIds.includes(item.id) ? { ...item, folder: value } : item)),
    );
    showToast(t.toast.folderUpdated);
  };

  const requestSync = async () => {
    showToast(t.toast.syncStarting);

    if (hasExtensionRuntime()) {
      const response = await sendExtensionMessage({ type: "BDX_OPEN_X_BOOKMARKS" });
      showToast(response?.ok ? t.toast.syncStarted : response?.error || t.toast.xOpenFailed);
      return;
    }

    window.open("https://x.com/i/bookmarks", "_blank", "noopener,noreferrer");
    showToast(t.toast.devXOpened);
  };

  const openXBookmarks = async () => {
    if (hasExtensionRuntime()) {
      const response = await sendExtensionMessage({ type: "BDX_OPEN_X_BOOKMARKS_VISIBLE" });
      showToast(response?.ok ? t.toast.xBookmarksOpened : response?.error || t.toast.xOpenFailed);
      return;
    }

    window.open("https://x.com/i/bookmarks", "_blank", "noopener,noreferrer");
  };

  const exportData = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      version: 1,
      bookmarks,
      folders,
      settings,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bookmarkdeepx-export-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast(t.toast.exported);
  };

  const importData = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const payload = JSON.parse(await file.text());
      if (!Array.isArray(payload.bookmarks)) {
        showToast(t.toast.invalidImport, "error");
        return;
      }

      setBookmarks(payload.bookmarks);
      if (Array.isArray(payload.folders)) payload.folders.forEach(rememberFolder);
      if (payload.settings) updateSettings({ ...DEFAULT_SETTINGS, ...payload.settings });
      showToast(formatMessage(t.toast.imported, { count: payload.bookmarks.length }));
    } catch {
      showToast(t.toast.importUnreadable, "error");
    }
  };

  const clearLocalData = async () => {
    const confirmed = window.confirm(t.confirm.clearLocal);
    if (!confirmed) return;

    setBookmarks([]);
    updateSettings({ debugMode: false });

    if (hasExtensionStorage()) {
      await setExtensionValue(STORAGE_KEY, []);
      await setExtensionValue(FOLDERS_STORAGE_KEY, DEFAULT_FOLDERS);
      await setExtensionValue(SYNC_STORAGE_KEY, DEFAULT_SYNC_STATUS);
    } else {
      writeLocalJson(STORAGE_KEY, []);
      writeLocalJson(FOLDERS_STORAGE_KEY, DEFAULT_FOLDERS);
    }

    showToast(t.toast.localCleared);
  };

  useEffect(() => {
    if (!settings.autoSync || !hasExtensionRuntime()) return undefined;
    const timer = window.setTimeout(() => {
      sendExtensionMessage({ type: "BDX_OPEN_X_BOOKMARKS" }).then((response) => {
        if (!response?.ok) showToast(response?.error || t.toast.autoSyncFailed, "error");
      });
    }, 900);
    return () => window.clearTimeout(timer);
  }, [settings.autoSync, t]);

  return (
    <main className={`workspace density-${settings.density} theme-${settings.theme}`}>
      <section className="command-surface" aria-label="BookmarkDeepX controls">
        <div className="topline">
          <button className="brand-mark" type="button" aria-label="BookmarkDeepX">
            <Bookmark size={18} fill="currentColor" />
            <span>BookmarkDeepX</span>
          </button>

          <label className="search-box">
            <Search size={18} />
            <input
              data-search-input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t.topbar.searchPlaceholder}
              aria-label={t.topbar.searchLabel}
            />
            <kbd>/</kbd>
          </label>

          <div className="top-actions">
            <div className={`sync-cluster ${syncDisplay.tone}`} aria-live="polite">
              <button className={`sync-pill ${syncDisplay.tone}`} type="button" onClick={requestSync}>
                {syncDisplay.tone === "complete" ? (
                  <Check size={15} />
                ) : syncDisplay.tone === "waiting" || syncDisplay.tone === "stale" ? (
                  <Clock3 className={syncIsWorking ? "pulse" : ""} size={15} />
                ) : syncIsWorking ? (
                  <Loader2 className="spin" size={15} />
                ) : (
                  <Repeat2 size={15} />
                )}
                <span>{syncDisplay.label}</span>
              </button>
              <span className="sync-detail">{syncDisplay.detail}</span>
            </div>
            <button className="icon-button" type="button" onClick={openXBookmarks} title={t.topbar.openXBookmarks}>
              <ExternalLink size={18} />
            </button>
            <button className="icon-button" type="button" onClick={exportData} title={t.topbar.export}>
              <FileDown size={18} />
            </button>
            <div className="settings-anchor">
            <button
              className={activePopover === "settings" ? "icon-button active" : "icon-button"}
              type="button"
              title={t.topbar.settings}
              onClick={() => setActivePopover(activePopover === "settings" ? null : "settings")}
            >
              <Settings size={18} />
            </button>
            {activePopover === "settings" && (
              <SettingsPanel
                bookmarks={bookmarks}
                settings={settings}
                syncDisplay={syncDisplay}
                syncStatus={syncStatus}
                updateSettings={updateSettings}
                requestSync={requestSync}
                exportData={exportData}
                importInputRef={importInputRef}
                clearLocalData={clearLocalData}
                t={t}
              />
            )}
            </div>
          </div>
        </div>

        <div className="control-row">
          <div className="filter-strip" role="tablist" aria-label={t.topbar.filtersLabel}>
            {filters.map((filter) => {
              const Icon = filter.icon;
              return (
                <button
                  key={filter.id}
                  className={activeFilter === filter.id ? "filter-chip active" : "filter-chip"}
                  type="button"
                  role="tab"
                  aria-selected={activeFilter === filter.id}
                  onClick={() => setActiveFilter(filter.id)}
                >
                  <Icon size={15} />
                  {filter.label}
                </button>
              );
            })}
          </div>

          <label className="sort-select">
            <ArrowDownUp size={15} />
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} aria-label={t.topbar.sortLabel}>
              {sortOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown size={15} />
          </label>
        </div>

        <div className="category-strip" role="tablist" aria-label={t.topbar.categoryLabel}>
          <button
            className={activeCategory === "all" ? "category-chip active" : "category-chip"}
            type="button"
            role="tab"
            aria-selected={activeCategory === "all"}
            onClick={() => setActiveCategory("all")}
          >
            <Folder size={14} />
            {t.category.all}
            <span>{bookmarks.length}</span>
          </button>

          {categories.map((category) => (
            <button
              key={category.name}
              className={activeCategory === category.name ? "category-chip active" : "category-chip"}
              style={getCategoryStyle(category.name)}
              type="button"
              role="tab"
              aria-selected={activeCategory === category.name}
              onClick={() => setActiveCategory(category.name)}
            >
              <span className="category-dot" />
              {getLocalizedFolderName(category.name, t)}
              <span>{category.count}</span>
            </button>
          ))}
        </div>

        <div className="quick-context" aria-label={t.topbar.contextLabel}>
          <span>{formatMessage(t.topbar.bookmarkCount, { count: filteredBookmarks.length })}</span>
          <span>{formatMessage(t.topbar.folderCount, { count: folders.length })}</span>
          <span>{formatMessage(t.topbar.tagCount, { count: tags.length })}</span>
          <span>{formatMessage(t.topbar.openTaskCount, { count: bookmarks.filter((item) => item.task?.title && !item.task.done).length })}</span>
        </div>
      </section>

      <section className="board" aria-label="Bookmark panosu">
        {bookmarkColumns.map((column, columnIndex) => (
          <div className="board-column" key={`column-${columnIndex}`}>
            {column.map((bookmark) => (
              <BookmarkCard
                key={bookmark.id}
                bookmark={bookmark}
                folders={folders}
                rememberFolder={rememberFolder}
                categoryStyle={getCategoryStyle(bookmark.folder || "Kategorisiz")}
                t={t}
                isSelected={selectedIds.includes(bookmark.id)}
                activePopover={activePopover}
                setActivePopover={setActivePopover}
                updateBookmark={(patch) => updateBookmark(bookmark.id, patch)}
                toggleSelection={() => toggleSelection(bookmark.id)}
                removeBookmark={() => removeBookmark(bookmark.id)}
                showToast={showToast}
              />
            ))}
          </div>
        ))}
      </section>

      {!filteredBookmarks.length && (
        <section className="empty-state" aria-live="polite">
          <Sparkles size={20} />
          <strong>{t.empty.title}</strong>
          <span>{t.empty.body}</span>
        </section>
      )}

      {selectedIds.length > 0 && (
        <div className="batch-bar" role="toolbar" aria-label={t.batch.toolbarLabel}>
          <strong>{formatMessage(t.batch.selected, { count: selectedIds.length })}</strong>
          <button type="button" onClick={batchTag}>
            <Tag size={16} />
            {t.batch.tag}
          </button>
          <button type="button" onClick={batchFolder}>
            <Folder size={16} />
            {t.batch.moveFolder}
          </button>
          <button type="button" onClick={removeSelected} className="danger-action">
            <BookmarkMinus size={16} />
            {t.batch.removeFromX}
          </button>
          <button type="button" className="ghost-action" onClick={() => setSelectedIds([])}>
            <X size={16} />
            {t.batch.clear}
          </button>
        </div>
      )}

      {toast && (
        <div className={`app-toast ${toastTone}`} role="status" aria-live="polite">
          {toastTone === "error" ? <AlertCircle size={15} /> : <Check size={15} />}
          {toast}
        </div>
      )}

      <input
        ref={importInputRef}
        className="sr-only"
        type="file"
        accept="application/json,.json"
        onChange={importData}
        tabIndex={-1}
      />
    </main>
  );
}

function SettingsPanel({
  bookmarks,
  settings,
  syncDisplay,
  syncStatus,
  updateSettings,
  requestSync,
  exportData,
  importInputRef,
  clearLocalData,
  t,
}) {
  const connectionLabel =
    syncDisplay.tone === "active"
      ? t.settings.connectionActive
      : syncDisplay.tone === "complete"
        ? t.settings.connectionConnected
        : syncDisplay.tone === "failed" || syncDisplay.tone === "stale"
          ? t.settings.connectionNeedsCheck
          : syncStatus.state === "needs_x_tab"
            ? t.settings.connectionNeedsX
            : t.settings.connectionReady;

  return (
    <div className="settings-popover" role="dialog" aria-label={t.settings.title}>
      <div className="settings-head">
        <strong>{t.settings.title}</strong>
        <span>{formatMessage(t.settings.localCount, { count: bookmarks.length })}</span>
      </div>

      <div className="settings-section">
        <div className="status-line">
          <Radio size={16} />
          <div>
            <strong>{t.settings.connection}</strong>
            <span>{connectionLabel} · {syncDisplay.detail}</span>
          </div>
          <button type="button" onClick={requestSync}>{t.settings.sync}</button>
        </div>
        <label className="settings-toggle">
          <span>
            <strong>{t.settings.autoSync}</strong>
            <small>{t.settings.autoSyncHelp}</small>
          </span>
          <input
            type="checkbox"
            checked={settings.autoSync}
            onChange={(event) => updateSettings({ autoSync: event.target.checked })}
          />
        </label>
      </div>

      <div className="settings-grid">
        <button type="button" onClick={exportData}>
          <Download size={16} />
          {t.settings.export}
        </button>
        <button type="button" onClick={() => importInputRef.current?.click()}>
          <Upload size={16} />
          {t.settings.import}
        </button>
      </div>

      <div className="settings-section compact">
        <label className="settings-select">
          <Info size={15} />
          {t.settings.language}
          <select value={settings.language} onChange={(event) => updateSettings({ language: event.target.value })}>
            {LANGUAGE_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="settings-select">
          <Moon size={15} />
          {t.settings.theme}
          <select value={settings.theme} onChange={(event) => updateSettings({ theme: event.target.value })}>
            <option value="dark">{t.settings.themeDark}</option>
            <option value="soft">{t.settings.themeSoft}</option>
          </select>
        </label>
        <label className="settings-select">
          <Database size={15} />
          {t.settings.density}
          <select value={settings.density} onChange={(event) => updateSettings({ density: event.target.value })}>
            <option value="comfortable">{t.settings.densityComfortable}</option>
            <option value="compact">{t.settings.densityCompact}</option>
          </select>
        </label>
      </div>

      <label className="settings-toggle">
        <span>
          <strong>{t.settings.debug}</strong>
          <small>{t.settings.debugHelp}</small>
        </span>
        <input
          type="checkbox"
          checked={settings.debugMode}
          onChange={(event) => updateSettings({ debugMode: event.target.checked })}
        />
      </label>

      {settings.debugMode && (
        <div className="debug-box">
          <Info size={14} />
          <span>{syncStatus.state || "idle"} · {syncStatus.message || syncDisplay.label}</span>
        </div>
      )}

      <button className="settings-danger" type="button" onClick={clearLocalData}>
        <Trash size={16} />
        {t.settings.clearLocal}
      </button>
    </div>
  );
}

function BookmarkCard({
  bookmark,
  folders,
  rememberFolder,
  categoryStyle,
  t,
  isSelected,
  activePopover,
  setActivePopover,
  updateBookmark,
  toggleSelection,
  removeBookmark,
  showToast,
}) {
  const popoverFor = (name) => `${bookmark.id}:${name}`;
  const isOpen = (name) => activePopover === popoverFor(name);
  const [tagDraft, setTagDraft] = useState("");
  const [folderDraft, setFolderDraft] = useState(bookmark.folder || "");
  const [taskDraft, setTaskDraft] = useState(bookmark.task?.title || "");
  const [taskDueDraft, setTaskDueDraft] = useState(bookmark.task?.due || "");

  useEffect(() => {
    setFolderDraft(bookmark.folder || "");
    setTaskDraft(bookmark.task?.title || "");
    setTaskDueDraft(bookmark.task?.due || "");
  }, [bookmark.folder, bookmark.task?.due, bookmark.task?.title]);

  const openPopover = (name) => {
    setActivePopover(isOpen(name) ? null : popoverFor(name));
  };

  const addTag = (event) => {
    event.preventDefault();
    const value = tagDraft.trim();
    if (!value || bookmark.tags.includes(value)) return;
    updateBookmark({ tags: [...bookmark.tags, value] });
    setTagDraft("");
    setActivePopover(null);
    showToast(t.toast.tagAdded);
  };

  const removeTag = (tag) => {
    updateBookmark({ tags: bookmark.tags.filter((item) => item !== tag) });
    showToast(t.toast.tagRemoved);
  };

  const saveFolder = (event) => {
    event.preventDefault();
    const value = folderDraft.trim();
    rememberFolder(value);
    updateBookmark({ folder: value });
    setActivePopover(null);
    showToast(t.toast.folderUpdated);
  };

  const selectFolder = (folder) => {
    rememberFolder(folder);
    updateBookmark({ folder });
    setFolderDraft(folder);
    setActivePopover(null);
    showToast(formatMessage(t.toast.folderAdded, { folder }));
  };

  const saveTask = (event) => {
    event.preventDefault();
    updateBookmark({
      task: {
        title: taskDraft.trim(),
        due: taskDueDraft,
        done: bookmark.task?.done || false,
      },
    });
    setActivePopover(null);
    showToast(taskDraft.trim() ? t.toast.taskUpdated : t.toast.taskCleared);
  };

  const profileUrl = getProfileUrl(bookmark.handle);
  const useMediaTextOverlay = Boolean(bookmark.media && bookmark.text.length <= 78);

  return (
    <article className={`bookmark-card ${bookmark.type} ${isSelected ? "selected" : ""}`}>
      <div className="card-toolbar">
        <label className="select-control" title={t.card.select}>
          <input type="checkbox" checked={isSelected} onChange={toggleSelection} />
          <span>
            {isSelected ? <Check size={14} /> : <Circle size={14} />}
          </span>
        </label>
        <button className="mini-button bookmark-ribbon" type="button" onClick={removeBookmark} title={t.card.removeFromX}>
          {["removing", "pending_remove"].includes(bookmark.syncState) && <Loader2 className="spin" size={15} />}
        </button>
      </div>

      <header className="tweet-header">
        <a
          className="avatar profile-link"
          href={profileUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={formatMessage(t.card.profileLabel, { author: bookmark.author })}
        >
          {bookmark.author.slice(0, 1)}
        </a>
        <a className="author-lines profile-link" href={profileUrl} target="_blank" rel="noreferrer">
          <strong>{bookmark.author}</strong>
          <span>
            {bookmark.handle} · {bookmark.date}
          </span>
        </a>
      </header>

      <label className="title-field">
        <span>{t.card.titleLabel}</span>
        <input
          value={bookmark.title}
          onChange={(event) => updateBookmark({ title: event.target.value })}
          placeholder={t.card.titlePlaceholder}
          aria-label={t.card.titleLabel}
        />
      </label>

      {!useMediaTextOverlay && <p className="tweet-text">{bookmark.text}</p>}

      {bookmark.media && (
        <figure className={`media-frame ${bookmark.media.shape} ${useMediaTextOverlay ? "with-text-overlay" : ""}`}>
          <img src={bookmark.media.src} alt={bookmark.media.alt} loading="lazy" />
          {useMediaTextOverlay && (
            <figcaption className="media-text-overlay">
              <p>{bookmark.text}</p>
            </figcaption>
          )}
          {bookmark.type === "video" && (
            <span className="play-affordance" aria-label="Video">
              <PlayCircle size={44} fill="rgba(255,255,255,0.14)" />
            </span>
          )}
        </figure>
      )}

      <div className="metadata-row">
        {bookmark.folder && (
          <button
            className="metadata-pill category-pill"
            style={categoryStyle}
            type="button"
            onClick={() => openPopover("folder")}
          >
            <Folder size={13} />
            {bookmark.folder}
          </button>
        )}
        {bookmark.task?.title && (
          <button className="metadata-pill" type="button" onClick={() => openPopover("task")}>
            <CheckSquare size={13} />
            {bookmark.task.done ? t.card.taskDonePill : t.card.task}
          </button>
        )}
      </div>

      <div className="tag-row">
        {bookmark.tags.map((tag) => (
          <button key={tag} className="tag-chip" type="button" onClick={() => removeTag(tag)} title={t.card.removeTag}>
            #{tag}
          </button>
        ))}
        <button className="tag-add" type="button" onClick={() => openPopover("tag")} title={t.card.addTag}>
          <Tag size={14} />
        </button>
      </div>

      <footer className="tweet-footer">
        <span>
          <MessageCircle size={14} /> {bookmark.metrics.reply}
        </span>
        <span>
          <Repeat2 size={14} /> {bookmark.metrics.repost}
        </span>
        <span>
          <Heart size={14} /> {bookmark.metrics.like}
        </span>
      </footer>

      <div className="action-dock" aria-label={t.card.actionsLabel}>
        <button type="button" onClick={() => openPopover("folder")} title={t.card.folderAction}>
          <Folder size={16} />
        </button>
        <button type="button" onClick={() => openPopover("task")} title={t.card.taskAction}>
          <CheckSquare size={16} />
        </button>
        <button type="button" onClick={() => window.open(bookmark.url, "_blank", "noopener,noreferrer")} title={t.card.openOriginal}>
          <Link size={16} />
        </button>
        <button type="button" className="danger-icon" onClick={removeBookmark} title={t.card.removeFromX}>
          <Trash2 size={16} />
        </button>
      </div>

      {isOpen("tag") && (
        <form className="card-popover compact" onSubmit={addTag}>
          <label>
            {t.card.tag}
            <input value={tagDraft} onChange={(event) => setTagDraft(event.target.value)} placeholder={t.card.tagPlaceholder} autoFocus />
          </label>
          <button type="submit">{t.card.add}</button>
        </form>
      )}

      {isOpen("folder") && (
        <form className="card-popover" onSubmit={saveFolder}>
          {folders.length > 0 && (
            <div className="folder-preset-list" aria-label={t.card.currentFolders}>
              <span>{t.card.currentFolders}</span>
              <div>
                {folders.map((folder) => (
                  <button
                    key={folder}
                    className={bookmark.folder === folder ? "folder-preset active" : "folder-preset"}
                    style={getCategoryStyle(folder)}
                    type="button"
                    onClick={() => selectFolder(folder)}
                  >
                    <Folder size={13} />
                    {folder}
                  </button>
                ))}
              </div>
            </div>
          )}
          <label>
            {t.card.newFolder}
            <input
              value={folderDraft}
              onChange={(event) => setFolderDraft(event.target.value)}
              placeholder={t.card.newFolderPlaceholder}
              autoFocus
            />
          </label>
          <div className="popover-actions">
            <button type="button" onClick={() => setFolderDraft("")}>
              {t.card.clear}
            </button>
            <button type="submit">{t.card.save}</button>
          </div>
        </form>
      )}

      {isOpen("task") && (
        <form className="card-popover" onSubmit={saveTask}>
          <div className="popover-title-row">
            <strong>{t.card.task}</strong>
            <button type="button" onClick={() => setActivePopover(null)}>
              {t.card.close}
            </button>
          </div>
          <label>
            {t.card.task}
            <input value={taskDraft} onChange={(event) => setTaskDraft(event.target.value)} placeholder={t.card.taskPlaceholder} autoFocus />
          </label>
          <label>
            {t.card.taskDate}
            <input type="date" value={taskDueDraft} onChange={(event) => setTaskDueDraft(event.target.value)} />
          </label>
          <label className="checkline">
            <input
              type="checkbox"
              checked={bookmark.task?.done || false}
              onChange={(event) =>
                updateBookmark({
                  task: {
                    title: taskDraft.trim() || bookmark.task?.title || "",
                    due: taskDueDraft || bookmark.task?.due || "",
                    done: event.target.checked,
                  },
                })
              }
            />
            {t.card.taskDone}
          </label>
          <div className="popover-actions">
            <button type="button" onClick={() => setTaskDraft("")}>
              {t.card.clear}
            </button>
            <button type="submit">{t.card.save}</button>
          </div>
        </form>
      )}
    </article>
  );
}
