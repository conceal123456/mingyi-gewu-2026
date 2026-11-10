/* Offline canvas chart engine.
   Used only when the local ECharts file cannot be loaded.
   It renders the same four teaching visualisations without network access. */
(function () {
  "use strict";

  var COLORS = {
    ink: "#12100c",
    paper: "#d6c5ae",
    paperHi: "#f0e1c8",
    muted: "rgba(214,197,174,.48)",
    faint: "rgba(214,197,174,.16)",
    grid: "rgba(214,197,174,.11)",
    gold: "#d4af37",
    goldDeep: "#9a7b2c",
    cinnabar: "#a84336",
    sage: "#84927b"
  };

  function setup(el) {
    if (!el) return null;
    var w = Math.max(10, Math.floor(el.clientWidth));
    var h = Math.max(10, Math.floor(el.clientHeight));
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var canvas = el.querySelector("canvas.tcm-fallback-canvas");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.className = "tcm-fallback-canvas";
      canvas.style.position = "absolute";
      canvas.style.inset = "0";
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      if (!el.style.position) el.style.position = "relative";
      el.appendChild(canvas);
    }
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    var ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx: ctx, w: w, h: h, canvas: canvas, dpr: dpr };
  }

  function font(ctx, size, weight) {
    ctx.font = (weight || 400) + " " + size + 'px "Noto Serif SC","Songti SC","STSong","SimSun",serif';
  }

  function text(ctx, value, x, y, color, size, align, baseline, weight) {
    font(ctx, size || 10, weight || 400);
    ctx.fillStyle = color || COLORS.muted;
    ctx.textAlign = align || "center";
    ctx.textBaseline = baseline || "middle";
    ctx.fillText(value, x, y);
  }

  function hexToRgba(hex, a) {
    var h = hex.replace("#", "");
    if (h.length === 3) h = h.split("").map(function (x) { return x + x; }).join("");
    var n = parseInt(h, 16);
    return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")";
  }

  function grid(ctx, w, h, light) {
    var col = light ? "rgba(60,44,26,.08)" : COLORS.grid;
    ctx.save();
    ctx.strokeStyle = col;
    ctx.lineWidth = 0.5;
    ctx.setLineDash([2, 5]);
    for (var i = 1; i < 6; i++) {
      var x = (w / 6) * i;
      ctx.beginPath();
      ctx.moveTo(x, 8);
      ctx.lineTo(x, h - 8);
      ctx.stroke();
    }
    for (var j = 1; j < 4; j++) {
      var y = (h / 4) * j;
      ctx.beginPath();
      ctx.moveTo(8, y);
      ctx.lineTo(w - 8, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function radar(el, cfg) {
    var s = setup(el);
    if (!s) return;
    var ctx = s.ctx, w = s.w, h = s.h, light = !!cfg.light;
    var axes = cfg.axes || [];
    var values = cfg.values || [];
    var n = axes.length;
    var cx = w / 2, cy = h / 2 + 4;
    var r = Math.min(w * 0.31, h * 0.34);
    var line = light ? "rgba(60,44,26,.24)" : COLORS.grid;
    var label = light ? "rgba(50,37,22,.7)" : COLORS.muted;

    ctx.save();
    ctx.strokeStyle = line;
    ctx.lineWidth = 0.7;
    for (var ring = 1; ring <= 4; ring++) {
      var rr = r * ring / 4;
      ctx.beginPath();
      for (var i = 0; i < n; i++) {
        var a = -Math.PI / 2 + i * Math.PI * 2 / n;
        var x = cx + Math.cos(a) * rr;
        var y = cy + Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }
    for (var k = 0; k < n; k++) {
      var ang = -Math.PI / 2 + k * Math.PI * 2 / n;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r);
      ctx.stroke();
    }
    ctx.restore();

    ctx.beginPath();
    for (var m = 0; m < n; m++) {
      var aa = -Math.PI / 2 + m * Math.PI * 2 / n;
      var v = Math.max(0, Math.min(100, values[m] || 0)) / 100;
      var px = cx + Math.cos(aa) * r * v;
      var py = cy + Math.sin(aa) * r * v;
      if (m === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = light ? "rgba(143,47,45,.17)" : hexToRgba(COLORS.gold, .14);
    ctx.fill();
    ctx.strokeStyle = light ? "#8f2f2d" : COLORS.gold;
    ctx.lineWidth = 1.3;
    ctx.stroke();
    for (var d = 0; d < n; d++) {
      var da = -Math.PI / 2 + d * Math.PI * 2 / n;
      var dv = Math.max(0, Math.min(100, values[d] || 0)) / 100;
      var dx = cx + Math.cos(da) * r * dv;
      var dy = cy + Math.sin(da) * r * dv;
      ctx.beginPath();
      ctx.arc(dx, dy, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = light ? "#8f2f2d" : COLORS.gold;
      ctx.fill();
    }
    axes.forEach(function (a, idx) {
      var t = -Math.PI / 2 + idx * Math.PI * 2 / n;
      var lx = cx + Math.cos(t) * (r + 27);
      var ly = cy + Math.sin(t) * (r + 21);
      var align = Math.abs(Math.cos(t)) < .23 ? "center" : (Math.cos(t) > 0 ? "left" : "right");
      text(ctx, a, lx, ly, label, 9, align, "middle");
    });
  }

  function pathPoints(data, x0, y0, gw, gh, max) {
    return data.map(function (v, i) {
      return [x0 + gw * i / Math.max(1, data.length - 1), y0 + gh - gh * Math.max(0, Math.min(max, v)) / max];
    });
  }

  function smoothPath(ctx, pts) {
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 0; i < pts.length - 1; i++) {
      var p = pts[i], q = pts[i + 1];
      var mx = (p[0] + q[0]) / 2;
      ctx.bezierCurveTo(mx, p[1], mx, q[1], q[0], q[1]);
    }
  }

  function line(el, cfg) {
    var s = setup(el);
    if (!s) return;
    var ctx = s.ctx, w = s.w, h = s.h;
    var light = !!cfg.light;
    var m = { l: 36, r: 16, t: 14, b: 27 };
    var gw = w - m.l - m.r, gh = h - m.t - m.b;
    var labels = cfg.labels || [];
    var max = cfg.yMax || 100;
    var axisColor = light ? "rgba(55,40,24,.28)" : COLORS.grid;
    var textColor = light ? "rgba(55,40,24,.55)" : COLORS.muted;
    grid(ctx, w, h, light);
    ctx.save();
    ctx.strokeStyle = axisColor;
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(m.l, m.t);
    ctx.lineTo(m.l, m.t + gh);
    ctx.lineTo(m.l + gw, m.t + gh);
    ctx.stroke();
    for (var y = 0; y <= 4; y++) {
      text(ctx, String(Math.round(max - max * y / 4)), m.l - 7, m.t + gh * y / 4, textColor, 8, "right", "middle");
    }
    labels.forEach(function (lab, i) {
      if (!lab && lab !== 0) return;
      var x = m.l + gw * i / Math.max(1, labels.length - 1);
      text(ctx, String(lab), x, m.t + gh + 14, textColor, 8, "center", "middle");
    });
    if (cfg.marker != null && labels.length > 1) {
      var mx = m.l + gw * cfg.marker / (labels.length - 1);
      ctx.strokeStyle = "rgba(212,175,55,.28)";
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(mx, m.t);
      ctx.lineTo(mx, m.t + gh);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    (cfg.series || []).forEach(function (series) {
      var pts = pathPoints(series.data, m.l, m.t, gw, gh, max);
      ctx.strokeStyle = series.color || COLORS.gold;
      ctx.lineWidth = series.active === false ? 1 : 1.6;
      ctx.globalAlpha = series.active === false ? .46 : 1;
      if (series.dashed) ctx.setLineDash([4, 4]); else ctx.setLineDash([]);
      ctx.beginPath();
      smoothPath(ctx, pts);
      ctx.stroke();
      ctx.setLineDash([]);
      if (series.dots) {
        pts.forEach(function (p) {
          ctx.beginPath();
          ctx.arc(p[0], p[1], 1.6, 0, Math.PI * 2);
          ctx.fillStyle = series.color || COLORS.gold;
          ctx.fill();
        });
      }
      ctx.globalAlpha = 1;
    });
    ctx.restore();
  }

  function forceLayout(nodes, links, w, h) {
    var pad = 30;
    var seed = 3;
    function rand() {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    }
    nodes.forEach(function (n, i) {
      if (n.x == null) {
        var a = i * 2.399;
        n.x = w / 2 + Math.cos(a) * (w * .27) * rand();
        n.y = h / 2 + Math.sin(a) * (h * .28) * rand();
        n.vx = 0;
        n.vy = 0;
      }
    });
    var byId = {};
    nodes.forEach(function (n) { byId[n.id] = n; });
    for (var it = 0; it < 160; it++) {
      nodes.forEach(function (a, i) {
        nodes.forEach(function (b, j) {
          if (i >= j) return;
          var dx = b.x - a.x, dy = b.y - a.y;
          var d2 = dx * dx + dy * dy + 8;
          var f = 520 / d2;
          a.vx -= dx * f; a.vy -= dy * f;
          b.vx += dx * f; b.vy += dy * f;
        });
      });
      links.forEach(function (l) {
        var a = byId[l.source], b = byId[l.target];
        if (!a || !b) return;
        var dx = b.x - a.x, dy = b.y - a.y;
        var d = Math.sqrt(dx * dx + dy * dy) + .1;
        var f = (d - 53) * .006;
        a.vx += dx / d * f; a.vy += dy / d * f;
        b.vx -= dx / d * f; b.vy -= dy / d * f;
      });
      nodes.forEach(function (n) {
        n.vx += (w / 2 - n.x) * .0008;
        n.vy += (h / 2 - n.y) * .0008;
        n.x += Math.max(-4, Math.min(4, n.vx));
        n.y += Math.max(-4, Math.min(4, n.vy));
        n.vx *= .82; n.vy *= .82;
        n.x = Math.max(pad, Math.min(w - pad, n.x));
        n.y = Math.max(pad, Math.min(h - pad, n.y));
      });
    }
  }

  function network(el, cfg) {
    var s = setup(el);
    if (!s) return;
    var ctx = s.ctx, w = s.w, h = s.h;
    var nodes = cfg.nodes.map(function (n) { return Object.assign({}, n); });
    if (!el._networkLayout || el._networkKey !== cfg.key) {
      forceLayout(nodes, cfg.links, w, h);
      el._networkLayout = nodes;
      el._networkKey = cfg.key;
    } else {
      nodes = el._networkLayout;
    }
    var byId = {};
    nodes.forEach(function (n) { byId[n.id] = n; });
    ctx.save();
    cfg.links.forEach(function (l) {
      var a = byId[l.source], b = byId[l.target];
      if (!a || !b) return;
      var active = l.source === cfg.active || l.target === cfg.active;
      ctx.strokeStyle = active ? "rgba(212,175,55,.32)" : "rgba(214,197,174,.1)";
      ctx.lineWidth = active ? 1.1 : .55;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    });
    var palette = ["#d4af37", "#a84336", "#84927b"];
    nodes.forEach(function (n) {
      var active = n.id === cfg.active;
      var rad = n.type === 0 ? (active ? 8 : 4.4) : (n.type === 1 ? 6 : 3.7);
      if (active) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, rad + 5, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(212,175,55,.1)";
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(n.x, n.y, rad, 0, Math.PI * 2);
      ctx.fillStyle = active ? "#f0dfb9" : palette[n.type] || COLORS.muted;
      ctx.fill();
      text(ctx, n.name, n.x + (n.x > w * .72 ? -7 : 7), n.y, active ? "#f0dfb9" : "rgba(214,197,174,.5)", active ? 9 : 7, n.x > w * .72 ? "right" : "left", "middle");
    });
    ctx.restore();
  }

  function bars(el, cfg) {
    var s = setup(el);
    if (!s) return;
    var ctx = s.ctx, w = s.w, h = s.h;
    var labels = cfg.labels || [];
    var values = cfg.values || [];
    var dark = cfg.dark !== false;
    var left = 76, right = 28, top = 18, bottom = 16;
    var gw = w - left - right, gh = h - top - bottom;
    var n = Math.max(1, labels.length);
    var row = gh / n;
    ctx.save();
    for (var i = 0; i < n; i++) {
      var y = top + row * (i + .5);
      var val = Math.max(0, Math.min(100, values[i] || 0));
      ctx.strokeStyle = dark ? "rgba(214,197,174,.055)" : "rgba(55,40,24,.08)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(left + gw, y);
      ctx.stroke();
      // category label
      text(ctx, labels[i], left - 12, y, dark ? "rgba(232,215,190,.66)" : "rgba(45,32,19,.72)", 9, "right", "middle");
      // track
      ctx.fillStyle = dark ? "rgba(214,197,174,.045)" : "rgba(55,40,24,.06)";
      ctx.fillRect(left, y - 4, gw, 8);
      // bar gradient
      var grad = ctx.createLinearGradient(left, 0, left + gw, 0);
      grad.addColorStop(0, "#6f2e27");
      grad.addColorStop(.62, "#a95743");
      grad.addColorStop(1, "#d08a69");
      ctx.fillStyle = grad;
      ctx.fillRect(left, y - 4, gw * val / 100, 8);
      text(ctx, String(Math.round(val)), left + gw * val / 100 + 10, y, dark ? "rgba(232,215,190,.54)" : "rgba(45,32,19,.52)", 8, "left", "middle");
    }
    // 50% reference
    ctx.strokeStyle = dark ? "rgba(214,197,174,.14)" : "rgba(55,40,24,.16)";
    ctx.setLineDash([3, 5]);
    ctx.beginPath();
    ctx.moveTo(left + gw * .5, top);
    ctx.lineTo(left + gw * .5, top + gh);
    ctx.stroke();
    ctx.restore();
  }

  function curveMini(svg, values) {
    if (!svg) return;
    var w = 115, h = 65;
    var pts = pathPoints(values, 2, 4, w - 4, h - 8, 100);
    var d = "M" + pts.map(function (p) { return p[0].toFixed(1) + "," + p[1].toFixed(1); }).join(" L");
    svg.setAttribute("viewBox", "0 0 " + w + " " + h);
    svg.innerHTML = '<path d="' + d + '" fill="none" stroke="currentColor" stroke-width="1.1" opacity=".85"/>';
  }

  window.TCMFallback = {
    radar: radar,
    bars: bars,
    line: line,
    network: network,
    curveMini: curveMini,
    clear: function (el) { if (el) el.innerHTML = ""; }
  };
})();
