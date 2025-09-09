// js/app.js
let questions = [];
let quizQuestions = [];
let current = 0;
let userAnswers = [];
let timer = null;
let startTime = 0;
let elapsed = 0;
let totalTime = 0;

//靈活的「HTML 元素快取工具」，這樣寫的好處是你可以傳任何 HTML 元素的 id 進來，不限於 "main"。
const $ = (id) => document.getElementById(id);

//載入問題集
async function loadQuestions() {
  const res = await fetch('data/questions.json');
  questions = await res.json();
}

// 依權重抽題: 用權重把題目「複製」進池子，再隨機抽，不重覆（以 id 判斷）
function weightedRandomSample(arr, count) {
  
  let pool = [];
  arr.forEach(q => {
    let w = q.weight || 1;
    for (let i = 0; i < w; i++) pool.push(q);
  });
  let result = [];
  let used = new Set();
  while (result.length < count && pool.length > 0) {
    let idx = Math.floor(Math.random() * pool.length);
    let q = pool[idx];
    if (!used.has(q.id)) {
      result.push(q);
      used.add(q.id);
    }
    pool.splice(idx, 1); // 只移掉這一次抽到的，而不是全部
  }
  return result;
}

//顯示問題權重之清單
function showHighWeightList() {
  const list = questions.filter(q => (q.weight || 1) > 1)
    .sort((a, b) => (b.weight || 1) - (a.weight || 1));
  const block = $('high-weight-list');
  if (list.length === 0) {
    block.classList.remove('visible');
    return;
  }
  block.innerHTML = `<p style="font-weight: bold; font-size: 21px; margin: 12px 0;">高權重題目（抽中機率較高）</p><ul style="padding-left:18px;">` +
    list.map(q => `<li style="margin-bottom: 12px; "><span style="color:#1976d2; font-weight: bold; padding-right:10px;">${q.id}</span> ${q.question} <span style="color: #e7b200;">（權重${q.weight}）</span></li>`).join('') +
    `</ul>`;
  block.classList.add('visible');
}

// 首頁(標題、題號範圍、題數、考試時間、是否播放音效、開始與下載題庫按鈕、說明)
function showHome() {
  $('main').innerHTML = `
    <div class="header">網頁設計模擬試題系統</div>
    <div style="margin-bottom:16px;">
      <label class="form-title">題號範圍：
        <select id="range" style="width:50px; display:inline-block; margin-left:8px; margin-bottom:8px;">
          <option value="10">10</option>
          <option value="15">15</option>
          <option value="all" selected>全部</option>
        </select>
      </label>
      <br>
      <label class="form-title" for="count" style="margin-bottom:8px;">考題數量：
        <select id="count" style="width:50px; display:inline-block; margin-left:8px; margin-bottom:8px;">
          <option value="5">5</option>
          <option value="10">10</option>
          <option value="20" selected>20</option>
        </select>
      </label>
      <br>
      <label class="form-title" for="exam-duration">測驗時間：</label>
      <input type="number" id="exam-duration" min="1" max="999" value="60" style="width:50px; margin-left:8px; margin-bottom:8px;">
      <label for="exam-duration" style="margin-top:8px;">分鐘 (輸入 0 表示不限制測驗時間)</label>
      <br>
      <label class="form-title">播放音效：</label>
      <input type="checkbox" id="enable-sound" class="form-check-input mt-2 ms-2" style="margin-left:8px;" checked>
      <hr>
      <div>
        <button class="btn btn-green" id="start-btn"><svg class="svg-inline--fa fa-play" aria-hidden="true" focusable="false" data-prefix="fas" data-icon="play" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" data-fa-i2svg=""><path fill="currentColor" d="M73 39c-14.8-9.1-33.4-9.4-48.5-.9S0 62.6 0 80L0 432c0 17.4 9.4 33.4 24.5 41.9s33.7 8.1 48.5-.9L361 297c14.3-8.7 23-24.2 23-41s-8.7-32.2-23-41L73 39z"></path></svg>
        開始測驗</button>
        <button class="btn btn-blue" id="download-btn"><svg class="svg-inline--fa fa-download" aria-hidden="true" focusable="false" data-prefix="fas" data-icon="download" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" data-fa-i2svg=""><path fill="currentColor" d="M288 32c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 242.7-73.4-73.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l128 128c12.5 12.5 32.8 12.5 45.3 0l128-128c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L288 274.7 288 32zM64 352c-35.3 0-64 28.7-64 64l0 32c0 35.3 28.7 64 64 64l384 0c35.3 0 64-28.7 64-64l0-32c0-35.3-28.7-64-64-64l-101.5 0-45.3 45.3c-25 25-65.5 25-90.5 0L165.5 352 64 352zm368 56a24 24 0 1 1 0 48 24 24 0 1 1 0-48z"></path></svg>下載題庫</button>
      </div>
      
    </div>
    
    <div id="high-weight-list"></div>
    <div style="font-size:1.1rem;line-height:1.7;">
      <b>說明：</b>
      <ul>
        <li>本系統支援單選、複選題型，題庫可自訂權重與圖片。</li>
        <li>開始測驗前可指定題號範圍與題數，題目依權重加權隨機抽取。</li>
        <li>高權重題目會優先顯示於列表，僅供參考。</li>
        <li>作答後立即顯示正確答案與詳細說明。</li>
        <li>測驗結束後顯示分數、正確率、作答時間與錯誤題目。</li>
      </ul>
    </div>
  `;
  // 呼喚題目權重之清單的函式
  showHighWeightList();
  $('start-btn').onclick = startQuiz;
  $('download-btn').onclick = () => {
    const blob = new Blob([JSON.stringify(questions, null, 2)], {type: 'application/json'});
    //動態建立一個 <a> 標籤（超連結）
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'questions.json';
    a.click();
  };
}

