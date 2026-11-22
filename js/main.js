(() => {
  const config = window.ASCII_LOGO_CONFIG;

  const snowCanvas = document.getElementById("snowCanvas");
  const snowCtx = snowCanvas.getContext("2d", { alpha: false });

  const logoCanvas = document.getElementById("logoCanvas");
  const logoCtx = logoCanvas.getContext("2d");

  // Кэш фона и кэш готового логотипа
  const bgCache = document.createElement("canvas");
  const bgCtx = bgCache.getContext("2d", { alpha: false });

  const logoCache = document.createElement("canvas");
  const logoCacheCtx = logoCache.getContext("2d");

  const sourceImage = new Image();
  let viewW = 0;
  let viewH = 0;
  let logoW = 0;
  let logoH = 0;
  let dpr = 1;

  let cachedSource = null;
  let cachedSamples = [];
  let logoReady = false;
  let originX = 0;
  let originY = 0;
  let logoRadius = 180;

  let snowflakes = [];
  let lastTime = performance.now();
  let animStartTime = performance.now();

  const random = (min, max) => Math.random() * (max - min) + min;
  const choose = (array, index) => array[index % array.length];
  const clamp01 = (v) => Math.max(0, Math.min(1, v));

  // =========================================================================
  // 1. ASCII-ТАЙМЕР ОБРАТНОГО ОТСЧЁТА
  // =========================================================================
  const TARGET_DATE = new Date(config.eventDate || "2027-01-30T10:00:00");

  const ASCII_DIGITS = {
    "0": [
      " .###$#.",
      ":##$..$#",
      "##$  .$#",
      "##$  .$#",
      ":##$..$#",
      " .###$#."
    ],
    "1": [
      "  .##$  ",
      " .###$  ",
      "   ##$  ",
      "   ##$  ",
      "   ##$  ",
      " .#####."
    ],
    "2": [
      " .####$.",
      ":#$..$##",
      "    .$$.",
      "  .$$#  ",
      ".$$#... ",
      "#######$"
    ],
    "3": [
      " .####$.",
      ":#$..$##",
      "   .###.",
      "     $##",
      ":#$..$##",
      " .####$."
    ],
    "4": [
      "   .$$# ",
      "  .#$$# ",
      " .#$ $# ",
      "#######$",
      "     $# ",
      "     $# "
    ],
    "5": [
      "#######$",
      "##$.... ",
      "######$.",
      "     $##",
      ":#$..$##",
      " .####$."
    ],
    "6": [
      " .####$.",
      ":##$... ",
      "######$.",
      "##$  .$#",
      ":##$..$#",
      " .####$."
    ],
    "7": [
      "#######$",
      "    .$#:",
      "   .$$. ",
      "  .$$.  ",
      "  ##$   ",
      "  ##$   "
    ],
    "8": [
      " .####$.",
      ":##$..$#",
      " .####$.",
      ":##$..$#",
      ":##$..$#",
      " .####$."
    ],
    "9": [
      " .####$.",
      ":##$..$#",
      ":##$..$#",
      " .#####$",
      "    .$#:",
      " .####. "
    ]
  };

  const GLITCH_CHARS = "@#$*!=~:;+";
  const GLITCH_DURATION = 300;

  const countdownUnits = [
    { key: "days",    el: document.getElementById("cd-days"),    prev: [], glitchUntil: [] },
    { key: "hours",   el: document.getElementById("cd-hours"),   prev: [], glitchUntil: [] },
    { key: "minutes", el: document.getElementById("cd-minutes"), prev: [], glitchUntil: [] },
    { key: "seconds", el: document.getElementById("cd-seconds"), prev: [], glitchUntil: [] }
  ];

  function updateCountdown(nowMs) {
    const diffSec = Math.max(0, Math.floor((TARGET_DATE - new Date()) / 1000));

    const values = {
      days:    String(Math.floor(diffSec / 86400)).padStart(2, "0"),
      hours:   String(Math.floor((diffSec % 86400) / 3600)).padStart(2, "0"),
      minutes: String(Math.floor((diffSec % 3600) / 60)).padStart(2, "0"),
      seconds: String(diffSec % 60).padStart(2, "0")
    };

    for (const unit of countdownUnits) {
      if (!unit.el) continue;
      const str = values[unit.key];

      // Подгоняем количество <pre> (если дней, например, 3 цифры вместо 2)
      while (unit.el.children.length < str.length) {
        const pre = document.createElement("pre");
        pre.className = "ascii-digit";
        unit.el.appendChild(pre);
      }
      while (unit.el.children.length > str.length) {
        unit.el.removeChild(unit.el.lastChild);
      }

      for (let i = 0; i < str.length; i++) {
        const ch = str[i];
        const pre = unit.el.children[i];
        const targetArt = ASCII_DIGITS[ch] || ASCII_DIGITS["0"];

        if (unit.prev[i] !== ch) {
          const hadPrev = unit.prev[i] !== undefined;
          unit.prev[i] = ch;
          if (hadPrev) {
            unit.glitchUntil[i] = nowMs + GLITCH_DURATION;
            pre.classList.add("glitching");
          } else {
            pre.textContent = targetArt.join("\n");
            continue;
          }
        }

        if (unit.glitchUntil[i] && nowMs < unit.glitchUntil[i]) {
          const progress = 1 - (unit.glitchUntil[i] - nowMs) / GLITCH_DURATION;
          const lockedRows = Math.floor(progress * targetArt.length);

          const morphed = targetArt.map((row, rIdx) => {
            if (rIdx < lockedRows) return row;
            let out = "";
            for (let c = 0; c < row.length; c++) {
              if (row[c] !== " " || Math.random() < 0.22) {
                out += GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)];
              } else {
                out += " ";
              }
            }
            return out;
          });
          pre.textContent = morphed.join("\n");
        } else if (pre.classList.contains("glitching")) {
          pre.classList.remove("glitching");
          pre.textContent = targetArt.join("\n");
        }
      }
    }
  }

  // =========================================================================
  // 2. ФОНОВЫЙ СНЕГОПАД
  // =========================================================================
  function createFlake(randomY = true) {
    const depth = random(0.35, 1.0);
    const isGlyph = Math.random() < 0.16;

    return {
      x: random(-20, viewW + 20),
      y: randomY ? random(0, viewH) : random(-30, -5),
      r: 0.7 + depth * 1.9,
      speedY: (24 + depth * 64) * (config.snowSpeed || 1),
      swayAmp: random(8, 28) * depth,
      swaySpeed: random(0.6, 1.8),
      phase: random(0, Math.PI * 2),
      alpha: 0.18 + depth * 0.62,
      isGlyph,
      glyph: Math.random() < 0.65 ? "*" : "+"
    };
  }

  function makeSnow() {
    const count = config.snowflakes || 220;
    snowflakes = Array.from({ length: count }, () => createFlake(true));
  }

  function buildBackgroundCache() {
    bgCache.width = Math.round(viewW * dpr);
    bgCache.height = Math.round(viewH * dpr);
    bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    bgCtx.fillStyle = "#02070c";
    bgCtx.fillRect(0, 0, viewW, viewH);

    const halo = bgCtx.createRadialGradient(
        viewW / 2, viewH * 0.43, 8,
        viewW / 2, viewH * 0.43, Math.max(viewW, viewH) * 0.66
    );
    halo.addColorStop(0, "rgba(20, 72, 91, .34)");
    halo.addColorStop(1, "rgba(1, 5, 10, 0)");
    bgCtx.fillStyle = halo;
    bgCtx.fillRect(0, 0, viewW, viewH);
  }

  function renderSnow(dt, timeSec) {
    snowCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    snowCtx.drawImage(bgCache, 0, 0, viewW, viewH);

    const wind = config.snowWind ?? 12;

    for (let i = 0; i < snowflakes.length; i++) {
      const f = snowflakes[i];
      f.y += f.speedY * dt;
      f.x += (wind + Math.sin(timeSec * f.swaySpeed + f.phase) * f.swayAmp) * dt;

      if (f.y > viewH + 15) {
        snowflakes[i] = createFlake(false);
        continue;
      }
      if (f.x > viewW + 25) f.x = -20;
      if (f.x < -25) f.x = viewW + 20;

      snowCtx.globalAlpha = f.alpha;
      snowCtx.fillStyle = f.alpha > 0.6 ? "#e8fcff" : "#b8eeff";

      if (f.isGlyph) {
        const size = Math.round(6 + f.r * 3.2);
        snowCtx.font = `bold ${size}px "Courier New", monospace`;
        snowCtx.textAlign = "center";
        snowCtx.textBaseline = "middle";
        snowCtx.fillText(f.glyph, f.x, f.y);
      } else {
        snowCtx.beginPath();
        snowCtx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        snowCtx.fill();
      }
    }

    snowCtx.globalAlpha = 1;
  }

  // =========================================================================
  // 3. ASCII-ЛОГОТИП С ЭФФЕКТОМ «МОРОЗНЫЙ ИНЕЙ» И ПЛАВНЫМ ПОКАЧИВАНИЕМ
  // =========================================================================
  function getSourcePixels() {
    const offscreen = document.createElement("canvas");
    offscreen.width = sourceImage.naturalWidth;
    offscreen.height = sourceImage.naturalHeight;
    const offCtx = offscreen.getContext("2d", { willReadFrequently: true });
    offCtx.clearRect(0, 0, offscreen.width, offscreen.height);
    offCtx.drawImage(sourceImage, 0, 0);
    return {
      width: offscreen.width,
      height: offscreen.height,
      data: offCtx.getImageData(0, 0, offscreen.width, offscreen.height).data
    };
  }

  function makeSamples(source) {
    const samples = [];
    const step = config.sampleStep;

    for (let y = 0; y < source.height; y += step) {
      for (let x = 0; x < source.width; x += step) {
        const index = (Math.floor(y) * source.width + Math.floor(x)) * 4;
        const r = source.data[index];
        const g = source.data[index + 1];
        const b = source.data[index + 2];
        const a = source.data[index + 3];

        if (a < config.alphaThreshold) continue;

        const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
        const glyphIndex = Math.min(
            config.glyphs.length - 1,
            Math.floor(luminance * config.glyphs.length)
        );

        samples.push({
          x: x - source.width / 2,
          y: y - source.height / 2,
          r, g, b, a,
          glyph: config.glyphs[glyphIndex],
          luminance
        });
      }
    }
    return samples;
  }

  function getGlyphColor(sample, layer = 0) {
    if (config.colorMode === "original") {
      const dim = layer ? 0.42 : 1;
      return `rgb(${Math.round(sample.r * dim)}, ${Math.round(sample.g * dim)}, ${Math.round(sample.b * dim)})`;
    }

    if (layer > 0) return layer > 2 ? "#397f98" : "#55b9d1";

    const paletteIndex = Math.min(
        config.iceColors.length - 1,
        Math.floor(sample.luminance * config.iceColors.length)
    );
    return choose(config.iceColors, paletteIndex);
  }

  function drawSample(targetCtx, sample, x, y, scale, layer = 0) {
    const color = getGlyphColor(sample, layer);
    const glyph = sample.glyph === " " ? "." : sample.glyph;
    const fontSize = Math.max(4, config.sampleStep * scale * 1.55);
    const alpha = (sample.a / 255) * (layer ? 0.10 : 0.88);

    targetCtx.save();
    targetCtx.globalAlpha = alpha;
    targetCtx.font = `bold ${fontSize}px "Courier New", monospace`;
    targetCtx.textAlign = "center";
    targetCtx.textBaseline = "middle";
    targetCtx.fillStyle = color;

    if (layer === 0) {
      targetCtx.shadowColor = color;
      targetCtx.shadowBlur = config.glow;
    } else {
      targetCtx.shadowBlur = 0;
    }

    targetCtx.fillText(glyph, x, y);
    targetCtx.restore();
  }

  function buildLogoCache() {
    if (!cachedSource || !cachedSamples.length || !logoW || !logoH) return;

    logoCache.width = Math.round(logoW * dpr);
    logoCache.height = Math.round(logoH * dpr);
    logoCacheCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    logoCacheCtx.clearRect(0, 0, logoW, logoH);

    const maxW = logoW * (config.maxWidthRatio || 0.82);
    const maxH = logoH * (config.maxHeightRatio || 0.70);
    const scale = Math.min(maxW / cachedSource.width, maxH / cachedSource.height);

    originX = logoW / 2;
    originY = logoH * (logoH < 620 ? 0.43 : 0.42);
    logoRadius = Math.hypot(cachedSource.width * scale, cachedSource.height * scale) * 0.56 + 24;

    for (let layer = config.depthLayers; layer >= 1; layer--) {
      const dx = layer * config.depthOffset;
      const dy = layer * config.depthOffset * 0.48;

      for (const sample of cachedSamples) {
        const x = originX + sample.x * scale + dx;
        const y = originY + sample.y * scale + dy;
        drawSample(logoCacheCtx, sample, x, y, scale, layer);
      }
    }

    for (const sample of cachedSamples) {
      const x = originX + sample.x * scale;
      const y = originY + sample.y * scale;
      drawSample(logoCacheCtx, sample, x, y, scale, 0);
    }

    logoReady = true;
  }

  function traceFrostPath(cx, cy, baseRadius, twist = 0) {
    const steps = 96;
    logoCtx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const crystal =
          1 +
          0.085 * Math.sin(a * 6 + 0.4 + twist) +
          0.055 * Math.sin(a * 13 - 1.1 - twist * 0.6) +
          0.035 * Math.cos(a * 23 + 0.7) +
          0.02 * Math.sin(a * 37 - 0.3);
      const r = Math.max(0, baseRadius * crystal);
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r;
      if (i === 0) logoCtx.moveTo(px, py);
      else logoCtx.lineTo(px, py);
    }
    logoCtx.closePath();
  }

  function drawFrostMaskedLogo(radius, masterAlpha, floatY, rimStrength, twist) {
    if (radius <= 1 || masterAlpha <= 0.01) return;

    const cx = originX;
    const cy = originY + floatY;

    const passes = [
      { mult: 1.12, alpha: 0.22 },
      { mult: 1.05, alpha: 0.48 },
      { mult: 1.0,  alpha: 1.0 }
    ];

    for (const pass of passes) {
      logoCtx.save();
      traceFrostPath(cx, cy, radius * pass.mult, twist);
      logoCtx.clip();
      logoCtx.globalAlpha = pass.alpha * masterAlpha;
      logoCtx.drawImage(logoCache, 0, floatY, logoW, logoH);
      logoCtx.restore();
    }

    if (rimStrength > 0.01) {
      logoCtx.save();
      traceFrostPath(cx, cy, radius * 1.01, twist);
      logoCtx.strokeStyle = `rgba(145, 232, 255, ${(0.22 * rimStrength).toFixed(3)})`;
      logoCtx.lineWidth = 7;
      logoCtx.stroke();

      logoCtx.strokeStyle = `rgba(232, 252, 255, ${(0.42 * rimStrength).toFixed(3)})`;
      logoCtx.lineWidth = 1.6;
      logoCtx.stroke();
      logoCtx.restore();
    }
  }

  function renderLogo(elapsed) {
    if (!logoReady) return;

    // Не тратим ресурсы, когда логотип ушёл за верхнюю границу экрана при скролле
    if (logoCanvas.getBoundingClientRect().bottom < -20) return;

    logoCtx.setTransform(1, 0, 0, 1, 0, 0);
    logoCtx.clearRect(0, 0, logoCanvas.width, logoCanvas.height);
    logoCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const CYCLE = 14.0;
    const phase = elapsed % CYCLE;
    const floatY = Math.sin(elapsed * 1.6) * 7;

    if (phase < 2.8) {
      const p = phase / 2.8;
      const ease = 1 - Math.pow(1 - p, 2.4);
      const radius = logoRadius * ease;
      const alpha = clamp01(p * 3.2);
      const rim = Math.sin(p * Math.PI);
      drawFrostMaskedLogo(radius, alpha, floatY, rim, p * 0.12);
    } else if (phase < 10.3) {
      logoCtx.drawImage(logoCache, 0, floatY, logoW, logoH);
    } else if (phase < 12.7) {
      const p = (phase - 10.3) / 2.4;
      const ease = p * p * (3 - 2 * p);
      const radius = logoRadius * (1 - ease);
      const alpha = clamp01((1 - p) * 2.2);
      const rim = Math.sin(p * Math.PI) * 0.55;
      drawFrostMaskedLogo(radius, alpha, floatY, rim, -p * 0.1);
    }
  }

  // =========================================================================
  // 4. РЕСАЙЗ И ГЛАВНЫЙ ЦИКЛ
  // =========================================================================
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);

    const nextViewW = window.innerWidth;
    const nextViewH = window.innerHeight;
    if (nextViewW !== viewW || nextViewH !== viewH) {
      viewW = nextViewW;
      viewH = nextViewH;
      snowCanvas.width = Math.round(viewW * dpr);
      snowCanvas.height = Math.round(viewH * dpr);
      buildBackgroundCache();
      makeSnow();
    }

    const rect = logoCanvas.getBoundingClientRect();
    const nextLogoW = Math.round(rect.width);
    const nextLogoH = Math.round(rect.height);

    if (Math.abs(nextLogoW - logoW) > 2 || Math.abs(nextLogoH - logoH) > 2) {
      logoW = nextLogoW;
      logoH = nextLogoH;
      logoCanvas.width = Math.round(logoW * dpr);
      logoCanvas.height = Math.round(logoH * dpr);
      if (cachedSource) buildLogoCache();
    }
  }

  function animate(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    const elapsed = (now - animStartTime) / 1000;

    renderSnow(dt, elapsed);
    renderLogo(elapsed);
    updateCountdown(now);

    requestAnimationFrame(animate);
  }

  sourceImage.onload = () => {
    cachedSource = getSourcePixels();
    cachedSamples = makeSamples(cachedSource);
    resize();
    buildLogoCache();
    animStartTime = performance.now();
  };
  sourceImage.onerror = () => {
    console.error("Не удалось загрузить " + config.imagePath);
  };
  sourceImage.src = config.imagePath;

  window.addEventListener("resize", resize);
  resize();
  updateCountdown(performance.now());
  requestAnimationFrame(animate);
})();