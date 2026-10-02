/* Panel de administración del Calendario standalone */

(function () {
  var COLORS = ['#B45309', '#1D4ED8', '#047857', '#7C3AED', '#0F766E', '#BE123C'];
  var adminPassword = '';
  var state = {
    centerName: '',
    dataRoot: '',
    people: [],
    shiftTypes: [],
    shiftRotation: { weeks: 2, shiftIds: ['manana', 'partido'] },
    personShifts: {},
    dutyLogins: [],
    dutyAnchorMonday: '2026-10-05',
    leavePeriod: { month: 2, day: 28 },
    reportsDir: '',
    tab: 'equipo',
  };

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

  function nextMondayIso(fromIso) {
    var d = fromIso ? new Date(fromIso + 'T00:00:00') : new Date();
    if (isNaN(d.getTime())) d = new Date();
    var day = d.getDay();
    var add = day === 1 ? 0 : day === 0 ? 1 : 8 - day;
    d.setDate(d.getDate() + add);
    return (
      d.getFullYear() +
      '-' +
      String(d.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(d.getDate()).padStart(2, '0')
    );
  }

  function personByLogin(login) {
    var key = String(login || '').toLowerCase();
    for (var i = 0; i < state.people.length; i++) {
      if (String(state.people[i].login || '').toLowerCase() === key) return state.people[i];
    }
    return null;
  }

  function tabsHtml() {
    var tabs = [
      { id: 'equipo', label: 'Equipo' },
      { id: 'turnos', label: 'Turnos' },
      { id: 'guardias', label: 'Guardias' },
      { id: 'datos', label: 'Centro y datos' },
      { id: 'seguridad', label: 'Seguridad' },
    ];
    return (
      '<div class="cal-admin-tabs" role="tablist">' +
      tabs
        .map(function (t) {
          return (
            '<button type="button" class="cal-admin-tab' +
            (state.tab === t.id ? ' is-active' : '') +
            '" data-tab="' +
            t.id +
            '" role="tab" aria-selected="' +
            (state.tab === t.id ? 'true' : 'false') +
            '">' +
            esc(t.label) +
            '</button>'
          );
        })
        .join('') +
      '</div>'
    );
  }

  function colorCell(p, i) {
    var value = p.color || COLORS[i % COLORS.length];
    return (
      '<label class="setup-color-input-wrap" title="Color">' +
      '<input type="color" class="adm-p-color" value="' +
      esc(value) +
      '">' +
      '<span class="setup-color-preview" style="background:' +
      esc(value) +
      '"></span></label>'
    );
  }

  function renderEquipo() {
    var rows = state.people
      .map(function (p, i) {
        return (
          '<tr data-idx="' +
          i +
          '">' +
          '<td><input type="text" class="adm-p-login" value="' +
          esc(p.login) +
          '" placeholder="login"></td>' +
          '<td><input type="text" class="adm-p-name" value="' +
          esc(p.name) +
          '" placeholder="Nombre"></td>' +
          '<td><input type="number" class="adm-p-vac" min="0" max="60" value="' +
          esc(String(p.vacationDays == null ? 22 : p.vacationDays)) +
          '"></td>' +
          '<td>' +
          colorCell(p, i) +
          '</td>' +
          '<td><button type="button" class="btn btn-ghost adm-p-del">Quitar</button></td></tr>'
        );
      })
      .join('');
    return (
      '<h3>Miembros del equipo</h3>' +
      '<p class="cal-hint">Añade o quita personas, ajusta vacaciones y color en el calendario.</p>' +
      '<div class="cal-setup-table-wrap"><table class="cal-setup-table cal-setup-table--people">' +
      '<thead><tr><th>Login</th><th>Nombre</th><th>Vac.</th><th>Color</th><th></th></tr></thead>' +
      '<tbody id="admPeopleBody">' +
      rows +
      '</tbody></table></div>' +
      '<button type="button" class="btn btn-secondary" id="admAddPerson">+ Añadir persona</button>' +
      '<div class="cal-form-row" style="margin-top:16px">' +
      '<div class="form-group"><label for="admLeaveDay">Día reinicio vacaciones</label>' +
      '<input type="number" id="admLeaveDay" min="1" max="31" value="' +
      esc(String((state.leavePeriod && state.leavePeriod.day) || 28)) +
      '"></div>' +
      '<div class="form-group"><label for="admLeaveMonth">Mes reinicio</label>' +
      '<input type="number" id="admLeaveMonth" min="1" max="12" value="' +
      esc(String((state.leavePeriod && state.leavePeriod.month) || 2)) +
      '"></div></div>'
    );
  }

  function renderTurnos() {
    if (!state.shiftTypes.length) state.shiftTypes = defaultShifts();
    var typeRows = state.shiftTypes
      .map(function (t, i) {
        return (
          '<tr data-idx="' +
          i +
          '">' +
          '<td><input type="text" class="adm-t-label" value="' +
          esc(t.label) +
          '"></td>' +
          '<td><input type="time" class="adm-t-start" value="' +
          esc(t.start || '06:00') +
          '"></td>' +
          '<td><input type="time" class="adm-t-end" value="' +
          esc(t.end || '14:00') +
          '"></td>' +
          '<td><button type="button" class="btn btn-ghost adm-t-del">Quitar</button></td></tr>'
        );
      })
      .join('');
    var firstId = (state.shiftTypes[0] && state.shiftTypes[0].id) || 'manana';
    var assignRows = state.people
      .map(function (p) {
        var cfg = state.personShifts[p.login] || { mode: 'fixed', shiftId: firstId };
        var opts = state.shiftTypes
          .map(function (t) {
            return (
              '<option value="' +
              esc(t.id) +
              '"' +
              (t.id === (cfg.shiftId || cfg.anchorShiftId || firstId) ? ' selected' : '') +
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
          '<td>' +
          esc(p.name || p.login) +
          '</td>' +
          '<td><select class="adm-s-mode">' +
          '<option value="fixed"' +
          (cfg.mode !== 'rotating' ? ' selected' : '') +
          '>Fijo</option>' +
          '<option value="rotating"' +
          (cfg.mode === 'rotating' ? ' selected' : '') +
          '>Rotativo</option></select></td>' +
          '<td><select class="adm-s-shift">' +
          opts +
          '</select></td></tr>'
        );
      })
      .join('');
    return (
      '<h3>Turnos de trabajo</h3>' +
      '<p class="cal-hint">Define horarios y asígnalos a cada persona.</p>' +
      '<div class="cal-setup-table-wrap"><table class="cal-setup-table">' +
      '<thead><tr><th>Nombre</th><th>Inicio</th><th>Fin</th><th></th></tr></thead>' +
      '<tbody id="admShiftTypesBody">' +
      typeRows +
      '</tbody></table></div>' +
      '<button type="button" class="btn btn-secondary" id="admAddShift">+ Añadir turno</button>' +
      '<h3 style="margin-top:18px">Asignación</h3>' +
      '<div class="cal-setup-table-wrap"><table class="cal-setup-table">' +
      '<thead><tr><th>Persona</th><th>Modo</th><th>Turno</th></tr></thead>' +
      '<tbody id="admShiftAssignBody">' +
      assignRows +
      '</tbody></table></div>'
    );
  }

  function renderGuardias() {
    if (!state.dutyLogins.length) {
      state.dutyLogins = state.people.map(function (p) {
        return p.login;
      }).filter(Boolean);
    }
    var rows = state.dutyLogins
      .map(function (login, i) {
        var p = personByLogin(login) || { login: login, name: login, color: COLORS[0] };
        return (
          '<tr data-login="' +
          esc(login) +
          '"><td>' +
          (i + 1) +
          '</td><td><span class="setup-person-chip"><span class="setup-person-dot" style="background:' +
          esc(p.color || COLORS[0]) +
          '"></span>' +
          esc(p.name || login) +
          '</span></td><td class="setup-duty-actions">' +
          '<button type="button" class="btn btn-ghost adm-duty-up">↑</button>' +
          '<button type="button" class="btn btn-ghost adm-duty-down">↓</button>' +
          '<button type="button" class="btn btn-ghost adm-duty-del">✕</button></td></tr>'
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
    var opts = extras
      .map(function (p) {
        return '<option value="' + esc(p.login) + '">' + esc(p.name || p.login) + '</option>';
      })
      .join('');
    return (
      '<h3>Rotación de guardias</h3>' +
      '<p class="cal-hint">Orden semanal (Lun–Dom). La posición 1 cubre la primera semana desde el lunes indicado.</p>' +
      '<div class="form-group"><label for="admDutyAnchor">Primera semana (lunes)</label>' +
      '<input type="date" id="admDutyAnchor" value="' +
      esc(state.dutyAnchorMonday) +
      '"></div>' +
      '<div class="cal-setup-table-wrap"><table class="cal-setup-table">' +
      '<thead><tr><th>#</th><th>Persona</th><th></th></tr></thead>' +
      '<tbody id="admDutyBody">' +
      rows +
      '</tbody></table></div>' +
      '<div class="setup-duty-add-row"><select id="admDutyAddPerson"' +
      (extras.length ? '' : ' disabled') +
      '>' +
      (opts || '<option value="">Todas están en la rotación</option>') +
      '</select>' +
      '<button type="button" class="btn btn-secondary" id="admDutyAdd"' +
      (extras.length ? '' : ' disabled') +
      '>+ Añadir</button></div>'
    );
  }

  function renderDatos() {
    return (
      '<h3>Centro y ubicación de datos</h3>' +
      '<p class="cal-hint">El nombre del centro se muestra en la esquina. Puedes mover los datos a otra carpeta compartida (se copian; la anterior no se borra).</p>' +
      '<div class="form-group"><label for="admCenterName">Nombre del centro</label>' +
      '<input type="text" id="admCenterName" maxlength="80" value="' +
      esc(state.centerName) +
      '"></div>' +
      '<div class="form-group"><label for="admDataRoot">Ruta de datos</label>' +
      '<input type="text" id="admDataRoot" value="' +
      esc(state.dataRoot) +
      '"></div>' +
      '<div class="form-group"><label for="admReportsDir">Carpeta de informes (guardias y horas extra)</label>' +
      '<input type="text" id="admReportsDir" value="' +
      esc(state.reportsDir) +
      '" placeholder="Ej. G:\\Comun\\...\\Informes Guardias"></div>' +
      '<p class="cal-hint">Ahí se guardarán el Word de guardias, el Excel de jornadas y el informe de equipo. Por defecto: Documentos\\Guardias.</p>' +
      '<p class="cal-hint">Tras cambiar la ruta de datos, el resto del equipo debe usar la misma instalación (mismo <code>instalacion.json</code>).</p>'
    );
  }

  function renderSeguridad() {
    return (
      '<h3>Contraseña de administrador</h3>' +
      '<p class="cal-hint">Cambia la contraseña usada para abrir este panel y operaciones sensibles.</p>' +
      '<div class="form-group"><label for="admNewPwd">Nueva contraseña</label>' +
      '<input type="password" id="admNewPwd" autocomplete="new-password"></div>' +
      '<div class="form-group"><label for="admNewPwd2">Repetir contraseña</label>' +
      '<input type="password" id="admNewPwd2" autocomplete="new-password"></div>' +
      '<p class="cal-hint">Déjalas vacías si no quieres cambiarla al guardar.</p>'
    );
  }

  function panelBody() {
    if (state.tab === 'turnos') return renderTurnos();
    if (state.tab === 'guardias') return renderGuardias();
    if (state.tab === 'datos') return renderDatos();
    if (state.tab === 'seguridad') return renderSeguridad();
    return renderEquipo();
  }

  function readPeople() {
    var body = document.getElementById('admPeopleBody');
    if (!body) return;
    var next = [];
    body.querySelectorAll('tr').forEach(function (tr, i) {
      var login = ((tr.querySelector('.adm-p-login') || {}).value || '').trim().toLowerCase();
      var name = ((tr.querySelector('.adm-p-name') || {}).value || '').trim();
      var vac = parseInt(((tr.querySelector('.adm-p-vac') || {}).value || '22'), 10);
      var color = (tr.querySelector('.adm-p-color') || {}).value || COLORS[i % COLORS.length];
      if (!login && !name) return;
      next.push({
        login: login,
        name: name,
        vacationDays: isNaN(vac) ? 22 : vac,
        color: color,
      });
    });
    state.people = next;
    var day = parseInt(((document.getElementById('admLeaveDay') || {}).value || '28'), 10);
    var month = parseInt(((document.getElementById('admLeaveMonth') || {}).value || '2'), 10);
    state.leavePeriod = {
      day: isNaN(day) ? 28 : Math.max(1, Math.min(31, day)),
      month: isNaN(month) ? 2 : Math.max(1, Math.min(12, month)),
    };
  }

  function slugify(label, index) {
    var base = String(label || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    if (!base) base = 'turno-' + (index + 1);
    return base.slice(0, 40);
  }

  function readTurnos() {
    var typesBody = document.getElementById('admShiftTypesBody');
    if (typesBody) {
      var types = [];
      typesBody.querySelectorAll('tr').forEach(function (tr, i) {
        var label = ((tr.querySelector('.adm-t-label') || {}).value || '').trim();
        var start = ((tr.querySelector('.adm-t-start') || {}).value || '').trim();
        var end = ((tr.querySelector('.adm-t-end') || {}).value || '').trim();
        if (!label && !start && !end) return;
        var prev = state.shiftTypes[i] || {};
        var id = prev.id || slugify(label, i);
        if (prev.label && label && prev.label !== label) id = slugify(label, i);
        types.push({
          id: id,
          label: label || 'Turno ' + (i + 1),
          start: start || '06:00',
          end: end || '14:00',
        });
      });
      state.shiftTypes = types;
    }
    var assignBody = document.getElementById('admShiftAssignBody');
    if (assignBody) {
      var firstId = (state.shiftTypes[0] && state.shiftTypes[0].id) || 'manana';
      assignBody.querySelectorAll('tr').forEach(function (tr) {
        var login = tr.getAttribute('data-login');
        if (!login) return;
        var mode = ((tr.querySelector('.adm-s-mode') || {}).value || 'fixed');
        var shiftId = ((tr.querySelector('.adm-s-shift') || {}).value || firstId);
        if (mode === 'rotating') {
          state.personShifts[login] = {
            mode: 'rotating',
            anchorDate: '2026-09-01',
            anchorShiftId: shiftId,
          };
        } else {
          state.personShifts[login] = { mode: 'fixed', shiftId: shiftId };
        }
      });
    }
  }

  function readGuardias() {
    var anchor = document.getElementById('admDutyAnchor');
    if (anchor && anchor.value) state.dutyAnchorMonday = nextMondayIso(anchor.value);
  }

  function readDatos() {
    var center = document.getElementById('admCenterName');
    var root = document.getElementById('admDataRoot');
    var reports = document.getElementById('admReportsDir');
    if (center) state.centerName = (center.value || '').trim();
    if (root) state.dataRoot = (root.value || '').trim();
    if (reports) state.reportsDir = (reports.value || '').trim();
  }

  function collectVisible() {
    if (state.tab === 'equipo') readPeople();
    if (state.tab === 'turnos') readTurnos();
    if (state.tab === 'guardias') readGuardias();
    if (state.tab === 'datos') readDatos();
  }

  function bindPanel() {
    document.querySelectorAll('.cal-admin-tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        collectVisible();
        state.tab = btn.getAttribute('data-tab') || 'equipo';
        paintModalBody();
      });
    });
    var addP = document.getElementById('admAddPerson');
    if (addP) {
      addP.addEventListener('click', function () {
        readPeople();
        state.people.push({
          login: '',
          name: '',
          vacationDays: 22,
          color: COLORS[state.people.length % COLORS.length],
        });
        paintModalBody();
      });
    }
    document.querySelectorAll('.adm-p-del').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var tr = btn.closest('tr');
        var idx = tr ? parseInt(tr.getAttribute('data-idx'), 10) : -1;
        readPeople();
        if (idx >= 0) state.people.splice(idx, 1);
        paintModalBody();
      });
    });
    document.querySelectorAll('.adm-p-color').forEach(function (input) {
      input.addEventListener('input', function () {
        var preview = input.parentElement && input.parentElement.querySelector('.setup-color-preview');
        if (preview) preview.style.background = input.value;
      });
    });
    var addT = document.getElementById('admAddShift');
    if (addT) {
      addT.addEventListener('click', function () {
        readTurnos();
        var n = state.shiftTypes.length + 1;
        state.shiftTypes.push({
          id: 'turno-' + n,
          label: 'Turno ' + n,
          start: '08:00',
          end: '16:00',
        });
        paintModalBody();
      });
    }
    document.querySelectorAll('.adm-t-del').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var tr = btn.closest('tr');
        var idx = tr ? parseInt(tr.getAttribute('data-idx'), 10) : -1;
        readTurnos();
        if (state.shiftTypes.length <= 1) {
          showToast('Debe quedar al menos un turno', 'error');
          return;
        }
        if (idx >= 0) state.shiftTypes.splice(idx, 1);
        paintModalBody();
      });
    });
    document.querySelectorAll('.adm-duty-up').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var login = btn.closest('tr') && btn.closest('tr').getAttribute('data-login');
        var idx = state.dutyLogins.indexOf(login);
        if (idx > 0) {
          var tmp = state.dutyLogins[idx - 1];
          state.dutyLogins[idx - 1] = state.dutyLogins[idx];
          state.dutyLogins[idx] = tmp;
          paintModalBody();
        }
      });
    });
    document.querySelectorAll('.adm-duty-down').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var login = btn.closest('tr') && btn.closest('tr').getAttribute('data-login');
        var idx = state.dutyLogins.indexOf(login);
        if (idx >= 0 && idx < state.dutyLogins.length - 1) {
          var tmp = state.dutyLogins[idx + 1];
          state.dutyLogins[idx + 1] = state.dutyLogins[idx];
          state.dutyLogins[idx] = tmp;
          paintModalBody();
        }
      });
    });
    document.querySelectorAll('.adm-duty-del').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var login = btn.closest('tr') && btn.closest('tr').getAttribute('data-login');
        if (state.dutyLogins.length <= 1) {
          showToast('Debe quedar al menos una persona', 'error');
          return;
        }
        state.dutyLogins = state.dutyLogins.filter(function (l) {
          return l !== login;
        });
        paintModalBody();
      });
    });
    var dutyAdd = document.getElementById('admDutyAdd');
    if (dutyAdd) {
      dutyAdd.addEventListener('click', function () {
        var sel = document.getElementById('admDutyAddPerson');
        var login = sel && sel.value;
        if (login && state.dutyLogins.indexOf(login) < 0) {
          state.dutyLogins.push(login);
          paintModalBody();
        }
      });
    }
  }

  function paintModalBody() {
    var body = document.getElementById('modalBody');
    if (!body) return;
    body.innerHTML =
      '<div class="cal-admin-panel">' +
      tabsHtml() +
      '<div class="cal-admin-panel-body">' +
      panelBody() +
      '</div></div>';
    bindPanel();
  }

  async function loadConfig() {
    var meta = await API.get('/api/setup/admin-config');
    state.centerName = meta.centerName || '';
    state.dataRoot = meta.dataRoot || '';
    var peopleRes = await API.get('/api/calendario/people');
    state.people = (peopleRes.people || []).slice();
    state.leavePeriod = peopleRes.leavePeriod || { month: 2, day: 28 };
    state.reportsDir = peopleRes.reportsDir || '';
    var rot = peopleRes.dutyRotation || {};
    state.dutyLogins = (rot.logins || []).slice();
    state.dutyAnchorMonday = rot.anchorMonday || nextMondayIso('2026-10-05');
    var shifts = await API.get('/api/calendario/turnos/config');
    state.shiftTypes = (shifts.types || defaultShifts()).slice();
    state.shiftRotation = shifts.rotation || { weeks: 2, shiftIds: ['manana', 'partido'] };
    state.personShifts = shifts.personShifts || {};
    if (!state.dutyLogins.length) {
      state.dutyLogins = state.people.map(function (p) {
        return p.login;
      }).filter(Boolean);
    }
  }

  async function saveAll() {
    collectVisible();
    if (!state.people.length) {
      showToast('Añade al menos un miembro', 'error');
      return;
    }
    for (var i = 0; i < state.people.length; i++) {
      if (!state.people[i].login || !state.people[i].name) {
        showToast('Cada persona necesita login y nombre', 'error');
        state.tab = 'equipo';
        paintModalBody();
        return;
      }
    }
    if (!state.shiftTypes.length) {
      showToast('Define al menos un turno', 'error');
      state.tab = 'turnos';
      paintModalBody();
      return;
    }
    if (!state.dutyLogins.length) {
      showToast('La rotación de guardias necesita al menos una persona', 'error');
      state.tab = 'guardias';
      paintModalBody();
      return;
    }
    if (!state.centerName) {
      showToast('Indica el nombre del centro', 'error');
      state.tab = 'datos';
      paintModalBody();
      return;
    }
    if (!state.dataRoot) {
      showToast('Indica la ruta de datos', 'error');
      state.tab = 'datos';
      paintModalBody();
      return;
    }
    if (!state.reportsDir) {
      showToast('Indica la carpeta de informes', 'error');
      state.tab = 'datos';
      paintModalBody();
      return;
    }

    var newPwd = ((document.getElementById('admNewPwd') || {}).value || '');
    var newPwd2 = ((document.getElementById('admNewPwd2') || {}).value || '');
    if (newPwd || newPwd2) {
      if (newPwd.length < 6) {
        showToast('La nueva contraseña debe tener al menos 6 caracteres', 'error');
        state.tab = 'seguridad';
        paintModalBody();
        return;
      }
      if (newPwd !== newPwd2) {
        showToast('Las contraseñas no coinciden', 'error');
        state.tab = 'seguridad';
        paintModalBody();
        return;
      }
    }

    try {
      await API.put('/api/calendario/people', {
        people: state.people,
        leavePeriod: state.leavePeriod,
        dutyRotation: {
          logins: state.dutyLogins,
          anchorMonday: state.dutyAnchorMonday,
        },
        reportsDir: state.reportsDir,
      });

      var personShifts = {};
      state.people.forEach(function (p) {
        personShifts[p.login] = state.personShifts[p.login] || {
          mode: 'fixed',
          shiftId: state.shiftTypes[0].id,
        };
      });
      await API.put('/api/calendario/turnos/config', {
        types: state.shiftTypes,
        rotation: state.shiftRotation,
        personShifts: personShifts,
      });

      await API.put('/api/setup/center', {
        password: adminPassword,
        centerName: state.centerName,
      });

      var meta = await API.get('/api/setup/admin-config');
      var currentRoot = (meta.dataRoot || '').replace(/[\\/]+$/, '');
      var wantedRoot = state.dataRoot.replace(/[\\/]+$/, '');
      if (wantedRoot.toLowerCase() !== currentRoot.toLowerCase()) {
        var migrated = await API.post('/api/setup/migrate', {
          password: adminPassword,
          dataRoot: state.dataRoot,
        });
        state.dataRoot = migrated.dataRoot || state.dataRoot;
        showToast('Datos copiados a la nueva ruta');
      }

      if (newPwd) {
        await API.put('/api/setup/password', {
          password: adminPassword,
          newPassword: newPwd,
        });
        adminPassword = newPwd;
        showToast('Contraseña actualizada');
      }

      var brand = document.getElementById('calBrandApp');
      if (brand) {
        brand.textContent = state.centerName
          ? state.centerName + ' · IT Calendario'
          : 'IT Calendario';
      }
      document.title = (state.centerName ? state.centerName + ' · ' : '') + 'IT Calendario | Inditex';

      closeModal();
      showToast('Ajustes guardados');
      var page = document.getElementById('page-calendario');
      if (page && typeof window.loadCalendario === 'function') {
        await window.loadCalendario(page);
      }
    } catch (e) {
      showToast(e.message || 'No se pudieron guardar los ajustes', 'error');
    }
  }

  async function openAdminSettings(password) {
    adminPassword = password || '';
    state.tab = 'equipo';
    try {
      await loadConfig();
    } catch (e) {
      showToast(e.message || 'No se pudo cargar la configuración', 'error');
      return;
    }
    openModal(
      'Ajustes de administrador',
      '<div class="cal-admin-panel"><p class="cal-hint">Cargando…</p></div>',
      '<button type="button" class="btn btn-ghost" id="admCancel">Cancelar</button>' +
        '<button type="button" class="btn btn-primary" id="admSave">Guardar cambios</button>',
      { wide: true }
    );
    paintModalBody();
    var cancel = document.getElementById('admCancel');
    var save = document.getElementById('admSave');
    if (cancel) cancel.addEventListener('click', function () {
      closeModal();
    });
    if (save) save.addEventListener('click', saveAll);
  }

  async function promptAndOpenAdmin() {
    openModal(
      'Acceso administrador',
      '<p class="cal-hint">Introduce la contraseña de administrador para abrir los ajustes.</p>' +
        '<div class="form-group"><label for="admUnlockPwd">Contraseña</label>' +
        '<input type="password" id="admUnlockPwd" autocomplete="current-password" ' +
        'placeholder="Contraseña" aria-describedby="admUnlockHint">' +
        '<p class="cal-hint" id="admUnlockHint"></p></div>',
      '<button type="button" class="btn btn-ghost" id="admUnlockCancel">Cancelar</button>' +
        '<button type="button" class="btn btn-primary" id="admUnlockOk">Entrar</button>',
      { closeOnBackdrop: false }
    );

    var input = document.getElementById('admUnlockPwd');
    var hint = document.getElementById('admUnlockHint');
    var okBtn = document.getElementById('admUnlockOk');
    var cancelBtn = document.getElementById('admUnlockCancel');
    var busy = false;

    function setBusy(on) {
      busy = on;
      if (okBtn) okBtn.disabled = on;
      if (input) input.disabled = on;
    }

    async function submit() {
      if (busy) return;
      var pwd = ((input && input.value) || '');
      if (!pwd) {
        if (hint) hint.textContent = 'Introduce la contraseña.';
        if (typeof shakeModal === 'function') shakeModal();
        showToast('Contraseña requerida', 'error');
        if (input) input.focus();
        return;
      }
      setBusy(true);
      if (hint) hint.textContent = '';
      try {
        await API.post('/api/setup/unlock', { password: pwd });
        sessionStorage.setItem('calAdminUnlocked', '1');
        showToast('Acceso correcto');
        closeModal(function () {
          openAdminSettings(pwd);
        });
      } catch (e) {
        setBusy(false);
        if (hint) hint.textContent = e.message || 'Contraseña incorrecta';
        if (input) {
          input.value = '';
          input.focus();
        }
        if (typeof shakeModal === 'function') shakeModal();
        showToast(e.message || 'Contraseña incorrecta', 'error');
      }
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', function () {
        if (!busy) closeModal();
      });
    }
    if (okBtn) okBtn.addEventListener('click', submit);
    if (input) {
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          submit();
        }
      });
      setTimeout(function () {
        input.focus();
      }, 50);
    }
  }

  window.openCalAdminSettings = promptAndOpenAdmin;
  window.openCalAdminSettingsWithPassword = openAdminSettings;
})();
