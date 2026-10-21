// =========================================================
// advancements.js ― 進捗トラッカーを動かすプログラム
// 進捗のデータは advancements-data.js（ADVANCEMENT_DATA）にあります。
// 「//」から始まる行はメモ（コメント）で、プログラムとしては無視されます。
// =========================================================

const categories = ADVANCEMENT_DATA;


// ---------- 1. 保存の仕組み ----------
// チェック状態はブラウザの「localStorage」に保存します。
//   ふつうの進捗     → "story/mine_stone": true
//   細かい項目       → "adventure/kill_all_mobs|minecraft:zombie": true
const SAVE_KEY = "mc-advancements-v2";

function loadChecked() {
  try {
    return JSON.parse(localStorage.getItem(SAVE_KEY)) || {};
  } catch (e) {
    return {};  // 保存できない環境でもページが壊れないように
  }
}

function saveChecked() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(checked));
  } catch (e) {
    // 保存できない環境では何もしない
  }
}

let checked = loadChecked();
let currentTab = "all";   // 今選んでいるタブ
let searchWord = "";      // 検索ワード


// ---------- 2. 達成状況を調べる関数 ----------
function subKey(adv, sub) {
  return adv.id + "|" + sub[0];
}

// 細かい項目のうち、いくつ達成しているか
function subDoneCount(adv) {
  return adv.subs.filter(function (s) { return checked[subKey(adv, s)]; }).length;
}

// 進捗が達成済みかどうか（細かい項目がある進捗は、全部チェックで達成）
function isDone(adv) {
  if (adv.subs) return subDoneCount(adv) === adv.subs.length;
  return !!checked[adv.id];
}


// ---------- 3. 画面を作る ----------
const list = document.getElementById("adv-list");
const tabs = document.getElementById("tabs");
const catGrid = document.getElementById("cat-grid");

// 文字を安全にHTMLへ入れるための関数
function esc(text) {
  const div = document.createElement("div");
  div.textContent = text == null ? "" : text;
  return div.innerHTML;
}

// アイコン画像のHTML（frame によって枠の形が変わる）
function iconHtml(src, frame, small) {
  const cls = "adv-icon " + (frame || "") + (small ? " small" : "");
  if (!src) return '<span class="' + cls + ' empty"></span>';
  return '<span class="' + cls + '"><img src="' + src + '" alt="" loading="lazy"></span>';
}

// タブ（すべて / Minecraft / ネザー …）を作る
function buildTabs() {
  const all = [{ id: "all", name: "すべて" }].concat(categories);
  all.forEach(function (cat) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tab" + (cat.id === currentTab ? " active" : "");
    button.textContent = cat.name;
    button.addEventListener("click", function () {
      currentTab = cat.id;
      document.querySelectorAll(".tab").forEach(function (b) { b.classList.remove("active"); });
      button.classList.add("active");
      buildList();
    });
    tabs.appendChild(button);
  });
}

// 進捗1つ分の <li> を作る
function buildItem(cat, adv) {
  const li = document.createElement("li");
  li.className = "adv-item";

  let html =
    '<div class="adv-row">' +
      '<input type="checkbox" class="adv-check" aria-label="' + esc(adv.ja) + '">' +
      iconHtml(adv.icon, adv.frame) +
      '<div class="adv-text">' +
        '<div class="adv-name">' + esc(adv.ja) +
          (currentTab === "all" ? '<span class="adv-cat">' + esc(cat.name) + '</span>' : '') +
          (adv.frame === "challenge" ? '<span class="adv-frame">挑戦</span>' : '') +
          (adv.frame === "goal" ? '<span class="adv-frame goal">目標</span>' : '') +
        '</div>' +
        '<div class="adv-en">' + esc(adv.en) + '</div>' +
        '<div class="adv-desc">' + esc(adv.desc) + '</div>' +
      '</div>';

  // 細かい項目がある進捗には「詳細」ボタンと小さな達成率を付ける
  if (adv.subs) {
    html +=
      '<button type="button" class="sub-toggle">' +
        '<span class="sub-count"></span> ▼' +
      '</button>';
  }
  html += '</div>';

  if (adv.subs) {
    html += '<div class="sub-panel" hidden>' +
      '<div class="bar sub-bar"><div class="bar-fill"></div></div>' +
      '<div class="sub-grid">';
    adv.subs.forEach(function (s, i) {
      html +=
        '<label class="sub-item">' +
          '<input type="checkbox" data-index="' + i + '">' +
          iconHtml(s[2], "", true) +
          '<span>' + esc(s[1] || s[0]) + '</span>' +
        '</label>';
    });
    html += '</div></div>';
  }
  li.innerHTML = html;

  // --- メインのチェックボックス ---
  const mainBox = li.querySelector(".adv-check");
  mainBox.addEventListener("change", function () {
    if (adv.subs) {
      // 細かい項目がある場合は、全部まとめてチェック／解除
      if (!mainBox.checked && subDoneCount(adv) > 0 &&
          !confirm("「" + adv.ja + "」の細かい項目のチェックをすべて外します。よろしいですか？")) {
        refreshItem(li, adv);
        return;
      }
      adv.subs.forEach(function (s) {
        if (mainBox.checked) checked[subKey(adv, s)] = true;
        else delete checked[subKey(adv, s)];
      });
    } else {
      if (mainBox.checked) checked[adv.id] = true;
      else delete checked[adv.id];
    }
    saveChecked();
    refreshItem(li, adv);
    updateProgress();
  });

  // --- 細かい項目 ---
  if (adv.subs) {
    const panel = li.querySelector(".sub-panel");
    li.querySelector(".sub-toggle").addEventListener("click", function () {
      panel.hidden = !panel.hidden;
      li.classList.toggle("open", !panel.hidden);
    });
    li.querySelectorAll(".sub-item input").forEach(function (box) {
      const s = adv.subs[Number(box.dataset.index)];
      box.addEventListener("change", function () {
        if (box.checked) checked[subKey(adv, s)] = true;
        else delete checked[subKey(adv, s)];
        saveChecked();
        refreshItem(li, adv);
        updateProgress();
      });
    });
  }

  refreshItem(li, adv);
  return li;
}

