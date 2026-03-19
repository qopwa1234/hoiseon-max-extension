let isRunning = false;

// 현재 상태 불러오기
chrome.runtime.sendMessage({ type: 'STATUS' }, (res) => {
  if (!res) return;
  isRunning = res.running;
  updateUI(res.doneCount || 0, res.wordCount || 0);
});

function toggle() {
  if (!isRunning) {
    chrome.runtime.sendMessage({ type: 'START' }, () => {
      isRunning = true;
      updateUI();
    });
  } else {
    chrome.runtime.sendMessage({ type: 'STOP' }, () => {
      isRunning = false;
      updateUI();
    });
  }
}

function updateUI(done, words) {
  const badge = document.getElementById('badge');
  const btn   = document.getElementById('startBtn');
  if (isRunning) {
    badge.textContent = '● 실행 중';
    badge.className = 'status-badge on';
    btn.textContent = '중지';
    btn.className = 'btn btn-stop';
  } else {
    badge.textContent = '● 대기 중';
    badge.className = 'status-badge off';
    btn.textContent = '시작';
    btn.className = 'btn btn-start';
  }
  if (done  !== undefined) document.getElementById('done').textContent  = done.toLocaleString();
  if (words !== undefined) document.getElementById('words').textContent = words.toLocaleString();
}

// 1초마다 통계 갱신
setInterval(() => {
  chrome.runtime.sendMessage({ type: 'STATUS' }, (res) => {
    if (res) updateUI(res.doneCount, res.wordCount);
  });
}, 1000);
