/* 접수 후 화면: 모션 인트로(SKIP 가능) → 한 페이지 소개 */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var skipped = false, finished = false, opened = false;
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  function wait(ms) { return new Promise(function (r) { setTimeout(r, skipped ? 0 : ms); }); }

  // 진한 초록 바탕에 블록이 모여 Q가 되고 → 바탕이 밝아지며 로고가 완성된다
  async function play() {
    var intro = $("ldIntro"), q = $("ldQ"), lt = $("ldLt");
    await wait(400); if (skipped) return;
    intro.classList.remove("pre"); intro.classList.add("go");   // 블록 조립
    await wait(2000); if (skipped) return;
    intro.classList.add("light");                               // 바탕이 밝아지고 Q가 연초록으로
    await wait(1000); if (skipped) return;
    q.classList.remove("c"); lt.classList.remove("pre");        // Q가 오른쪽으로, 글자가 펼쳐짐
    await wait(1500); if (skipped) return;
    $("ldTag").classList.add("on");
    await wait(1300);
    finish();
  }

  function finish() {
    if (finished) return; finished = true;
    var intro = $("ldIntro");
    intro.classList.add("out");
    document.documentElement.classList.remove("ld-play");
    var t = document.querySelector(".ld-hero .ld-tag"); if (t) t.classList.add("on");
    $("landing").classList.add("ld-ready");
    setTimeout(function () { intro.style.display = "none"; }, 900);
  }

  function observe() {
    var els = document.querySelectorAll("#landing .rv");
    if (!("IntersectionObserver" in window)) { for (var i = 0; i < els.length; i++) els[i].classList.add("in"); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { threshold: .15 });
    for (var j = 0; j < els.length; j++) io.observe(els[j]);
  }

  // 사전예약(오픈 알림) 시트: 수신 동의를 따로 받음
  function maskPhone(ph) { return (ph || "").replace(/^(\d{3})-(\d{3,4})-(\d{4})$/, "$1-****-$3"); }
  function setupNotify(o) {
    var sh = $("ldSheet"), btn = $("ldNotify"), err = $("ldShErr");
    function open() { $("ldShPhone").textContent = maskPhone(o.phone); err.textContent = ""; sh.hidden = false; requestAnimationFrame(function () { sh.classList.add("on"); }); }
    function close() { sh.classList.remove("on"); setTimeout(function () { sh.hidden = true; }, 220); }
    btn.addEventListener("click", function () { if (!btn.disabled) open(); });
    sh.addEventListener("click", function (e) { if (e.target.hasAttribute("data-close")) close(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !sh.hidden) close(); });
    $("ldConsent").addEventListener("change", function () { err.textContent = ""; });
    $("ldShOk").addEventListener("click", function () {
      if (!$("ldConsent").checked) { err.textContent = "수신에 동의해야 알림을 보내드릴 수 있어요."; return; }
      if (o.onNotify) o.onNotify(new Date().toISOString());
      btn.textContent = "사전예약 완료"; btn.disabled = true; btn.classList.add("done");
      close();
    });
  }

  // 접수가 끝나면 app.js가 부르는 입구
  window.IltaLanding = {
    open: function (o) {
      if (opened) return; opened = true; o = o || {};
      $("ldCode").textContent = o.code || "";
      var site = $("ldSite");
      if (o.url) { site.href = o.url; site.hidden = false; }
      setupNotify(o);
      document.body.classList.add("ld-on");
      window.scrollTo(0, 0);
      observe();
      window.IltaScenes.start();
      document.documentElement.classList.add("ld-play");
      $("ldSkip").onclick = function () { skipped = true; finish(); };
      play();
    }
  };
})();

