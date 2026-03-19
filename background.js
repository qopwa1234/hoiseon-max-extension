// 회선 MAX 크롤링 노드 — 백그라운드 서비스 워커
// 확장이라 CORS 없이 모든 URL fetch 가능

let running = false;
const coordinatorUrl = 'https://crawl-coordinator.qopwa1234.workers.dev';
let doneCount = 0;
let wordCount = 0;
let abortController = null;

// 스토리지에서 설정 불러오기
chrome.storage.local.get(['running', 'doneCount', 'wordCount'], (data) => {
  doneCount = data.doneCount || 0;
  wordCount = data.wordCount || 0;
  if (data.running) {
    startCrawl();
  }
});

// popup에서 메시지 수신
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'START') {
    chrome.storage.local.set({ running: true });
    startCrawl();
    sendResponse({ ok: true });
  }
  if (msg.type === 'STOP') {
    stopCrawl();
    sendResponse({ ok: true });
  }
  if (msg.type === 'STATUS') {
    sendResponse({ running, doneCount, wordCount, coordinatorUrl });
  }
  return true;
});

function startCrawl() {
  if (running) return;
  running = true;
  abortController = new AbortController();
  const conns = 3; // 병렬 3개
  for (let i = 0; i < conns; i++) {
    crawlLoop(abortController.signal);
  }
}

function stopCrawl() {
  running = false;
  chrome.storage.local.set({ running: false });
  abortController?.abort();
}

async function crawlLoop(signal) {
  while (running && !signal.aborted) {
    try {
      // 1. 작업 요청
      const taskRes = await fetch(coordinatorUrl + '/task', { signal });
      if (!taskRes.ok) { await sleep(2000); continue; }
      const task = await taskRes.json();
      if (task.error) { await sleep(1000); continue; }

      // 2. HTML 파싱 (확장은 DOMParser 사용 가능)
      const parsed = parseHTML(task.html, task.url);
      doneCount++;
      wordCount += parsed.words;

      // 3. 결과 전송
      await fetch(coordinatorUrl + '/result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: task.id,
          url: task.url,
          title: parsed.title,
          wordCount: parsed.words,
          links: parsed.links,
          fetchedBytes: task.fetchedBytes,
        }),
        signal,
      }).catch(() => {});

      // 통계 저장
      chrome.storage.local.set({ doneCount, wordCount });

    } catch (e) {
      if (signal.aborted) break;
      await sleep(2000);
    }
  }
}

function parseHTML(html, baseUrl) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    doc.querySelectorAll('script,style,nav,footer,aside').forEach(el => el.remove());
    const text = doc.body?.textContent || '';
    const words = text.trim().split(/\s+/).filter(w => w.length > 2).length;
    const title = doc.title || '';
    const links = [...doc.querySelectorAll('a[href]')]
      .map(a => { try { return new URL(a.href, baseUrl).href; } catch { return null; } })
      .filter(h => h && h.startsWith('http') && !h.includes('#'))
      .slice(0, 20);
    return { title, words, links };
  } catch {
    return { title: '', words: 0, links: [] };
  }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