// 進捗1つ分の表示（チェック状態・達成数）を最新にする
function refreshItem(li, adv) {
  const done = isDone(adv);
  const mainBox = li.querySelector(".adv-check");
  mainBox.checked = done;
  li.classList.toggle("done", done);

  if (adv.subs) {
    const n = subDoneCount(adv);
    mainBox.indeterminate = n > 0 && !done;   // 途中のときは「－」表示
    li.querySelector(".sub-count").textContent = n + " / " + adv.subs.length;
    li.querySelector(".sub-bar .bar-fill").style.width = (n / adv.subs.length * 100) + "%";
    li.querySelectorAll(".sub-item input").forEach(function (box) {
      const s = adv.subs[Number(box.dataset.index)];
      box.checked = !!checked[subKey(adv, s)];
      box.parentElement.classList.toggle("checked", box.checked);
    });
  }
}

// 検索ワードに合うかどうか（日本語名・英語名・細かい項目の名前で探す）
function matches(adv) {
  if (!searchWord) return true;
  const w = searchWord.toLowerCase();
  const texts = [adv.ja, adv.en, adv.desc];
  if (adv.subs) adv.subs.forEach(function (s) { texts.push(s[1]); });
  return texts.some(function (t) { return t && t.toLowerCase().indexOf(w) !== -1; });
}

// 進捗リストを作る
function buildList() {
  list.innerHTML = "";
  let count = 0;
  categories.forEach(function (cat) {
    if (currentTab !== "all" && currentTab !== cat.id) return;
    cat.items.forEach(function (adv) {
      if (!matches(adv)) return;
      list.appendChild(buildItem(cat, adv));
      count++;
    });
  });
  if (count === 0) {
    list.innerHTML = '<li class="adv-empty">見つかりませんでした</li>';
  }
}

// 達成率（全体とカテゴリー別）を計算して表示する
function updateProgress() {
  let totalDone = 0;
  let totalAll = 0;
  catGrid.innerHTML = "";

  categories.forEach(function (cat) {
    const all = cat.items.length;
    const done = cat.items.filter(isDone).length;
    const percent = Math.round((done / all) * 100);
    totalDone += done;
    totalAll += all;

    const box = document.createElement("div");
    box.className = "cat-box" + (done === all ? " complete" : "");
    box.innerHTML =
      iconHtml(cat.items[0].icon, "", true) +
      "<h3>" + esc(cat.name) + "</h3>" +
      '<p class="cat-num">' + done + " / " + all + "（" + percent + "%）</p>" +
      '<div class="bar"><div class="bar-fill" style="width:' + percent + '%"></div></div>';
    catGrid.appendChild(box);
  });

  const totalPercent = totalAll ? Math.round((totalDone / totalAll) * 100) : 0;
  document.getElementById("total-text").textContent =
    totalDone + " / " + totalAll + "（" + totalPercent + "%）";
  document.getElementById("total-bar").style.width = totalPercent + "%";
}


// ---------- 4. ボタンの動き ----------
// 「達成済みを隠す」
document.getElementById("hide-done").addEventListener("change", function (e) {
  list.classList.toggle("hide-done", e.target.checked);
});

// 検索ボックス
document.getElementById("search").addEventListener("input", function (e) {
  searchWord = e.target.value.trim();
  buildList();
});

// 「リセット」（確認してから全部のチェックを外す）
document.getElementById("reset").addEventListener("click", function () {
  if (confirm("すべてのチェックを外します。よろしいですか？")) {
    checked = {};
    saveChecked();
    buildList();
    updateProgress();
  }
});


// ---------- 5. 最初に一度だけ実行 ----------
buildTabs();
buildList();
updateProgress();
