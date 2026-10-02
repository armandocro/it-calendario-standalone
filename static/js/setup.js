/* Asistente de configuración inicial del Calendario standalone */

(function () {
  var state = {
    step: 0,
    centerName: '',
    dataRoot: '',
    sessionUser: '',
    adminLogin: '',
    adminName: '',
    adminPassword: '',
    adminPassword2: '',
    people: [],
    shiftTypes: [],
    personShifts: {},
    dutyLogins: [],
    dutyAnchorMonday: '2026-10-05',
  };

  var COLORS = ['#B45309', '#1D4ED8', '#047857', '#7C3AED', '#0F766E', '#BE123C'];

  function esc(s) {
    return window.esc ? window.esc(String(s == null ? '' : s)) : String(s == null ? '' : s);
  }

  function defaultShifts() {
    return [
      { id: 'manana', label: 'Mañana', start: '06:00', end: '14:00' },
      { id: 'partido', label: 'Partido', start: '09:30', end: '18:30' },
      { id: 'tarde', label: 'Tarde', start: '10:00', end: '17:00' },
    ];
  }

  function ensureShiftTypes() {
    if (!state.shiftTypes.length) {
      state.shiftTypes = defaultShifts();
    }
  }

  function slugifyShiftId(label, index) {
    var base = String(label || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    if (!base) base = 'turno-' + (index + 1);
    var id = base;
    var n = 2;
    var existing = state.shiftTypes.map(function (t, i) {
      return i === index ? '' : t.id;
    });
    while (existing.indexOf(id) >= 0) {
      id = base + '-' + n;
      n += 1;
    }
    return id.slice(0, 40);
  }

  function nextMondayIso(fromIso) {
    var d = fromIso ? new Date(fromIso + 'T00:00:00') : new Date();
    if (isNaN(d.getTime())) d = new Date();
    var day = d.getDay();
    var add = day === 1 ? 0 : (day === 0 ? 1 : 8 - day);
    d.setDate(d.getDate() + add);
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var dayNum = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + dayNum;
  }

  function personByLogin(login) {
    var key = String(login || '').toLowerCase();
    for (var i = 0; i < state.people.length; i++) {
      if (String(state.people[i].login || '').toLowerCase() === key) return state.people[i];
    }
    return null;
  }

  function ensureDutyRotation() {
    if (!state.dutyAnchorMonday) {
      state.dutyAnchorMonday = nextMondayIso('2026-10-05');
    }
    var valid = {};
    state.people.forEach(function (p) {
      if (p.login) valid[p.login] = true;
    });
    var kept = (state.dutyLogins || []).filter(function (login) {
      return valid[login];
    });
    if (!kept.length) {
      kept = state.people.map(function (p) {
        return p.login;
      }).filter(Boolean);
    }
    state.dutyLogins = kept;
  }

  function dutyPreviewHtml() {
    ensureDutyRotation();
    if (!state.dutyLogins.length) return 'Añade al menos una persona a la rotación.';
    var parts = [];
    var anchor = state.dutyAnchorMonday || nextMondayIso();
    for (var i = 0; i < Math.min(4, Math.max(4, state.dutyLogins.length)); i++) {
      var login = state.dutyLogins[i % state.dutyLogins.length];
      var person = personByLogin(login);
      var d = new Date(anchor + 'T00:00:00');
      d.setDate(d.getDate() + i * 7);
      var end = new Date(d);
      end.setDate(end.getDate() + 6);
      function fmt(dt) {
        return String(dt.getDate()).padStart(2, '0') + '/' + String(dt.getMonth() + 1).padStart(2, '0');
      }
      parts.push(fmt(d) + '–' + fmt(end) + ': ' + ((person && person.name) || login));
    }
    return 'Próximas semanas: ' + parts.join(' · ') + '.';
  }

  function stepsHtml() {
    var labels = [
      'Centro y datos',
      'Administrador',
      'Equipo',
      'Definir turnos',
      'Asignar turnos',
      'Guardias',
      'Confirmar',
    ];
    return (
      '<ol class="cal-setup-steps">' +
      labels
        .map(function (label, i) {
          var cls = i === state.step ? 'is-current' : i < state.step ? 'is-done' : '';
          return '<li class="' + cls + '"><span>' + (i + 1) + '</span> ' + esc(label) + '</li>';
        })
        .join('') +
      '</ol>'
    );
  }

  function colorCellHtml(color, index) {
    var value = color || COLORS[index % COLORS.length];
    var swatches = COLORS.map(function (c) {
      return (
        '<button type="button" class="setup-color-swatch' +
        (c.toLowerCase() === String(value).toLowerCase() ? ' is-selected' : '') +
        '" data-color="' +
        esc(c) +
        '" style="background:' +
        esc(c) +
        '" title="' +
        esc(c) +
        '" aria-label="Color ' +
        esc(c) +
        '"></button>'
      );
    }).join('');
    return (
      '<div class="setup-color-picker">' +
      '<label class="setup-color-input-wrap" title="Elegir color">' +
      '<input type="color" class="setup-p-color" value="' +
      esc(value) +
      '" aria-label="Color del usuario">' +
      '<span class="setup-color-preview" style="background:' +
      esc(value) +
      '"></span>' +
      '</label>' +
      '<div class="setup-color-swatches" role="group" aria-label="Colores sugeridos">' +
      swatches +
      '</div></div>'
    );
  }

  function renderStepBody() {
    if (state.step === 0) {
      return (
        '<h2>Centro y datos</h2>' +
        '<p class="cal-hint">El nombre del centro se muestra en la esquina de la aplicación (como IT.CAB · IT Calendario).</p>' +
        '<div class="form-group"><label for="setupCenterName">Nombre del centro *</label>' +
        '<input type="text" id="setupCenterName" maxlength="80" value="' +
        esc(state.centerName) +
        '" placeholder="Ej. IT.CAB, Cabanillas, Arteixo..."></div>' +
        '<p class="cal-hint">Elige una carpeta compartida (por ejemplo en G:\\ o UNC) accesible por todo el equipo. ' +
        'Ahí se crearán las carpetas <code>calendario</code> y <code>sistema</code>.</p>' +
        '<div class="form-group"><label for="setupDataRoot">Ruta de datos *</label>' +
        '<input type="text" id="setupDataRoot" value="' +
        esc(state.dataRoot) +
        '" placeholder="G:\\Comun\\...\\calendario-data"></div>' +
        '<button type="button" class="btn btn-secondary" id="setupProbe">Comprobar escritura</button>' +
        '<p class="cal-hint" id="setupProbeMsg"></p>'
      );
    }
    if (state.step === 1) {
      return (
        '<h2>Administrador</h2>' +
        '<p class="cal-hint">Login Windows del administrador y contraseña para cambios de configuración.</p>' +
        '<div class="cal-form-row">' +
        '<div class="form-group"><label for="setupAdminLogin">Login Windows *</label>' +
        '<input type="text" id="setupAdminLogin" value="' +
        esc(state.adminLogin) +
        '"></div>' +
        '<div class="form-group"><label for="setupAdminName">Nombre *</label>' +
        '<input type="text" id="setupAdminName" value="' +
        esc(state.adminName) +
        '"></div></div>' +
        '<div class="cal-form-row">' +
        '<div class="form-group"><label for="setupAdminPwd">Contraseña *</label>' +
        '<input type="password" id="setupAdminPwd" value="' +
        esc(state.adminPassword) +
        '" autocomplete="new-password"></div>' +
        '<div class="form-group"><label for="setupAdminPwd2">Repetir contraseña *</label>' +
        '<input type="password" id="setupAdminPwd2" value="' +
        esc(state.adminPassword2) +
        '" autocomplete="new-password"></div></div>'
      );
    }
    if (state.step === 2) {
      var rows = state.people
        .map(function (p, i) {
          return (
            '<tr data-idx="' +
            i +
            '">' +
            '<td><input type="text" class="setup-p-login" value="' +
            esc(p.login) +
            '" placeholder="login"></td>' +
            '<td><input type="text" class="setup-p-name" value="' +
            esc(p.name) +
            '" placeholder="Nombre"></td>' +
            '<td><input type="number" class="setup-p-vac" min="0" max="60" value="' +
            esc(String(p.vacationDays || 22)) +
            '"></td>' +
            '<td>' +
            colorCellHtml(p.color, i) +
            '</td>' +
            '<td><button type="button" class="btn btn-ghost setup-p-del">Quitar</button></td>' +
            '</tr>'
          );
        })
        .join('');
      return (
        '<h2>Miembros del equipo</h2>' +
        '<p class="cal-hint">Login Windows, nombre visible, días de vacaciones del periodo y color en el calendario.</p>' +
        '<div class="cal-setup-table-wrap"><table class="cal-setup-table cal-setup-table--people">' +
        '<thead><tr><th>Login</th><th>Nombre</th><th>Vac.</th><th>Color</th><th></th></tr></thead>' +
        '<tbody id="setupPeopleBody">' +
        rows +
        '</tbody></table></div>' +
        '<button type="button" class="btn btn-secondary" id="setupAddPerson">+ Añadir persona</button>'
      );
    }
    if (state.step === 3) {
      ensureShiftTypes();
      var shiftRows = state.shiftTypes
        .map(function (t, i) {
          return (
            '<tr data-idx="' +
            i +
            '">' +
            '<td><input type="text" class="setup-t-label" maxlength="60" value="' +
            esc(t.label) +
            '" placeholder="Nombre del turno"></td>' +
            '<td><input type="time" class="setup-t-start" value="' +
            esc(t.start || '06:00') +
            '"></td>' +
            '<td><input type="time" class="setup-t-end" value="' +
            esc(t.end || '14:00') +
            '"></td>' +
            '<td><button type="button" class="btn btn-ghost setup-t-del">Quitar</button></td>' +
            '</tr>'
          );
        })
        .join('');
      return (
        '<h2>Definir turnos</h2>' +
        '<p class="cal-hint">Define los turnos del centro (nombre y horario). Por defecto: Mañana, Partido y Tarde. ' +
        'Después asignarás uno a cada persona.</p>' +
        '<div class="cal-setup-table-wrap"><table class="cal-setup-table">' +
        '<thead><tr><th>Nombre</th><th>Inicio</th><th>Fin</th><th></th></tr></thead>' +
        '<tbody id="setupShiftTypesBody">' +
        shiftRows +
        '</tbody></table></div>' +
        '<button type="button" class="btn btn-secondary" id="setupAddShift">+ Añadir turno</button>'
      );
    }
    if (state.step === 4) {
      ensureShiftTypes();
      var assignRows = state.people
        .map(function (p) {
          var firstId = (state.shiftTypes[0] && state.shiftTypes[0].id) || 'manana';
          var cfg = state.personShifts[p.login] || { mode: 'fixed', shiftId: firstId };
          var shiftOpts = state.shiftTypes
            .map(function (t) {
              return (
                '<option value="' +
                esc(t.id) +
                '"' +
                (t.id === (cfg.shiftId || firstId) ? ' selected' : '') +
                '>' +
                esc(t.label + ' ' + t.start + '–' + t.end) +
                '</option>'
              );
            })
            .join('');
          return (
            '<tr data-login="' +
            esc(p.login) +
            '">' +
            '<td><span class="setup-person-chip"><span class="setup-person-dot" style="background:' +
            esc(p.color || COLORS[0]) +
            '"></span>' +
            esc(p.name || p.login) +
            '</span></td>' +
            '<td><select class="setup-s-mode">' +
            '<option value="fixed"' +
            (cfg.mode === 'fixed' ? ' selected' : '') +
            '>Fijo</option>' +
            '<option value="rotating"' +
            (cfg.mode === 'rotating' ? ' selected' : '') +
            '>Rotativo</option>' +
            '</select></td>' +
            '<td><select class="setup-s-shift">' +
            shiftOpts +
            '</select></td>' +
            '</tr>'
          );
        })
        .join('');
      return (
        '<h2>Asignar turnos</h2>' +
        '<p class="cal-hint">Asigna a cada persona un turno fijo o rotativo usando los turnos definidos en el paso anterior.</p>' +
        '<div class="cal-setup-table-wrap"><table class="cal-setup-table">' +
        '<thead><tr><th>Persona</th><th>Modo</th><th>Turno</th></tr></thead>' +
        '<tbody id="setupShiftsBody">' +
        assignRows +
        '</tbody></table></div>'
      );
    }
    if (state.step === 5) {
      ensureDutyRotation();
      var dutyRows = state.dutyLogins
        .map(function (login, i) {
          var person = personByLogin(login) || { login: login, name: login, color: COLORS[0] };
          return (
            '<tr data-login="' +
            esc(login) +
            '">' +
            '<td class="setup-duty-idx">' +
            (i + 1) +
            '</td>' +
            '<td><span class="setup-person-chip"><span class="setup-person-dot" style="background:' +
            esc(person.color || COLORS[0]) +
            '"></span>' +
            esc(person.name || login) +
            '</span></td>' +
            '<td class="setup-duty-actions">' +
            '<button type="button" class="btn btn-ghost setup-duty-up" title="Subir">↑</button>' +
            '<button type="button" class="btn btn-ghost setup-duty-down" title="Bajar">↓</button>' +
            '<button type="button" class="btn btn-ghost setup-duty-del" title="Quitar">✕</button>' +
            '</td></tr>'
          );
        })
        .join('');
      var inDuty = {};
      state.dutyLogins.forEach(function (l) {
        inDuty[l] = true;
      });
      var extras = state.people.filter(function (p) {
        return p.login && !inDuty[p.login];
      });
      var extraOpts = extras
        .map(function (p) {
          return '<option value="' + esc(p.login) + '">' + esc(p.name || p.login) + '</option>';
        })
        .join('');
      return (
        '<h2>Rotación de guardias</h2>' +
        '<p class="cal-hint">Elige quién hace guardia y en qué orden (semanas Lun–Dom). ' +
        'La persona en la posición 1 cubre la primera semana a partir del lunes indicado.</p>' +
        '<div class="form-group"><label for="setupDutyAnchor">Primera semana automática (lunes) *</label>' +
        '<input type="date" id="setupDutyAnchor" value="' +
        esc(state.dutyAnchorMonday) +
        '"></div>' +
        '<div class="cal-setup-table-wrap"><table class="cal-setup-table">' +
        '<thead><tr><th>#</th><th>Persona</th><th>Orden</th></tr></thead>' +
        '<tbody id="setupDutyBody">' +
        dutyRows +
        '</tbody></table></div>' +
        '<div class="cal-form-row setup-duty-add-row">' +
        '<select id="setupDutyAddPerson"' +
        (extras.length ? '' : ' disabled') +
        '>' +
        (extraOpts || '<option value="">Todas están en la rotación</option>') +
        '</select>' +
        '<button type="button" class="btn btn-secondary" id="setupDutyAdd"' +
        (extras.length ? '' : ' disabled') +
        '>+ Añadir a la rotación</button></div>' +
        '<p class="cal-hint" id="setupDutyPreview">' +
        esc(dutyPreviewHtml()) +
        '</p>'
      );
    }
    var shiftSummary = state.shiftTypes
      .map(function (t) {
        return esc(t.label) + ' ' + esc(t.start) + '–' + esc(t.end);
      })
      .join(', ');
    var dutyNames = state.dutyLogins
      .map(function (login) {
        var p = personByLogin(login);
        return (p && p.name) || login;
      })
      .join(' → ');
    return (
      '<h2>Confirmar e instalar</h2>' +
      '<ul class="cal-setup-summary">' +
      '<li><strong>Centro:</strong> ' +
      esc(state.centerName) +
      '</li>' +
      '<li><strong>Ruta:</strong> ' +
      esc(state.dataRoot) +
      '</li>' +
      '<li><strong>Admin:</strong> ' +
      esc(state.adminName) +
      ' (' +
      esc(state.adminLogin) +
      ')</li>' +
      '<li><strong>Equipo:</strong> ' +
      state.people.length +
      ' personas</li>' +
      '<li><strong>Turnos:</strong> ' +
      (shiftSummary || '—') +
      '</li>' +
      '<li><strong>Guardias:</strong> ' +
      esc(dutyNames || '—') +
      ' (desde ' +
      esc(state.dutyAnchorMonday) +
      ')</li>' +
      '</ul>' +
      '<p class="cal-hint">Al guardar se crea la estructura compartida. El resto del equipo abrirá esta misma app y trabajará contra esos datos.</p>'
    );
  }

  function readPeopleFromDom() {
    var body = document.getElementById('setupPeopleBody');
    if (!body) return;
    var next = [];
    body.querySelectorAll('tr').forEach(function (tr, i) {
      var login = ((tr.querySelector('.setup-p-login') || {}).value || '').trim().toLowerCase();
      var name = ((tr.querySelector('.setup-p-name') || {}).value || '').trim();
      var vac = parseInt(((tr.querySelector('.setup-p-vac') || {}).value || '22'), 10);
      var color = ((tr.querySelector('.setup-p-color') || {}).value || COLORS[i % COLORS.length]);
      if (!login && !name) return;
      next.push({
        login: login,
        name: name,
        vacationDays: isNaN(vac) ? 22 : vac,
        color: color,
      });
    });
    state.people = next;
  }

  function readShiftTypesFromDom() {
    var body = document.getElementById('setupShiftTypesBody');
    if (!body) return;
    var next = [];
    body.querySelectorAll('tr').forEach(function (tr, i) {
      var label = ((tr.querySelector('.setup-t-label') || {}).value || '').trim();
      var start = ((tr.querySelector('.setup-t-start') || {}).value || '').trim();
      var end = ((tr.querySelector('.setup-t-end') || {}).value || '').trim();
      if (!label && !start && !end) return;
      var prev = state.shiftTypes[i] || {};
      var id = prev.id || slugifyShiftId(label, i);
      if (prev.label && label && prev.label !== label) {
        id = slugifyShiftId(label, i);
      }
      next.push({
        id: id,
        label: label || 'Turno ' + (i + 1),
        start: start || '06:00',
        end: end || '14:00',
      });
    });
    state.shiftTypes = next;
  }

  function readAssignmentsFromDom() {
    var body = document.getElementById('setupShiftsBody');
    if (!body) return;
    var firstId = (state.shiftTypes[0] && state.shiftTypes[0].id) || 'manana';
    body.querySelectorAll('tr').forEach(function (tr) {
      var login = tr.getAttribute('data-login');
      if (!login) return;
      var shiftId = ((tr.querySelector('.setup-s-shift') || {}).value || firstId);
      state.personShifts[login] = {
        login: login,
        mode: ((tr.querySelector('.setup-s-mode') || {}).value || 'fixed'),
        shiftId: shiftId,
        anchorDate: '2026-09-01',
        anchorShiftId: shiftId,
      };
    });
  }

  function collectStep() {
    if (state.step === 0) {
      state.centerName = ((document.getElementById('setupCenterName') || {}).value || '').trim();
      state.dataRoot = ((document.getElementById('setupDataRoot') || {}).value || '').trim();
    }
    if (state.step === 1) {
      state.adminLogin = ((document.getElementById('setupAdminLogin') || {}).value || '')
        .trim()
        .toLowerCase();
      state.adminName = ((document.getElementById('setupAdminName') || {}).value || '').trim();
      state.adminPassword = ((document.getElementById('setupAdminPwd') || {}).value || '');
      state.adminPassword2 = ((document.getElementById('setupAdminPwd2') || {}).value || '');
    }
    if (state.step === 2) readPeopleFromDom();
    if (state.step === 3) readShiftTypesFromDom();
    if (state.step === 4) readAssignmentsFromDom();
    if (state.step === 5) {
      var anchorEl = document.getElementById('setupDutyAnchor');
      if (anchorEl && anchorEl.value) {
        state.dutyAnchorMonday = nextMondayIso(anchorEl.value);
      }
    }
  }

  function validateTime(value) {
    return /^\d{2}:\d{2}$/.test(String(value || ''));
  }

  function validateStep() {
    collectStep();
    if (state.step === 0) {
      if (!state.centerName) return 'Indica el nombre del centro';
      if (!state.dataRoot) return 'Indica la ruta de datos';
    }
    if (state.step === 1) {
      if (!state.adminLogin) return 'Indica el login del administrador';
      if (!state.adminName) return 'Indica el nombre del administrador';
      if (state.adminPassword.length < 6) return 'La contraseña debe tener al menos 6 caracteres';
      if (state.adminPassword !== state.adminPassword2) return 'Las contraseñas no coinciden';
    }
    if (state.step === 2) {
      if (!state.people.length) return 'Añade al menos un miembro';
      for (var i = 0; i < state.people.length; i++) {
        if (!state.people[i].login || !state.people[i].name) {
          return 'Cada persona necesita login y nombre';
        }
      }
      var adminInTeam = state.people.some(function (p) {
        return p.login === state.adminLogin;
      });
      if (!adminInTeam) {
        state.people.unshift({
          login: state.adminLogin,
          name: state.adminName,
          vacationDays: 22,
          color: COLORS[0],
        });
      }
    }
    if (state.step === 3) {
      if (!state.shiftTypes.length) return 'Define al menos un turno';
      for (var s = 0; s < state.shiftTypes.length; s++) {
        var t = state.shiftTypes[s];
        if (!t.label) return 'Cada turno necesita un nombre';
        if (!validateTime(t.start) || !validateTime(t.end)) {
          return 'Revisa los horarios del turno «' + (t.label || '') + '»';
        }
        if (t.start >= t.end) {
          return 'En «' + t.label + '» la hora de fin debe ser posterior al inicio';
        }
      }
    }
    if (state.step === 4) {
      if (!state.people.length) return 'No hay personas para asignar turnos';
      if (!state.shiftTypes.length) return 'No hay turnos definidos';
    }
    if (state.step === 5) {
      ensureDutyRotation();
      if (!state.dutyLogins.length) return 'Añade al menos una persona a la rotación de guardias';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(state.dutyAnchorMonday || '')) {
        return 'Indica el lunes de inicio de la rotación';
      }
    }
    return '';
  }

  function bindStep() {
    var probe = document.getElementById('setupProbe');
    if (probe) {
      probe.addEventListener('click', async function () {
        collectStep();
        var msg = document.getElementById('setupProbeMsg');
        try {
          var res = await API.post('/api/setup/probe', { dataRoot: state.dataRoot });
          state.dataRoot = res.dataRoot || state.dataRoot;
          if (msg) msg.textContent = 'Ruta válida y con permiso de escritura.';
          showToast('Ruta correcta');
        } catch (e) {
          if (msg) msg.textContent = e.message || 'No se pudo escribir';
          showToast(e.message || 'Error', 'error');
        }
      });
    }
    var addBtn = document.getElementById('setupAddPerson');
    if (addBtn) {
      addBtn.addEventListener('click', function () {
        readPeopleFromDom();
        state.people.push({
          login: '',
          name: '',
          vacationDays: 22,
          color: COLORS[state.people.length % COLORS.length],
        });
        paint();
      });
    }
    document.querySelectorAll('.setup-p-del').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var tr = btn.closest('tr');
        var idx = tr ? parseInt(tr.getAttribute('data-idx'), 10) : -1;
        readPeopleFromDom();
        if (idx >= 0) state.people.splice(idx, 1);
        paint();
      });
    });
    document.querySelectorAll('.setup-p-color').forEach(function (input) {
      input.addEventListener('input', function () {
        var wrap = input.closest('.setup-color-picker');
        var preview = wrap && wrap.querySelector('.setup-color-preview');
        if (preview) preview.style.background = input.value;
        if (wrap) {
          wrap.querySelectorAll('.setup-color-swatch').forEach(function (sw) {
            sw.classList.toggle(
              'is-selected',
              sw.getAttribute('data-color').toLowerCase() === input.value.toLowerCase()
            );
          });
        }
      });
    });
    document.querySelectorAll('.setup-color-swatch').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var color = btn.getAttribute('data-color') || COLORS[0];
        var wrap = btn.closest('.setup-color-picker');
        var input = wrap && wrap.querySelector('.setup-p-color');
        var preview = wrap && wrap.querySelector('.setup-color-preview');
        if (input) input.value = color;
        if (preview) preview.style.background = color;
        if (wrap) {
          wrap.querySelectorAll('.setup-color-swatch').forEach(function (sw) {
            sw.classList.toggle('is-selected', sw === btn);
          });
        }
      });
    });
    var addShift = document.getElementById('setupAddShift');
    if (addShift) {
      addShift.addEventListener('click', function () {
        readShiftTypesFromDom();
        var n = state.shiftTypes.length + 1;
        state.shiftTypes.push({
          id: 'turno-' + n,
          label: 'Turno ' + n,
          start: '08:00',
          end: '16:00',
        });
        paint();
      });
    }
    document.querySelectorAll('.setup-t-del').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var tr = btn.closest('tr');
        var idx = tr ? parseInt(tr.getAttribute('data-idx'), 10) : -1;
        readShiftTypesFromDom();
        if (state.shiftTypes.length <= 1) {
          showToast('Debe quedar al menos un turno', 'error');
          return;
        }
        if (idx >= 0) state.shiftTypes.splice(idx, 1);
        paint();
      });
    });
    var dutyAnchor = document.getElementById('setupDutyAnchor');
    if (dutyAnchor) {
      dutyAnchor.addEventListener('change', function () {
        state.dutyAnchorMonday = nextMondayIso(dutyAnchor.value);
        dutyAnchor.value = state.dutyAnchorMonday;
        var preview = document.getElementById('setupDutyPreview');
        if (preview) preview.textContent = dutyPreviewHtml();
      });
    }
    document.querySelectorAll('.setup-duty-up').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var tr = btn.closest('tr');
        var login = tr && tr.getAttribute('data-login');
        var idx = state.dutyLogins.indexOf(login);
        if (idx > 0) {
          var tmp = state.dutyLogins[idx - 1];
          state.dutyLogins[idx - 1] = state.dutyLogins[idx];
          state.dutyLogins[idx] = tmp;
          paint();
        }
      });
    });
    document.querySelectorAll('.setup-duty-down').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var tr = btn.closest('tr');
        var login = tr && tr.getAttribute('data-login');
        var idx = state.dutyLogins.indexOf(login);
        if (idx >= 0 && idx < state.dutyLogins.length - 1) {
          var tmp = state.dutyLogins[idx + 1];
          state.dutyLogins[idx + 1] = state.dutyLogins[idx];
          state.dutyLogins[idx] = tmp;
          paint();
        }
      });
    });
    document.querySelectorAll('.setup-duty-del').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var tr = btn.closest('tr');
        var login = tr && tr.getAttribute('data-login');
        if (state.dutyLogins.length <= 1) {
          showToast('Debe quedar al menos una persona en la rotación', 'error');
          return;
        }
        state.dutyLogins = state.dutyLogins.filter(function (l) {
          return l !== login;
        });
        paint();
      });
    });
    var dutyAdd = document.getElementById('setupDutyAdd');
    if (dutyAdd) {
      dutyAdd.addEventListener('click', function () {
        var sel = document.getElementById('setupDutyAddPerson');
        var login = sel && sel.value;
        if (!login) return;
        if (state.dutyLogins.indexOf(login) < 0) {
          state.dutyLogins.push(login);
          paint();
        }
      });
    }
  }

  async function finish() {
    collectStep();
    var err = validateStep();
    if (err) {
      showToast(err, 'error');
      return;
    }
    ensureShiftTypes();
    ensureDutyRotation();
    var firstId = (state.shiftTypes[0] && state.shiftTypes[0].id) || 'manana';
    var personShifts = state.people.map(function (p) {
      var cfg = state.personShifts[p.login] || { mode: 'fixed', shiftId: firstId };
      return {
        login: p.login,
        mode: cfg.mode || 'fixed',
        shiftId: cfg.shiftId || firstId,
        anchorDate: cfg.anchorDate || '2026-09-01',
        anchorShiftId: cfg.anchorShiftId || cfg.shiftId || firstId,
      };
    });
    try {
      await API.post('/api/setup/complete', {
        dataRoot: state.dataRoot,
        centerName: state.centerName,
        adminLogin: state.adminLogin,
        adminName: state.adminName,
        adminPassword: state.adminPassword,
        people: state.people,
        shiftTypes: state.shiftTypes,
        personShifts: personShifts,
        dutyRotation: {
          logins: state.dutyLogins,
          anchorMonday: state.dutyAnchorMonday,
        },
        extraAdmins: [],
      });
      showToast('Instalación completada');
      window.location.reload();
    } catch (e) {
      showToast(e.message || 'No se pudo completar la instalación', 'error');
    }
  }

  function paint() {
    var root = document.getElementById('setupRoot');
    if (!root) return;
    root.innerHTML =
      '<div class="cal-setup-shell">' +
      '<header class="cal-setup-header">' +
      '<div class="brand-inditex">Inditex</div>' +
      '<h1>IT Calendario — Configuración inicial</h1>' +
      '<p>Solo la primera vez. Después todo el equipo usará esta misma instalación. <span class="cal-version">v1.0 · Octubre 2026</span></p>' +
      '</header>' +
      stepsHtml() +
      '<div class="cal-setup-card">' +
      renderStepBody() +
      '<div class="cal-setup-nav">' +
      (state.step > 0
        ? '<button type="button" class="btn btn-ghost" id="setupPrev">Atrás</button>'
        : '<span></span>') +
      (state.step < 6
        ? '<button type="button" class="btn btn-primary" id="setupNext">Siguiente</button>'
        : '<button type="button" class="btn btn-primary" id="setupFinish">Guardar e iniciar</button>') +
      '</div></div></div>';

    bindStep();
    var prev = document.getElementById('setupPrev');
    var next = document.getElementById('setupNext');
    var finishBtn = document.getElementById('setupFinish');
    if (prev) {
      prev.addEventListener('click', function () {
        collectStep();
        state.step -= 1;
        paint();
      });
    }
    if (next) {
      next.addEventListener('click', function () {
        var err = validateStep();
        if (err) {
          showToast(err, 'error');
          return;
        }
        if (state.step === 3) {
          ensureShiftTypes();
          var validIds = {};
          state.shiftTypes.forEach(function (t) {
            validIds[t.id] = true;
          });
          var firstId = state.shiftTypes[0].id;
          state.people.forEach(function (p) {
            var cfg = state.personShifts[p.login];
            if (!cfg || !validIds[cfg.shiftId]) {
              state.personShifts[p.login] = {
                login: p.login,
                mode: (cfg && cfg.mode) || 'fixed',
                shiftId: firstId,
              };
            }
          });
        }
        if (state.step === 4) {
          state.dutyLogins = state.people.map(function (p) {
            return p.login;
          }).filter(Boolean);
          if (!state.dutyAnchorMonday) {
            state.dutyAnchorMonday = nextMondayIso('2026-10-05');
          }
        }
        state.step += 1;
        paint();
      });
    }
    if (finishBtn) finishBtn.addEventListener('click', finish);
  }

  window.renderSetupWizard = function (status) {
    state.dataRoot = (status && status.suggestedDataRoot) || '';
    state.sessionUser = (status && status.sessionUser) || '';
    state.adminLogin = state.sessionUser;
    state.adminName = state.sessionUser;
    state.shiftTypes = defaultShifts();
    state.personShifts = {};
    state.dutyLogins = [];
    state.dutyAnchorMonday = nextMondayIso('2026-10-05');
    if (state.adminLogin) {
      state.people = [
        {
          login: state.adminLogin,
          name: state.adminName,
          vacationDays: 22,
          color: COLORS[0],
        },
      ];
      state.dutyLogins = [state.adminLogin];
    }
    state.step = 0;
    paint();
  };
})();