// 開始測驗按鈕連結之功能
function startQuiz() {
  // 先讀取測驗時間（此時首頁還在，DOM 還在）
  const durationInput = $('exam-duration');
  const durationMinutes = durationInput ? parseInt(durationInput.value, 10) : 0;
  totalTime = (!isNaN(durationMinutes) && durationMinutes > 0)
    ? durationMinutes * 60
    : 0;

  //題號範圍，利用value取出數量
  let range = $('range').value;
  //把字串轉成整數，10 表示用十進位解析
  let count = parseInt($('count').value, 10);
  let pool = questions;
  //指抽取部分題目
  if (range !== 'all') {
    let maxId = parseInt(range, 10);
    pool = questions.filter(q => q.id <= maxId);
  }
  quizQuestions = weightedRandomSample(pool, count > pool.length ? pool.length : count);
  //現在顯示的題目索引
  current = 0;
  //清空使用者的作答記錄
  userAnswers = [];
  //測驗經過時間歸零
  elapsed = 0;
  startTime = Date.now();

  // 先有 totalTime 再渲染畫面，timeHtml 就能正確顯示「剩餘時間」
  showQuestion();
  startTimer();

  const hw = $('high-weight-list');
  if (hw) hw.classList.remove('visible');
}

//測驗時間功能設定
function startTimer() {
  if (timer) clearInterval(timer);
  startTime = Date.now();
  elapsed = 0;

  timer = setInterval(() => {
    elapsed = Math.floor((Date.now() - startTime) / 1000);

    // 如果有限制時間 → 檢查是否到期
    if (totalTime > 0) {
      let remaining = totalTime - elapsed;
      if (remaining <= 0) {
        stopTimer();
        showResult(); // 呼叫結束測驗
        return;
      }
    }
    // 每秒更新進度
    updateProgress();

  }, 1000);
}

//結束時間功能設定
function stopTimer() {
  if (timer) clearInterval(timer);
}

//時間狀態更新
function updateProgress() {
  
  if (totalTime > 0) {
    // 有限制，顯示剩餘時間
    if($('elapsed-wrapper')) $('elapsed-wrapper').style.display = 'none';
    if ($('remaining-wrapper')) {
      $('remaining-wrapper').style.display = 'inline';
      $('remaining-time').textContent = formatTime(totalTime - elapsed);
    }

  } else {
    // 無限制 → 只顯示已用時間
    if ($('remaining-wrapper')) $('remaining-wrapper').style.display = 'none';
    if ($('elapsed-wrapper')) {
      $('elapsed-wrapper').style.display = 'inline';
      $('elapsed-time').textContent = formatTime(elapsed);
    }
  }
  if ($('progress-text')) {
    $('progress-text').textContent = `第 ${current+1}/${quizQuestions.length} 題`;
  }
  
}

