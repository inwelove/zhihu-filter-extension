import json
import asyncio
import websockets
import sys

WS_URL = "ws://localhost:9222/devtools/page/AECE4A44D02DC2A15C6C0587C8ECB749"

EXPR1 = """
(() => {
  const items = document.querySelectorAll('.FeedItem, .ContentItem, .AnswerItem');
  const results = [];
  for (let i = 0; i < Math.min(3, items.length); i++) {
    const item = items[i];
    const richContent = item.querySelector('.RichContent-inner');
    const richText = item.querySelector('.RichText');
    const collapse = item.querySelector('.ContentItem-expandButton, .RichContent-inner .ContentItem-more, .RichContent-actions button');
    results.push({
      index: i,
      innerText: richContent?.innerText?.substring(0, 200),
      richTextInnerText: richText?.innerText?.substring(0, 200),
      richTextHTML: richContent?.innerHTML?.substring(0, 500),
      expandButton: collapse?.textContent?.trim(),
      dataAttrs: [...item.attributes].map(a => a.name + '=' + (a.value || '').substring(0, 50)),
      isCollapsed: richContent?.classList?.contains('RichContent-inner--collapsed') || item.querySelector('[class*=collaps]')?.className || 'unknown'
    });
  }
  return JSON.stringify(results, null, 2);
})()
"""

EXPR2 = """
(() => {
  const scripts = document.querySelectorAll('script');
  let nextData = '';
  for (const s of scripts) {
    if (s.id === '__NEXT_DATA__' || s.textContent.includes('initialData') || s.textContent.includes('"answer"')) {
      nextData += s.textContent.substring(0, 1000) + '\\n---\\n';
    }
  }
  return nextData || 'No __NEXT_DATA__ found';
})()
"""

EXPR3 = """
(() => {
  const items = document.querySelectorAll('.FeedItem, .ContentItem, .AnswerItem');
  const results = [];
  for (let i = 0; i < Math.min(3, items.length); i++) {
    const item = items[i];
    const richContent = item.querySelector('.RichContent-inner');
    const richText = richContent?.querySelector('.RichText');
    const collapseBtn = item.querySelector('.ContentItem-more, .ContentItem-expandButton, button[aria-label*="展开"], button[aria-label*="阅读全文"]');
    const isCollapsed = richContent?.style?.maxHeight || getComputedStyle(richContent || document.body).maxHeight;
    results.push({
      index: i,
      fullTextLength: richText?.textContent?.length,
      displayTextLength: richContent?.innerText?.length,
      computedMaxHeight: isCollapsed,
      expandBtnText: collapseBtn?.textContent?.trim(),
      richTextClasses: richText?.className,
      richContentClasses: richContent?.className,
      hasHiddenOverflow: getComputedStyle(richContent || document.body).overflow,
    });
  }
  return JSON.stringify(results, null, 2);
})()
"""

EXPR4 = """
(() => {
  const items = document.querySelectorAll('.List-item');
  let result = 'List-item count: ' + items.length + '\\n';
  if (items.length > 0) {
    const item = items[0];
    result += 'First List-item innerHTML (500 chars): ' + item.innerHTML.substring(0, 500);
  }
  const allClasses = new Set();
  document.querySelectorAll('[class*="Content"], [class*="Rich"], [class*="Answer"], [class*="Item"]').forEach(el => {
    allClasses.add(el.className.substring(0, 80));
  });
  result += '\\n\\nRelevant classes found:\\n' + [...allClasses].slice(0, 30).join('\\n');
  return result;
})()
"""

async def evaluate(ws, expr, label):
    msg = json.dumps({"id": 1, "method": "Runtime.evaluate", "params": {"expression": expr, "returnByValue": True}})
    await ws.send(msg)
    resp = await asyncio.wait_for(ws.recv(), timeout=10)
    data = json.loads(resp)
    val = data.get("result", {}).get("result", {}).get("value", "")
    print(f"\n{'='*60}")
    print(f"  {label}")
    print(f"{'='*60}")
    print(val)
    return val

async def main():
    async with websockets.connect(WS_URL, max_size=10**7) as ws:
        await evaluate(ws, EXPR4, "Expression 4: Available DOM classes & structure")
        await evaluate(ws, EXPR1, "Expression 1: Answer cards content inspection")
        await evaluate(ws, EXPR3, "Expression 3: Collapse state & overflow analysis")
        await evaluate(ws, EXPR2, "Expression 2: __NEXT_DATA__ / initialData search")

asyncio.run(main())
