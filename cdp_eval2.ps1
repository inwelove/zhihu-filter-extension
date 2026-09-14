$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$ws = New-Object System.Net.WebSockets.ClientWebSocket
$uri = [Uri]"ws://localhost:9222/devtools/page/AECE4A44D02DC2A15C6C0587C8ECB749"
$ct = [System.Threading.CancellationToken]::None
$ws.ConnectAsync($uri, $ct).Wait()

function Send-CdpCommand($id, $method, $expression) {
    $msg = @{ id = $id; method = $method; params = @{ expression = $expression; returnByValue = $true } } | ConvertTo-Json -Depth 5 -Compress
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($msg)
    $ws.SendAsync((New-Object System.ArraySegment[byte] -ArgumentList @(,$bytes)), [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $ct).Wait()
    $buf = New-Object byte[] 1048576
    $result = ""
    do {
        $res = $ws.ReceiveAsync((New-Object System.ArraySegment[byte] -ArgumentList @(,$buf)), $ct).Result
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
    Write-Host $parsed.result.result.value
}

# Expression 1: Answer cards
$expr1 = @"
(() => {
  const items = document.querySelectorAll('.ContentItem.AnswerItem');
  const results = [];
  for (let i = 0; i < Math.min(3, items.length); i++) {
    const item = items[i];
    const richContent = item.querySelector('.RichContent-inner');
    const richText = item.querySelector('.RichText');
    results.push({
      index: i,
      innerText: richContent?.innerText?.substring(0, 300),
      richTextTextContent: richText?.textContent?.substring(0, 300),
      richTextHTML: richContent?.innerHTML?.substring(0, 600),
    });
  }
  return JSON.stringify(results, null, 2);
})()
"@
Invoke-CdpEval 1 $expr1 "Expression 1: Answer cards content"

# Expression 2: __INITIAL_STATE__ / initialState
$expr2 = @"
(() => {
  const scripts = document.querySelectorAll('script');
  for (const s of scripts) {
    const t = s.textContent;
    if (t && t.includes('"answers"')) {
      const match = t.match(/"answers"\s*:\s*\{([^}]{0,500})/);
      if (match) return 'answers data snippet: ' + match[0].substring(0, 400);
    }
  }
  return 'no answers data found in scripts';
})()
"@
Invoke-CdpEval 2 $expr2 "Expression 2: initialState.answers data"

# Expression 3: Check for hidden full content
$expr3 = @"
(() => {
  const items = document.querySelectorAll('.ContentItem.AnswerItem');
  const results = [];
  for (let i = 0; i < Math.min(3, items.length); i++) {
    const item = items[i];
    const richContent = item.querySelector('.RichContent-inner');
    const richText = richContent?.querySelector('.RichText');
    const contentSpan = richText?.querySelector('#content');
    const allHidden = richContent?.querySelectorAll('[style*="display:none"], [style*="display: none"], [hidden]');
    const cs = richContent ? getComputedStyle(richContent) : null;
    results.push({
      index: i,
      fullTextLen: richText?.textContent?.length,
      contentSpanText: contentSpan?.textContent?.substring(0, 200),
      hiddenElements: allHidden?.length || 0,
      maxHeight: cs?.maxHeight,
      overflow: cs?.overflow,
      classes: richContent?.className,
      isCollapsed: richContent?.classList?.contains('is-collapsed') || item.querySelector('.RichContent.is-collapsed') !== null,
    });
  }
  return JSON.stringify(results, null, 2);
})()
"@
Invoke-CdpEval 3 $expr3 "Expression 3: Hidden content check"

# Expression 4: Check the answer entity data in initialState
$expr4 = @"
(() => {
  const scripts = document.querySelectorAll('script');
  for (const s of scripts) {
    const t = s.textContent;
    if (t && t.includes('"initialState"')) {
      try {
        const data = JSON.parse(t);
        const answers = data?.initialState?.entities?.answers;
        if (answers) {
          const keys = Object.keys(answers);
          const sample = keys.slice(0, 2).map(k => ({id: k, ...answers[k]}));
          return JSON.stringify({totalAnswers: keys.length, sampleKeys: keys.slice(0, 5), sample}, null, 2);
        }
        return 'answers entity is empty or missing';
      } catch(e) {
        return 'parse error: ' + e.message;
      }
    }
  }
  return 'no initialState script found';
})()
"@
Invoke-CdpEval 4 $expr4 "Expression 4: initialState entity data"

# Expression 5: Check AnswerItem data attributes
$expr5 = @"
(() => {
  const item = document.querySelector('.ContentItem.AnswerItem');
  if (!item) return 'no AnswerItem found';
  const attrs = [...item.attributes].map(a => a.name + '=' + (a.value || '').substring(0, 100));
  const dataElems = item.querySelectorAll('[data-za-extra-module], [data-zop], [data-aid], [data-cv-a]');

  const dataAttrs = [];
  dataElems.forEach(el => {
    [...el.attributes].filter(a => a.name.startsWith('data-')).forEach(a => {
      dataAttrs.push(el.tagName + '.' + a.name + '=' + a.value?.substring(0, 200));
    });
  });

  return JSON.stringify({
    itemAttrs: attrs,
    dataElements: dataAttrs.slice(0, 10),
    itemHTML: item.outerHTML.substring(0, 500)
  }, null, 2);
})()
"@
Invoke-CdpEval 5 $expr5 "Expression 5: AnswerItem data attributes"

$ws.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, "", $ct).Wait()