// 時間格式化 (秒 → mm:ss)
function formatTime(sec) {
  let m = Math.floor(sec / 60);
  let s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// 進入測驗 & 顯示問題頁面
function showQuestion() {
  let q = quizQuestions[current];

  // 題目選項
  let optionsHtml = q.options.map((opt, i) => {
    let type = q.type === 'multi' ? 'checkbox' : 'radio';
    return `<li>
      <input type="${type}" name="opt" id="opt${i}" value="${i+1}">
      <label for="opt${i}">${opt}</label>
    </li>`;
  }).join('');

  let imgHtml = q.image ? `<img src="${q.image}" class="question-img" alt="題目圖片">` : '';

  // 這裡決定時間區塊要顯示什麼
  let timeHtml = `
   <div id="time-block">
      <span id="elapsed-wrapper">已用時間：<span id="elapsed-time">00:00</span></span>
      <span id="remaining-wrapper">剩餘時間：<span id="remaining-time">00:00</span></span>
   </div>
  `;
  

  $('main').innerHTML = `
    <div class="header">網頁設計模擬試題系統</div>
    <div class="progress-row row">
      <div class="col">
        <span id="progress-text">第 ${current+1}/${quizQuestions.length} 題</span>
      </div>
      <div class="col">
        ${timeHtml}
      </div>
    </div>

    <div class="question-block">
      <div style="font-size:1.1rem;font-weight:bold;margin-bottom:8px;">${q.question}</div>
      ${imgHtml}
      <ul class="options-list">${optionsHtml}</ul>
      <button class="btn btn-green" id="submit-btn">提交答案</button>
    </div>
    <div id="NoChoice"></div>
    <div id="feedback"></div>
  `;
  updateProgress();
  $('submit-btn').onclick = submitAnswer;
}

// 提交答案的按鈕之功能設定
function submitAnswer() {
  let q = quizQuestions[current];
  let selected = [];
  document.querySelectorAll('input[name="opt"]:checked').forEach(e => {
    selected.push(parseInt(e.value, 10));
  });
  if (selected.length === 0) {
    $('NoChoice').innerHTML = '<p style="color:red">請選擇答案!</p>';
    return;
  }
  let correct = arrayEqual(selected.sort(), q.answer.slice().sort());
  userAnswers.push({selected, correct});
  showFeedback(correct, q, selected);
}

function arrayEqual(a, b) {

  //every為陣列方法
  //v為目前正在檢查的值，i為目前檢查的索引
  //比較運算會回傳 布林值
  //.every() 本身就是一個 布林判斷方法，它會回傳 true 或 false
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

// 答案回饋及音效
function showFeedback(correct, q, selected) {
  // 播放音效
  if (correct) {
    document.getElementById('audio-correct').play();
  } else {
    document.getElementById('audio-wrong').play();
  }
  // 答案回饋
  let feedback = $('feedback');
  //.map()的作用是把 q.answer 裡的每個編號，轉換成對應的文字
  let ansText = q.answer.map(i => q.options[i-1]).join(', ');
  let selText = selected.map(i => q.options[i-1]).join(', ');
  feedback.innerHTML = `
    <div style="margin:12px 0;">
      <b style="color:${correct ? '#43a047' : '#e53935'};">
        ${correct ? '✔️ 恭喜答對！' : '❌ 答錯了'}
      </b>
    </div>
    <div style="margin-bottom:8px;white-space:pre-line;">${q.explanation}</div>
    <div style="margin-bottom:8px;">
      <span style="color:#1976d2;">你的答案：</span>${selText}<br>
      <span style="color:#43a047;">正確答案：</span>${ansText}
    </div>
    <button class="btn btn-blue" id="next-btn">${current+1 === quizQuestions.length ? '看結果' : '繼續下一題'}</button>
  `;
  $('submit-btn').style.display = 'none';
  // 禁用所有選項
  document.querySelectorAll('input[name="opt"]').forEach(e => {e.disabled = true});
  $('next-btn').onclick = () => {
    if (current+1 === quizQuestions.length) {
      stopTimer();
      showResult();
    } else {
      current++;
      showQuestion();
    }
  };
}

// 顯示最終成績頁面
function showResult() {
  let correctCount = userAnswers.filter(a => a.correct).length;
  let percent = Math.round(correctCount / quizQuestions.length * 100);
  let wrongs = quizQuestions.map((q, i) => ({q, ua: userAnswers[i]}))
    .filter(x => !x.ua.correct);
  $('main').innerHTML = `
    <div class="header">網頁設計模擬試題系統</div>
    <div class="result-block">
      <div class="result-score">分數：${correctCount} / ${quizQuestions.length}</div>
      <div class="result-circle" style="--percent:${percent}%">${percent}%</div>
      <div class="result-time">總作答時間：${formatTime(elapsed)}</div>
      <button class="btn btn-blue" id="restart-btn">繼續測驗</button>
      <div class="wrong-list">
        <b class="wrongpoint">答錯題目：</b>
        ${wrongs.length === 0 ? '<div>全部答對，太厲害了！</div>' :
          wrongs.map(x => `
            <div class="wrong-item">
              <div><b>Q${x.q.id}.</b> ${x.q.question}</div>
              <div class="your-answer">你的答案：${x.ua.selected.map(i => x.q.options[i-1]).join(', ')}</div>
              <div class="correct-answer">正確答案：${x.q.answer.map(i => x.q.options[i-1]).join(', ')}</div>
              <div style="white-space:pre-line;">${x.q.explanation}</div>
            </div>
          `).join('')}
      </div>
    </div>
  `;
  animateCircle(percent); // 🎯 這裡傳入動態計算的 percent
  
  $('restart-btn').onclick = showHome;
}

function animateCircle(targetPercent){
  let circle = document.querySelector('.result-circle');
  let currentValue = 0;

  function step(){
    if(currentValue <= targetPercent){
      circle.textContent = currentValue + '%';
      circle.style.setProperty('--percent', currentValue + '%');
      currentValue++;
      requestAnimationFrame(step);
    }
  }
  step();
}


window.onload = async function() {
  await loadQuestions();
  showHome();
};

