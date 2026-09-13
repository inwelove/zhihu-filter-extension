(() => {
  'use strict';

  // 覆盖 document.hidden
  Object.defineProperty(Document.prototype, 'hidden', {
    get: () => false,
    configurable: true
  });

  // 覆盖 document.visibilityState
  Object.defineProperty(Document.prototype, 'visibilityState', {
    get: () => 'visible',
    configurable: true
  });

  // 覆盖 document.webkitHidden (Safari/旧版Chrome)
  if ('webkitHidden' in document) {
    Object.defineProperty(Document.prototype, 'webkitHidden', {
      get: () => false,
      configurable: true
    });
  }

  // 覆盖 document.webkitVisibilityState
  if ('webkitVisibilityState' in document) {
    Object.defineProperty(Document.prototype, 'webkitVisibilityState', {
      get: () => 'visible',
      configurable: true
    });
  }

  // 覆盖 document.hasFocus
  Document.prototype.hasFocus = () => true;

  // 阻止 visibilitychange 事件
  const originalAddEventListener = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function(type, listener, options) {
    if (type === 'visibilitychange' || type === 'webkitvisibilitychange') {
      return; // 不注册这些事件
    }
    return originalAddEventListener.call(this, type, listener, options);
  };

  // 阻止 window blur 事件
  window.addEventListener('blur', (e) => {
    e.stopImmediatePropagation();
  }, true);

  window.addEventListener('focus', (e) => {
    e.stopImmediatePropagation();
  }, true);

  // 标记注入完成
  window.__ZHIHU_KEEP_ALIVE_INJECTED__ = true;
})();
