document.addEventListener('DOMContentLoaded', () => {
  const $ = (id) => document.getElementById(id);
  
  const fields = {
    upvoteThreshold: $('upvoteThreshold'),
    commentThreshold: $('commentThreshold'),
    favoriteThreshold: $('favoriteThreshold'),
    likeThreshold: $('likeThreshold'),
    maxMatchCount: $('maxMatchCount'),
    highlightColor: $('highlightColor'),
    glowColor: $('glowColor'),
    highlightColorText: $('highlightColorText'),
    glowColorText: $('glowColorText')
  };

  const toggles = {
    enable: $('enableToggle'),
    highlight: $('highlightToggle'),
    hide: $('hideToggle'),
    breathe: $('breatheToggle'),
    keepAlive: $('keepAliveToggle'),
    questionPage: $('questionPageToggle'),
    profilePage: $('profilePageToggle'),
    shortComment: $('shortCommentToggle')
  };

  const sliders = {
    breatheIntensity: $('breatheIntensity'),
    breatheSpeed: $('breatheSpeed')
  };

  const sliderValues = {
    breatheIntensity: $('breatheIntensityValue'),
    breatheSpeed: $('breatheSpeedValue')
  };

  const breatheSliders = $('breatheSliders');
  const themeSwitch = $('themeSwitch');
  const themeIcon = $('themeIcon');
  const saveBtn = $('saveBtn');
  const applyBtn = $('applyBtn');
  const statusBar = $('statusBar');
  const statusText = $('statusText');
  const previewAnswer = $('previewAnswer');

  let currentTheme = 'dark';

  // ============ 工具函数 ============

  function isValidHex(color) {
    return /^#[0-9a-fA-F]{6}$/.test(color);
  }

  function normalizeHex(value) {
    let val = value.trim();
    if (!val.startsWith('#')) val = '#' + val;
    return val;
  }

  function setToggle(toggle, active) {
    toggle.classList[active ? 'add' : 'remove']('active');
  }

  // ============ 颜色同步 ============

  function setupColorSync(colorPicker, textInput) {
    colorPicker.addEventListener('input', (e) => {
      textInput.value = e.target.value;
      updatePreview();
    });

    textInput.addEventListener('input', (e) => {
      if (isValidHex(e.target.value)) {
        colorPicker.value = e.target.value;
        updatePreview();
      }
    });

    textInput.addEventListener('blur', (e) => {
      const val = normalizeHex(e.target.value);
      if (isValidHex(val)) {
        e.target.value = val;
        colorPicker.value = val;
        updatePreview();
      } else {
        e.target.value = colorPicker.value;
      }
    });
  }

  setupColorSync(fields.highlightColor, fields.highlightColorText);
  setupColorSync(fields.glowColor, fields.glowColorText);

  // ============ 主题 ============

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
  }

  function loadTheme() {
    chrome.storage.local.get('zhihuTheme', (result) => {
      currentTheme = result.zhihuTheme || 'dark';
      applyTheme(currentTheme);
    });
  }

  themeSwitch.addEventListener('click', () => {
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(currentTheme);
    chrome.storage.local.set({ zhihuTheme: currentTheme });
  });

  loadTheme();

  // ============ 开关 ============

  Object.values(toggles).forEach(t => {
    t.addEventListener('click', () => {
      t.classList.toggle('active');
      if (t === toggles.breathe) {
        breatheSliders.style.display = toggles.breathe.classList.contains('active') ? 'block' : 'none';
      }
      if (t === toggles.shortComment) {
        shortCommentSliders.style.display = toggles.shortComment.classList.contains('active') ? 'block' : 'none';
      }
      updatePreview();
    });
  });

  // ============ 滑块 ============

  sliders.breatheIntensity.addEventListener('input', (e) => {
    sliderValues.breatheIntensity.textContent = e.target.value + '%';
    updatePreview();
  });

  sliders.breatheSpeed.addEventListener('input', (e) => {
    sliderValues.breatheSpeed.textContent = (e.target.value / 10).toFixed(1) + 's';
    updatePreview();
  });

  // ============ 保存/应用 ============

  function getSettings() {
    return {
      enabled: toggles.enable.classList.contains('active'),
      highlight: toggles.highlight.classList.contains('active'),
      hide: toggles.hide.classList.contains('active'),
      breathe: toggles.breathe.classList.contains('active'),
      keepAlive: toggles.keepAlive.classList.contains('active'),
      questionPage: toggles.questionPage.classList.contains('active'),
      profilePage: toggles.profilePage.classList.contains('active'),
      shortComment: toggles.shortComment.classList.contains('active'),
      upvoteThreshold: parseInt(fields.upvoteThreshold.value) || 0,
      commentThreshold: parseInt(fields.commentThreshold.value) || 0,
      favoriteThreshold: parseInt(fields.favoriteThreshold.value) || 0,
      likeThreshold: parseInt(fields.likeThreshold.value) || 0,
      maxMatchCount: fields.maxMatchCount.value === '' ? 50 : parseInt(fields.maxMatchCount.value),
      highlightColor: fields.highlightColor.value,
      glowColor: fields.glowColor.value,
      breatheIntensity: parseInt(sliders.breatheIntensity.value) || 50,
      breatheSpeed: parseInt(sliders.breatheSpeed.value) || 20
    };
  }

  function saveAndApply() {
    const settings = getSettings();
    chrome.storage.local.set({ zhihuFilterSettings: settings }, () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'applyFilter', settings }, () => {
            if (chrome.runtime.lastError) return;
          });
        }
      });
    });
  }

  saveBtn.addEventListener('click', () => {
    saveAndApply();
    showStatus('设置已保存', true);
  });

  applyBtn.addEventListener('click', () => {
    saveAndApply();
    showStatus('筛选已应用', true);
  });

  // ============ 加载设置 ============

  function loadSettings() {
    chrome.storage.local.get('zhihuFilterSettings', (result) => {
      if (result.zhihuFilterSettings) {
        const s = result.zhihuFilterSettings;
        fields.upvoteThreshold.value = s.upvoteThreshold || 100;
        fields.commentThreshold.value = s.commentThreshold || 0;
        fields.favoriteThreshold.value = s.favoriteThreshold || 0;
        fields.likeThreshold.value = s.likeThreshold || 0;
        fields.maxMatchCount.value = s.maxMatchCount !== undefined ? s.maxMatchCount : 50;
        fields.highlightColor.value = s.highlightColor || '#0084ff';
        fields.glowColor.value = s.glowColor || '#0066cc';
        fields.highlightColorText.value = s.highlightColor || '#0084ff';
        fields.glowColorText.value = s.glowColor || '#0066cc';
        sliders.breatheIntensity.value = s.breatheIntensity || 50;
        sliders.breatheSpeed.value = s.breatheSpeed || 20;
        sliderValues.breatheIntensity.textContent = (s.breatheIntensity || 50) + '%';
        sliderValues.breatheSpeed.textContent = ((s.breatheSpeed || 20) / 10).toFixed(1) + 's';

        setToggle(toggles.enable, s.enabled);
        setToggle(toggles.highlight, s.highlight);
        setToggle(toggles.hide, s.hide);
        setToggle(toggles.breathe, s.breathe);
        setToggle(toggles.keepAlive, s.keepAlive);
        setToggle(toggles.questionPage, s.questionPage);
        setToggle(toggles.profilePage, s.profilePage);
        setToggle(toggles.shortComment, s.shortComment);

        breatheSliders.style.display = toggles.breathe.classList.contains('active') ? 'block' : 'none';
        updatePreview();
      }
    });
  }

  // ============ 预览 ============

  function updatePreview() {
    const color = fields.highlightColor.value;
    const glow = fields.glowColor.value;
    const breathe = toggles.breathe.classList.contains('active');

    previewAnswer.style.borderLeftColor = color;
    previewAnswer.style.boxShadow = breathe ? `0 0 15px ${glow}40, 0 0 30px ${glow}20` : 'none';
    previewAnswer.style.animation = breathe ? 'preview-breathe 2s ease-in-out infinite' : 'none';
  }

  // ============ 状态 ============

  function showStatus(msg, ok) {
    statusText.textContent = msg;
    statusBar.className = ok ? 'status-bar active' : 'status-bar';
    setTimeout(() => {
      statusText.textContent = '就绪';
      statusBar.className = 'status-bar';
    }, 2000);
  }

  // ============ 初始化 ============

  loadSettings();
  updatePreview();
});
