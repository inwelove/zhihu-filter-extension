$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$expr = @'
(() => {
  const items = document.querySelectorAll('.AnswerItem, .ContentItem');
  const data = [];
  for (let i = 0; i < Math.min(3, items.length); i++) {
    const item = items[i];
    
    // Find vote button
    const voteBtn = item.querySelector('.VoteButton');
    const voteBtns = item.querySelectorAll('.VoteButton');
    const allVoteBtns = document.querySelectorAll('.VoteButton');
    
    // Try to find upvote info in various ways
    const ariaLabel = voteBtn?.getAttribute('aria-label') || '';
    const voteText = voteBtn?.textContent || '';
    
    // Check action buttons
    const actionBtns = item.querySelectorAll('.ContentItem-action, .ContentItem-actions button');
    const actionInfo = [...actionBtns].map(b => ({
      text: b.textContent?.substring(0, 30),
      aria: b.getAttribute('aria-label')
    }));
    
    // Find the actual vote element
    const voteContainer = item.querySelector('[class*="Vote"], [class*="vote"], [class*="Voter"]');
    
    data.push({
      index: i,
      voteBtnCount: voteBtns.length,
      totalVoteBtnsOnPage: allVoteBtns.length,
      ariaLabel,
      voteText: voteText.substring(0, 50),
      voteContainerClass: voteContainer?.className || 'none',
      actionInfo,
      itemClasses: item.className
    });
  }
  return JSON.stringify(data, null, 2);
})()
'@

$ws = New-Object System.Net.WebSockets.ClientWebSocket
$uri = [Uri]"ws://localhost:9222/devtools/page/3625A2438ABD56C1928B8862373EB239"
$ct = [System.Threading.CancellationToken]::None
$ws.ConnectAsync($uri, $ct).Wait()

$msg = @{ id = 1; method = "Runtime.evaluate"; params = @{ expression = $expr; returnByValue = $true } } | ConvertTo-Json -Depth 5 -Compress
$bytes = [System.Text.Encoding]::UTF8.GetBytes($msg)
$ws.SendAsync((New-Object System.ArraySegment[byte] -ArgumentList @(,$bytes)), [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $ct).Wait()

$buf = New-Object byte[] 4194304
$result = ""
do {
    $res = $ws.ReceiveAsync((New-Object System.ArraySegment[byte] -ArgumentList @(,$buf)), $ct).Result
    $result += [System.Text.Encoding]::UTF8.GetString($buf, 0, $res.Count)
} while (-not $res.EndOfMessage)

$parsed = $result | ConvertFrom-Json
Write-Output $parsed.result.result.value

$ws.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, "", $ct).Wait()
