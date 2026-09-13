(() => {
  'use strict';

  let settings = {
    enabled: true,
    highlight: true,
    hide: false,
    breathe: true,
    keepAlive: false,
    questionPage: false,
    profilePage: false,
    upvoteThreshold: 100,
    commentThreshold: 0,
    favoriteThreshold: 0,
    likeThreshold: 0,
    maxMatchCount: 50,
    highlightColor: '#0084ff',
    glowColor: '#0066cc',
    breatheIntensity: 50,
    breatheSpeed: 20
  };

  const MATCH_CLASS = 'zhihu-filter-match';
  const NO_MATCH_CLASS = 'zhihu-filter-no-match';
  const BREATHE_CLASS = 'zhihu-filter-breathe';

  let debounceTimer = null;
  let observer = null;
  let matchCount = 0;

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'applyFilter') {
      settings = msg.settings;
      applyStyles();
      processAllAnswers();
      // 处理 keep-alive 状态
      if (settings.keepAlive && !window.__ZHIHU_KEEP_ALIVE_INJECTED__) {
        injectKeepAlive();
      }
      sendResponse({ success: true });
    }
    if (msg.action === 'toggleKeepAlive') {
      settings.keepAlive = msg.enabled;
      if (settings.keepAlive) {
        injectKeepAlive();
      }
      sendResponse({ success: true });
    }
  });

  chrome.storage.local.get('zhihuFilterSettings', (result) => {
    if (result.zhihuFilterSettings) {
      settings = { ...settings, ...result.zhihuFilterSettings };
    }
    applyStyles();
    processAllAnswers();
    startObserver();
    initKeepAlive();
  });

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.zhihuFilterSettings) {
      settings = { ...settings, ...changes.zhihuFilterSettings.newValue };
      applyStyles();
      processAllAnswers();
      // 处理 keep-alive 状态
      if (settings.keepAlive && !window.__ZHIHU_KEEP_ALIVE_INJECTED__) {
        injectKeepAlive();
      }
    }
  });

  function injectKeepAlive() {
    if (window.__ZHIHU_KEEP_ALIVE_INJECTED__) return;
    
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('inject.js');
    script.onload = () => script.remove();
    (document.head || document.documentElement).appendChild(script);
  }

  // 初始化时检查 keep-alive 状态
  function initKeepAlive() {
    if (settings.keepAlive) {
      injectKeepAlive();
    }
  }

  // 监听页面可见性变化，页面恢复时重新筛选
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && settings.enabled) {
      setTimeout(processAllAnswers, 500);
    }
  });

  // 监听页面获得焦点
  window.addEventListener('focus', () => {
    if (settings.enabled) {
      setTimeout(processAllAnswers, 500);
    }
  });

  function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
      : '0, 132, 255';
  }

  function applyStyles() {
    const root = document.documentElement;
    root.style.setProperty('--zhihu-highlight-color', settings.highlightColor);
    root.style.setProperty('--zhihu-glow-color', settings.glowColor);
    root.style.setProperty('--zhihu-glow-color-rgb', `rgba(${hexToRgb(settings.glowColor)}, `);
    root.style.setProperty('--zhihu-breathe-intensity', (settings.breatheIntensity / 100).toString());
    root.style.setProperty('--zhihu-breathe-speed', (settings.breatheSpeed / 10) + 's');
  }

  function startObserver() {
    if (observer) observer.disconnect();

    observer = new MutationObserver(() => {
      if (!settings.enabled) return;
      debouncedProcess();
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  function debouncedProcess() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(processAllAnswers, 300);
  }

  function isZhihuPage() {
    const path = window.location.pathname;
    const isHomepage = path === '/' || path.startsWith('/follow') || path.startsWith('/hot');
    const isQuestionPage = path.startsWith('/question');
    const isProfilePage = path.startsWith('/people');
    
    if (isHomepage) return true;
    if (isQuestionPage && settings.questionPage) return true;
    if (isProfilePage && settings.profilePage) return true;
    
    return false;
  }

  function processAllAnswers() {
    if (!settings.enabled || !isZhihuPage()) {
      clearAllFilters();
      return;
    }

    matchCount = 0;
    document.querySelectorAll('.AnswerItem, .ContentItem').forEach(processItem);
  }

  function clearAllFilters() {
    document.querySelectorAll(`.${MATCH_CLASS}, .${NO_MATCH_CLASS}, .${BREATHE_CLASS}`)
      .forEach(el => el.classList.remove(MATCH_CLASS, NO_MATCH_CLASS, BREATHE_CLASS));
  }

  function processItem(item) {
    // 检查是否达到最大匹配数量
    if (settings.maxMatchCount > 0 && matchCount >= settings.maxMatchCount) {
      return;
    }

    item.classList.remove(MATCH_CLASS, NO_MATCH_CLASS, BREATHE_CLASS);
    const stats = extractStats(item);
    item.setAttribute('data-filter-stats', JSON.stringify(stats));

    const container = item.closest('.Card') || item.closest('.Feed') || item;
    container.classList.remove(MATCH_CLASS, NO_MATCH_CLASS, BREATHE_CLASS);

    if (checkMatch(stats)) {
      matchCount++;
      container.classList.add(MATCH_CLASS);
      if (settings.breathe) {
        container.classList.add(BREATHE_CLASS);
      }
    } else if (settings.hide) {
      container.classList.add(NO_MATCH_CLASS);
    }
  }

  function checkMatch(stats) {
    const conditions = [];
    if (settings.upvoteThreshold > 0) conditions.push(stats.upvotes >= settings.upvoteThreshold);
    if (settings.commentThreshold > 0) conditions.push(stats.comments >= settings.commentThreshold);
    if (settings.favoriteThreshold > 0) conditions.push(stats.favorites >= settings.favoriteThreshold);
    if (settings.likeThreshold > 0) conditions.push(stats.likes >= settings.likeThreshold);
    if (conditions.length === 0) return false;
    return conditions.every(c => c);
  }

  function extractStats(item) {
    const stats = { upvotes: 0, comments: 0, favorites: 0, likes: 0 };

    const upvoteBtn = item.querySelector('.VoteButton');
    if (upvoteBtn) {
      const ariaLabel = upvoteBtn.getAttribute('aria-label') || '';
      const ariaMatch = ariaLabel.match(/赞同\s*([\d,.]+)/);
      if (ariaMatch) stats.upvotes = parseNumber(ariaMatch[1]);
    }

    const actionBtns = item.querySelectorAll('.ContentItem-action');
    actionBtns.forEach(btn => {
      const text = btn.textContent || '';
      const ariaLabel = btn.getAttribute('aria-label') || '';
      
      if (text.includes('评论') || ariaLabel.includes('评论')) {
        const match = text.match(/([\d,.]+)/);
        if (match) stats.comments = parseNumber(match[1]);
      }
      if (text.includes('收藏') || ariaLabel.includes('收藏')) {
        const match = text.match(/([\d,.]+)/);
        if (match) stats.favorites = parseNumber(match[1]);
      }
      if (text.includes('喜欢') || ariaLabel.includes('喜欢')) {
        const match = text.match(/([\d,.]+)/);
        if (match) stats.likes = parseNumber(match[1]);
      }
    });

    return stats;
  }

  function parseNumber(text) {
    if (!text) return 0;
    text = text.toString().replace(/,/g, '').trim();
    let mult = 1;
    if (text.endsWith('万')) { mult = 10000; text = text.slice(0, -1); }
    else if (text.endsWith('亿')) { mult = 100000000; text = text.slice(0, -1); }
    else if (text.toLowerCase().endsWith('k')) { mult = 1000; text = text.slice(0, -1); }
    else if (text.toLowerCase().endsWith('m')) { mult = 1000000; text = text.slice(0, -1); }
    const num = parseFloat(text);
    return isNaN(num) ? 0 : Math.floor(num * mult);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(processAllAnswers, 1000));
  } else {
    setTimeout(processAllAnswers, 1000);
  }
})();
