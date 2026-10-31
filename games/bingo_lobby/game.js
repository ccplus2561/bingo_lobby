(() => {
  "use strict";

  // ===== 設定常數 =====
  const STORAGE_PREFIX = "bingoLobby.";
  const NAV_DELAY_MS = 260;

  // 4 個入口：改網址只要改這張表
  // 預設假設 games/ 底下並排：bingo_card（電子卡）、bingo（旁觀 / 主持）
  const MODES = {
    solo:     { url: "../bingo_card/index.html?mode=solo" },
    multi:    { url: "../bingo_card/index.html?mode=multi" },
    spectate: { url: "../bingo/index.html?role=spectator" },
    host:     { url: "../bingo/index.html?role=host" },
  };

  // 鍵盤快速鍵 → 模式
  const HOTKEYS = { "1": "solo", "2": "multi", "3": "spectate", "4": "host" };

  // 方向鍵 → 焦點位移（2 欄排列）
  const ARROW_STEP = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -2, ArrowDown: 2 };

  // ===== DOM =====
  const $ = id => document.getElementById(id);
  const sfxBtn = $("sfxBtn");
  const modeBtns = Array.from(document.querySelectorAll("[data-mode]"));

  // ===== 狀態 =====
  const state = {
    sfx: true,
    navigating: false,
    timer: 0,
  };

  // ===== 音效（Proxy，失敗不影響流程）=====
  const sound = new Proxy({}, {
    get: (_, name) => (...args) => {
      try {
        const fn = window.GameAudio && window.GameAudio[name];
        if (typeof fn === "function") fn(...args);
      } catch (e) { /* 忽略音效錯誤 */ }
    },
  });

  // ===== 本機儲存 =====
  function readStore(key, fallback) {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function writeStore(key, value) {
    try {
      localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
    } catch (e) { /* 忽略儲存錯誤 */ }
  }

  // ===== 大廳整合（獨立開啟時全部略過）=====
  const embedded = (() => {
    try { return window.parent !== window; } catch (e) { return true; }
  })();

  function applyHubPrefs() {
    if (!embedded) return;
    try {
      sound.setHubPrefs(parent.MiniHubPrefs());
    } catch (e) { /* 忽略 */ }
  }

  function pause() {
    cancelNavigation();
    sound.suspend();
  }

  function setupHub() {
    if (!embedded) return;
    window.MiniHubPause = pause;
    applyHubPrefs();
  }

  // ===== HUD =====
  function renderSfxButton() {
    sfxBtn.textContent = state.sfx ? "🔊" : "🔇";
    sfxBtn.setAttribute("aria-pressed", String(state.sfx));
  }

  // ===== 遊戲流程 =====
  function toggleSfx() {
    state.sfx = !state.sfx;
    sound.setSfx(state.sfx);
    writeStore("sfx", state.sfx);
    renderSfxButton();
    sound.toggle();
  }

  function enterMode(modeId) {
    const mode = MODES[modeId];
    if (!mode || state.navigating) return;
    state.navigating = true;
    applyHubPrefs();
    markBusy(modeId);
    sound.enter();
    state.timer = window.setTimeout(() => {
      window.location.href = mode.url;
    }, NAV_DELAY_MS);
  }

  function cancelNavigation() {
    window.clearTimeout(state.timer);
    state.navigating = false;
    markBusy(null);
  }

  // ===== 繪製 =====
  function markBusy(modeId) {
    modeBtns.forEach(btn => {
      btn.classList.toggle("is-busy", btn.dataset.mode === modeId);
    });
  }

  function moveFocus(step) {
    const current = modeBtns.indexOf(document.activeElement);
    const next = current < 0 ? 0 : current + step;
    if (next < 0 || next >= modeBtns.length) return;
    modeBtns[next].focus();
    sound.hover();
  }

  // ===== 輸入 =====
  function onKeyDown(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (HOTKEYS[e.key]) {
      e.preventDefault();
      enterMode(HOTKEYS[e.key]);
      return;
    }
    if (ARROW_STEP[e.key] !== undefined) {
      e.preventDefault();
      moveFocus(ARROW_STEP[e.key]);
    }
  }

  function bindInput() {
    modeBtns.forEach(btn => {
      btn.addEventListener("click", () => enterMode(btn.dataset.mode));
      btn.addEventListener("mouseenter", () => sound.hover());
    });
    sfxBtn.addEventListener("click", toggleSfx);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("pageshow", cancelNavigation); // 從上一頁返回時還原
  }

  // ===== 啟動 =====
  function init() {
    state.sfx = readStore("sfx", true) !== false;
    sound.setSfx(state.sfx);
    renderSfxButton();
    setupHub();
    bindInput();
  }

  init();
})();
