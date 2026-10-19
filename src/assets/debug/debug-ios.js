/*
 * DEBUG TEMPORAIRE (images noires / bandeaux vides sur iPhone)
 * Ne fait rien sauf si l'adresse contient ?debug (ex. monsite.com/fit-gen.html?debug)
 * Pour le retirer : supprimer ce fichier et sa ligne <script> dans _partials/_header.html
 */
(function () {
  if (!/[?&]debug/.test(location.search)) return;

  var events = []; // erreurs et contextes perdus, gardés entre deux analyses
  var lines = [];
  var panel = null;
  var stats = { webgl: 0, webgl2: 0, lost: 0, restored: 0, ctx2d: 0, nulls: [] };

  function log(text) {
    lines.push(text);
    if (panel) panel.textContent = lines.join('\n');
  }

  // 1. Erreurs JS
  window.addEventListener('error', function (e) {
    event('ERREUR: ' + e.message + ' (' + (e.filename || '').split('/').pop() + ':' + e.lineno + ')');
  });
  window.addEventListener('unhandledrejection', function (e) {
    event('PROMESSE REJETÉE: ' + (e.reason && e.reason.message ? e.reason.message : e.reason));
  });
  ['error', 'warn'].forEach(function (type) {
    var original = console[type];
    console[type] = function () {
      event('console.' + type + ': ' + Array.prototype.join.call(arguments, ' '));
      original.apply(console, arguments);
    };
  });

  // 2. Compte les contextes créés, perdus, et les getContext qui renvoient null
  var seen = new WeakSet();
  var getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type) {
    var context = getContext.apply(this, arguments);
    if (!context) {
      stats.nulls.push(type + ' ' + this.width + 'x' + this.height);
      event('getContext("' + type + '") = NULL (' + this.width + 'x' + this.height + ')');
      return context;
    }
    if (seen.has(this)) return context;
    seen.add(this);
    if (type === '2d') stats.ctx2d++;
    if (type === 'webgl') stats.webgl++;
    if (type === 'webgl2') stats.webgl2++;
    if (type.indexOf('webgl') === 0) {
      this.addEventListener('webglcontextlost', function () {
        stats.lost++;
        event('webglcontextlost (total perdus: ' + stats.lost + ')');
      });
      this.addEventListener('webglcontextrestored', function () {
        stats.restored++;
      });
    }
    return context;
  };

  // Couleur moyenne d'un canvas 2D, ou d'une image dessinée dans un petit canvas
  function average(source) {
    var c = document.createElement('canvas');
    c.width = c.height = 8;
    var ctx = getContext.call(c, '2d');
    if (!ctx) return 'ctx null';
    try {
      ctx.drawImage(source, 0, 0, 8, 8);
      var d = ctx.getImageData(0, 0, 8, 8).data;
      var r = 0, g = 0, b = 0;
      for (var i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
      var n = d.length / 4;
      return 'rgb(' + Math.round(r / n) + ',' + Math.round(g / n) + ',' + Math.round(b / n) + ')';
    } catch (err) {
      return 'erreur ' + err.message;
    }
  }

  // Le truc du bandeau : texte dessiné HORS du canvas, seule son ombre tombe dedans
  function testShadow(offscreen) {
    var c = document.createElement('canvas');
    c.width = 200;
    c.height = 60;
    var ctx = getContext.call(c, '2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, 200, 60);
    ctx.font = '50px "Archivo Black"';
    ctx.fillStyle = '#000';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = offscreen ? 200 : 0;
    ctx.fillText('TEST', offscreen ? 10 - 200 : 10, 50);
    var d = ctx.getImageData(0, 0, 200, 60).data;
    var ink = 0;
    for (var i = 0; i < d.length; i += 4) if (d[i] < 128) ink++;
    return Math.round((ink / (d.length / 4)) * 100) + '% de pixels noirs';
  }

  function analyse() {
    lines = [];
    var root = getComputedStyle(document.documentElement);
    log('UA: ' + navigator.userAgent);
    log('DPR: ' + devicePixelRatio + ' | tactile: ' + matchMedia('(hover: none) and (pointer: coarse)').matches);
    log('--color-background="' + root.getPropertyValue('--color-background').trim() + '" --color-white="' + root.getPropertyValue('--color-white').trim() + '"');
    log('Contextes créés: webgl2=' + stats.webgl2 + ' webgl=' + stats.webgl + ' 2d=' + stats.ctx2d + ' | perdus=' + stats.lost + ' | getContext null=' + stats.nulls.length);
    log('Bandeau, ombre hors canvas: ' + testShadow(true) + ' | ombre dans le canvas: ' + testShadow(false));

    var veils = document.querySelectorAll('[data-component="DitherVeil"]');
    log('--- ' + veils.length + ' DitherVeil ---');
    Array.prototype.forEach.call(veils, function (el, i) {
      var img = el.querySelector('img');
      var canvas = el.querySelector('canvas');
      var rect = el.getBoundingClientRect();
      var onScreen = rect.bottom > 0 && rect.top < innerHeight;
      var text = '#' + i + (onScreen ? ' [ÉCRAN]' : '') + ' img ' + (img ? img.naturalWidth + 'x' + img.naturalHeight + ' complete=' + img.complete : 'aucune');
      if (img && img.complete) text += ' moyenne img=' + average(img);
      if (canvas) text += ' | canvas ' + canvas.className.replace('dither-veil__canvas', '').trim() + ' ' + canvas.width + 'x' + canvas.height + (canvas.className.indexOf('still') > -1 ? ' moyenne=' + average(canvas) : '');
      else text += ' | pas de canvas';
      log(text);
    });

    var marquees = document.querySelectorAll('.halftone-marquee__canvas');
    log('--- ' + marquees.length + ' bandeaux --- ' + Array.prototype.map.call(marquees, function (c) { return c.width + 'x' + c.height; }).join(', '));
  }

  document.addEventListener('DOMContentLoaded', function () {
    panel = document.createElement('pre');
    panel.style.cssText = 'position:fixed;left:0;right:0;bottom:0;max-height:45vh;overflow:auto;margin:0;padding:8px;font:10px/1.3 monospace;color:#0f0;background:rgba(0,0,0,.88);z-index:2147483647;white-space:pre-wrap;word-break:break-all;';
    panel.textContent = lines.join('\n');
    var button = document.createElement('button');
    button.textContent = 'Analyser';
    button.style.cssText = 'position:fixed;right:8px;bottom:calc(45vh + 8px);z-index:2147483647;padding:8px 12px;font:14px sans-serif;';
    button.addEventListener('click', analyse);
    document.body.appendChild(panel);
    document.body.appendChild(button);
    show();
    setTimeout(analyse, 3000);
  });
})();
