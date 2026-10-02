/* Shell mínimo para reutilizar el calendario (utils.js) */

function esc(s) {
  if (typeof s !== 'string') return s;
  var d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

async function apiErrorMessage(response) {
  var text = await response.text();
  try {
    var data = JSON.parse(text);
    var detail = data && data.detail;
    if (typeof detail === 'string' && detail) return detail;
    if (Array.isArray(detail) && detail.length) {
      return detail.map(function (item) {
        return (item && (item.msg || item.detail)) || String(item);
      }).join('; ');
    }
  } catch (_) { /* no JSON */ }
  return text || response.statusText || 'Error de red';
}

var API = {
  async get(url) {
    var r = await fetch(url);
    if (!r.ok) throw new Error(await apiErrorMessage(r));
    return r.json();
  },
  async post(url, data) {
    var r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data || {}),
    });
    if (!r.ok) throw new Error(await apiErrorMessage(r));
    return r.json();
  },
  async put(url, data) {
    var r = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data || {}),
    });
    if (!r.ok) throw new Error(await apiErrorMessage(r));
    return r.json();
  },
  async del(url) {
    var r = await fetch(url, { method: 'DELETE' });
    if (!r.ok) throw new Error(await apiErrorMessage(r));
    return r.json();
  },
};

var DIALOG_FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
var dialogStack = [];

function dialogVisible(el) {
  return !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
}

function dialogFocusables(root) {
  if (!root) return [];
  return Array.prototype.filter.call(root.querySelectorAll(DIALOG_FOCUSABLE), dialogVisible);
}

function dialogBox(overlay) {
  if (!overlay) return null;
  return (
    overlay.querySelector('[role="dialog"]') ||
    overlay.querySelector('.modal, .cal-modal-card') ||
    overlay
  );
}

var ITDialog = {
  bind: function (overlay, opts) {
    opts = opts || {};
    if (!overlay || overlay._itDialogBound) return;
    overlay._itDialogBound = true;
    overlay._itDialogOpts = opts;
    dialogStack.push(overlay);
    var box = dialogBox(overlay);
    var prev = document.activeElement;
    overlay._itDialogPrevFocus = prev;
    function onKey(e) {
      if (ITDialog.top() !== overlay) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        if (typeof opts.onEscape === 'function') opts.onEscape();
        return;
      }
      if (e.key !== 'Tab') return;
      var nodes = dialogFocusables(box || overlay);
      if (!nodes.length) return;
      var first = nodes[0];
      var last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    overlay._itDialogKey = onKey;
    document.addEventListener('keydown', onKey, true);
    setTimeout(function () {
      var nodes = dialogFocusables(box || overlay);
      if (nodes[0]) nodes[0].focus();
      else if (box && box.focus) box.focus();
    }, 0);
  },
  unbind: function (overlay) {
    if (!overlay || !overlay._itDialogBound) return;
    document.removeEventListener('keydown', overlay._itDialogKey, true);
    overlay._itDialogBound = false;
    dialogStack = dialogStack.filter(function (el) { return el !== overlay; });
    var prev = overlay._itDialogPrevFocus;
    if (prev && typeof prev.focus === 'function') {
      try { prev.focus(); } catch (_) { /* ignore */ }
    }
  },
  top: function () {
    return dialogStack.length ? dialogStack[dialogStack.length - 1] : null;
  },
};
window.ITDialog = ITDialog;

var TOAST_ICONS = {
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M20 6 9 17l-5-5"/></svg>',
  alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v5h1"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="m6 6 12 12M18 6 6 18"/></svg>',
};

