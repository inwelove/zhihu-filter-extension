$ws = New-Object System.Net.WebSockets.ClientWebSocket
$uri = [Uri]"ws://localhost:9222/devtools/page/AECE4A44D02DC2A15C6C0587C8ECB749"
$ct = [System.Threading.CancellationToken]::None
$ws.ConnectAsync($uri, $ct).Wait()

function Send-CdpCommand($id, $method, $expression) {
    $msg = @{
        id = $id
        method = $method
        params = @{
            expression = $expression
            returnByValue = $true
        }
    } | ConvertTo-Json -Depth 5 -Compress
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($msg)
    $seg = New-Object System.ArraySegment[byte] -ArgumentList @(,$bytes)
    $ws.SendAsync($seg, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $ct).Wait()
    
    $buf = New-Object byte[] 1048576
    $result = ""
    do {
        $seg2 = New-Object System.ArraySegment[byte] -ArgumentList @(,$buf)
        $res = $ws.ReceiveAsync($seg2, $ct).Result
        $result += [System.Text.Encoding]::UTF8.GetString($buf, 0, $res.Count)
    } while (-not $res.EndOfMessage)
    return $result
}

function Invoke-CdpEval($id, $expr, $label) {
    Write-Host "`n$('=' * 60)"
    Write-Host "  $label"
    Write-Host "$('=' * 60)"
    $raw = Send-CdpCommand $id "Runtime.evaluate" $expr
    $parsed = $raw | ConvertFrom-Json
    $val = $parsed.result.result.value
    Write-Host $val
    return $val
}

# Expression 4: Discover DOM structure
$expr4 = @"
(() => {
  const items = document.querySelectorAll('.List-item');
  let result = 'List-item count: ' + items.length + '\n';
  if (items.length > 0) {
    const item = items[0];
    result += 'First List-item classes:\n';
    result += [...item.querySelectorAll('[class]')].slice(0, 20).map(e => e.className.substring(0, 80)).join('\n');
  }
  const allClasses = new Set();
  document.querySelectorAll('[class]').forEach(el => {
    const c = el.className;
    if (typeof c === 'string' && (c.includes('Content') || c.includes('Rich') || c.includes('Answer') || c.includes('Feed') || c.includes('Item') || c.includes('collaps') || c.includes('expand'))) {
      allClasses.add(c.substring(0, 100));
    }
  });
  result += '\n\nRelevant classes found:\n' + [...allClasses].slice(0, 40).join('\n');
  return result;
})()
"@

Invoke-CdpEval 4 $expr4 "Expression 4: DOM structure discovery"

# Expression 1: Answer cards content
$expr1 = @"
(() => {
  const selectors = ['.FeedItem', '.ContentItem', '.AnswerItem', '.List-item'];
  let found = '';
  for (const sel of selectors) {
    const count = document.querySelectorAll(sel).length;
    found += sel + ': ' + count + ' found\n';
  }
  const items = document.querySelectorAll('.List-item .ContentItem, .FeedItem, .AnswerItem, .ContentItem');
  const results = [];
  for (let i = 0; i < Math.min(3, items.length); i++) {
    const item = items[i];
    const richContent = item.querySelector('.RichContent-inner');
    const richText = item.querySelector('.RichText');
    results.push({
      index: i,
      classes: item.className?.substring(0, 100),
      innerText: richContent?.innerText?.substring(0, 300),
      richTextInnerText: richText?.innerText?.substring(0, 300),
      richTextHTML: richContent?.innerHTML?.substring(0, 500),
    });
  }
  return found + '\nResults:\n' + JSON.stringify(results, null, 2);
})()
"@

Invoke-CdpEval 1 $expr1 "Expression 1: Answer cards content inspection"

# Expression 3: Collapse state
$expr3 = @"
(() => {
  const items = document.querySelectorAll('.ContentItem, .FeedItem, .AnswerItem');
  const results = [];
  for (let i = 0; i < Math.min(3, items.length); i++) {
    const item = items[i];
    const richContent = item.querySelector('.RichContent-inner');
    const richText = richContent?.querySelector('.RichText');
    const collapseBtn = item.querySelector('.ContentItem-more, .ContentItem-expandButton, button');
    const cs = richContent ? getComputedStyle(richContent) : null;
    results.push({
      index: i,
      fullTextLength: richText?.textContent?.length,
      displayTextLength: richContent?.innerText?.length,
      maxHeight: cs?.maxHeight,
      overflow: cs?.overflow,
      textOverflow: cs?.textOverflow,
      expandBtnText: collapseBtn?.textContent?.trim()?.substring(0, 50),
      richContentClasses: richContent?.className,
    });
  }
  return JSON.stringify(results, null, 2);
})()
"@

Invoke-CdpEval 3 $expr3 "Expression 3: Collapse state & overflow analysis"

# Expression 2: __NEXT_DATA__
$expr2 = @"
(() => {
  const scripts = document.querySelectorAll('script');
  let nextData = '';
  for (const s of scripts) {
    if (s.id === '__NEXT_DATA__') {
      nextData += 'ID=__NEXT_DATA__:\n' + s.textContent.substring(0, 2000) + '\n---\n';
    }
  }
  for (const s of scripts) {
    const t = s.textContent;
    if (t && (t.includes('"initialData"') || t.includes('"answer"') || t.includes('"content"'))) {
      nextData += 'SCRIPT with answer/initialData (500 chars):\n' + t.substring(0, 500) + '\n---\n';
      if (nextData.length > 3000) break;
    }
  }
  return nextData || 'No __NEXT_DATA__ or answer scripts found';
})()
"@

Invoke-CdpEval 2 $expr2 "Expression 2: __NEXT_DATA__ / initialData search"

$ws.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, "", $ct).Wait()
