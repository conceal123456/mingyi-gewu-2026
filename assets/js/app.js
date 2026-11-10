/* ==========================================================================
   明医格物 · 离线交互主程序
   Vanilla JS. No fetch, no modules, no external runtime dependency.
   ========================================================================== */
(function () {
  "use strict";

  window.__APP_ERRORS__ = window.__APP_ERRORS__ || [];
  window.addEventListener("error", function (event) {
    window.__APP_ERRORS__.push(String(event.message || event.error || "unknown"));
  });
  window.addEventListener("unhandledrejection", function (event) {
    window.__APP_ERRORS__.push(String(event.reason || "unhandled rejection"));
  });

  var DATA = window.TCM_DATA;
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hasECharts = !!window.echarts;
  var charts = {};

  function $(selector, root) { return (root || document).querySelector(selector); }
  function $$(selector, root) { return Array.prototype.slice.call((root || document).querySelectorAll(selector)); }
  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function easeInOutCubic(t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function nf(value, digits) { return Number(value).toFixed(digits == null ? 1 : digits); }
  function debounce(fn, wait) {
    var timer;
    return function () {
      var args = arguments, ctx = this;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(ctx, args); }, wait || 100);
    };
  }
  function svgIcon(name, cls) {
    return '<svg class="icon ' + (cls || "") + '" aria-hidden="true"><use href="#icon-' + name + '"></use></svg>';
  }
  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch];
    });
  }
  function chineseNumber(n) {
    var nums = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
    return nums[n] || String(n);
  }
  function rgb(hex) {
    var h = hex.replace("#", "");
    if (h.length === 3) h = h.split("").map(function (c) { return c + c; }).join("");
    var num = parseInt(h, 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
  }
  function mixColor(a, b, t) {
    var A = rgb(a), B = rgb(b);
    return "rgb(" + Math.round(lerp(A[0], B[0], t)) + "," + Math.round(lerp(A[1], B[1], t)) + "," + Math.round(lerp(A[2], B[2], t)) + ")";
  }
  function colorAlpha(hex, a) {
    var c = rgb(hex);
    return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")";
  }
  function setRangeFill(input) {
    var min = Number(input.min), max = Number(input.max), value = Number(input.value);
    var pct = ((value - min) / (max - min)) * 100;
    input.style.setProperty("--range", pct + "%");
  }
  function canvasContext(canvas) {
    var rect = canvas.getBoundingClientRect();
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var w = Math.max(20, rect.width);
    var h = Math.max(20, rect.height);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    var ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, w: w, h: h, dpr: dpr };
  }
  function seededRandom(seed) {
    var s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  }

  var state = {
    doctor: 0,
    galleryFlipped: false,
    herb: 0,
    proc: { temp: 100, hours: 6, stage: 0, animating: false, visualStage: 0, particles: [], lastTime: 0 },
    distill: { material: "mint", power: 720, flow: 1.5, oil: 0, lost: 0, running: true, particles: [], bubbles: [], lastTime: 0, lastUi: 0 },
    verse: 0,
    shichen: 3,
    rhythmState: "night",
    tea: [],
    form: 0,
    quizIndex: 0,
    answers: [],
    quizDone: false,
    certificateReady: false,
    certificateData: null,
    visible: {}
  };

  var dom = {};
  var toastTimer;
  var sectionObserver = null;

  function showToast(message) {
    if (!dom.soundToast) return;
    dom.soundToast.textContent = message;
    dom.soundToast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { dom.soundToast.classList.remove("is-visible"); }, 2800);
  }

  function cacheDom() {
    dom.boot = $("#bootScreen");
    dom.header = $("#siteHead");
    dom.nav = $("#mainNav");
    dom.menu = $("#menuToggle");
    dom.sound = $("#soundToggle");
    dom.soundToast = $("#soundToast");
    dom.readProgress = $("#readProgress");
    dom.rail = $(".rail-current");
    dom.railProgress = $("#railProgress");
    dom.main = $("#main");
    dom.hero = $("#prologue");
    dom.gallery = $("#heroGallery");
    dom.scrollStage = $("#scrollStage");
    dom.scrollTrack = $("#scrollTrack");
    dom.floorReflection = $("#floorReflection");
    dom.galleryIndex = $("#galleryIndex");
    dom.galleryName = $("#galleryName");
    dom.galleryEra = $("#galleryEra");
    dom.heroOpenDoctor = $("#heroOpenDoctor");
    dom.prevDoctor = $("#prevDoctor");
    dom.nextDoctor = $("#nextDoctor");
    dom.cabinet = $("#herbCabinet");
    dom.radarChart = $("#radarChart");
    dom.networkChart = $("#networkChart");
    dom.herbName = $("#herbName");
    dom.herbLatin = $("#herbLatin");
    dom.herbOrigin = $("#herbOrigin");
    dom.herbQuote = $("#herbQuote");
    dom.herbQuoteSource = $("#herbQuoteSource");
    dom.herbTags = $("#herbTags");
    dom.herbPhysical = $("#herbPhysical");
    dom.herbCompounds = $("#herbCompounds");
    dom.herbCompoundCount = $("#herbCompoundCount");
    dom.herbNote = $("#herbNote");
    dom.herbPhoto = $("#herbPhoto");
    dom.herbPhotoCredit = $("#herbPhotoCredit");
    dom.herbPlateIndex = $("#herbPlateIndex");
    dom.herbPlateKind = $("#herbPlateKind");
    dom.deckPrev = $("#deckPrev");
    dom.deckNext = $("#deckNext");
    dom.deckCurrent = $("#deckCurrent");
    dom.deckTotal = $("#deckTotal");
    dom.flavorRows = $("#flavorRows");
    dom.proc = {
      input: $("#steamTemp"),
      hoursInput: $("#steamHours"),
      tempValue: $("#steamTempValue"),
      hoursValue: $("#steamHoursValue"),
      stageValue: $("#steamStageValue"),
      seals: $("#steamStageSeals"),
      advance: $("#advanceSteam"),
      reset: $("#resetSteam"),
      irritant: $("#irritantReadout"),
      hmf: $("#hmfReadout"),
      brown: $("#brownReadout"),
      visualTemp: $("#visualTemp"),
      heatDose: $("#heatDose"),
      stageNumber: $("#stageNumber"),
      stateLabel: $("#steamStateLabel"),
      stamp: $("#stageStamp"),
      canvas: $("#huangjingCanvas"),
      photoCaption: $("#processingPhotoCaption"),
      note: $("#canvasNote"),
      chart: $("#processingChart")
    };
    dom.distill = {
      materialSwitch: $("#materialSwitch"),
      power: $("#heatPower"),
      flow: $("#coolFlow"),
      powerValue: $("#heatPowerValue"),
      flowValue: $("#coolFlowValue"),
      azeotrope: $("#azeotropeTemp"),
      eff: $("#condenseEff"),
      oil: $("#oilCollected"),
      warning: $("#distillWarning"),
      materialLabel: $("#materialLabel"),
      sate: $("#distillState"),
      note: $("#materialNote"),
      canvas: $("#distillCanvas")
    };
    dom.verse = {
      tabs: $("#verseTabs"),
      title: $("#verseTitle"),
      lines: $("#verseLines"),
      tag: $("#verseTag"),
      explain: $("#verseExplain"),
      note: $("#verseNote")
    };
    dom.rhythm = {
      dial: $("#shichenDial"),
      hand: $("#dialHand"),
      center: $("#dialCenter"),
      shichen: $("#dialShichen"),
      time: $("#dialTime"),
      text: $("#circadianText"),
      disclaimer: $("#rhythmDisclaimer"),
      states: $("#stateSelect"),
      tray: $("#teaTray"),
      slots: $("#teaSlots"),
      balanceBeam: $("#balanceBeam"),
      balanceCold: $("#balanceCold"),
      balanceWarm: $("#balanceWarm"),
      balanceScore: $("#balanceScore"),
      temp: $("#teaTemp"),
      copy: $("#teaBalanceCopy"),
      extract: $("#teaExtract"),
      warning: $("#teaWarning"),
      brew: $("#brewTea"),
      jump: $("#jumpTea"),
      liquid: $("#teaLiquid")
    };
    dom.forms = {
      track: $("#formTrack"),
      handscroll: $("#handscroll"),
      prev: $("#formPrev"),
      next: $("#formNext"),
      chart: $("#doseChart"),
      index: $("#formIndex"),
      name: $("#formName"),
      motto: $("#formMotto"),
      description: $("#formDescription"),
      disintegration: $("#formDisintegration"),
      peak: $("#formPeak"),
      detail: $("#formDetail"),
      quote: $("#formQuote")
    };
    dom.quiz = {
      top: $(".quiz-topline span:first-child"),
      progress: $("#quizProgress"),
      progressText: $("#quizProgressText"),
      card: $("#quizCard"),
      tag: $("#quizTag"),
      scene: $("#quizScene"),
      question: $("#quizQuestion"),
      options: $("#quizOptions"),
      feedback: $("#quizFeedback"),
      feedbackTitle: $("#feedbackTitle"),
      feedbackText: $("#feedbackText"),
      orbit: $("#quizOrbit"),
      orbitNum: $("#quizOrbitNum"),
      next: $("#quizNext"),
      result: $("#quizResult"),
      resultText: $("#quizResultText"),
      accuracy: $("#resultAccuracy"),
      alias: $("#resultAlias"),
      generate: $("#generateCertificate"),
      canvas: $("#certificateCanvas"),
      locked: $("#certificateLocked"),
      download: $("#downloadCertificate")
    };
  }

  /* ----------------------------------------------------------------------
     Museum chrome
     ---------------------------------------------------------------------- */
  function initChrome() {
    if (dom.menu) {
      dom.menu.addEventListener("click", function () {
        var open = dom.nav.classList.toggle("is-open");
        dom.menu.setAttribute("aria-expanded", open ? "true" : "false");
        document.body.classList.toggle("nav-open", open);
      });
      dom.nav.addEventListener("click", function (e) {
        if (e.target.closest("a")) {
          dom.nav.classList.remove("is-open");
          dom.menu.setAttribute("aria-expanded", "false");
          document.body.classList.remove("nav-open");
        }
      });
    }
    initSound();
    initReveals();
    setTimeout(function () { if (dom.boot) dom.boot.classList.add("is-done"); }, 760);
  }

  var deckState = { scenes: [], index: 0, locked: false, wheelAt: 0, touch: null };

  function isSceneActive(id) {
    var scene = deckState.scenes[deckState.index];
    return !!scene && scene.id === id;
  }

  function syncVisiblePanels() {
    if (!state.visible) state.visible = {};
    state.visible.processing = isSceneActive("chapter-processing");
    state.visible.distillation = isSceneActive("chapter-distillation");
  }

  function initDeck() {
    deckState.scenes = [$("#prologue")].concat($$(".chapter")).concat([$("#epilogue")]).filter(Boolean);
    if (!deckState.scenes.length) return;
    deckState.total = deckState.scenes.length;
    deckState.scenes.forEach(function (scene, index) {
      scene.classList.add("deck-scene");
      scene.setAttribute("data-scene-index", String(index));
      scene.setAttribute("aria-hidden", "true");
      if ("inert" in scene) scene.inert = true;
    });
    if (dom.deckTotal) dom.deckTotal.textContent = String(deckState.total).padStart(2, "0");
    var hash = (location.hash || "").replace(/^#/, "");
    var initial = 0;
    if (hash) {
      var found = deckState.scenes.findIndex(function (scene) { return scene.id === hash; });
      if (found >= 0) initial = found;
    }
    deckState.scenes[initial].classList.add("is-deck-active");
    deckState.scenes.forEach(function (scene) {
      scene.addEventListener("scroll", function () {
        if (scene.scrollLeft) scene.scrollLeft = 0;
      }, { passive: true });
    });
    if (dom.main) {
      dom.main.addEventListener("scroll", function () {
        if (dom.main.scrollLeft) dom.main.scrollLeft = 0;
      }, { passive: true });
    }
    deckState.scenes[initial].setAttribute("aria-hidden", "false");
    if ("inert" in deckState.scenes[initial]) deckState.scenes[initial].inert = false;
    deckState.index = initial;
    dom.header.classList.toggle("is-scrolled", initial > 0);
    document.documentElement.classList.add("deck-ready");
    updateDeckChrome(initial);

    if (dom.deckPrev) dom.deckPrev.addEventListener("click", function () { goScene(deckState.index - 1); });
    if (dom.deckNext) dom.deckNext.addEventListener("click", function () { goScene(deckState.index + 1); });

    document.addEventListener("click", function (event) {
      var link = event.target.closest("a[href^='#']");
      if (!link) return;
      var id = link.getAttribute("href").slice(1);
      var target = document.getElementById(id);
      var index = deckState.scenes.indexOf(target);
      if (index < 0) return;
      event.preventDefault();
      goScene(index);
    });

    window.addEventListener("wheel", onDeckWheel, { passive: false });
    document.addEventListener("keydown", onDeckKey);
    document.addEventListener("touchstart", onDeckTouchStart, { passive: true });
    document.addEventListener("touchend", onDeckTouchEnd, { passive: true });
    window.addEventListener("popstate", function () {
      var id = (location.hash || "").replace(/^#/, "");
      var index = deckState.scenes.findIndex(function (scene) { return scene.id === id; });
      if (index >= 0 && index !== deckState.index) goScene(index, { silent: true });
    });
  }

  function updateDeckChrome(index) {
    var scenes = deckState.scenes;
    var current = scenes[index];
    if (!current) return;
    if (dom.deckCurrent) dom.deckCurrent.textContent = String(index + 1).padStart(2, "0");
    if (dom.deckPrev) dom.deckPrev.disabled = index <= 0;
    if (dom.deckNext) dom.deckNext.disabled = index >= scenes.length - 1;
    if (dom.readProgress) dom.readProgress.style.width = ((index + 1) / scenes.length * 100).toFixed(2) + "%";
    $$(".main-nav a").forEach(function (link) {
      link.classList.toggle("is-active", link.getAttribute("data-nav") === current.id);
    });
    if (dom.rail) dom.rail.textContent = current.getAttribute("data-chapter") || "序";
    if (dom.railProgress) dom.railProgress.style.height = (index / Math.max(1, scenes.length - 1) * 100).toFixed(2) + "%";
    dom.header.classList.toggle("is-scrolled", index > 0);
    document.body.classList.toggle("is-light-scene", current.getAttribute("data-tone") === "light");
  }

  function goScene(index, options) {
    options = options || {};
    var scenes = deckState.scenes;
    if (!scenes.length) return;
    index = clamp(index, 0, scenes.length - 1);
    if (index === deckState.index && !options.force) return;
    deckState.index = index;
    scenes.forEach(function (scene, i) {
      var active = i === index;
      scene.classList.toggle("is-deck-active", active);
      scene.classList.toggle("is-deck-past", i < index);
      scene.classList.toggle("is-deck-future", i > index);
      scene.setAttribute("aria-hidden", active ? "false" : "true");
      if ("inert" in scene) scene.inert = !active;
    });
    var activeScene = scenes[index];
    if (!options.keepScroll) activeScene.scrollTop = 0;
    activeScene.scrollLeft = 0;
    if (dom.main) dom.main.scrollLeft = 0;
    syncVisiblePanels();
    updateDeckChrome(index);
    if (!options.silent) {
      try { history.replaceState(null, "", "#" + activeScene.id); } catch (err) { /* file:// safe */ }
    }
    deckState.locked = !options.instant;
    window.setTimeout(function () { deckState.locked = false; }, options.instant ? 0 : 920);
  }

  function onDeckWheel(event) {
    if (event.ctrlKey || document.body.classList.contains("nav-open")) return;
    if (Math.abs(event.deltaY) < 10) return;
    if (deckState.index === 0) {
      if (event.target.closest && event.target.closest("#scrollStage")) return;
      event.preventDefault();
      if (deckState.locked || Date.now() - deckState.wheelAt < 720) return;
      deckState.wheelAt = Date.now();
      goScene(1);
      return;
    }
    var scene = deckState.scenes[deckState.index];
    var canScroll = scene.scrollHeight > scene.clientHeight + 4;
    var atTop = scene.scrollTop <= 2;
    var atBottom = scene.scrollTop + scene.clientHeight >= scene.scrollHeight - 3;
    var down = event.deltaY > 0;
    if (canScroll && ((down && !atBottom) || (!down && !atTop))) return;
    event.preventDefault();
    if (deckState.locked || Date.now() - deckState.wheelAt < 720) return;
    deckState.wheelAt = Date.now();
    goScene(deckState.index + (down ? 1 : -1));
  }

  function onDeckKey(event) {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    if (/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || "")) return;
    if (document.body.classList.contains("nav-open")) return;
    if (event.key === "ArrowRight" && deckState.index > 0) { event.preventDefault(); goScene(deckState.index + 1); }
    else if (event.key === "ArrowLeft" && deckState.index > 0) { event.preventDefault(); goScene(deckState.index - 1); }
    else if (event.key === "ArrowDown" && deckState.index === 0) { event.preventDefault(); goScene(1); }
    else if (event.key === "PageDown") { event.preventDefault(); goScene(deckState.index + 1); }
    else if (event.key === "PageUp") { event.preventDefault(); goScene(deckState.index - 1); }
    else if (event.key === "Home" && deckState.index > 0) { event.preventDefault(); goScene(0); }
    else if (event.key === "End") { event.preventDefault(); goScene(deckState.scenes.length - 1); }
  }

  function onDeckTouchStart(event) {
    if (event.touches.length !== 1) { deckState.touch = null; return; }
    var t = event.touches[0];
    deckState.touch = { x: t.clientX, y: t.clientY, time: Date.now(), target: event.target };
  }

  function onDeckTouchEnd(event) {
    var start = deckState.touch;
    deckState.touch = null;
    if (!start || !event.changedTouches.length) return;
    if (start.target.closest("#scrollStage, #formTrack, input, textarea, select, .range, .shichen-dial")) return;
    var t = event.changedTouches[0];
    var dx = t.clientX - start.x;
    var dy = t.clientY - start.y;
    if (Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(dy) * 1.35) return;
    goScene(deckState.index + (dx < 0 ? 1 : -1));
  }

  function initReveals() {
    var selectors = ".chapter-head, .herb-workbench, .flavor-band, .lab-shell, .science-strip, .distill-shell, .verse-stage, .rhythm-panel, .handscroll-shell, .form-detail-grid, .trial-shell";
    $$(selectors).forEach(function (node, index) {
      node.classList.add("reveal");
      if (index % 3 === 1) node.classList.add("reveal-delay-1");
      if (index % 3 === 2) node.classList.add("reveal-delay-2");
    });
    $$(".reveal").forEach(function (node) { node.classList.add("is-visible"); });
  }

  function initSound() {
    if (!dom.sound) return;
    var audio = { ctx: null, master: null, nodes: [], timer: null, on: false };
    var scale = [146.83, 196.0, 220.0, 293.66, 329.63, 440.0];

    function pluck() {
      if (!audio.on || !audio.ctx) return;
      var ctx = audio.ctx;
      var now = ctx.currentTime;
      var index = Math.floor(Math.random() * scale.length);
      var freq = scale[index];
      [1, 2.01, 2.98].forEach(function (mult, k) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        var filter = ctx.createBiquadFilter();
        osc.type = k === 0 ? "triangle" : "sine";
        osc.frequency.value = freq * mult;
        osc.detune.value = (k - 1) * 3.5;
        filter.type = "lowpass";
        filter.frequency.value = 1600 - k * 300;
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.028 / (k + 1), now + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 5.6 + k * .8);
        osc.connect(filter); filter.connect(gain); gain.connect(audio.master);
        osc.start(now); osc.stop(now + 6.8);
      });
      audio.timer = setTimeout(pluck, 3600 + Math.random() * 4200);
    }

    function start() {
      if (!audio.ctx) {
        var Ctor = window.AudioContext || window.webkitAudioContext;
        if (!Ctor) { showToast("当前浏览器不支持 Web Audio，画面仍可正常浏览"); return; }
        audio.ctx = new Ctor();
        audio.master = audio.ctx.createGain();
        audio.master.gain.value = 0;
        audio.master.connect(audio.ctx.destination);
        var droneGain = audio.ctx.createGain();
        droneGain.gain.value = 0.008;
        var lp = audio.ctx.createBiquadFilter();
        lp.type = "lowpass"; lp.frequency.value = 420;
        droneGain.connect(lp); lp.connect(audio.master);
        [73.42, 110.0].forEach(function (freq, index) {
          var osc = audio.ctx.createOscillator();
          osc.type = "sine";
          osc.frequency.value = freq;
          osc.detune.value = index ? 4 : -3;
          var g = audio.ctx.createGain();
          g.gain.value = index ? .42 : .58;
          osc.connect(g); g.connect(droneGain); osc.start();
          audio.nodes.push(osc);
        });
        var lfo = audio.ctx.createOscillator();
        var lfoGain = audio.ctx.createGain();
        lfo.frequency.value = .055; lfoGain.gain.value = .0028;
        lfo.connect(lfoGain); lfoGain.connect(droneGain.gain); lfo.start();
        audio.nodes.push(lfo);
      }
      audio.ctx.resume();
      audio.on = true;
      audio.master.gain.cancelScheduledValues(audio.ctx.currentTime);
      audio.master.gain.linearRampToValueAtTime(.75, audio.ctx.currentTime + 1.2);
      pluck();
      dom.sound.classList.add("is-on");
      dom.sound.setAttribute("aria-pressed", "true");
      dom.sound.setAttribute("aria-label", "停止环境音");
      showToast("环境音已开启 · 古琴泛音由 Web Audio 实时合成");
    }

    function stop() {
      audio.on = false;
      clearTimeout(audio.timer);
      if (audio.ctx && audio.master) {
        audio.master.gain.cancelScheduledValues(audio.ctx.currentTime);
        audio.master.gain.linearRampToValueAtTime(0, audio.ctx.currentTime + .7);
        setTimeout(function () { if (audio.ctx && !audio.on) audio.ctx.suspend(); }, 800);
      }
      dom.sound.classList.remove("is-on");
      dom.sound.setAttribute("aria-pressed", "false");
      dom.sound.setAttribute("aria-label", "开启环境音");
      showToast("环境音已关闭");
    }

    dom.sound.addEventListener("click", function () {
      if (audio.on) stop(); else start();
    });
  }

  /* ----------------------------------------------------------------------
     Hero: 3D hanging-scroll carousel
     ---------------------------------------------------------------------- */
  function buildDoctors() {
    dom.scrollTrack.innerHTML = DATA.doctors.map(function (doctor, index) {
      return '<article class="doctor-scroll" data-doctor="' + index + '" tabindex="0" role="button" aria-label="展开' + escapeHtml(doctor.name) + '名医卷轴" aria-expanded="false">' +
        '<div class="scroll-object">' +
          '<div class="scroll-flipper">' +
            '<div class="scroll-rod top"></div>' +
            '<div class="scroll-face">' +
              '<div class="scroll-sheet">' +
                '<div class="scroll-portrait" style="background-image:url(\'' + doctor.portrait + '\')"></div>' +
                '<span class="scroll-vertical-rule"></span>' +
                '<span class="vertical-name">' + escapeHtml(doctor.name) + '</span>' +
                '<span class="scroll-era">' + escapeHtml(doctor.era) + ' · ' + escapeHtml(doctor.date) + '</span>' +
                '<span class="scroll-open">展开</span>' +
              '</div>' +
            '</div>' +
            '<div class="scroll-back">' +
              '<span class="back-no">卷 ' + chineseNumber(index + 1) + '</span>' +
              '<span class="back-seal">' + escapeHtml(doctor.seal) + '</span>' +
              '<h3>' + escapeHtml(doctor.name) + '</h3>' +
              '<p class="back-quote">“' + escapeHtml(doctor.quote) + '”<span class="back-source">' + escapeHtml(doctor.quoteSource) + '</span></p>' +
              '<p class="back-summary">' + escapeHtml(doctor.summary) + '</p>' +
              '<p class="back-science"><strong>' + escapeHtml(doctor.scienceTitle) + '</strong><br>' + escapeHtml(doctor.science) + '</p>' +
              '<button type="button" class="back-close">合卷</button>' +
            '</div>' +
            '<div class="scroll-rod bottom"></div>' +
          '</div>' +
        '</div>' +
        '<div class="scroll-mirror" style="background-image:url(\'' + doctor.portrait + '\')"></div>' +
      '</article>';
    }).join("");

    $$(".doctor-scroll", dom.scrollTrack).forEach(function (card) {
      card.addEventListener("click", function (event) {
        if (event.target.closest(".back-close")) {
          event.stopPropagation();
          closeDoctor();
          return;
        }
        if (state.suppressDoctorClick) return;
        var index = Number(card.getAttribute("data-doctor"));
        if (index === state.doctor) {
          toggleDoctor();
        } else {
          goDoctor(index);
        }
      });
      card.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          card.click();
        }
      });
    });

    dom.heroOpenDoctor.addEventListener("click", function () {
      state.doctor = state.doctor || 0;
      toggleDoctor(true);
      setTimeout(function () {
        var back = $(".doctor-scroll.is-active .scroll-back");
        if (back) {
          var btn = $(".back-close", back);
          if (btn) btn.focus({ preventScroll: true });
        }
      }, 520);
    });
    dom.prevDoctor.addEventListener("click", function () { goDoctor(state.doctor - 1); });
    dom.nextDoctor.addEventListener("click", function () { goDoctor(state.doctor + 1); });

    bindGalleryGestures();
    updateGallery();
  }

  function updateGallery() {
    var count = DATA.doctors.length;
    var cards = $$(".doctor-scroll", dom.scrollTrack);
    var width = dom.scrollStage.clientWidth;
    var gap = width < 560 ? 112 : width < 860 ? 145 : Math.min(210, width * .195);
    cards.forEach(function (card, index) {
      var diff = index - state.doctor;
      if (diff > count / 2) diff -= count;
      if (diff < -count / 2) diff += count;
      var abs = Math.abs(diff);
      var x = diff * gap;
      var y = abs * 14 - (diff === 0 ? 5 : 0);
      var z = diff === 0 ? 80 : -40 - abs * 20;
      var rotate = diff === 0 ? 0 : diff * -28;
      var scale = diff === 0 ? 1 : abs === 1 ? .92 : .82;
      card.style.transform = "translate3d(calc(-50% + " + x + "px), calc(-50% + " + y + "px), " + z + "px) rotateY(" + rotate + "deg) scale(" + scale + ")";
      card.style.zIndex = String(20 - abs);
      card.classList.toggle("is-active", diff === 0);
      card.classList.toggle("is-side-left", diff === -1);
      card.classList.toggle("is-side-right", diff === 1);
      card.classList.toggle("is-far-left", diff <= -2);
      card.classList.toggle("is-far-right", diff >= 2);
      card.setAttribute("aria-expanded", diff === 0 && state.galleryFlipped ? "true" : "false");
    });
    var doc = DATA.doctors[state.doctor];
    dom.galleryIndex.textContent = String(state.doctor + 1).padStart(2, "0");
    dom.galleryName.textContent = doc.name;
    dom.galleryEra.textContent = doc.era + " · " + doc.role;
    window.requestAnimationFrame(function () {
      var scene = deckState.scenes[deckState.index];
      if (scene) scene.scrollLeft = 0;
      if (dom.main) dom.main.scrollLeft = 0;
    });
  }

  function goDoctor(index) {
    var count = DATA.doctors.length;
    state.doctor = ((index % count) + count) % count;
    state.galleryFlipped = false;
    $$(".doctor-scroll").forEach(function (card) { card.classList.remove("is-flipped"); });
    updateGallery();
  }

  function toggleDoctor(force) {
    var card = $(".doctor-scroll.is-active");
    if (!card) return;
    var next = typeof force === "boolean" ? force : !state.galleryFlipped;
    state.galleryFlipped = next;
    card.classList.toggle("is-flipped", next);
    card.setAttribute("aria-expanded", next ? "true" : "false");
  }

  function closeDoctor() {
    state.galleryFlipped = false;
    $$(".doctor-scroll").forEach(function (card) {
      card.classList.remove("is-flipped");
      card.setAttribute("aria-expanded", "false");
    });
  }

  function bindGalleryGestures() {
    var startX = 0, startY = 0, lastX = 0, pointerId = null, moved = false, wheelLock = false, trackShift = 0;
    dom.scrollStage.addEventListener("pointerdown", function (event) {
      if (event.button !== undefined && event.button !== 0) return;
      pointerId = event.pointerId;
      startX = lastX = event.clientX;
      startY = event.clientY;
      moved = false;
      dom.scrollStage.classList.add("is-dragging");
    });
    dom.scrollStage.addEventListener("pointermove", function (event) {
      if (pointerId == null) return;
      lastX = event.clientX;
      if (Math.abs(lastX - startX) > 8 || Math.abs(event.clientY - startY) > 8) {
        if (!moved) {
          moved = true;
          try { dom.scrollStage.setPointerCapture(pointerId); } catch (err) { /* noop */ }
        }
        trackShift = (lastX - startX) * .12;
        dom.scrollTrack.style.transform = "translate3d(" + trackShift.toFixed(2) + "px,0,0)";
      }
    });
    function finishDrag() {
      if (pointerId == null) return;
      var dx = lastX - startX;
      dom.scrollStage.classList.remove("is-dragging");
      pointerId = null;
      trackShift = 0;
      dom.scrollTrack.style.transform = "";
      if (Math.abs(dx) > 42) {
        state.suppressDoctorClick = true;
        setTimeout(function () { state.suppressDoctorClick = false; }, 80);
        goDoctor(state.doctor + (dx < 0 ? 1 : -1));
      } else if (moved) {
        state.suppressDoctorClick = true;
        setTimeout(function () { state.suppressDoctorClick = false; }, 80);
      }
    }
    dom.scrollStage.addEventListener("pointerup", finishDrag);
    dom.scrollStage.addEventListener("pointercancel", finishDrag);
    dom.scrollStage.addEventListener("pointerleave", function () {
      if (pointerId != null) finishDrag();
    });

    dom.scrollStage.addEventListener("wheel", function (event) {
      if (Math.abs(event.deltaY) < 8) return;
      event.preventDefault();
      if (wheelLock) return;
      wheelLock = true;
      goDoctor(state.doctor + (event.deltaY > 0 ? 1 : -1));
      setTimeout(function () { wheelLock = false; }, 900);
    }, { passive: false });

    document.addEventListener("keydown", function (event) {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
      if (document.documentElement.classList.contains("deck-ready") && !dom.hero.classList.contains("is-deck-active")) return;
      var heroRect = dom.hero.getBoundingClientRect();
      if (heroRect.bottom < 0 || heroRect.top > window.innerHeight) return;
      if (event.key === "ArrowLeft") { event.preventDefault(); goDoctor(state.doctor - 1); }
      if (event.key === "ArrowRight") { event.preventDefault(); goDoctor(state.doctor + 1); }
      if (event.key === "Escape") closeDoctor();
    });
  }

  /* ----------------------------------------------------------------------
     ECharts visual system
     ---------------------------------------------------------------------- */
  var chartColors = {
    paper: "#2b2116",
    gold: "#d4af37",
    cinnabar: "#9e2a2b",
    line: "rgba(214,197,174,.16)",
    muted: "rgba(214,197,174,.45)"
  };
  var tooltipStyle = {
    backgroundColor: "rgba(12,10,8,.94)",
    borderColor: "rgba(212,175,55,.28)",
    borderWidth: 1,
    textStyle: { color: "#e6d7bf", fontFamily: "Noto Serif SC, SimSun, serif", fontSize: 14 },
    extraCssText: "box-shadow:0 10px 30px rgba(0,0,0,.35);border-radius:0;"
  };

  function initCharts() {
    if (!hasECharts) return;
    if (dom.radarChart) {
      charts.radar = window.echarts.init(dom.radarChart, null, { renderer: "canvas" });
      charts.network = window.echarts.init(dom.networkChart, null, { renderer: "canvas" });
      charts.processing = window.echarts.init(dom.proc.chart, null, { renderer: "canvas" });
      charts.dose = window.echarts.init(dom.forms.chart, null, { renderer: "canvas" });
      charts.network.on("click", function (params) {
        if (!params.data || params.data.nodeType !== 0) return;
        var target = DATA.herbs.findIndex(function (herb) { return herb.id === params.data.id; });
        if (target >= 0) selectHerb(target);
      });
    }
  }

  function updateRadarChart() {
    var herb = DATA.herbs[state.herb];
    var axes = ["多糖", "生物碱", "黄酮", "萜 / 挥发油", "酚酸 / 鞣质", "含氮组分"];
    var values = herb.chem.slice();
    var labels = axes.slice().reverse();
    var bars = values.slice().reverse();
    if (hasECharts && charts.radar) {
      var barGradient = window.echarts && window.echarts.graphic ? new window.echarts.graphic.LinearGradient(0, 0, 1, 0, [
        { offset: 0, color: "#6f2e27" },
        { offset: .62, color: "#a95743" },
        { offset: 1, color: "#d08a69" }
      ]) : "#b56750";
      charts.radar.setOption({
        animationDuration: 720,
        animationEasing: "cubicOut",
        grid: { left: 76, right: 38, top: 22, bottom: 22 },
        tooltip: Object.assign({}, tooltipStyle, {
          trigger: "item",
          formatter: function (params) {
            return "<strong style='font-weight:400;color:#f0dfb9'>" + escapeHtml(herb.name) + "</strong><br>" +
              params.name + " · 相对强度 " + params.value;
          }
        }),
        xAxis: {
          type: "value",
          max: 100,
          min: 0,
          splitNumber: 4,
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { color: "rgba(214,197,174,.25)", fontSize: 14, fontFamily: "Georgia, serif" },
          splitLine: { lineStyle: { color: "rgba(214,197,174,.08)", type: "dashed" } }
        },
        yAxis: {
          type: "category",
          data: labels,
          inverse: false,
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: {
            color: "rgba(232,215,190,.68)",
            fontSize: 14,
            fontFamily: "Noto Serif SC, SimSun, serif",
            margin: 13
          }
        },
        series: [{
          name: "相对强度",
          type: "bar",
          data: bars,
          barWidth: 9,
          barCategoryGap: "43%",
          showBackground: true,
          backgroundStyle: { color: "rgba(214,197,174,.055)" },
          itemStyle: { color: barGradient },
          label: {
            show: true,
            position: "right",
            color: "rgba(232,215,190,.55)",
            fontFamily: "Georgia, serif",
            fontSize: 14,
            formatter: "{c}"
          },
          emphasis: { itemStyle: { color: "#e0b889" } },
          markLine: {
            silent: true,
            symbol: ["none", "none"],
            label: { show: false },
            lineStyle: { color: "rgba(214,197,174,.14)", type: "dashed", width: 1 },
            data: [{ xAxis: 50 }]
          }
        }]
      }, true);
    } else if (window.TCMFallback) {
      window.TCMFallback.bars(dom.radarChart, { labels: axes, values: values, dark: true });
    }
  }

  function updateNetworkChart() {
    var herb = DATA.herbs[state.herb];
    var nodes = [];
    var links = [];
    var flavors = ["辛", "甘", "酸", "苦", "咸"];
    var meridians = ["心", "肝", "脾", "肺", "肾", "胃", "胆"];
    DATA.herbs.forEach(function (item) {
      nodes.push({ id: item.id, name: item.name, type: 0, nodeType: 0, category: 0, symbolSize: item.id === herb.id ? 17 : 10 });
      item.flavor.forEach(function (f) {
        links.push({ source: item.id, target: "flavor-" + f });
      });
      item.meridians.forEach(function (m) {
        links.push({ source: item.id, target: "meridian-" + m });
      });
    });
    flavors.forEach(function (f) {
      nodes.push({ id: "flavor-" + f, name: f + "味", type: 1, nodeType: 1, category: 1, symbolSize: 17 });
    });
    meridians.forEach(function (m) {
      nodes.push({ id: "meridian-" + m, name: m + "经", type: 2, nodeType: 2, category: 2, symbolSize: 9 });
    });
    var categories = [
      { name: "本草", itemStyle: { color: "#d4bd94" } },
      { name: "五味", itemStyle: { color: "#a65e4d" } },
      { name: "归经", itemStyle: { color: "#71816c" } }
    ];
    nodes = nodes.map(function (n) {
      if (n.id === herb.id) {
        n.itemStyle = { color: "#f1dfb5", borderColor: "#d4af37", borderWidth: 2 };
        n.label = { show: true, color: "#f5e6c4", fontSize: 14, fontWeight: 400 };
      }
      // Meridian nodes stay readable through hover tooltips; suppressing their
      // static labels keeps the larger type from colliding at 1920px.
      if (n.nodeType === 2) n.label = { show: false };
      return n;
    });
    if (hasECharts && charts.network) {
      charts.network.setOption({
        animationDuration: 700,
        tooltip: Object.assign({}, tooltipStyle, {
          formatter: function (params) {
            if (params.dataType === "edge") return "";
            return params.data.name + (params.data.type === 0 ? " · 本草" : params.data.type === 1 ? " · 五味" : " · 归经");
          }
        }),
        series: [{
          type: "graph",
          layout: "force",
          roam: true,
          draggable: true,
          categories: categories,
          data: nodes,
          links: links,
          symbol: "circle",
          force: { repulsion: 155, edgeLength: [45, 100], gravity: .1, friction: .2 },
          label: {
            show: true,
            color: "rgba(232,215,190,.58)",
            fontSize: 11.5,
            fontFamily: "Noto Serif SC, SimSun, serif",
            formatter: function (p) { return p.data.name; }
          },
          labelLayout: { hideOverlap: true },
          lineStyle: { color: "rgba(196,169,130,.12)", width: .7, curveness: .08 },
          emphasis: { focus: "adjacency", lineStyle: { color: "rgba(212,175,55,.42)", width: 1.1 } },
          itemStyle: { borderColor: "rgba(0,0,0,.3)", borderWidth: 1 }
        }]
      }, true);
    } else if (window.TCMFallback) {
      window.TCMFallback.network(dom.networkChart, { nodes: nodes, links: links, active: herb.id, key: herb.id });
    }
  }

  function processingModel(temp, hours, stage) {
    var tempFactor = Math.exp((temp - 100) / 26);
    var timeFactor = hours / 6;
    var heat = stage * tempFactor * timeFactor;
    var irritant = 100 * Math.exp(-.19 * heat);
    var reducing = 90 * (1 - Math.exp(-.22 * heat));
    var hmf = clamp(88 * (1 - Math.exp(-.26 * heat)) * (0.82 + 0.22 * Math.min(temp / 100, 1.25)), 0, 100);
    var brown = clamp(100 * (1 - Math.exp(-.2 * heat)), 0, 100);
    return { heat: heat, irritant: irritant, reducing: reducing, hmf: hmf, brown: brown };
  }

  function updateProcessingChart() {
    var temp = state.proc.temp;
    var hours = state.proc.hours;
    var labels = ["生"];
    var irritant = [100];
    var reducing = [0];
    var hmf = [0];
    for (var i = 1; i <= 9; i++) {
      var model = processingModel(temp, hours, i);
      labels.push(chineseNumber(i));
      irritant.push(+model.irritant.toFixed(1));
      reducing.push(+model.reducing.toFixed(1));
      hmf.push(+model.hmf.toFixed(1));
    }
    var marker = state.proc.stage;
    if (hasECharts && charts.processing) {
      charts.processing.setOption({
        animationDurationUpdate: 600,
        tooltip: Object.assign({}, tooltipStyle, {
          trigger: "axis",
          formatter: function (params) {
            return "第 " + (params[0].dataIndex === 0 ? "生品" : params[0].dataIndex + " 蒸") + "<br>" +
              params.map(function (p) { return p.marker + p.seriesName + " · " + p.value[1]; }).join("<br>");
          }
        }),
        grid: { left: 34, right: 10, top: 22, bottom: 25 },
        xAxis: {
          type: "category",
          data: labels,
          boundaryGap: false,
          axisLine: { lineStyle: { color: "rgba(214,197,174,.18)" } },
          axisTick: { show: false },
          axisLabel: { color: "rgba(214,197,174,.42)", fontSize: 14, fontFamily: "Noto Serif SC, SimSun, serif" }
        },
        yAxis: {
          type: "value",
          min: 0,
          max: 100,
          splitNumber: 4,
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { color: "rgba(214,197,174,.28)", fontSize: 14, fontFamily: "Georgia, serif" },
          splitLine: { lineStyle: { color: "rgba(214,197,174,.09)", type: "dashed" } }
        },
        series: [
          {
            name: "刺激性组分", type: "line", data: irritant, smooth: true, symbol: "circle", symbolSize: 3.5,
            lineStyle: { width: 1.5, color: "#b25340" }, itemStyle: { color: "#b25340" },
            areaStyle: { color: "rgba(178,83,64,.06)" },
            markLine: marker > 0 ? { silent: true, symbol: "none", label: { show: false }, lineStyle: { color: "rgba(212,175,55,.24)", type: "dashed" }, data: [{ xAxis: marker }] } : undefined
          },
          {
            name: "多糖→还原糖", type: "line", data: reducing, smooth: true, symbol: "circle", symbolSize: 3.5,
            lineStyle: { width: 1.35, color: "#d4af37" }, itemStyle: { color: "#d4af37" }
          },
          {
            name: "5-HMF", type: "line", data: hmf, smooth: true, symbol: "none",
            lineStyle: { width: 1, color: "rgba(214,197,174,.68)", type: "dashed" }, itemStyle: { color: "#c2ae93" }
          }
        ]
      }, true);
    } else if (window.TCMFallback) {
      window.TCMFallback.line(dom.proc.chart, {
        labels: labels,
        series: [
          { name: "刺激性组分", data: irritant, color: "#b25340" },
          { name: "多糖→还原糖", data: reducing, color: "#d4af37" },
          { name: "5-HMF", data: hmf, color: "#c2ae93", dashed: true }
        ],
        marker: marker, yMax: 100
      });
    }
  }

  function formChartData() {
    return DATA.forms.map(function (form, index) {
      var active = index === state.form;
      return {
        name: form.name,
        type: "line",
        data: form.curve,
        smooth: true,
        symbol: "none",
        lineStyle: { width: active ? 2.4 : 1, color: form.color, opacity: active ? 1 : .25 },
        itemStyle: { color: form.color },
        emphasis: { focus: "series" }
      };
    });
  }

  function updateDoseChart() {
    if (hasECharts && charts.dose) {
      charts.dose.setOption({
        animationDurationUpdate: 700,
        tooltip: Object.assign({}, tooltipStyle, {
          trigger: "axis",
          formatter: function (params) {
            return params[0].axisValue + " h<br>" + params.map(function (p) {
              return p.marker + p.seriesName + " · " + p.value + "%";
            }).join("<br>");
          }
        }),
        grid: { left: 34, right: 12, top: 26, bottom: 27 },
        xAxis: {
          type: "category", boundaryGap: false, data: ["0", ".25", ".5", "1", "2", "4", "6", "8"],
          name: "小时", nameTextStyle: { color: "rgba(214,197,174,.28)", fontSize: 14, padding: [18, 0, 0, 0] },
          axisLine: { lineStyle: { color: "rgba(214,197,174,.18)" } },
          axisTick: { show: false },
          axisLabel: { color: "rgba(214,197,174,.4)", fontSize: 14 }
        },
        yAxis: {
          type: "value", min: 0, max: 100, splitNumber: 4,
          axisLabel: { color: "rgba(214,197,174,.26)", fontSize: 14, formatter: "{value}%" },
          splitLine: { lineStyle: { color: "rgba(214,197,174,.08)", type: "dashed" } }
        },
        series: formChartData()
      }, true);
    } else if (window.TCMFallback) {
      window.TCMFallback.line(dom.forms.chart, {
        labels: ["0", ".25", ".5", "1", "2", "4", "6", "8"],
        series: DATA.forms.map(function (f, i) {
          return { name: f.name, data: f.curve, color: f.color, active: i === state.form, dashed: i !== state.form && i % 2 === 1 };
        }),
        yMax: 100
      });
    }
  }

  function redrawFallbackCharts() {
    if (hasECharts) {
      Object.keys(charts).forEach(function (key) { if (charts[key]) charts[key].resize(); });
      return;
    }
    if (window.TCMFallback) {
      updateRadarChart();
      updateNetworkChart();
      updateProcessingChart();
      updateDoseChart();
    }
  }
  /* ----------------------------------------------------------------------
     Chapter 01 · herb cabinet + molecular ledger
     ---------------------------------------------------------------------- */
  var herbIconMap = { stem: "sprig", root: "root", rhizome: "rhizome", fruit: "fruit", leaf: "leaf", fungus: "fungus", flower: "flower", peel: "peel", bulb: "bulb" };

  function initHerbs() {
    dom.cabinet.innerHTML = DATA.herbs.map(function (herb, index) {
      var anhui = herb.origin.indexOf("安徽") !== -1;
      return '<button class="herb-drawer" type="button" role="listitem" data-herb="' + index + '" aria-pressed="' + (index === 0 ? "true" : "false") + '">' +
        '<span class="drawer-photo" aria-hidden="true" style="background-image:url(\'' + herb.photo + '\')"></span>' +
        '<span class="drawer-num">' + String(index + 1).padStart(2, "0") + '</span>' +
        '<span class="drawer-name">' + escapeHtml(herb.name) + '<small>' + escapeHtml(herb.nature) + ' · ' + escapeHtml(herb.flavor.join("")) + '味</small></span>' +
        '<span class="drawer-origin">' + escapeHtml(herb.origin.replace("安徽", "")) + '</span>' +
        (anhui ? '<span class="drawer-anhui">皖</span>' : "") +
        svgIcon(herbIconMap[herb.icon] || "sprig", "drawer-icon") +
      '</button>';
    }).join("");
    dom.cabinet.addEventListener("click", function (event) {
      var button = event.target.closest(".herb-drawer");
      if (!button) return;
      selectHerb(Number(button.getAttribute("data-herb")));
    });

    dom.flavorRows.innerHTML = DATA.flavorBasis.map(function (item) {
      return '<article class="flavor-row">' +
        '<span class="flavor-glyph">' + escapeHtml(item.flavor) + '</span>' +
        '<div><h4>' + escapeHtml(item.taste) + '</h4><p>' + escapeHtml(item.molecules) + '</p><small>' + escapeHtml(item.examples) + '</small></div>' +
      '</article>';
    }).join("");

    selectHerb(0, true);
  }

  function selectHerb(index, initial) {
    state.herb = clamp(index, 0, DATA.herbs.length - 1);
    var herb = DATA.herbs[state.herb];
    $$(".herb-drawer", dom.cabinet).forEach(function (button, i) {
      button.classList.toggle("is-active", i === state.herb);
      button.setAttribute("aria-pressed", i === state.herb ? "true" : "false");
    });
    dom.herbName.textContent = herb.name;
    dom.herbLatin.textContent = herb.latin;
    dom.herbOrigin.textContent = herb.origin + " · " + herb.part;
    dom.herbQuote.textContent = "“" + herb.quote + "”";
    dom.herbQuoteSource.textContent = herb.quoteSource;
    dom.herbPhysical.textContent = herb.physical;
    if (dom.herbPhoto) {
      dom.herbPhoto.src = herb.photo;
      dom.herbPhoto.alt = herb.name + (herb.part === "菌核" ? "菌核参考影像" : "原植物参考影像");
    }
    if (dom.herbPhotoCredit) {
      dom.herbPhotoCredit.textContent = herb.photoSource + " · " + herb.photoLicense;
    }
    if (dom.herbPlateIndex) {
      dom.herbPlateIndex.textContent = "FIELD PLATE · " + String(state.herb + 1).padStart(2, "0");
    }
    if (dom.herbPlateKind) {
      dom.herbPlateKind.textContent = herb.part === "菌核" ? "菌核 · 药材参考" : "原植物 · 生境参考";
    }
    dom.herbTags.innerHTML = [herb.nature, herb.flavor.join(" · ") + "味"].concat(herb.meridians.map(function (m) { return m + "经"; })).map(function (tag) {
      return "<span>" + escapeHtml(tag) + "</span>";
    }).join("");
    dom.herbCompounds.innerHTML = herb.compounds.map(function (compound) {
      return '<article class="ledger-item"><b>' + escapeHtml(compound.name) + '</b><span>' + escapeHtml(compound.class) + '</span><p>' + escapeHtml(compound.note) + '</p></article>';
    }).join("");
    dom.herbCompoundCount.textContent = String(herb.compounds.length).padStart(2, "0") + " 项";
    dom.herbNote.textContent = "观察注 · " + herb.note;
    updateRadarChart();
    updateNetworkChart();
    if (!initial && !reducedMotion) {
      var block = $(".herb-title-block");
      if (block && block.animate) {
        block.animate([
          { opacity: .35, transform: "translateY(8px)" },
          { opacity: 1, transform: "translateY(0)" }
        ], { duration: 520, easing: "cubic-bezier(.22,1,.36,1)" });
      }
    }
  }

  /* ----------------------------------------------------------------------
     Chapter 02 · Nine steamings virtual processing bench
     ---------------------------------------------------------------------- */
  function initProcessing() {
    dom.proc.input.value = state.proc.temp;
    dom.proc.hoursInput.value = state.proc.hours;
    dom.proc.input.addEventListener("input", function () {
      state.proc.temp = Number(this.value);
      updateProcessingUI();
    });
    dom.proc.hoursInput.addEventListener("input", function () {
      state.proc.hours = Number(this.value);
      updateProcessingUI();
    });
    dom.proc.seals.innerHTML = Array.from({ length: 9 }, function (_, i) {
      return '<button type="button" data-stage="' + (i + 1) + '" aria-label="跳至第' + chineseNumber(i + 1) + '蒸">' + (i + 1) + '</button>';
    }).join("");
    dom.proc.seals.addEventListener("click", function (event) {
      var button = event.target.closest("button[data-stage]");
      if (!button) return;
      setProcessingStage(Number(button.getAttribute("data-stage")));
    });
    dom.proc.advance.addEventListener("click", function () {
      if (state.proc.stage >= 9) {
        showToast("九蒸九晒已完成。可调低温度与时长，观察另一条反应路径。");
        return;
      }
      setProcessingStage(state.proc.stage + 1);
    });
    dom.proc.reset.addEventListener("click", function () {
      setProcessingStage(0);
      showToast("炮制台已归零，回到生品切片。");
    });
    setRangeFill(dom.proc.input);
    setRangeFill(dom.proc.hoursInput);
    updateProcessingUI();
    syncProcessingPhoto();
    drawProcessingFrame(performance.now());

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        state.visible.processing = entries[0].isIntersecting && isSceneActive("chapter-processing");
      }, { threshold: .05 }).observe($("#chapter-processing"));
    } else {
      state.visible.processing = true;
    }
    window.requestAnimationFrame(processingLoop);
  }

  function setProcessingStage(stage) {
    state.proc.stage = clamp(stage, 0, 9);
    state.proc.animating = true;
    state.proc.lastStageChange = performance.now();
    if (state.proc.stage > 0) {
      for (var i = 0; i < 16; i++) spawnSteamParticle(1.5);
    }
    updateProcessingUI();
    if (state.proc.stage === 9) showToast("九蒸九晒工艺完成 · 切面进入黑亮油润阶段");
  }

  function updateProcessingUI() {
    var proc = state.proc;
    var model = processingModel(proc.temp, proc.hours, proc.stage);
    dom.proc.tempValue.innerHTML = proc.temp + "<span>℃</span>";
    dom.proc.hoursValue.innerHTML = proc.hours + "<span>h</span>";
    dom.proc.visualTemp.textContent = proc.temp;
    dom.proc.stageNumber.textContent = proc.stage;
    dom.proc.heatDose.textContent = nf(model.heat, 1);
    dom.proc.irritant.textContent = nf(model.irritant, 1);
    dom.proc.hmf.textContent = nf(model.hmf, 1);
    dom.proc.brown.textContent = Math.round(model.brown);
    dom.proc.stageValue.textContent = proc.stage === 0 ? "未启" : "第 " + chineseNumber(proc.stage) + " 蒸";
    dom.proc.stamp.innerHTML = "<span>" + (proc.stage === 0 ? "未" : chineseNumber(proc.stage)) + "</span><small>蒸</small>";
    dom.proc.stageValue.style.color = proc.stage === 9 ? "var(--gold-pale)" : "";
    if (proc.stage === 0) {
      dom.proc.stateLabel.textContent = "生品 · 浅黄半透明";
      dom.proc.note.textContent = "生黄精根茎尚未经历蒸晒。色浅，纤维清晰，含水较高。";
      dom.proc.advance.querySelector("span").textContent = "点火 · 推进一蒸";
    } else {
      var stage = DATA.processing.stages[proc.stage - 1];
      dom.proc.stateLabel.textContent = "第 " + chineseNumber(proc.stage) + " 蒸 · " + stage.phase;
      dom.proc.note.textContent = stage.desc;
      dom.proc.advance.querySelector("span").textContent = proc.stage >= 9 ? "九蒸完成 · 观其色" : "点火 · 推进第 " + chineseNumber(proc.stage + 1) + " 蒸";
    }
    $$("button[data-stage]", dom.proc.seals).forEach(function (button) {
      var n = Number(button.getAttribute("data-stage"));
      button.classList.toggle("is-done", n <= proc.stage);
      button.classList.toggle("is-current", n === proc.stage);
    });
    setRangeFill(dom.proc.input);
    setRangeFill(dom.proc.hoursInput);
    syncProcessingPhoto();
    updateProcessingChart();
  }

  function syncProcessingPhoto() {
    var stage = document.getElementById("processingPhotoStage");
    if (!stage) return;
    var stageNo = state.proc.stage;
    var key = stageNo === 0 ? "raw" : stageNo >= 9 ? "prepared" : stageNo >= 5 ? "deep" : "steam";
    stage.style.setProperty("--stage", clamp(state.proc.visualStage / 9, 0, 1).toFixed(3));
    stage.setAttribute("data-stage", String(stageNo));
    stage.classList.toggle("is-nine", stageNo === 9);
    $$(".processing-photo", stage).forEach(function (img) {
      img.classList.toggle("is-visible", img.getAttribute("data-stage-image") === key);
    });
    if (dom.proc.photoCaption) {
      dom.proc.photoCaption.textContent = stageNo === 0 ? "生品 · 原根茎" : stageNo >= 9 ? "九蒸九晒 · 乌黑油润" : stageNo >= 5 ? "反复蒸晒 · 糖化加深" : "蒸制中 · 色转深";
    }
  }

  function spawnSteamParticle(force) {
    var p = state.proc.particles;
    if (p.length > 80) return;
    p.push({
      x: 280 + Math.random() * 250,
      y: 330 + Math.random() * 24,
      vx: (Math.random() - .5) * 10,
      vy: -18 - Math.random() * 25,
      life: 1,
      size: 3 + Math.random() * 8,
      drift: Math.random() * Math.PI * 2
    });
  }

  function processingLoop(now) {
    if (state.visible.processing !== false) {
      var delta = state.proc.lastTime ? Math.min(50, now - state.proc.lastTime) : 16;
      state.proc.lastTime = now;
      if (state.proc.visualStage !== state.proc.stage) {
        var step = Math.max(.008, delta / 1000 * .58);
        if (state.proc.visualStage < state.proc.stage) state.proc.visualStage = Math.min(state.proc.stage, state.proc.visualStage + step);
        else state.proc.visualStage = Math.max(state.proc.stage, state.proc.visualStage - step);
        syncProcessingPhoto();
      }
      state.proc.particles.forEach(function (p) {
        p.x += p.vx * delta / 1000 + Math.sin(now / 650 + p.drift) * .22;
        p.y += p.vy * delta / 1000;
        p.life -= delta / 3000;
      });
      state.proc.particles = state.proc.particles.filter(function (p) { return p.life > 0; });
      if (state.proc.stage > 0 && Math.random() < .18) spawnSteamParticle();
      if (state.proc.stage > 0 && state.proc.stage < 9 && Math.random() < .03) spawnSteamParticle(1.8);
      drawProcessingFrame(now);
    }
    window.requestAnimationFrame(processingLoop);
  }

  function drawProcessingFrame(now) {
    var canvas = dom.proc.canvas;
    if (!canvas) return;
    var c = canvasContext(canvas);
    var ctx = c.ctx, w = c.w, h = c.h;
    if (!w || !h) return;
    ctx.clearRect(0, 0, w, h);
    var t = clamp(state.proc.visualStage / 9, 0, 1);
    var cx = w * .5, cy = h * .53;
    var sliceW = Math.min(w * .32, h * .45);
    var sliceH = sliceW * .64;

    // Table / board shadow.
    ctx.save();
    var boardGrad = ctx.createRadialGradient(cx - 30, cy + sliceH * .62, 10, cx, cy + sliceH * .7, sliceW * 1.75);
    boardGrad.addColorStop(0, "rgba(89,57,30,.42)");
    boardGrad.addColorStop(.55, "rgba(34,23,13,.64)");
    boardGrad.addColorStop(1, "rgba(10,8,6,0)");
    ctx.fillStyle = boardGrad;
    ctx.beginPath();
    ctx.ellipse(cx, cy + sliceH * .74, sliceW * 1.5, sliceH * .42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Back slices.
    drawRhizomeSlice(ctx, cx - sliceW * .28, cy + sliceH * .1, sliceW * .73, sliceH * .72, -.22, t, 12, .55);
    drawRhizomeSlice(ctx, cx + sliceW * .34, cy + sliceH * .03, sliceW * .7, sliceH * .69, .18, t, 28, .58);

    // Main slice with a warm rim light.
    ctx.save();
    ctx.shadowColor = t > .82 ? "rgba(213,161,83,.15)" : "rgba(213,161,83,.28)";
    ctx.shadowBlur = t > .82 ? 18 : 28;
    drawRhizomeSlice(ctx, cx, cy, sliceW, sliceH, -.04, t, 5, 1);
    ctx.restore();

    // Glossy highlights and fibres.
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, sliceW * .97, sliceH * .96, -.04, 0, Math.PI * 2);
    ctx.clip();
    ctx.strokeStyle = "rgba(255,239,202," + (.08 + t * .18) + ")";
    ctx.lineWidth = 1;
    for (var r = 1; r < 8; r++) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, sliceW * (.11 + r * .095), sliceH * (.1 + r * .09), -.04, Math.PI * .1, Math.PI * 1.075);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(255,237,195," + (.04 + t * .14) + ")";
    ctx.beginPath();
    ctx.ellipse(cx - sliceW * .3, cy - sliceH * .37, sliceW * .31, sliceH * .13, -.26, 0, Math.PI * 2);
    ctx.fill();
    var rng = seededRandom(12);
    for (var j = 0; j < 35; j++) {
      var a = rng() * Math.PI * 2;
      var rr = Math.sqrt(rng());
      var px = cx + Math.cos(a) * sliceW * .84 * rr;
      var py = cy + Math.sin(a) * sliceH * .82 * rr;
      ctx.fillStyle = "rgba(" + Math.round(lerp(104, 32, t)) + "," + Math.round(lerp(73, 16, t)) + "," + Math.round(lerp(40, 8, t)) + "," + (.05 + t * .12) + ")";
      ctx.beginPath();
      ctx.ellipse(px, py, 1 + rng() * 2.2, .7 + rng() * 1.3, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Steam particles.
    state.proc.particles.forEach(function (p) {
      var alpha = Math.max(0, p.life) * .18;
      var g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 4.2);
      g.addColorStop(0, "rgba(239,221,186," + alpha + ")");
      g.addColorStop(.5, "rgba(210,184,141," + alpha * .45 + ")");
      g.addColorStop(1, "rgba(210,184,141,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 4.2, 0, Math.PI * 2);
      ctx.fill();
    });

    // Seal-like small red dot on the main slice after the 3rd steaming.
    if (state.proc.stage >= 3) {
      ctx.save();
      ctx.globalAlpha = .58;
      ctx.strokeStyle = "#a94334";
      ctx.lineWidth = 1;
      ctx.strokeRect(cx + sliceW * .61, cy + sliceH * .43, 22, 22);
      ctx.fillStyle = "rgba(169,67,52,.72)";
      ctx.font = '10px "Noto Serif SC",SimSun,serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("熟", cx + sliceW * .61 + 11, cy + sliceH * .43 + 11);
      ctx.restore();
    }

    // Floor / shadow line under the slice.
    ctx.save();
    var floor = ctx.createLinearGradient(0, h * .8, 0, h);
    floor.addColorStop(0, "rgba(212,175,55,0)");
    floor.addColorStop(.55, "rgba(212,175,55,.055)");
    floor.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = floor;
    ctx.fillRect(0, h * .8, w, h * .2);
    ctx.restore();
  }

  function drawRhizomeSlice(ctx, cx, cy, rx, ry, rotation, t, seed, weight) {
    var rng = seededRandom(seed);
    var darkT = Math.pow(t, .72);
    var baseLight = mixColor("#e2ce9b", "#331a0d", darkT * .94);
    var baseDark = mixColor("#9e7a45", "#0d0705", t);
    var edge = mixColor("#7f5b2e", "#080403", t);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation);
    ctx.globalAlpha = weight;
    ctx.beginPath();
    for (var i = 0; i <= 64; i++) {
      var a = i / 64 * Math.PI * 2;
      var wobble = 1 + Math.sin(a * 3 + seed) * .016 + Math.sin(a * 7 + seed * .5) * .009;
      var x = Math.cos(a) * rx * wobble;
      var y = Math.sin(a) * ry * wobble;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    var grad = ctx.createRadialGradient(-rx * .22, -ry * .26, rx * .05, 0, 0, rx * 1.25);
    grad.addColorStop(0, mixColor("#f1e2b6", "#44230f", Math.pow(t, .82)));
    grad.addColorStop(.38, baseLight);
    grad.addColorStop(.78, mixColor("#b58d55", "#180c06", t));
    grad.addColorStop(1, baseDark);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = edge;
    ctx.lineWidth = 1.3;
    ctx.stroke();

    // Darker rim after processing.
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, 0, rx * .93, ry * .93, 0, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(" + Math.round(lerp(94, 19, t)) + "," + Math.round(lerp(67, 10, t)) + "," + Math.round(lerp(33, 6, t)) + "," + (.22 + t * .35) + ")";
    ctx.lineWidth = Math.max(1, rx * .014);
    ctx.stroke();
    ctx.restore();

    // Tiny radial channels.
    for (var k = 0; k < 18; k++) {
      var aa = rng() * Math.PI * 2;
      var len = rx * (.18 + rng() * .62);
      var sx = Math.cos(aa) * rx * .16;
      var sy = Math.sin(aa) * ry * .16;
      ctx.strokeStyle = t > .72 ? "rgba(236,194,132," + (.06 + t * .05) + ")" : "rgba(255,242,211," + (.06 + t * .06) + ")";
      ctx.lineWidth = t > .72 ? .9 : .6;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(Math.cos(aa + .2) * len * .6, Math.sin(aa + .2) * len * .5, Math.cos(aa) * len, Math.sin(aa) * len);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ----------------------------------------------------------------------
     Chapter 03 · Hydrodistillation apparatus
     ---------------------------------------------------------------------- */
  function initDistillation() {
    dom.distill.power.value = state.distill.power;
    dom.distill.flow.value = state.distill.flow;
    dom.distill.materialSwitch.addEventListener("click", function (event) {
      var button = event.target.closest("[data-material]");
      if (!button) return;
      state.distill.material = button.getAttribute("data-material");
      state.distill.oil = 0;
      state.distill.lost = 0;
      $$("[data-material]", dom.distill.materialSwitch).forEach(function (b) {
        var active = b === button;
        b.classList.toggle("is-active", active);
        b.setAttribute("aria-selected", active ? "true" : "false");
      });
      var material = DATA.distillation.materials.find(function (m) { return m.id === state.distill.material; });
      dom.distill.materialLabel.textContent = material.name + " · " + (material.id === "mint" ? "地上部分" : "叶");
      dom.distill.note.innerHTML = "<span>" + material.oil + "</span><p>" + material.note + "</p>";
      updateDistillReadouts();
    });
    dom.distill.power.addEventListener("input", function () {
      state.distill.power = Number(this.value);
      updateDistillReadouts();
    });
    dom.distill.flow.addEventListener("input", function () {
      state.distill.flow = Number(this.value);
      updateDistillReadouts();
    });
    setRangeFill(dom.distill.power);
    setRangeFill(dom.distill.flow);
    updateDistillReadouts();
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        state.visible.distillation = entries[0].isIntersecting && isSceneActive("chapter-distillation");
      }, { threshold: .05 }).observe($("#chapter-distillation"));
    } else {
      state.visible.distillation = true;
    }
    window.requestAnimationFrame(distillationLoop);
  }

  function distillMetrics() {
    var power = state.distill.power;
    var flow = state.distill.flow;
    var heat = (power - 240) / 960;
    var condense = clamp(.30 + (flow / 2.5) * .64 - Math.max(0, power - 800) / 2600, .12, .98);
    var risk = clamp(power / 1200 - (flow / 2.5) * 1.12, 0, 1);
    var danger = risk > .4 || (power > 1050 && flow < .9);
    var azeotrope = state.distill.material === "mint" ? 96.4 : 96.9;
    return { heat: clamp(heat, 0, 1), condense: condense, risk: risk, danger: danger, azeotrope: azeotrope };
  }

  function updateDistillReadouts() {
    var m = distillMetrics();
    var material = DATA.distillation.materials.find(function (x) { return x.id === state.distill.material; });
    dom.distill.powerValue.innerHTML = state.distill.power + "<span>W</span>";
    dom.distill.flowValue.innerHTML = nf(state.distill.flow, 1) + "<span>L/min</span>";
    dom.distill.azeotrope.textContent = nf(m.azeotrope, 1);
    dom.distill.eff.textContent = Math.round(m.condense * 100);
    dom.distill.oil.textContent = nf(state.distill.oil, 1);
    setRangeFill(dom.distill.power);
    setRangeFill(dom.distill.flow);
    var photoStage = document.getElementById("distillPhotoStage");
    if (photoStage) {
      photoStage.style.setProperty("--heat", m.heat.toFixed(3));
      photoStage.classList.toggle("is-danger", !!m.danger);
    }
    var warningTitle = "操作提示";
    var warningCopy = "保持冷凝水流动；若出现蒸汽外逸或液体剧烈翻腾，先降低热功率。";
    if (m.danger) {
      dom.distill.warning.classList.add("is-warning");
      warningTitle = "暴沸预警 · 挥发油逸散";
      warningCopy = "热输入超过当前冷凝能力。请降低底部加热功率，或提高冷凝水流量，让蒸汽重新回到冷凝管。";
      dom.distill.sate.textContent = "风险状态 · 先降热，再稳流";
    } else if (state.distill.flow < .6) {
      dom.distill.warning.classList.add("is-warning");
      warningTitle = "冷凝不足";
      warningCopy = "冷凝水流量偏低，蒸汽可能外逸。逐步开大水阀，观察油层是否回落。";
      dom.distill.sate.textContent = "低流量 · 冷凝效率下降";
    } else {
      dom.distill.warning.classList.remove("is-warning");
      dom.distill.sate.textContent = state.distill.oil > 18 ? "装置运行中 · 油水分离器积聚" : "装置运行中 · 蒸汽进入冷凝管";
    }
    dom.distill.warning.innerHTML = '<span class="warning-mark">!</span><p><b>' + warningTitle + '</b>' + warningCopy + '</p>';
    if (dom.distill.note && !dom.distill.note.innerHTML) {
      dom.distill.note.innerHTML = "<span>" + material.oil + "</span><p>" + material.note + "</p>";
    }
  }

  function distillationLoop(now) {
    var delta = state.distill.lastTime ? Math.min(60, now - state.distill.lastTime) : 16;
    state.distill.lastTime = now;
    if (state.visible.distillation !== false && state.distill.running) {
      var m = distillMetrics();
      var gain = m.heat * m.condense * .14 * delta / 1000;
      state.distill.oil = clamp(state.distill.oil + gain, 0, 100);
      if (m.danger) {
        state.distill.oil = clamp(state.distill.oil - .05 * delta / 1000, 0, 100);
        state.distill.lost += .025 * delta / 1000;
      }
      updateDistillationParticles(delta, m);
      drawDistillation(now, m);
      if (now - state.distill.lastUi > 180) {
        updateDistillReadouts();
        state.distill.lastUi = now;
      }
    }
    window.requestAnimationFrame(distillationLoop);
  }

  function updateDistillationParticles(delta, metrics) {
    var d = state.distill;
    if (Math.random() < .2 + metrics.heat * .6 && d.bubbles.length < 75) {
      d.bubbles.push({
        x: 250 + Math.random() * 130,
        y: 470 + Math.random() * 50,
        r: 1.5 + Math.random() * 5.5,
        vy: -12 - Math.random() * 55,
        life: 1
      });
    }
    d.bubbles.forEach(function (b) {
      b.y += b.vy * delta / 1000;
      b.x += Math.sin(b.y / 22) * .28;
      b.life -= delta / 3000;
    });
    d.bubbles = d.bubbles.filter(function (b) { return b.life > 0 && b.y > 300; });
    if (Math.random() < .25 + metrics.heat * .5 && d.particles.length < 95) {
      d.particles.push({
        t: 0,
        speed: .075 + metrics.heat * .13,
        size: 1.4 + Math.random() * 2.2,
        offset: Math.random() * 10,
        life: 1
      });
    }
    d.particles.forEach(function (p) {
      p.t += p.speed * delta / 1000;
      p.life -= delta / 6000;
    });
    d.particles = d.particles.filter(function (p) { return p.t < .995 && p.life > 0; });
  }

  function apparatusPoint(t) {
    // Vapour path: flask neck -> vertical tube -> horizontal tube -> condenser.
    if (t < .12) return { x: 318, y: 330 - t / .12 * 110 };
    if (t < .38) return { x: 318 + (t - .12) / .26 * 278, y: 220 };
    if (t < .72) {
      var k = (t - .38) / .34;
      return { x: 596 + k * 180, y: 220 + k * 250 };
    }
    var q = (t - .72) / .28;
    return { x: 776 + Math.sin(q * Math.PI) * 7, y: 470 + q * 166 };
  }

  function drawDistillation(now, metrics) {
    var canvas = dom.distill.canvas;
    if (!canvas) return;
    var c = canvasContext(canvas);
    var ctx = c.ctx, w = c.w, h = c.h;
    if (!w || !h) return;
    var sx = w / 1060, sy = h / 760;
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.scale(sx, sy);

    // Faint technical grid.
    ctx.strokeStyle = "rgba(214,197,174,.035)";
    ctx.lineWidth = .7;
    for (var gx = 80; gx < 1060; gx += 80) {
      ctx.beginPath(); ctx.moveTo(gx, 76); ctx.lineTo(gx, 700); ctx.stroke();
    }
    for (var gy = 80; gy < 760; gy += 80) {
      ctx.beginPath(); ctx.moveTo(40, gy); ctx.lineTo(1020, gy); ctx.stroke();
    }

    // Floor line.
    var floorGrad = ctx.createLinearGradient(0, 650, 0, 760);
    floorGrad.addColorStop(0, "rgba(0,0,0,0)");
    floorGrad.addColorStop(.55, "rgba(148,109,55,.13)");
    floorGrad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, 650, 1060, 110);

    // Warm halo behind the flask.
    var halo = ctx.createRadialGradient(300, 490, 20, 300, 490, 260);
    halo.addColorStop(0, "rgba(193,135,63,.18)");
    halo.addColorStop(.55, "rgba(128,82,40,.07)");
    halo.addColorStop(1, "rgba(128,82,40,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(50, 260, 520, 440);

    // Heating mantle.
    ctx.save();
    var mantle = ctx.createLinearGradient(0, 575, 0, 660);
    mantle.addColorStop(0, "#6e4b2c");
    mantle.addColorStop(.32, "#3c2717");
    mantle.addColorStop(1, "#1b110a");
    ctx.fillStyle = mantle;
    ctx.beginPath();
    ctx.moveTo(195, 572);
    ctx.lineTo(390, 572);
    ctx.lineTo(364, 660);
    ctx.lineTo(220, 660);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(218,170,94,.3)";
    ctx.lineWidth = 1.3;
    ctx.stroke();
    ctx.strokeStyle = metrics.heat > .25 ? "rgba(210,93,64," + (.35 + metrics.heat * .45) + ")" : "rgba(214,197,174,.16)";
    ctx.lineWidth = 2.2;
    for (var coil = 0; coil < 5; coil++) {
      ctx.beginPath();
      ctx.arc(292, 588, 36 + coil * 8, Math.PI * .12, Math.PI * .88);
      ctx.stroke();
    }
    ctx.restore();

    // Flask body.
    ctx.save();
    ctx.beginPath();
    ctx.arc(295, 475, 126, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(178,185,165,.035)";
    ctx.fill();
    ctx.strokeStyle = "rgba(195,199,180,.45)";
    ctx.lineWidth = 2.2;
    ctx.stroke();
    // Neck.
    ctx.beginPath();
    ctx.moveTo(258, 405);
    ctx.lineTo(258, 340);
    ctx.lineTo(276, 330);
    ctx.lineTo(276, 326);
    ctx.lineTo(318, 326);
    ctx.lineTo(318, 340);
    ctx.lineTo(334, 405);
    ctx.stroke();
    // Liquid in flask.
    ctx.beginPath();
    ctx.arc(295, 475, 123, 0, Math.PI * 2);
    ctx.clip();
    var liquid = ctx.createLinearGradient(0, 465, 0, 600);
    liquid.addColorStop(0, colorAlpha(DATA.distillation.materials.find(function (m) { return m.id === state.distill.material; }).accent, .45));
    liquid.addColorStop(1, "rgba(74,43,24,.88)");
    ctx.fillStyle = liquid;
    ctx.beginPath();
    ctx.ellipse(295, 517, 122, 23, 0, 0, Math.PI);
    ctx.lineTo(173, 475);
    ctx.lineTo(417, 475);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(235,207,157,.1)";
    ctx.beginPath();
    ctx.ellipse(295, 506, 112, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    // Bubbles.
    state.distill.bubbles.forEach(function (b) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(238,221,190," + (.2 + b.life * .45) + ")";
      ctx.lineWidth = 1;
      ctx.stroke();
    });
    // Glass highlight.
    ctx.strokeStyle = "rgba(245,235,210,.22)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(295, 475, 109, Math.PI * 1.06, Math.PI * 1.37);
    ctx.stroke();
    ctx.restore();

    // Rubber stopper.
    ctx.fillStyle = "#3d2b1c";
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(268, 323, 59, 22, 3) : ctx.rect(268, 323, 59, 22);
    ctx.fill();
    ctx.fillStyle = "rgba(211,167,93,.16)";
    ctx.fillRect(273, 327, 48, 2);

    // Vapour line.
    ctx.save();
    ctx.strokeStyle = "rgba(200,204,186,.34)";
    ctx.lineWidth = 10;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(297, 324);
    ctx.lineTo(318, 220);
    ctx.lineTo(596, 220);
    ctx.lineTo(776, 470);
    ctx.stroke();
    ctx.strokeStyle = "rgba(17,14,10,.86)";
    ctx.lineWidth = 6.5;
    ctx.stroke();
    ctx.restore();

    // Condenser jacket and spiral.
    ctx.save();
    ctx.translate(688, 346);
    ctx.rotate(-.49);
    ctx.strokeStyle = "rgba(195,201,184,.22)";
    ctx.lineWidth = 7;
    ctx.strokeRect(-138, -32, 276, 64);
    var coolColor = mixColor("#b27942", "#93aaa0", clamp(state.distill.flow / 2.5, 0, 1));
    for (var s = 0; s < 8; s++) {
      ctx.beginPath();
      ctx.strokeStyle = "rgba(158,180,161," + (.16 + state.distill.flow / 2.5 * .35) + ")";
      ctx.lineWidth = 3;
      ctx.arc(-118 + s * 32, 0, 20, Math.PI * .15, Math.PI * .85);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(214,197,174,.32)";
    ctx.lineWidth = 1;
    ctx.strokeRect(-140, -35, 280, 70);
    ctx.fillStyle = coolColor;
    ctx.font = '11px "Noto Serif SC",SimSun,serif';
    ctx.textAlign = "center";
    ctx.fillText("冷 凝 管", 0, 52);
    ctx.restore();

    // Cooling water in/out tubes.
    ctx.save();
    ctx.strokeStyle = "rgba(148,170,156,.38)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(576, 306);
    ctx.bezierCurveTo(530, 345, 540, 385, 500, 408);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(784, 370);
    ctx.bezierCurveTo(850, 340, 870, 300, 915, 286);
    ctx.stroke();
    ctx.fillStyle = "rgba(214,197,174,.34)";
    ctx.font = '10px "Noto Serif SC",SimSun,serif';
    ctx.fillText("冷却水进", 492, 429);
    ctx.fillText("冷却水出", 870, 276);
    ctx.restore();

    // Vapour particles.
    state.distill.particles.forEach(function (p) {
      var pt = apparatusPoint(p.t);
      ctx.beginPath();
      ctx.arc(pt.x + p.offset, pt.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(239,224,193," + (.16 + p.life * .42) + ")";
      ctx.fill();
    });

    // Condensate drops.
    for (var drop = 0; drop < 4; drop++) {
      var phase = (now / 900 + drop * .25) % 1;
      var dx = 790 + Math.sin((now / 500) + drop) * 4;
      var dy = 496 + phase * 115;
      ctx.beginPath();
      ctx.ellipse(dx, dy, 2, 5, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(225,208,168," + (1 - phase) * .5 + ")";
      ctx.fill();
    }

    // Separator.
    ctx.save();
    var flaskX = 800, flaskY = 650;
    ctx.beginPath();
    ctx.moveTo(781, 496);
    ctx.lineTo(819, 496);
    ctx.lineTo(819, 565);
    ctx.bezierCurveTo(857, 575, 874, 606, 862, 646);
    ctx.bezierCurveTo(847, 695, 753, 695, 738, 646);
    ctx.bezierCurveTo(726, 606, 743, 575, 781, 565);
    ctx.closePath();
    ctx.fillStyle = "rgba(174,180,162,.035)";
    ctx.fill();
    ctx.strokeStyle = "rgba(197,201,184,.42)";
    ctx.lineWidth = 2;
    ctx.stroke();
    // water layer
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(744, 609);
    ctx.bezierCurveTo(757, 682, 847, 682, 858, 609);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = "rgba(122,82,43,.48)";
    ctx.fillRect(730, 600, 150, 100);
    ctx.restore();
    // oil layer
    var oilHeight = state.distill.oil / 100 * 38;
    if (oilHeight > .6) {
      var oy = 614 - oilHeight;
      var oilGrad = ctx.createLinearGradient(0, oy, 0, oy + oilHeight);
      var mat = DATA.distillation.materials.find(function (m) { return m.id === state.distill.material; });
      oilGrad.addColorStop(0, "rgba(245,220,149,.7)");
      oilGrad.addColorStop(.45, colorAlpha(mat.accent, .7));
      oilGrad.addColorStop(1, "rgba(163,122,56,.6)");
      ctx.fillStyle = oilGrad;
      ctx.beginPath();
      ctx.ellipse(800, oy, 51, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(749, oy, 102, oilHeight);
      ctx.beginPath();
      ctx.ellipse(800, oy + oilHeight, 51, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      // meniscus
      ctx.strokeStyle = "rgba(249,227,173,.55)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(800, oy, 51, 7, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(214,197,174,.45)";
    ctx.font = '10px "Noto Serif SC",SimSun,serif';
    ctx.textAlign = "center";
    ctx.fillText("油水分离器", 800, 723);
    ctx.fillStyle = "rgba(214,197,174,.22)";
    ctx.font = '8px "Noto Serif SC",SimSun,serif';
    ctx.fillText("OIL / WATER", 800, 738);
    ctx.restore();

    // Labels.
    ctx.fillStyle = "rgba(214,197,174,.32)";
    ctx.font = '10px "Noto Serif SC",SimSun,serif';
    ctx.textAlign = "center";
    ctx.fillText("圆底烧瓶", 295, 625);
    ctx.fillText("加热介质", 295, 685);
    ctx.fillText("蒸汽出口", 394, 212);
    ctx.fillStyle = "rgba(212,175,55,.46)";
    ctx.font = '9px "Noto Serif SC",SimSun,serif';
    ctx.fillText("TEACHING SIMULATION / 02", 108, 112);

    // Danger ring and escaping steam.
    if (metrics.danger) {
      ctx.save();
      var pulse = .5 + .5 * Math.sin(now / 240);
      ctx.strokeStyle = "rgba(184,74,54," + (.22 + pulse * .32) + ")";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(295, 475, 155 + pulse * 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "rgba(206,107,85,.14)";
      for (var j = 0; j < 5; j++) {
        var ang = now / 950 + j * 1.2;
        ctx.beginPath();
        ctx.arc(400 + Math.cos(ang) * 55, 360 + Math.sin(ang) * 42, 18 + j * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  /* ----------------------------------------------------------------------
     Chapter 04 · time wheel, circadian note and tea simulator
     ---------------------------------------------------------------------- */
  var teaPhotoMap = {
    maidong: "assets/images/tea/maidong.jpg",
    gouqi: "assets/images/tea/gouqi.jpg",
    chenpi: "assets/images/tea/chenpi.jpg",
    shengjiang: "assets/images/tea/shengjiang.jpg",
    hongzao: "assets/images/tea/hongzao.jpg",
    "bohe-tea": "assets/images/tea/bohe.jpg",
    baihe: "assets/images/tea/baihe.jpg",
    shanzha: "assets/images/tea/shanzha.jpg",
    "fuling-tea": "assets/images/tea/fuling.jpg",
    juhua: "assets/images/tea/juhua.jpg"
  };

  function initRhythm() {
    dom.verse.tabs.innerHTML = DATA.verses.map(function (verse, index) {
      return '<button type="button" role="tab" data-verse="' + index + '" aria-selected="' + (index === 0 ? "true" : "false") + '">' + chineseNumber(index + 1) + '</button>';
    }).join("");
    dom.verse.tabs.addEventListener("click", function (event) {
      var b = event.target.closest("[data-verse]");
      if (b) setVerse(Number(b.getAttribute("data-verse")));
    });
    setVerse(0);

    dom.rhythm.dial.insertAdjacentHTML("beforeend", DATA.shichen.map(function (s, index) {
      return '<button type="button" class="dial-node" data-shichen="' + index + '" style="--angle:' + s.angle + 'deg" aria-label="' + s.name + '时 ' + s.time + '">' + s.name + '</button>';
    }).join(""));
    dom.rhythm.dial.addEventListener("click", function (event) {
      var node = event.target.closest("[data-shichen]");
      if (node) setShichen(Number(node.getAttribute("data-shichen")));
    });
    bindDialDrag();

    dom.rhythm.states.innerHTML = DATA.states.map(function (stateItem, index) {
      return '<button type="button" data-state="' + stateItem.id + '" class="' + (index === 0 ? "is-active" : "") + '">' + stateItem.name + '</button>';
    }).join("");
    dom.rhythm.states.addEventListener("click", function (event) {
      var b = event.target.closest("[data-state]");
      if (!b) return;
      state.rhythmState = b.getAttribute("data-state");
      $$("[data-state]", dom.rhythm.states).forEach(function (button) { button.classList.toggle("is-active", button === b); });
      updateTea();
    });
    if (dom.rhythm.jump) {
      dom.rhythm.jump.addEventListener("click", function () {
        var scene = deckState.scenes[deckState.index];
        var studio = $("#teaStudio");
        if (!scene || !studio) return;
        var top = studio.getBoundingClientRect().top - scene.getBoundingClientRect().top + scene.scrollTop - 88;
        if (scene.scrollTo) scene.scrollTo({ top: top, behavior: reducedMotion ? "auto" : "smooth" });
        else scene.scrollTop = top;
      });
    }

    dom.rhythm.tray.innerHTML = DATA.teaHerbs.map(function (herb) {
      var photo = teaPhotoMap[herb.id];
      return '<button type="button" class="tea-herb" data-tea="' + herb.id + '" aria-pressed="false">' +
        '<span class="tea-herb-photo"><img src="' + photo + '" alt="' + escapeHtml(herb.name) + '药材影像"></span>' +
        '<span class="tea-herb-copy"><b>' + escapeHtml(herb.name) + '</b><small>' + escapeHtml(herb.nature) + ' · ' + escapeHtml(herb.part) + '</small></span>' +
      '</button>';
    }).join("");
    dom.rhythm.tray.addEventListener("click", function (event) {
      var button = event.target.closest("[data-tea]");
      if (!button) return;
      var id = button.getAttribute("data-tea");
      var existing = state.tea.indexOf(id);
      if (existing >= 0) state.tea.splice(existing, 1);
      else if (state.tea.length >= 3) {
        showToast("一盏茶最多三味。先取出一味，再放入新的草本。");
        return;
      } else state.tea.push(id);
      updateTea();
    });
    dom.rhythm.brew.addEventListener("click", function () {
      if (state.tea.length !== 3) {
        showToast("先从托盘中选择三味草本。");
        return;
      }
      var result = calculateTea();
      var liquid = dom.rhythm.liquid;
      if (liquid && liquid.animate && !reducedMotion) {
        liquid.animate([
          { opacity: .2, transform: "translateY(8px)" },
          { opacity: .82, transform: "translateY(0)" }
        ], { duration: 900, easing: "cubic-bezier(.22,1,.36,1)" });
      }
      showToast("冲泡完成 · 建议 " + result.temp + "℃ · " + result.label + "配伍");
    });
    setShichen(3);
    updateTea();
  }

  function bindDialDrag() {
    var dragging = false, rect;
    function angleFor(clientX, clientY) {
      rect = dom.rhythm.dial.getBoundingClientRect();
      var cx = rect.left + rect.width / 2;
      var cy = rect.top + rect.height / 2;
      var deg = Math.atan2(clientY - cy, clientX - cx) * 180 / Math.PI + 90;
      if (deg < 0) deg += 360;
      return deg;
    }
    dom.rhythm.dial.addEventListener("pointerdown", function (event) {
      if (event.target.closest("button")) return;
      dragging = true;
      try { dom.rhythm.dial.setPointerCapture(event.pointerId); } catch (err) { /* noop */ }
      setDialByAngle(angleFor(event.clientX, event.clientY));
    });
    dom.rhythm.dial.addEventListener("pointermove", function (event) {
      if (!dragging) return;
      setDialByAngle(angleFor(event.clientX, event.clientY));
    });
    function end() { dragging = false; }
    dom.rhythm.dial.addEventListener("pointerup", end);
    dom.rhythm.dial.addEventListener("pointercancel", end);
  }

  function setDialByAngle(deg) {
    var idx = Math.round(deg / 30) % 12;
    if (idx !== state.shichen) setShichen(idx);
  }

  function setVerse(index) {
    state.verse = clamp(index, 0, DATA.verses.length - 1);
    var verse = DATA.verses[state.verse];
    dom.verse.title.textContent = verse.title;
    dom.verse.lines.innerHTML = verse.lines.map(function (line) { return "<span>" + escapeHtml(line) + "</span>"; }).join("");
    dom.verse.tag.textContent = verse.tag;
    dom.verse.explain.textContent = verse.explain;
    dom.verse.note.textContent = verse.note;
    $$("[data-verse]", dom.verse.tabs).forEach(function (button, i) {
      button.classList.toggle("is-active", i === state.verse);
      button.setAttribute("aria-selected", i === state.verse ? "true" : "false");
    });
  }

  function setShichen(index) {
    state.shichen = ((index % 12) + 12) % 12;
    var item = DATA.shichen[state.shichen];
    $$(".dial-node", dom.rhythm.dial).forEach(function (node, i) {
      node.classList.toggle("is-active", i === state.shichen);
    });
    dom.rhythm.hand.style.transform = "translate(-50%, -100%) rotate(" + item.angle + "deg)";
    dom.rhythm.shichen.textContent = item.name;
    dom.rhythm.time.textContent = item.time;
    dom.rhythm.text.textContent = item.modern;
    if (dom.rhythm.disclaimer && !dom.rhythm.disclaimer.textContent.trim()) dom.rhythm.disclaimer.textContent = DATA.rhythmNote;
  }

  function selectedTeaHerbs() {
    return state.tea.map(function (id) {
      return DATA.teaHerbs.find(function (h) { return h.id === id; });
    }).filter(Boolean);
  }

  function calculateTea() {
    var herbs = selectedTeaHerbs();
    if (!herbs.length) return { temp: "—", label: "等待选择", score: 0, balance: 0, copy: "选择三味草本，查看寒热平衡。" };
    var sum = herbs.reduce(function (acc, h) { return acc + h.score; }, 0);
    var mean = sum / herbs.length;
    var preferred = DATA.states.find(function (s) { return s.id === state.rhythmState; }).preference;
    var duplicateFlavor = 0;
    var flavors = {};
    herbs.forEach(function (h) {
      flavors[h.flavor] = (flavors[h.flavor] || 0) + 1;
      if (flavors[h.flavor] > 1) duplicateFlavor += 1;
    });
    var thermalBalance = 100 - Math.abs(sum) / 3 * 21;
    var stateFit = 100 - Math.abs(mean - preferred) * 24;
    var score = clamp(Math.round(thermalBalance * .64 + stateFit * .36 - duplicateFlavor * 2), 38, 99);
    var volatile = herbs.filter(function (h) { return h.part === "叶" || h.part === "花"; }).length;
    var dense = herbs.filter(function (h) { return h.part === "根" || h.part === "根茎" || h.part === "菌核" || h.part === "鳞茎" || h.part === "果"; }).length;
    var temp = volatile > dense ? "85℃" : dense > volatile ? "100℃" : "90℃";
    var label = sum <= -2 ? "清润偏凉" : sum >= 2 ? "温润偏暖" : "寒温平和";
    var copy = "三味合计寒温值 " + (sum > 0 ? "+" + sum : sum) + "，" + (sum === 0 ? "位置居中。" : sum < 0 ? "整体偏凉。" : "整体偏温。") + "与“" + DATA.states.find(function (s) { return s.id === state.rhythmState; }).name + "”的偏好" + (score >= 78 ? "较为贴合。" : "存在一定偏移。");
    var extract;
    if (volatile > dense) {
      extract = "85℃ · 花叶类为主。降低水温可减少薄荷醇、菊花挥发油等香气成分的损失，加盖闷泡 5 分钟即可。";
    } else if (dense > volatile) {
      extract = "100℃ · 根、果、菌核类为主。较高温度有助于多糖、皂苷等成分的水合与浸出；沸腾后转小火，避免长时间滚煮。";
    } else {
      extract = "90℃ · 花叶与根果并用。先以较高水温浸润根果，再放入花叶，减少香气损失；总浸泡时间约 6—8 分钟。";
    }
    var warning = "";
    if (state.rhythmState === "dry" && sum <= -2) warning = "组合偏凉，请结合自身体感与饮用量，不必追求“越凉越好”。";
    if (state.rhythmState === "morning" && sum <= -1) warning = "晨起空腹饮用偏凉组合，可先进食或减少用量。";
    return { temp: temp, label: label, score: score, balance: sum, copy: copy, extract: extract, warning: warning };
  }

  function updateTea() {
    var herbs = selectedTeaHerbs();
    $$("[data-tea]", dom.rhythm.tray).forEach(function (button) {
      var selected = state.tea.indexOf(button.getAttribute("data-tea")) >= 0;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", selected ? "true" : "false");
    });
    var teaRoles = ["主味", "辅味", "佐味"];
    dom.rhythm.slots.innerHTML = [0, 1, 2].map(function (index) {
      var herb = herbs[index];
      return herb
        ? '<span class="tea-slot is-filled"><small>' + teaRoles[index] + '</small><img src="' + teaPhotoMap[herb.id] + '" alt=""><b>' + escapeHtml(herb.name) + '</b></span>'
        : '<span class="tea-slot is-empty"><small>' + teaRoles[index] + '</small><i>待取</i></span>';
    }).join("");
    var result = calculateTea();
    var sum = result.balance || 0;
    dom.rhythm.balanceBeam.style.transform = "rotate(" + clamp(sum * 4.2, -11, 11) + "deg)";
    dom.rhythm.balanceCold.textContent = sum < 0 ? String(Math.abs(sum)) : "0";
    dom.rhythm.balanceWarm.textContent = sum > 0 ? String(sum) : "0";
    dom.rhythm.balanceScore.textContent = herbs.length === 3 ? result.score : "—";
    dom.rhythm.temp.textContent = herbs.length === 3 ? result.temp : "—";
    dom.rhythm.copy.textContent = result.copy;
    dom.rhythm.extract.textContent = herbs.length === 3 ? result.extract : "浸出动力学解释将在选择三味后出现。";
    dom.rhythm.warning.textContent = result.warning || "";
    if (dom.rhythm.liquid) {
      var liquidColor = herbs.length ? herbs[0].nature === "温" ? "#8a4e28" : "#a36b3e" : "#a36b3e";
      dom.rhythm.liquid.style.fill = liquidColor;
      dom.rhythm.liquid.style.opacity = herbs.length ? ".82" : ".42";
    }
  }

  /* ----------------------------------------------------------------------
     Chapter 05 · dosage form handscroll
     ---------------------------------------------------------------------- */
  function initForms() {
    dom.forms.track.innerHTML = DATA.forms.map(function (form, index) {
      return '<article class="form-panel" data-form="' + index + '" tabindex="0" role="button" aria-label="查看' + escapeHtml(form.name) + '释放曲线">' +
        '<div class="form-panel-head"><span class="form-panel-no">' + String(index + 1).padStart(2, "0") + ' / 04</span>' + svgIcon(form.icon, "form-panel-icon") + '</div>' +
        '<h3>' + escapeHtml(form.name) + '</h3>' +
        '<p class="form-sub">' + escapeHtml(form.sub) + '</p>' +
        '<p class="form-motto-big">' + escapeHtml(form.motto) + '</p>' +
        '<p class="form-panel-desc">' + escapeHtml(form.desc) + '</p>' +
        '<svg class="form-curve-mini" aria-hidden="true"></svg>' +
      '</article>';
    }).join("");
    $$(".form-panel", dom.forms.track).forEach(function (panel) {
      var idx = Number(panel.getAttribute("data-form"));
      drawCurveMini($(".form-curve-mini", panel), DATA.forms[idx].curve);
      panel.addEventListener("click", function () { selectForm(idx); });
      panel.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectForm(idx); }
      });
    });
    dom.forms.prev.addEventListener("click", function () {
      selectForm(state.form - 1);
      dom.forms.track.scrollBy({ left: -dom.forms.track.clientWidth * .3, behavior: "smooth" });
    });
    dom.forms.next.addEventListener("click", function () {
      selectForm(state.form + 1);
      dom.forms.track.scrollBy({ left: dom.forms.track.clientWidth * .3, behavior: "smooth" });
    });
    bindHorizontalDrag(dom.forms.track);
    selectForm(0, true);
  }

  function drawCurveMini(svg, values) {
    if (!svg) return;
    if (window.TCMFallback) { window.TCMFallback.curveMini(svg, values); return; }
    var pts = values.map(function (v, i) {
      return [(i / (values.length - 1)) * 111 + 2, 61 - v / 100 * 56];
    });
    var d = "M" + pts.map(function (p) { return p[0].toFixed(1) + "," + p[1].toFixed(1); }).join(" L");
    svg.setAttribute("viewBox", "0 0 115 65");
    svg.innerHTML = '<path d="' + d + '" fill="none" stroke="currentColor" stroke-width="1.1"></path>';
  }

  function selectForm(index, initial) {
    state.form = ((index % DATA.forms.length) + DATA.forms.length) % DATA.forms.length;
    var form = DATA.forms[state.form];
    $$(".form-panel", dom.forms.track).forEach(function (panel, i) {
      panel.classList.toggle("is-active", i === state.form);
      panel.setAttribute("aria-pressed", i === state.form ? "true" : "false");
    });
    dom.forms.index.textContent = String(state.form + 1).padStart(2, "0") + " / 04";
    dom.forms.name.textContent = form.name;
    dom.forms.motto.textContent = form.motto;
    dom.forms.description.textContent = form.desc;
    dom.forms.disintegration.textContent = form.disintegration;
    dom.forms.peak.textContent = form.peak;
    dom.forms.detail.textContent = form.detail;
    dom.forms.quote.textContent = form.motto;
    updateDoseChart();
    if (!initial && !reducedMotion) {
      var panel = $$(".form-panel", dom.forms.track)[state.form];
      if (panel) panel.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }

  function bindHorizontalDrag(el) {
    var startX = 0, startScroll = 0, pointer = null;
    el.addEventListener("pointerdown", function (event) {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      pointer = event.pointerId;
      startX = event.clientX;
      startScroll = el.scrollLeft;
      el.classList.add("is-dragging");
    });
    el.addEventListener("pointermove", function (event) {
      if (pointer == null) return;
      var dx = event.clientX - startX;
      if (Math.abs(dx) > 6) el.scrollLeft = startScroll - dx;
    });
    function end() {
      pointer = null;
      el.classList.remove("is-dragging");
    }
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
    el.addEventListener("pointerleave", function () { if (pointer != null) end(); });
  }

  /* ----------------------------------------------------------------------
     Chapter 06 · quiz and certificate
     ---------------------------------------------------------------------- */
  function drawCertificateTeaser() {
    var canvas = dom.quiz.canvas;
    if (!canvas) return;
    var ctx = canvas.getContext("2d");
    var W = 1200, H = 800;
    canvas.width = W; canvas.height = H;
    var bg = ctx.createRadialGradient(560, 340, 30, 600, 400, 760);
    bg.addColorStop(0, "#241a0f");
    bg.addColorStop(.52, "#11100b");
    bg.addColorStop(1, "#070604");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(212,175,55,.32)";
    ctx.lineWidth = 1;
    ctx.strokeRect(32, 31, W - 64, H - 62);
    ctx.strokeStyle = "rgba(212,175,55,.12)";
    ctx.strokeRect(44, 43, W - 88, H - 86);
    drawCertificateCorner(ctx, 48, 48, 1, 1);
    drawCertificateCorner(ctx, W - 48, 48, -1, 1);
    drawCertificateCorner(ctx, 48, H - 48, 1, -1);
    drawCertificateCorner(ctx, W - 48, H - 48, -1, -1);
    ctx.save();
    ctx.globalAlpha = .22;
    ctx.fillStyle = "#d6c5ae";
    ctx.textAlign = "center";
    ctx.font = '600 66px "Noto Serif SC",SimSun,serif';
    ctx.fillText("杏 林 格 物", W / 2, 300);
    ctx.fillStyle = "rgba(212,175,55,.8)";
    ctx.font = '18px "Noto Serif SC",SimSun,serif';
    ctx.fillText("通 关 文 牒", W / 2, 345);
    ctx.strokeStyle = "rgba(212,175,55,.5)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(410, 382); ctx.lineTo(790, 382); ctx.stroke();
    ctx.globalAlpha = .13;
    ctx.fillStyle = "#d6c5ae";
    ctx.font = '400 360px "Noto Serif SC",SimSun,serif';
    ctx.fillText("格", 870, 540);
    ctx.restore();
    ctx.strokeStyle = "rgba(169,67,52,.52)";
    ctx.lineWidth = 2;
    ctx.strokeRect(514, 482, 172, 68);
    ctx.fillStyle = "rgba(169,67,52,.56)";
    ctx.font = '22px "Noto Serif SC",SimSun,serif';
    ctx.textAlign = "center";
    ctx.fillText("待 印", 600, 526);
    ctx.fillStyle = "rgba(214,197,174,.22)";
    ctx.font = '12px "Noto Serif SC",SimSun,serif';
    ctx.fillText("完成六道情景题，依据你的实验记录与准确率落款。", 600, 582);
  }

  function initQuiz() {
    dom.quiz.progress.innerHTML = DATA.quiz.map(function () { return "<span></span>"; }).join("");
    drawCertificateTeaser();
    renderQuestion();
    dom.quiz.next.addEventListener("click", function () {
      if (state.quizIndex < DATA.quiz.length - 1) {
        state.quizIndex += 1;
        renderQuestion();
      } else {
        finishQuiz();
      }
    });
    dom.quiz.generate.addEventListener("click", function () {
      generateCertificate();
    });
    dom.quiz.download.addEventListener("click", downloadCertificate);
  }

  function renderQuestion() {
    var q = DATA.quiz[state.quizIndex];
    state.selectedAnswer = null;
    dom.quiz.top.textContent = "第" + chineseNumber(state.quizIndex + 1) + "题 / 共六题";
    dom.quiz.progressText.textContent = String(state.quizIndex + 1).padStart(2, "0") + " / 06";
    dom.quiz.card.setAttribute("data-q", String(state.quizIndex + 1).padStart(2, "0"));
    if (dom.quiz.orbit) dom.quiz.orbit.style.setProperty("--progress", ((state.quizIndex + 1) / DATA.quiz.length * 100).toFixed(2) + "%");
    if (dom.quiz.orbitNum) dom.quiz.orbitNum.textContent = String(state.quizIndex + 1).padStart(2, "0");
    var quizShell = $(".trial-shell");
    if (quizShell) quizShell.classList.add("is-quiz-active");
    dom.quiz.tag.textContent = q.tag;
    dom.quiz.scene.textContent = q.scene;
    dom.quiz.question.textContent = q.q;
    dom.quiz.options.innerHTML = q.options.map(function (option, index) {
      return '<button class="quiz-option" type="button" data-option="' + index + '"><span>' + String.fromCharCode(65 + index) + '</span><strong>' + escapeHtml(option) + '</strong></button>';
    }).join("");
    dom.quiz.feedback.hidden = true;
    dom.quiz.next.disabled = true;
    dom.quiz.next.innerHTML = (state.quizIndex === DATA.quiz.length - 1 ? "查看结果" : "下一题") + " " + svgIcon("arrow");
    $$(".quiz-option", dom.quiz.options).forEach(function (button) {
      button.addEventListener("click", function () { answerQuestion(Number(button.getAttribute("data-option"))); });
    });
    $$("span", dom.quiz.progress).forEach(function (span, index) {
      span.classList.toggle("is-done", index < state.quizIndex);
      span.classList.toggle("is-current", index === state.quizIndex);
    });
  }

  function answerQuestion(choice) {
    if (state.selectedAnswer != null) return;
    var q = DATA.quiz[state.quizIndex];
    state.selectedAnswer = choice;
    state.answers[state.quizIndex] = choice;
    $$(".quiz-option", dom.quiz.options).forEach(function (button, index) {
      button.disabled = true;
      if (index === q.answer) button.classList.add("is-correct");
      if (index === choice && choice !== q.answer) button.classList.add("is-wrong");
    });
    dom.quiz.feedback.hidden = false;
    dom.quiz.feedbackTitle.textContent = choice === q.answer ? "答对了 · 继续格物" : "再想一步 · 正确答案已标出";
    dom.quiz.feedbackText.textContent = q.explain;
    dom.quiz.next.disabled = false;
  }

  function finishQuiz() {
    state.quizDone = true;
    var correct = state.answers.reduce(function (acc, answer, i) {
      return acc + (answer === DATA.quiz[i].answer ? 1 : 0);
    }, 0);
    var accuracy = Math.round(correct / DATA.quiz.length * 100);
    var alias = DATA.aliases.find(function (a) { return correct >= a.min; }) || DATA.aliases[DATA.aliases.length - 1];
    state.accuracy = accuracy;
    state.alias = alias;
    dom.quiz.card.hidden = true;
    dom.quiz.result.hidden = false;
    var quizShellDone = $(".trial-shell");
    if (quizShellDone) quizShellDone.classList.remove("is-quiz-active");
    dom.quiz.resultText.textContent = "你在六道情景题中答对 " + correct + " 道。你的本草雅号为“" + alias.name + "”。" + alias.line;
    dom.quiz.accuracy.textContent = accuracy;
    dom.quiz.alias.textContent = alias.name;
    dom.quiz.progressText.textContent = "06 / 06";
    if (dom.quiz.orbit) dom.quiz.orbit.style.setProperty("--progress", "100%");
    if (dom.quiz.orbitNum) dom.quiz.orbitNum.textContent = "06";
    $$("span", dom.quiz.progress).forEach(function (span) { span.classList.add("is-done"); span.classList.remove("is-current"); });
    dom.quiz.top.textContent = "试炼完成 / 共六题";
    showToast("试炼完成 · 可生成通关文牒");
  }

  function roundedRect(ctx, x, y, w, h, r) {
    var radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  function generateCertificate() {
    if (!state.quizDone) {
      showToast("先完成六道题，再合成通关文牒。");
      return Promise.resolve(null);
    }
    var canvas = dom.quiz.canvas;
    var ctx = canvas.getContext("2d");
    var W = 1200, H = 800;
    canvas.width = W; canvas.height = H;
    var accuracy = state.accuracy || 0;
    var alias = state.alias || DATA.aliases[DATA.aliases.length - 1];
    var procStage = state.proc.stage;
    var oil = nf(state.distill.oil, 1);
    var teaBalance = calculateTea().score;
    var rng = seededRandom(20261109);
    function draw() {
      ctx.clearRect(0, 0, W, H);
      var bg = ctx.createRadialGradient(530, 360, 40, 570, 400, 720);
      bg.addColorStop(0, "#21180e");
      bg.addColorStop(.5, "#11100b");
      bg.addColorStop(1, "#070604");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Subtle paper grain.
      for (var i = 0; i < 380; i++) {
        ctx.fillStyle = "rgba(214,197,174," + (rng() * .022) + ")";
        ctx.fillRect(rng() * W, rng() * H, rng() * 3 + .4, .5);
      }
      // Faint arch and large ghost glyph.
      ctx.save();
      ctx.strokeStyle = "rgba(212,175,55,.11)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(600, 780, 460, Math.PI * 1.05, Math.PI * 1.95);
      ctx.stroke();
      ctx.globalAlpha = .04;
      ctx.fillStyle = "#d6c5ae";
      ctx.font = '400 440px "Noto Serif SC",SimSun,serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("格", 895, 300);
      ctx.restore();

      // Double gold frame.
      ctx.strokeStyle = "rgba(212,175,55,.62)";
      ctx.lineWidth = 1.2;
      ctx.strokeRect(32, 31, W - 64, H - 62);
      ctx.strokeStyle = "rgba(212,175,55,.22)";
      ctx.lineWidth = .7;
      ctx.strokeRect(44, 43, W - 88, H - 86);
      // Corner ornaments.
      drawCertificateCorner(ctx, 48, 48, 1, 1);
      drawCertificateCorner(ctx, W - 48, 48, -1, 1);
      drawCertificateCorner(ctx, 48, H - 48, 1, -1);
      drawCertificateCorner(ctx, W - 48, H - 48, -1, -1);

      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = "rgba(214,197,174,.45)";
      ctx.font = '12px "Noto Serif SC",SimSun,serif';
      ctx.fillText("2026“守创杯”中医药科普创新创意大赛 · 数字科普 H5", 76, 86);
      ctx.textAlign = "right";
      ctx.fillStyle = "rgba(212,175,55,.5)";
      ctx.fillText("OFFLINE EXHIBITION / No. " + ("2026" + String((state.answers.join("") || "0").replace(/[^0-9]/g, "") || "0").padStart(8, "0")).slice(0, 12), W - 76, 86);

      // Main header.
      ctx.textAlign = "center";
      ctx.fillStyle = "#ead8b8";
      ctx.font = '600 49px "Noto Serif SC",SimSun,serif';
      ctx.fillText("守 创 本 草", 460, 178);
      ctx.fillStyle = "rgba(212,175,55,.76)";
      ctx.font = '18px "Noto Serif SC",SimSun,serif';
      ctx.fillText("杏 林 格 物 · 通 关 文 牒", 460, 210);
      ctx.fillStyle = "rgba(214,197,174,.28)";
      ctx.font = '11px Georgia,serif';
      ctx.fillText("A CERTIFICATE OF BOTANICAL OBSERVATION", 460, 230);

      // Alias.
      ctx.fillStyle = "rgba(214,197,174,.42)";
      ctx.font = '13px "Noto Serif SC",SimSun,serif';
      ctx.fillText("授 予", 460, 286);
      ctx.fillStyle = "#f0dfb9";
      ctx.font = '600 56px "Noto Serif SC",SimSun,serif';
      ctx.fillText(alias.name, 460, 346);
      ctx.fillStyle = "rgba(212,175,55,.65)";
      ctx.font = '15px "Noto Serif SC",SimSun,serif';
      ctx.fillText(alias.line, 460, 378);

      // Divider.
      ctx.strokeStyle = "rgba(212,175,55,.29)";
      ctx.lineWidth = .8;
      ctx.beginPath();
      ctx.moveTo(315, 404); ctx.lineTo(605, 404);
      ctx.stroke();
      ctx.fillStyle = "#a94334";
      ctx.beginPath();
      ctx.arc(460, 404, 3, 0, Math.PI * 2);
      ctx.fill();

      // Stats.
      var stats = [
        { value: accuracy + "%", label: "实验准确率" },
        { value: (procStage ? chineseNumber(procStage) + "蒸" : "未启"), label: "九蒸九晒记录" },
        { value: oil + "%", label: "挥发油收集" },
        { value: teaBalance ? teaBalance + "" : "—", label: "茶饮配伍平衡" }
      ];
      var startX = 190;
      stats.forEach(function (item, i) {
        var x = startX + i * 181;
        ctx.fillStyle = "#f0dfb9";
        ctx.font = '400 32px Georgia,"Noto Serif SC",serif';
        ctx.fillText(item.value, x, 463);
        ctx.fillStyle = "rgba(214,197,174,.32)";
        ctx.font = '11px "Noto Serif SC",SimSun,serif';
        ctx.fillText(item.label, x, 484);
        if (i < stats.length - 1) {
          ctx.strokeStyle = "rgba(214,197,174,.1)";
          ctx.beginPath();
          ctx.moveTo(x + 74, 440);
          ctx.lineTo(x + 74, 480);
          ctx.stroke();
        }
      });

      // Knowledge summary.
      ctx.textAlign = "left";
      ctx.fillStyle = "rgba(214,197,174,.26)";
      ctx.font = '11px "Noto Serif SC",SimSun,serif';
      ctx.fillText("本 草 知 识 摘 要", 122, 540);
      ctx.strokeStyle = "rgba(214,197,174,.09)";
      ctx.beginPath();
      ctx.moveTo(122, 552); ctx.lineTo(790, 552);
      ctx.stroke();
      ctx.font = '14px "Noto Serif SC",SimSun,serif';
      ctx.fillStyle = "rgba(230,217,194,.62)";
      ctx.fillText("美拉德反应 / 道尔顿分压 / 五味化学分类 / 剂型扩散屏障", 122, 581);
      ctx.fillStyle = "rgba(214,197,174,.31)";
      ctx.font = '12px "Noto Serif SC",SimSun,serif';
      ctx.fillText("观察，不止于看见；解释，也不止于听说。", 122, 609);

      // Seal at right.
      ctx.save();
      ctx.translate(930, 430);
      ctx.rotate(-.06);
      ctx.strokeStyle = "rgba(169,67,52,.9)";
      ctx.lineWidth = 3;
      ctx.strokeRect(-64, -64, 128, 128);
      ctx.strokeStyle = "rgba(169,67,52,.55)";
      ctx.lineWidth = 1;
      ctx.strokeRect(-54, -54, 108, 108);
      ctx.fillStyle = "rgba(169,67,52,.84)";
      ctx.font = '600 46px "Noto Serif SC",SimSun,serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("格", -25, -22);
      ctx.fillText("物", 25, -22);
      ctx.fillText("有", -25, 36);
      ctx.fillText("序", 25, 36);
      ctx.restore();

      // Bottom.
      ctx.textAlign = "left";
      ctx.fillStyle = "rgba(214,197,174,.27)";
      ctx.font = '11px "Noto Serif SC",SimSun,serif';
      ctx.fillText("岁次丙午 · 2026", 78, 726);
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(214,197,174,.2)";
      ctx.fillText("本作品为中医药文化科普与教学仿真，不构成诊疗、用药或炮制生产建议。", 600, 734);
      ctx.textAlign = "right";
      ctx.fillStyle = "rgba(212,175,55,.38)";
      ctx.fillText("明医格物 · 数字展览", W - 78, 726);

      dom.quiz.locked.classList.add("is-hidden");
      dom.quiz.download.disabled = false;
      state.certificateReady = true;
      state.certificateData = canvas.toDataURL("image/png");
      showToast("通关文牒已生成 · 可导出 PNG");
    }
    if (document.fonts && document.fonts.ready) {
      return document.fonts.ready.then(draw).then(function () { return state.certificateData; });
    }
    draw();
    return Promise.resolve(state.certificateData);
  }

  function drawCertificateCorner(ctx, x, y, sx, sy) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(sx, sy);
    ctx.strokeStyle = "rgba(212,175,55,.7)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, 28);
    ctx.lineTo(0, 0);
    ctx.lineTo(28, 0);
    ctx.stroke();
    ctx.strokeStyle = "rgba(212,175,55,.3)";
    ctx.beginPath();
    ctx.moveTo(8, 42);
    ctx.lineTo(8, 8);
    ctx.lineTo(42, 8);
    ctx.stroke();
    ctx.fillStyle = "rgba(169,67,52,.62)";
    ctx.save();
    ctx.translate(19, 19);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-3, -3, 6, 6);
    ctx.restore();
    ctx.restore();
  }

  function downloadCertificate() {
    if (!state.certificateReady || !state.certificateData) {
      showToast("先生成通关文牒。");
      return;
    }
    var link = document.createElement("a");
    link.href = state.certificateData;
    link.download = "守创本草-杏林格物通关文牒.png";
    document.body.appendChild(link);
    link.click();
    link.remove();
    showToast("已导出 PNG · 可保存至本地");
  }

  /* ----------------------------------------------------------------------
     Resize, capture and app boot
     ---------------------------------------------------------------------- */
  function onResize() {
    if (dom.scrollStage) updateGallery();
    redrawFallbackCharts();
    if (state.visible.processing) drawProcessingFrame(performance.now());
    if (state.visible.distillation) drawDistillation(performance.now(), distillMetrics());
    if (state.quizDone && state.certificateReady) {
      // The image stays at its fixed 1200 × 800 output resolution.
      dom.quiz.canvas.style.width = "100%";
    }
  }

  function attachResize() {
    var handler = debounce(onResize, 120);
    window.addEventListener("resize", handler);
    if ("ResizeObserver" in window) {
      var ro = new ResizeObserver(handler);
      [dom.radarChart, dom.networkChart, dom.proc.chart, dom.forms.chart].forEach(function (node) { if (node) ro.observe(node); });
    }
  }

  function exposeDemoApi() {
    window.__TCM_DEMO__ = {
      goDoctor: goDoctor,
      goScene: function (target) {
        var index = typeof target === "number" ? target : deckState.scenes.findIndex(function (scene) { return scene.id === target; });
        if (index >= 0) goScene(index, { force: true });
      },
      currentScene: function () { return deckState.scenes[deckState.index] ? deckState.scenes[deckState.index].id : ""; },
      scrollScene: function (top) {
        var scene = deckState.scenes[deckState.index];
        if (scene) scene.scrollTop = Math.max(0, Number(top) || 0);
      },
      openDoctor: function () { toggleDoctor(true); },
      selectHerb: selectHerb,
      setProcessing: function (temp, hours, stage) {
        if (temp != null) { state.proc.temp = temp; dom.proc.input.value = temp; }
        if (hours != null) { state.proc.hours = hours; dom.proc.hoursInput.value = hours; }
        if (stage != null) { state.proc.stage = stage; state.proc.visualStage = stage; }
        updateProcessingUI();
        drawProcessingFrame(performance.now());
      },
      setDistillation: function (material, power, flow) {
        if (material) {
          var mbtn = $("[data-material='" + material + "']", dom.distill.materialSwitch);
          if (mbtn) mbtn.click();
        }
        if (power != null) { state.distill.power = power; dom.distill.power.value = power; }
        if (flow != null) { state.distill.flow = flow; dom.distill.flow.value = flow; }
        updateDistillReadouts();
        drawDistillation(performance.now(), distillMetrics());
      },
      setShichen: setShichen,
      setTea: function (ids) {
        state.tea = ids.slice(0, 3);
        updateTea();
      },
      setRhythmState: function (id) {
        state.rhythmState = id;
        $$("[data-state]", dom.rhythm.states).forEach(function (b) { b.classList.toggle("is-active", b.getAttribute("data-state") === id); });
        updateTea();
      },
      answerAll: function (correctOnly) {
        state.answers = DATA.quiz.map(function (q, i) {
          if (correctOnly === false) return (q.answer + 1) % q.options.length;
          return q.answer;
        });
        state.quizIndex = DATA.quiz.length - 1;
        finishQuiz();
      },
      generateCertificate: generateCertificate,
      selectForm: selectForm,
      state: state,
      charts: charts
    };
  }

  function init() {
    try {
      cacheDom();
      initDeck();
      initChrome();
      buildDoctors();
      initCharts();
      initHerbs();
      updateRadarChart();
      updateNetworkChart();
      initProcessing();
      initDistillation();
      initRhythm();
      initForms();
      initQuiz();
      attachResize();
      if (window.gsap && !reducedMotion) {
        window.gsap.fromTo(".hero-copy > *", { y: 22, opacity: 0 }, {
          y: 0, opacity: 1, duration: 1.15, stagger: .075, delay: .72, ease: "power3.out", overwrite: "auto"
        });
        window.gsap.fromTo(".hero-gallery", { y: 26, opacity: 0 }, {
          y: 0, opacity: 1, duration: 1.25, delay: .92, ease: "power3.out", overwrite: "auto"
        });
      }
      exposeDemoApi();
      window.__APP_READY__ = true;
      document.documentElement.classList.add("app-ready");
    } catch (error) {
      window.__APP_ERRORS__.push(String(error && error.stack || error));
      document.documentElement.classList.add("app-error");
      var boot = $("#bootScreen");
      if (boot) {
        boot.classList.add("is-done");
        boot.insertAdjacentHTML("afterend", '<p style="position:fixed;z-index:300;left:20px;bottom:20px;color:#c77562;font:12px serif">页面初始化出现异常，请刷新重试。</p>');
      }
      console.error(error);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
