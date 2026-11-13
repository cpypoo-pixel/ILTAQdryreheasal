(function () {
  "use strict";
  var CFG = window.ILTA_CONFIG || {};
  var VER = (window.ILTA_VERSION === "B") ? "B" : "A";
  var PROBLEMS = window.PROBLEMS || [];

  // ── 오픈 후 전환 ─────────────────────────────
  try {
    if (CFG.OPEN_URL && CFG.OPEN_AT && Date.now() >= new Date(CFG.OPEN_AT).getTime()) {
      location.replace(CFG.OPEN_URL);
      return;
    }
  } catch (e) {}

  // ── 버전별 문구 ──────────────────────────────
  // ※ 노란색(todo) 표시가 있는 문구는 확정 전 임시 문구입니다.
  var TEXT = {
    A: {
      tag: "오늘의 문제",
      lead: "정답을 입력하고 제출해 보세요.",
      inputLabel: "정답",
      inputHint: "숫자만 입력하세요.",
      placeholder: "예: 123",
      submit: "제출하기",
      slipLabel: "제출한 답",
      resultTitle: "답안을 제출했어요!",
      resultBody: "아직 응모 전이에요. 정답은 확인 후 연락드려요.",
      revealKicker: "출제 정보",
      revealTitle: "이 문제, 사실 AI가 만들었어요",
      revealBody: "수학일타Q의 AI가 만든 문제입니다. 사전예약하면 이런 문제를 직접 만들어 볼 수 있어요.",
      rewardTitle: "스타벅스 기프티콘 추첨",
      rewardBody: "이름·연락처를 남기면 추첨에 응모돼요. 당첨되면 그 연락처로 안내드려요."
    },
    B: {
      tag: "오류 찾기",
      lead: "이 문제에서 오류나 반례를 찾으면 적어 주세요.",
      inputLabel: "반례",
      inputHint: "글로 간단히 적어 주세요.",
      placeholder: "예: n=2일 때 조건이 성립하지 않습니다.",
      submit: "제출하기",
      slipLabel: "제출한 반례",
      resultTitle: "제보해 주셔서 감사해요!",
      resultBody: "아직 응모 전이에요. 제출하신 내용은 검토 후 연락드려요.",
      revealKicker: "검증 참여",
      revealTitle: "문제 검증에 참여하셨어요",
      revealBody: "수학일타Q는 문제를 꼼꼼히 검증하려고 합니다.",
      rewardTitle: "백화점 상품권 10만 원 · 맞춤 템플릿 추첨",
      rewardBody: "이름·연락처를 남기면 추첨에 응모돼요. 당첨되면 그 연락처로 안내드려요."
    }
  }[VER];

  // ── 도우미 ──────────────────────────────────
  function $(id) { return document.getElementById(id); }
  function sid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  var SID = sid();
  var state = { problem: null, shownAt: null, answer: "", solveSec: null };

  function send(type, data) {
    var body = { type: type, sid: SID, ver: VER, ts: new Date().toISOString() };
    for (var k in data) body[k] = data[k];
    try { console.log("[ilta]", body); } catch (e) {}
    if (!CFG.ENDPOINT) {
      try {
        var log = JSON.parse(localStorage.getItem("ilta_dev_log") || "[]");
        log.push(body);
        localStorage.setItem("ilta_dev_log", JSON.stringify(log.slice(-50)));
      } catch (e) {}
      return Promise.resolve();
    }
    return fetch(CFG.ENDPOINT, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(body),
      keepalive: true
    }).catch(function () {});
  }

  // 머리말 오른쪽: 문제 화면에서는 경과 시간, 나머지 화면에서는 단계 이름
  var HR = { result: "제출 완료", apply: "사전예약" };
  function fmt(sec) {
    var m = Math.floor(sec / 60), s = sec % 60;
    return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
  }
  function tick() {
    if (state.submitted || !state.shownAt) return;
    $("hr").textContent = "경과 " + fmt(Math.floor((Date.now() - state.shownAt) / 1000));
  }
  function show(name) {
    ["problem", "result", "apply"].forEach(function (n) {
      $("s-" + n).classList.toggle("on", n === name);
    });
    if (name === "problem") tick(); else $("hr").textContent = HR[name];
    window.scrollTo(0, 0);
  }

  function renderMath(el) {
    if (window.renderMathInElement) {
      window.renderMathInElement(el, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "$", right: "$", display: false }
        ],
        throwOnError: false
      });
    }
  }

  // 가운데 정렬 큰 수식이 화면보다 넓으면 한 줄을 유지한 채 글자 크기를 줄임
  function fitMath(root) {
    var list = root.querySelectorAll(".katex-display");
    for (var i = 0; i < list.length; i++) {
      var d = list[i], k = d.querySelector(".katex");
      if (!k) continue;
      k.style.fontSize = "";
      for (var pass = 0; pass < 3; pass++) {
        var bases = k.querySelectorAll(".katex-html > .base"), w = 0;
        for (var j = 0; j < bases.length; j++) w += bases[j].getBoundingClientRect().width;
        var cw = d.clientWidth;
        if (!(w > cw && cw > 0)) break;
        var fs = parseFloat(getComputedStyle(k).fontSize);
        k.style.fontSize = Math.max(fs * cw / w * 0.98, 9) + "px";
      }
    }
  }

  // ── 문제 뽑기 ───────────────────────────────
  function pickProblem() {
    if (!PROBLEMS.length) return null;
    if (CFG.ALLOW_PREVIEW_PARAM) {
      var m = /[?&]p=(\d+)/.exec(location.search);
      if (m && PROBLEMS[+m[1] - 1]) return PROBLEMS[+m[1] - 1];
    }
    var last = null;
    try { last = localStorage.getItem("ilta_last"); } catch (e) {}
    var pool = PROBLEMS.filter(function (p) { return p.id !== last; });
    if (!pool.length) pool = PROBLEMS;
    var p = pool[Math.floor(Math.random() * pool.length)];
    try { localStorage.setItem("ilta_last", p.id); } catch (e) {}
    return p;
  }

  // ── 화면 1: 문제 ────────────────────────────
  function initProblem() {
    var p = pickProblem();
    state.problem = p;
    $("tag").textContent = TEXT.tag;
    $("lead").textContent = TEXT.lead;
    $("inputLabel").textContent = TEXT.inputLabel;
    $("inputHint").textContent = TEXT.inputHint;
    var inp = $("answer");
    inp.placeholder = TEXT.placeholder;
    $("submit").textContent = TEXT.submit;
    if (VER === "B") {
      var ta = document.createElement("textarea");
      ta.id = "answer"; ta.placeholder = TEXT.placeholder;
      inp.parentNode.replaceChild(ta, inp);
    }
    var box = $("problemBody");
    box.innerHTML = "";
    if (p) {
      p.lines.forEach(function (t) {
        var el = document.createElement("p");
        el.textContent = t;
        box.appendChild(el);
      });
      renderMath(box);
      var refit = function () { fitMath(box); };
      refit();
      // 수식 글꼴이 늦게 불러와져 폭이 달라질 수 있어 몇 번 다시 맞춤
      if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener("loadingdone", refit);
      window.addEventListener("load", refit);
      window.addEventListener("resize", refit);
      setTimeout(refit, 400); setTimeout(refit, 1200);
    }
    state.shownAt = Date.now();
    setInterval(tick, 250);
    send("visit", { problemId: p ? p.id : "" });
  }

  $("submit").addEventListener("click", function () {
    var v = $("answer").value.trim();
    var err = $("answerErr");
    if (!v) { err.textContent = VER === "A" ? "정답을 입력해 주세요." : "내용을 입력해 주세요."; return; }
    err.textContent = "";
    this.disabled = true;
    state.submitted = true;
    var now = Date.now();
    state.answer = v;
    state.solveSec = Math.round((now - state.shownAt) / 1000);
    send("solve", {
      problemId: state.problem ? state.problem.id : "",
      shownAt: new Date(state.shownAt).toISOString(),
      submittedAt: new Date(now).toISOString(),
      solveSec: state.solveSec,
      answer: v
    });
    showResult();
    show("result");
  });

  // 정답 칸 어디를 눌러도 입력칸에 커서가 가서 키보드가 열리고, 키보드에 가리지 않게 위치를 맞춤
  $("ansBox").addEventListener("click", function () { $("answer").focus(); });
  $("ansBox").addEventListener("focusin", function () {
    var box = this;
    setTimeout(function () { box.scrollIntoView({ block: "center", behavior: "smooth" }); }, 300);
  });
  $("ansBox").addEventListener("keydown", function (e) {
    if (e.key === "Enter" && VER === "A") { e.preventDefault(); $("submit").click(); }
  });

  // ── 화면 2: 결과·보상 안내 ───────────────────
  function showResult() {
    $("slipAnsLabel").textContent = TEXT.slipLabel;
    $("slipAns").textContent = state.answer;
    $("slipTime").textContent = fmt(state.solveSec || 0);
    $("slipCode").textContent = SID.slice(-6).toUpperCase();
    $("revealKicker").textContent = TEXT.revealKicker;
    $("resultTitle").textContent = TEXT.resultTitle;
    $("resultBody").textContent = TEXT.resultBody;
    $("revealTitle").textContent = TEXT.revealTitle;
    $("revealBody").textContent = TEXT.revealBody;
    $("rewardTitle").textContent = TEXT.rewardTitle;
    $("rewardBody").textContent = TEXT.rewardBody;
    setTimeout(openModal, 900); // 제출 도장이 찍힌 뒤에 팝업
  }
  // 안내 팝업 (확인 버튼·바깥 영역·Esc로 닫힘)
  function openModal() {
    var m = $("modal"); m.hidden = false;
    requestAnimationFrame(function () { m.classList.add("on"); });
    $("modalOk").focus({ preventScroll: true });
  }
  function closeModal() {
    var m = $("modal"); m.classList.remove("on");
    setTimeout(function () { m.hidden = true; }, 200);
  }
  $("modal").addEventListener("click", function (e) { if (e.target.hasAttribute("data-close")) closeModal(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !$("modal").hidden) closeModal(); });
  $("toApply").addEventListener("click", function () { closeModal(); show("apply"); });

  // ── 화면 3: 개인정보 동의 + 사전예약 접수 ─────
  $("phone").addEventListener("input", function () {
    var d = this.value.replace(/\D/g, "").slice(0, 11), o = d;
    if (d.length > 7) o = d.slice(0, 3) + "-" + d.slice(3, 7) + "-" + d.slice(7);
    else if (d.length > 3) o = d.slice(0, 3) + "-" + d.slice(3);
    this.value = o;
  });
  $("applyBtn").addEventListener("click", function () {
    var name = $("name").value.trim();
    var phone = $("phone").value.trim();
    var consent = $("consent").checked;
    var e = $("applyErr");
    if (name.length < 2) { e.textContent = "이름을 입력해 주세요."; return; }
    if (!/^01[016789]-\d{3,4}-\d{4}$/.test(phone)) { e.textContent = "연락처를 010-0000-0000 형식으로 입력해 주세요."; return; }
    if (!consent) { e.textContent = "개인정보 수집·이용에 동의해야 접수할 수 있어요."; return; }
    e.textContent = "";
    this.disabled = true;
    send("apply", {
      problemId: state.problem ? state.problem.id : "",
      name: name, phone: phone, consent: "Y", consentAt: new Date().toISOString()
    });
    // 접수가 끝나면 모션 인트로 → 한 페이지 소개 화면으로 (전송이 끝나도록 화면 안에서 이어짐)
    window.IltaLanding.open({
      code: SID.slice(-6).toUpperCase(),
      phone: phone,
      url: CFG.LANDING_URL,
      onNotify: function (ts) { send("notify", { name: name, phone: phone, consent: "Y", consentAt: ts }); }
    });
  });

  initProblem();
  show("problem");
})();
