/* Ruckus — the treat jar.
 * A small tin in the corner. Drag a treat out of it and drop it on the pet. */
(function (global) {
  'use strict';

  function createJar(o) {
    var root = o.root;
    var jar = document.createElement('div');
    jar.className = 'jar';
    jar.setAttribute('role', 'button');
    jar.setAttribute('tabindex', '0');

    var lid = document.createElement('div');
    lid.className = 'jar-lid';
    var count = document.createElement('span');
    count.className = 'jar-count';
    var label = document.createElement('span');
    label.className = 'jar-label';
    label.textContent = 'treats';

    jar.appendChild(lid);
    jar.appendChild(count);
    jar.appendChild(label);
    root.appendChild(jar);

    var treats = 0;
    var dragging = null;

    function setTreats(n) {
      treats = n | 0;
      count.textContent = String(treats);
      jar.classList.toggle('empty', treats <= 0);
      jar.title = treats > 0
        ? 'Drag a treat onto the pet'
        : 'Empty. Search a few pages to earn more.';
    }

    function overPet(x, y) {
      var p = o.pet;
      if (!p || !p.visible) return false;
      var pad = 14;
      return x > p.x - pad && x < p.x + p.size + pad &&
             y > p.y - pad && y < p.y + p.size + pad;
    }

    function startDrag(e) {
      if (treats <= 0) {
        o.onEmpty && o.onEmpty();
        return;
      }
      e.preventDefault();
      var pellet = document.createElement('div');
      pellet.className = 'treat';
      root.appendChild(pellet);
      dragging = { el: pellet, id: e.pointerId };
      move(e);
      jar.classList.add('open');
      try { jar.setPointerCapture(e.pointerId); } catch (_) {}
    }

    function move(e) {
      if (!dragging) return;
      dragging.el.style.left = (e.clientX - 9) + 'px';
      dragging.el.style.top = (e.clientY - 9) + 'px';
      var hot = overPet(e.clientX, e.clientY);
      dragging.el.classList.toggle('hot', hot);
      if (o.pet && o.pet.setHungryEyes) o.pet.setHungryEyes(hot);
    }

    function end(e) {
      if (!dragging) return;
      var hit = overPet(e.clientX, e.clientY);
      var pellet = dragging.el;
      dragging = null;
      jar.classList.remove('open');
      try { jar.releasePointerCapture(e.pointerId); } catch (_) {}
      if (o.pet && o.pet.setHungryEyes) o.pet.setHungryEyes(false);

      if (hit) {
        pellet.classList.add('eaten');
        o.onFeed && o.onFeed();
      } else {
        pellet.classList.add('dropped');
      }
      setTimeout(function () { pellet.remove(); }, 320);
    }

    // Reaching for the jar at all is worth reacting to.
    var lastReach = 0;
    function reached() {
      var now = Date.now();
      if (now - lastReach < 2500) return;
      lastReach = now;
      jar.classList.add('reached');
      setTimeout(function () { jar.classList.remove('reached'); }, 600);
      if (o.onReach) o.onReach(jar.getBoundingClientRect());
    }
    jar.addEventListener('pointerenter', reached);
    jar.addEventListener('focus', reached);

    jar.addEventListener('pointerdown', startDrag);
    jar.addEventListener('pointermove', move);
    jar.addEventListener('pointerup', end);
    jar.addEventListener('pointercancel', end);
    jar.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (treats > 0) o.onFeed && o.onFeed();
        else o.onEmpty && o.onEmpty();
      }
    });

    return {
      rect: function () { return jar.getBoundingClientRect(); },
      /** The pet just headbutted us. */
      wobble: function () {
        jar.classList.remove('wobble');
        void jar.offsetWidth;              // restart the animation
        jar.classList.add('wobble');
        setTimeout(function () { jar.classList.remove('wobble'); }, 500);
      },
      setNear: function (on) { jar.classList.toggle('near', !!on); },
      setTreats: setTreats,
      setVisible: function (on) { jar.classList.toggle('hidden', !on); },
      destroy: function () { jar.remove(); }
    };
  }

  global.RKTreats = { create: createJar };
})(typeof globalThis !== 'undefined' ? globalThis : window);