/* ───── 스크롤 연동 장면 ───── */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var seg = function (p, a, b) { return clamp((p - a) / (b - a), 0, 1); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var ease = function (t) { return 1 - Math.pow(1 - t, 3); };
  var pad = function (n) { return (n < 10 ? "0" : "") + n; };
  var fmt = function (s) { return s >= 60 ? Math.floor(s / 60) + "분 " + pad(s % 60) + "초" : s + "초"; };

  var scenes, bar, ticking = false;

  // 1~5 장면: 모눈 칸(g, 화면 폭의 1/20) 단위 배치. 단어 카드 폭은 칸 수로 고정
  var WL = null, LGO = null;
  var WW = [4, 6, 6, 10];                 // You / were / onto / something 의 칸 수
  function layoutW() {
    var sc = document.querySelector('#landing [data-sc="w"]'); if (!sc) return;
    var g = Math.min(window.innerWidth * .05, 21), vh = window.innerHeight, rows = 24, i;
    var cg = sc.querySelector(".cg");
    cg.style.top = (Math.max(0, Math.floor((vh / g - rows) / 2)) * g) + "px";
    var num = function (s) { return s.split(",").map(Number); };
    var wds = sc.querySelectorAll(".wd:not(.lg)");
    // 최종 위치(칸)
    var T = [[4, 6], [4 + WW[0], 6], [4, 9], [20 - WW[3], 16]];
    // 모였을 때: You were / onto / something 이 가운데 정렬
    var x0 = Math.round((20 - WW[0] - WW[1]) / 2);
    var A = [[x0, 10], [x0 + WW[0], 10], [Math.round((20 - WW[2]) / 2), 13], [Math.round((20 - WW[3]) / 2), 16]];
    WL = [];
    for (i = 0; i < wds.length; i++) {
      wds[i].style.width = (WW[i] * g) + "px";
      wds[i].style.left = (T[i][0] * g) + "px"; wds[i].style.top = (T[i][1] * g) + "px";
      WL.push({ el: wds[i], dx: (A[i][0] - T[i][0]) * g, dy: (A[i][1] - T[i][1]) * g });
    }
    var lg = sc.querySelector(".lg");
    lg.style.width = (6 * g) + "px"; lg.style.left = ((T[2][0] + WW[2]) * g) + "px"; lg.style.top = (T[2][1] * g) + "px";
    LGO = lg;
    var ims = sc.querySelectorAll(".im");
    for (i = 0; i < ims.length; i++) {
      var c = num(ims[i].getAttribute("data-c"));
      ims[i].style.left = (c[0] * g) + "px"; ims[i].style.top = (c[1] * g) + "px";
      ims[i].style.width = (c[2] * g) + "px"; ims[i].style.height = (c[3] * g) + "px";
    }
    var lbs = sc.querySelectorAll(".lb");
    for (i = 0; i < lbs.length; i++) { var q = num(lbs[i].getAttribute("data-t")); lbs[i].style.left = (q[0] * g + 2) + "px"; lbs[i].style.top = (q[1] * g) + "px"; }
  }
  window.addEventListener("resize", function () { if (WL) layoutW(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (WL) layoutW(); });

  var FX = {
    // 1~5. You were onto something → 흩어짐 → 조각이 칸에 붙음 → onto + logy
    w: function (sc, p) {
      if (!WL) layoutW();
      var sp = ease(seg(p, .24, .42)), i;
      for (i = 0; i < WL.length; i++) {
        var a = .01 + i * .05, t = ease(seg(p, a, a + .07)), it = WL[i];
        it.el.style.opacity = t.toFixed(3);
        it.el.style.transform = "translate(" + (it.dx * (1 - sp)).toFixed(1) + "px," + (it.dy * (1 - sp)).toFixed(1) + "px) scale(" + lerp(.92, 1, t).toFixed(3) + ")";
      }
      var im = sc.querySelectorAll(".im");
      for (i = 0; i < im.length; i++) {
        var s = ease(seg(p, .34 + i * .024, .44 + i * .024));
        im[i].style.opacity = s.toFixed(3);
        im[i].style.transform = "scale(" + lerp(.94, 1, s).toFixed(3) + ")";
      }
      var lb = sc.querySelectorAll(".lb");
      for (i = 0; i < lb.length; i++) {
        var l = ease(seg(p, .68 + i * .04, .76 + i * .04));
        lb[i].style.opacity = l.toFixed(3);
        lb[i].style.transform = "translateX(" + ((1 - l) * -10).toFixed(1) + "px)";
      }
      var lo = ease(seg(p, .82, .88));
      LGO.style.opacity = lo.toFixed(3);
      LGO.style.transform = "translateX(" + ((1 - lo) * -16).toFixed(1) + "px)";
      WL[2].el.classList.toggle("on", p >= .82);
      var w = sc.querySelector(".wrap"), out = seg(p, .94, 1);
      w.style.opacity = (1 - out).toFixed(3);
      w.style.transform = "translateY(" + (-out * 24).toFixed(1) + "px)";
    },
    // 6~8. 개념 연결 그래프 → 카드가 올라오며 '시간 단축' → 시간이 줄어듦 (한 장면에서 이어짐)
    ana: function (sc, p) {
      var h6 = sc.querySelector(".h6"), h7 = sc.querySelector(".h7"), h8 = sc.querySelector(".h8");
      var net = sc.querySelector(".net"), ng = sc.querySelector(".ng"), i, j;
      var k = ease(seg(p, 0, .05));
      var o6 = seg(p, .44, .48), i7 = seg(p, .5, .55), o7 = seg(p, .68, .72), i8 = seg(p, .74, .79);
      h6.style.opacity = (k * (1 - o6)).toFixed(3);
      h6.style.transform = "translateY(" + ((1 - k) * 14 - o6 * 10).toFixed(1) + "px)";
      h7.style.opacity = (i7 * (1 - o7)).toFixed(3);
      h7.style.transform = "translateY(" + ((1 - i7) * 12 - o7 * 10).toFixed(1) + "px)";
      h8.style.opacity = i8.toFixed(3);
      h8.style.transform = "translateY(" + ((1 - i8) * 12).toFixed(1) + "px)";
      var cl = sc.querySelectorAll(".cl");
      for (i = 0; i < cl.length; i++) {
        var t = ease(seg(p, .03 + i * .055, .09 + i * .055)), cs = cl[i].children;
        for (j = 0; j < cs.length; j++) { cs[j].style.opacity = t.toFixed(3); }
      }
      sc.querySelector(".br").style.opacity = ease(seg(p, .03, .09)).toFixed(3);
      var tx = sc.querySelectorAll(".ng .tx");
      tx[0].style.opacity = ease(seg(p, .06, .12)).toFixed(3);
      tx[1].style.opacity = ease(seg(p, .4, .46)).toFixed(3);
      var lay = sc.querySelectorAll(".lay");
      for (i = 0; i < lay.length; i++) {
        var ls = lay[i].children, n = ls.length, st = .07 + i * .08;
        for (j = 0; j < n; j++) {
          var d = seg(p, st + (j / n) * .08, st + (j / n) * .08 + .1);
          ls[j].style.strokeDashoffset = (1 - d).toFixed(3);
        }
      }
      ng.classList.toggle("hot", p >= .4);
      // 그래프: 작아졌다가(7번) 카드가 올라오면 사라짐(8번)
      var s = lerp(1, .62, ease(seg(p, .49, .62)));
      s = lerp(s, .02, ease(seg(p, .70, .82)));
      net.style.transform = "scale(" + s.toFixed(3) + ")";
      net.style.opacity = (1 - ease(seg(p, .72, .8))).toFixed(3);
      net.style.marginBottom = (-(1 - s) * net.offsetHeight).toFixed(1) + "px";
      var tm = sc.querySelector(".tm"), m = ease(seg(p, .54, .66));
      tm.style.opacity = m.toFixed(3);
      tm.style.transform = "translateY(" + ((1 - m) * 40).toFixed(1) + "px)";
      // 8번: 시간이 줄어든다
      var bars = sc.querySelector(".bars"), bi = bars.children;
      bars.style.opacity = ease(seg(p, .74, .84)).toFixed(3);
      var el = $("ldTime"), from = +el.getAttribute("data-from"), to = +el.getAttribute("data-to");
      var tt = ease(seg(p, .8, .97));
      el.textContent = fmt(Math.round(from * Math.pow(to / from, tt)));
      var bl = tm.querySelectorAll(".seg i"), fill = 16 * (1 - .96 * tt);
      for (i = 0; i < bl.length; i++) bl[i].style.setProperty("--f", clamp(fill - i, 0, 1).toFixed(3));
      for (i = 0; i < bi.length; i++) bi[i].style.transform = "scaleY(" + lerp(1, .07, tt).toFixed(3) + ")";
    }
  };

  function frame() {
    ticking = false;
    var vh = window.innerHeight;
    for (var i = 0; i < scenes.length; i++) {
      var sc = scenes[i], r = sc.getBoundingClientRect();
      if (r.bottom < -50 || r.top > vh + 50) continue;
      var ld = (+sc.getAttribute("data-lead") || 0) * vh;   // 화면에 들어오는 순간부터 미리 시작
      var p = clamp((ld - r.top) / Math.max(1, sc.offsetHeight - vh + ld), 0, 1);
      FX[sc.getAttribute("data-sc")](sc, p);
    }
    var h = document.documentElement;
    bar.style.width = (clamp(h.scrollTop / Math.max(1, h.scrollHeight - vh), 0, 1) * 100).toFixed(2) + "%";
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }

  window.IltaScenes = {
    start: function () {
      scenes = document.querySelectorAll("#landing .sc"); bar = $("ld-bar");
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll);
      frame();
    }
  };
})();
