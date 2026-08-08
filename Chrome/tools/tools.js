/* Ruckus — document tools page.
 * Wires the operation registry to the UI. All processing is local. */
(function () {
  'use strict';

  var api = (typeof browser !== 'undefined' && browser.runtime) ? browser : chrome;

  // pdf.js needs its worker; point it at the bundled copy.
  if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = api.runtime.getURL('vendor/pdfjs.worker.min.js');
  }

  var el = {
    opList: document.getElementById('opList'),
    intro: document.getElementById('intro'),
    panel: document.getElementById('panel'),
    title: document.getElementById('opTitle'),
    blurb: document.getElementById('opBlurb'),
    drop: document.getElementById('drop'),
    dropHint: document.getElementById('dropHint'),
    dropTypes: document.getElementById('dropTypes'),
    picker: document.getElementById('picker'),
    files: document.getElementById('files'),
    options: document.getElementById('options'),
    run: document.getElementById('run'),
    state: document.getElementById('state'),
    log: document.getElementById('log'),
    results: document.getElementById('results'),
    resultList: document.getElementById('resultList'),
    saveAll: document.getElementById('saveAll'),
    mascot: document.getElementById('mascot'),
    closeTab: document.getElementById('closeTab')
  };

  var current = null;
  var files = [];
  var made = [];

  // ---- the pet, watching over proceedings --------------------------------

  (function drawMascot() {
    if (!window.RKSprites || !el.mascot) return;
    var ctx = el.mascot.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    var frame = 0;
    api.storage.local.get('ruckusState').then(function (res) {
      var s = res && res.ruckusState;
      var colour = (s && s.settings && s.settings.color) || 'amber';
      setInterval(function () {
        frame++;
        RKSprites.drawFrame(ctx, 0, 'idle', frame, { scale: 4, color: colour });
      }, 260);
      RKSprites.drawFrame(ctx, 0, 'idle', 0, { scale: 4, color: colour });
    }).catch(function () {
      RKSprites.drawFrame(ctx, 0, 'idle', 0, { scale: 4, color: 'amber' });
    });
  })();

  el.closeTab.addEventListener('click', function (e) {
    e.preventDefault();
    window.close();
  });

  // ---- sidebar ------------------------------------------------------------

  function buildSidebar() {
    RKDocTools.grouped().forEach(function (group) {
      var box = document.createElement('div');
      box.className = 'op-group';
      var h = document.createElement('h3');
      h.textContent = group.name;
      box.appendChild(h);
      group.ops.forEach(function (op) {
        var b = document.createElement('button');
        b.className = 'op';
        b.type = 'button';
        b.textContent = op.title;
        b.dataset.op = op.id;
        b.addEventListener('click', function () { choose(op.id); });
        box.appendChild(b);
      });
      el.opList.appendChild(box);
    });
  }

  function choose(id) {
    current = RKDocTools.byId(id);
    if (!current) return;
    Array.prototype.forEach.call(el.opList.querySelectorAll('.op'), function (b) {
      b.classList.toggle('on', b.dataset.op === id);
    });
    files = [];
    made = [];
    el.intro.hidden = true;
    el.panel.hidden = false;
    el.title.textContent = current.title;
    el.blurb.textContent = current.blurb || '';
    el.dropHint.textContent = current.multiple ? 'Drop files here' : 'Drop a file here';
    el.dropTypes.textContent = current.accept.replace(/,/g, '  ');
    el.picker.accept = current.accept;
    el.picker.multiple = !!current.multiple;
    el.results.hidden = true;
    el.log.hidden = true;
    el.log.textContent = '';
    setState('');
    buildOptions();
    renderFiles();
    location.hash = id;
  }

  // ---- options ------------------------------------------------------------

  function buildOptions() {
    el.options.textContent = '';
    (current.options || []).forEach(function (o) {
      var wrap = document.createElement('div');
      wrap.className = 'opt' + (o.type === 'check' ? ' check' : '');
      var label = document.createElement('label');
      label.textContent = o.label;
      label.htmlFor = 'opt-' + o.id;

      var input;
      if (o.type === 'select') {
        input = document.createElement('select');
        (o.choices || []).forEach(function (c) {
          var opt = document.createElement('option');
          opt.value = c[0];
          opt.textContent = c[1];
          input.appendChild(opt);
        });
        input.value = o.default;
      } else if (o.type === 'check') {
        input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = !!o.default;
      } else {
        input = document.createElement('input');
        input.type = o.type === 'number' ? 'number' : 'text';
        input.value = o.default != null ? o.default : '';
        if (o.placeholder) input.placeholder = o.placeholder;
      }
      input.id = 'opt-' + o.id;

      if (o.type === 'check') { wrap.appendChild(input); wrap.appendChild(label); }
      else { wrap.appendChild(label); wrap.appendChild(input); }
      el.options.appendChild(wrap);
    });
  }

  function readOptions() {
    var out = {};
    (current.options || []).forEach(function (o) {
      var input = document.getElementById('opt-' + o.id);
      if (!input) return;
      out[o.id] = o.type === 'check' ? input.checked : input.value;
    });
    return out;
  }

  // ---- files --------------------------------------------------------------

  function human(n) {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' KB';
    return (n / 1024 / 1024).toFixed(1) + ' MB';
  }

  function addFiles(list) {
    var incoming = Array.prototype.slice.call(list);
    if (!current.multiple) files = incoming.slice(0, 1);
    else files = files.concat(incoming);
    renderFiles();
    prefill();
  }

  function renderFiles() {
    el.files.textContent = '';
    files.forEach(function (f, i) {
      var li = document.createElement('li');
      li.draggable = !!current.multiple;
      li.dataset.i = String(i);

      if (current.multiple) {
        var grip = document.createElement('span');
        grip.className = 'grip';
        grip.textContent = '\u2261';
        grip.title = 'Drag to reorder';
        li.appendChild(grip);
      }
      var name = document.createElement('span');
      name.className = 'fname';
      name.textContent = f.name;
      var size = document.createElement('span');
      size.className = 'fsize';
      size.textContent = human(f.size);
      var x = document.createElement('button');
      x.className = 'x';
      x.type = 'button';
      x.textContent = '\u00d7';
      x.title = 'Remove';
      x.addEventListener('click', function () {
        files.splice(i, 1);
        renderFiles();
      });

      li.appendChild(name);
      li.appendChild(size);
      li.appendChild(x);
      el.files.appendChild(li);
    });
    el.run.disabled = !files.length;
  }

  /** Reorder by dragging, because merge order matters. */
  var dragFrom = null;
  el.files.addEventListener('dragstart', function (e) {
    var li = e.target.closest('li');
    if (!li) return;
    dragFrom = Number(li.dataset.i);
    li.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });
  el.files.addEventListener('dragend', function (e) {
    var li = e.target.closest('li');
    if (li) li.classList.remove('dragging');
  });
  el.files.addEventListener('dragover', function (e) { e.preventDefault(); });
  el.files.addEventListener('drop', function (e) {
    e.preventDefault();
    var li = e.target.closest('li');
    if (!li || dragFrom === null) return;
    var to = Number(li.dataset.i);
    var moved = files.splice(dragFrom, 1)[0];
    files.splice(to, 0, moved);
    dragFrom = null;
    renderFiles();
  });

  /** Some ops can read the file and fill their own fields in. */
  function prefill() {
    if (!current.inspect || !files.length) return;
    current.inspect(files[0]).then(function (values) {
      Object.keys(values || {}).forEach(function (k) {
        var input = document.getElementById('opt-' + k);
        if (input && !input.value) input.value = values[k];
      });
    }).catch(function () {});
  }

  el.drop.addEventListener('click', function () { el.picker.click(); });
  el.drop.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.picker.click(); }
  });
  el.picker.addEventListener('change', function () {
    if (el.picker.files.length) addFiles(el.picker.files);
    el.picker.value = '';
  });
  ['dragenter', 'dragover'].forEach(function (t) {
    el.drop.addEventListener(t, function (e) {
      e.preventDefault();
      el.drop.classList.add('hot');
    });
  });
  ['dragleave', 'drop'].forEach(function (t) {
    el.drop.addEventListener(t, function () { el.drop.classList.remove('hot'); });
  });
  el.drop.addEventListener('drop', function (e) {
    e.preventDefault();
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  });
  // Dropping anywhere else should not navigate away from the page.
  window.addEventListener('dragover', function (e) { e.preventDefault(); });
  window.addEventListener('drop', function (e) { e.preventDefault(); });

  // ---- running ------------------------------------------------------------

  function setState(text, kind) {
    el.state.textContent = text;
    el.state.className = 'state' + (kind ? ' ' + kind : '');
  }

  function log(line) {
    el.log.hidden = false;
    el.log.textContent += line + '\n';
    el.log.scrollTop = el.log.scrollHeight;
  }

  el.run.addEventListener('click', async function () {
    if (!current || !files.length) return;
    el.run.disabled = true;
    el.results.hidden = true;
    el.log.textContent = '';
    el.log.hidden = true;
    made = [];
    setState('Working\u2026');

    var started = performance.now();
    try {
      var out = await current.run({ files: files, options: readOptions(), log: log });
      made = out || [];
      showResults();
      var secs = ((performance.now() - started) / 1000).toFixed(1);
      setState('Done in ' + secs + 's \u2014 ' + made.length + ' file(s)', 'good');
    } catch (err) {
      console.error(err);
      setState(err && err.message ? err.message : String(err), 'bad');
      log('Failed: ' + (err && err.message ? err.message : err));
    } finally {
      el.run.disabled = !files.length;
    }
  });

  function showResults() {
    el.resultList.textContent = '';
    if (!made.length) { el.results.hidden = true; return; }
    made.forEach(function (r) {
      var li = document.createElement('li');
      var name = document.createElement('span');
      name.className = 'rname';
      name.textContent = r.name;
      var size = document.createElement('span');
      size.className = 'rsize';
      size.textContent = human(r.blob.size);
      var a = document.createElement('a');
      a.className = 'save';
      a.textContent = 'Save';
      a.href = URL.createObjectURL(r.blob);
      a.download = r.name;
      li.appendChild(name);
      li.appendChild(size);
      li.appendChild(a);
      el.resultList.appendChild(li);
    });
    el.saveAll.hidden = made.length < 2;
    el.results.hidden = false;
  }

  el.saveAll.addEventListener('click', function () {
    made.forEach(function (r, i) {
      setTimeout(function () {
        var a = document.createElement('a');
        a.href = URL.createObjectURL(r.blob);
        a.download = r.name;
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
      }, i * 220);   // browsers throttle rapid-fire downloads
    });
  });

  // ---- go ------------------------------------------------------------------

  buildSidebar();
  var wanted = location.hash.replace('#', '');
  if (wanted && RKDocTools.byId(wanted)) choose(wanted);
})();