function showToast(title, detailOrType) {
  var region = document.getElementById('toast-region');
  if (!region) return;
  var kind = 'success';
  if (detailOrType === 'error') kind = 'error';
  else if (detailOrType === 'info') kind = 'info';
  var toast = document.createElement('div');
  toast.className = 'toast toast-' + kind;
  toast.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  toast.innerHTML =
    '<span class="toast-icon">' + (kind === 'error' ? TOAST_ICONS.alert : kind === 'info' ? TOAST_ICONS.info : TOAST_ICONS.check) + '</span>' +
    '<span class="toast-body"><strong>' + esc(title) + '</strong></span>' +
    '<button type="button" class="toast-close" aria-label="Cerrar">' + TOAST_ICONS.close + '</button>';

  function remove() {
    var gsap = window.gsap;
    var reduce =
      (window.ITMotion && ITMotion.reduced && ITMotion.reduced()) ||
      (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (!gsap || reduce) {
      if (toast.parentNode) toast.remove();
      return;
    }
    gsap.to(toast, {
      autoAlpha: 0,
      y: kind === 'error' ? 8 : -8,
      duration: 0.22,
      ease: 'power1.in',
      onComplete: function () {
        if (toast.parentNode) toast.remove();
      },
    });
  }

  toast.querySelector('.toast-close').addEventListener('click', remove);
  region.appendChild(toast);

  var gsap = window.gsap;
  var reduce =
    (window.ITMotion && ITMotion.reduced && ITMotion.reduced()) ||
    (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  if (gsap && !reduce) {
    if (kind === 'error') {
      gsap.fromTo(
        toast,
        { autoAlpha: 0, x: 18, y: -4 },
        { autoAlpha: 1, x: 0, y: 0, duration: 0.32, ease: 'power2.out' }
      );
      gsap.timeline({ delay: 0.28 })
        .to(toast, { x: -7, duration: 0.05 })
        .to(toast, { x: 7, duration: 0.05 })
        .to(toast, { x: -5, duration: 0.05 })
        .to(toast, { x: 5, duration: 0.05 })
        .to(toast, { x: 0, duration: 0.08, clearProps: 'x' });
    } else {
      gsap.fromTo(
        toast,
        { autoAlpha: 0, y: -16, scale: 0.94 },
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: 0.42,
          ease: 'back.out(1.6)',
        }
      );
      var icon = toast.querySelector('.toast-icon');
      if (icon) {
        gsap.fromTo(
          icon,
          { scale: 0.5, rotation: -20 },
          { scale: 1, rotation: 0, duration: 0.45, ease: 'back.out(2)', delay: 0.05 }
        );
      }
    }
  }

  setTimeout(remove, kind === 'error' ? 4200 : 3400);
}

function shakeModal() {
  var overlay = document.getElementById('modalOverlay');
  var box = overlay && overlay.querySelector('.modal');
  var gsap = window.gsap;
  if (!box || !gsap) return;
  var reduce =
    (window.ITMotion && ITMotion.reduced && ITMotion.reduced()) ||
    (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  if (reduce) return;
  gsap.killTweensOf(box);
  gsap
    .timeline({
      onComplete: function () {
        gsap.set(box, { clearProps: 'transform' });
      },
    })
    .to(box, { x: -10, duration: 0.05 })
    .to(box, { x: 10, duration: 0.05 })
    .to(box, { x: -8, duration: 0.05 })
    .to(box, { x: 8, duration: 0.05 })
    .to(box, { x: -4, duration: 0.05 })
    .to(box, { x: 0, duration: 0.08 });
}

function openModal(title, bodyHtml, footerHtml, options) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = bodyHtml;
  document.getElementById('modalFooter').innerHTML = footerHtml || '';
  var overlay = document.getElementById('modalOverlay');
  var opts = options || {};
  overlay.dataset.closeOnBackdrop = opts.closeOnBackdrop === false ? '0' : '1';
  overlay.classList.toggle('is-wide', !!opts.wide);
  var wasActive = overlay.classList.contains('active');
  var wasClosing = !!overlay._closing;
  overlay._closing = false;
  overlay.classList.add('active');
  if ((!wasActive || wasClosing) && window.ITMotion && ITMotion.openOverlay) {
    ITMotion.openOverlay(overlay);
  }
  ITDialog.bind(overlay, {
    onEscape: function () {
      if (overlay.dataset.closeOnBackdrop === '0') return;
      closeModal();
    },
  });
}

function closeModal(done) {
  var overlay = document.getElementById('modalOverlay');
  if (!overlay || !overlay.classList.contains('active')) {
    if (typeof done === 'function') done();
    return;
  }
  var pending = overlay._confirmFinish;
  overlay._confirmFinish = null;
  function finish() {
    overlay.classList.remove('active');
    overlay.classList.remove('is-wide');
    overlay._closing = false;
    ITDialog.unbind(overlay);
    if (typeof pending === 'function') pending(false);
    if (typeof done === 'function') done();
  }
  overlay._closing = true;
  if (window.ITMotion && ITMotion.closeOverlay) {
    ITMotion.closeOverlay(overlay, finish);
  } else {
    finish();
  }
}

function confirmModal(message) {
  return new Promise(function (resolve) {
    var overlay = document.getElementById('modalOverlay');
    var settled = false;
    function settle(ok) {
      if (settled) return;
      settled = true;
      if (overlay) overlay._confirmFinish = null;
      closeModal();
      resolve(!!ok);
    }
    if (overlay) overlay._confirmFinish = settle;
    openModal(
      'Confirmar',
      '<p>' + esc(message) + '</p>',
      '<button type="button" class="btn btn-ghost" id="cfmNo">Cancelar</button>' +
        '<button type="button" class="btn btn-primary" id="cfmYes">Aceptar</button>'
    );
    document.getElementById('cfmNo').addEventListener('click', function () { settle(false); });
    document.getElementById('cfmYes').addEventListener('click', function () { settle(true); });
  });
}

window.API = API;
window.showToast = showToast;
window.shakeModal = shakeModal;
window.openModal = openModal;
window.closeModal = closeModal;
window.confirmModal = confirmModal;
window.esc = esc;

async function bootCalStandalone() {
  try {
    var status = await API.get('/api/setup/status');
    if (!status.configured) {
      document.getElementById('setupRoot').hidden = false;
      document.getElementById('appRoot').hidden = true;
      if (window.renderSetupWizard) window.renderSetupWizard(status);
      return;
    }
    document.getElementById('setupRoot').hidden = true;
    document.getElementById('appRoot').hidden = false;
    var brand = document.getElementById('calBrandApp');
    var center = (status.centerName || '').trim();
    if (brand) {
      brand.textContent = center ? (center + ' · IT Calendario') : 'IT Calendario';
    }
    if (center) {
      document.title = center + ' · IT Calendario | Inditex';
    }
    var sub = document.getElementById('calTopbarSub');
    if (sub) {
      sub.textContent = 'Guardias · Turnos · Vacaciones';
    }
    var verEl = document.getElementById('calVersionLabel');
    if (verEl) {
      var label = (status.versionLabel || '').trim();
      if (label) verEl.textContent = 'v' + label;
      else if (status.version) verEl.textContent = 'v' + status.version;
    }
    var page = document.getElementById('page-calendario');
    if (typeof window.loadCalendario === 'function') {
      await window.loadCalendario(page);
    } else {
      page.innerHTML = '<p class="cal-hint">No se pudo cargar el módulo de calendario.</p>';
    }
    var adminBtn = document.getElementById('btnAdminUnlock');
    if (adminBtn) {
      adminBtn.addEventListener('click', function () {
        if (typeof window.openCalAdminSettings === 'function') {
          window.openCalAdminSettings();
        } else {
          showToast('Panel de administración no disponible', 'error');
        }
      });
    }
    API.post('/api/session/keepalive', {}).catch(function () {});
  } catch (e) {
    document.body.innerHTML =
      '<div class="cal-boot-error"><h1>IT Calendario</h1><p>' +
      esc(e.message || 'Error al iniciar') +
      '</p></div>';
  }
}

window.bootCalStandalone = bootCalStandalone;
