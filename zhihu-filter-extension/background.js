const DEFAULT_SETTINGS = {
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

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.storage.local.set({ zhihuFilterSettings: DEFAULT_SETTINGS });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getSettings') {
    chrome.storage.local.get('zhihuFilterSettings', (result) => {
      sendResponse(result.zhihuFilterSettings || DEFAULT_SETTINGS);
    });
    return true;
  }
});
