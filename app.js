'use strict';

const DEMO_DATE = '2026-08-04';
const RATE = 42;
const STORAGE_KEY = 'somatra-demo-entries-v1';
const CLIENTS_STORAGE_KEY = 'somatra-demo-clients-v1';
const OPEN_TASKS_STORAGE_KEY = 'somatra-demo-open-preparations-v1';
const AUTHENTICATED_OPERATOR = 'Magasinier démo';
const LEGACY_OPERATOR = 'Magasinier non renseigné (ancienne tâche)';
const UNIDENTIFIED_CLIENT = 'Client à identifier';
const OPERATOR_MAX_LENGTH = 80;
const ORDER_REFERENCE_MAX_LENGTH = 120;
const seedOrders = {
  'Client A': ['CMD-2026-0142', 'CMD-2026-0151'],
  'Client B': ['CMD-2026-0147', 'CMD-2026-0155'],
  'Client C': ['CMD-2026-0149', 'CMD-2026-0158']
};
const seedEntries = [
  {id:1,date:'2026-08-01',client:'Client A',order:'CMD-2026-0142',minutes:82,operator:'Opérateur 01',comment:'Préparation standard',status:'Validé'},
  {id:2,date:'2026-08-02',client:'Client B',order:'CMD-2026-0147',minutes:48,operator:'Opérateur 02',comment:'Contrôle palette',status:'Validé'},
  {id:3,date:'2026-08-03',client:'Client A',order:'CMD-2026-0151',minutes:67,operator:'Opérateur 01',comment:'',status:'À contrôler'},
  {id:4,date:'2026-08-03',client:'Client C',order:'CMD-2026-0149',minutes:115,operator:'Opérateur 03',comment:'Commande multi-zones',status:'Validé'},
  {id:5,date:'2026-08-04',client:'Client B',order:'CMD-2026-0155',minutes:36,operator:'Opérateur 02',comment:'',status:'À contrôler'},
  {id:6,date:'2026-07-12',client:'Client A',order:'CMD-2026-0142',minutes:74,operator:'Opérateur 01',comment:'Archive juillet',status:'Validé'},
  {id:7,date:'2026-07-19',client:'Client C',order:'CMD-2026-0149',minutes:93,operator:'Opérateur 03',comment:'Archive juillet',status:'Validé'}
];

let entries = loadEntries();
let orders = loadClients();
let openTasks = loadOpenTasks();
let currentView = 'login';
let pendingTask = null;
let detailClient = null;
let toastTimer = null;
let scanStream = null;
let scanFrame = null;
let scanSession = 0;
let warehouseTab = 'new';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function loadEntries() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : seedEntries.map((entry) => ({...entry}));
  } catch (error) {
    return seedEntries.map((entry) => ({...entry}));
  }
}

function persistEntries() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)); } catch (error) { /* Démo utilisable sans stockage persistant. */ }
}

function loadClients() {
  try {
    const saved = JSON.parse(localStorage.getItem(CLIENTS_STORAGE_KEY));
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) return saved;
  } catch (error) { /* Revenir aux données fictives initiales. */ }
  return Object.fromEntries(Object.entries(seedOrders).map(([client, clientOrders]) => [client, [...clientOrders]]));
}


function loadOpenTasks() {
  try {
    const saved = JSON.parse(localStorage.getItem(OPEN_TASKS_STORAGE_KEY));
    if (!Array.isArray(saved)) return [];
    return saved.filter((task) => {
      if (!task || typeof task.id !== 'string' || typeof task.client !== 'string' || typeof task.order !== 'string') return false;
      const order = normalizeUserInput(task.order);
      return Boolean(order && order.length <= ORDER_REFERENCE_MAX_LENGTH);
    })
      .map((task) => ({
        id: task.id,
        client: task.client,
        order: normalizeUserInput(task.order),
        operator: typeof task.operator === 'string' && normalizeUserInput(task.operator) && normalizeUserInput(task.operator).length <= OPERATOR_MAX_LENGTH ? normalizeUserInput(task.operator) : LEGACY_OPERATOR,
        status: task.status === 'running' ? 'running' : 'paused',
        createdAt: Number.isFinite(task.createdAt) ? task.createdAt : Date.now(),
        accumulatedMs: Number.isFinite(task.accumulatedMs) && task.accumulatedMs >= 0 ? task.accumulatedMs : 0,
        lastStartedAt: Number.isFinite(task.lastStartedAt) ? task.lastStartedAt : null
      }));
  } catch (error) {
    return [];
  }
}

function persistOpenTasks() {
  try { localStorage.setItem(OPEN_TASKS_STORAGE_KEY, JSON.stringify(openTasks)); } catch (error) { /* Démo utilisable sans stockage persistant. */ }
}

function normalizeUserInput(value) {
  return String(value).trim().replace(/\s+/g, ' ');
}

function showView(name) {
  $$('.view').forEach((view) => view.classList.add('hidden'));
  $(`#view-${name}`).classList.remove('hidden');
  currentView = name;
  const loggedIn = name !== 'login';
  $('#switch-profile').classList.toggle('hidden', !loggedIn);
  $('#mobile-nav').classList.toggle('hidden', !loggedIn || name === 'confirm');
  $$('#mobile-nav button').forEach((button) => button.classList.toggle('active', button.dataset.action === name || (name === 'detail' && button.dataset.action === 'billing')));
  if (name === 'warehouse') {
    renderRecent();
    renderOpenTasks();
    renderWarehouseTab();
  }
  if (name === 'billing') renderBilling();
  window.scrollTo(0, 0);
  if (name === 'warehouse' && warehouseTab === 'new') $('#order-reference').focus({preventScroll:true});
  else $('#app').focus({preventScroll:true});
}

function navigate(action) {
  if (action === 'home') showView(currentView === 'login' ? 'login' : (currentView === 'warehouse' || currentView === 'confirm' ? 'warehouse' : 'billing'));
  if (action === 'warehouse') {
    warehouseTab = currentView === 'confirm' ? 'open' : 'new';
    showView('warehouse');
  }
  if (action === 'billing') showView('billing');
}

function setProfile(profile) {
  if (profile === 'warehouse') warehouseTab = 'new';
  showView(profile === 'warehouse' ? 'warehouse' : 'billing');
  toast(profile === 'warehouse' ? 'Profil magasinier activé' : 'Profil facturation activé');
}

function renderWarehouseTab() {
  $$('[data-warehouse-tab]').forEach((button) => {
    const active = button.dataset.warehouseTab === warehouseTab;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  $$('[data-warehouse-panel]').forEach((panel) => panel.classList.toggle('hidden', panel.dataset.warehousePanel !== warehouseTab));
}

function setWarehouseTab(tab, moveFocus = false) {
  if (!['new', 'open', 'history'].includes(tab)) return;
  warehouseTab = tab;
  renderRecent();
  renderOpenTasks();
  renderWarehouseTab();
  if (!moveFocus) return;
  const panel = document.querySelector(`[data-warehouse-panel="${tab}"]`);
  if (tab === 'new') $('#order-reference').focus({preventScroll:true});
  else if (panel) panel.focus({preventScroll:true});
}

function updateTaskSelection() {
  const order = normalizeUserInput($('#order-reference').value);
  const orderValid = order.length <= ORDER_REFERENCE_MAX_LENGTH;
  if (!order) {
    clearTaskFieldError('order-reference', 'order-reference-error');
  } else if (!orderValid) {
    showTaskFieldError('order-reference', 'order-reference-error', `La référence ne peut pas dépasser ${ORDER_REFERENCE_MAX_LENGTH} caractères.`);
  } else {
    clearTaskFieldError('order-reference', 'order-reference-error');
  }
  const canStart = Boolean(order && orderValid);
  $('#task-summary').classList.toggle('hidden', !canStart);
  $('#timer-button').disabled = !canStart;
  if (canStart) $('#selected-order').textContent = order;
}

function clearTaskFieldError(inputId, errorId) {
  $(`#${errorId}`).textContent = '';
  $(`#${errorId}`).classList.add('hidden');
  $(`#${inputId}`).removeAttribute('aria-invalid');
}

function showTaskFieldError(inputId, errorId, message) {
  $(`#${errorId}`).textContent = message;
  $(`#${errorId}`).classList.remove('hidden');
  $(`#${inputId}`).setAttribute('aria-invalid', 'true');
}

function stopScanning() {
  scanSession += 1;
  if (scanFrame !== null) cancelAnimationFrame(scanFrame);
  scanFrame = null;
  if (scanStream) scanStream.getTracks().forEach((track) => track.stop());
  scanStream = null;
  const video = $('#scan-video');
  video.pause();
  video.srcObject = null;
}

function scanErrorMessage(error) {
  if (error && (error.name === 'NotAllowedError' || error.name === 'SecurityError')) return 'Accès à la caméra refusé. Autorisez-la dans le navigateur ou saisissez la référence manuellement.';
  if (error && (error.name === 'NotFoundError' || error.name === 'OverconstrainedError')) return 'Aucune caméra compatible n’est disponible. Saisissez la référence manuellement.';
  return 'Le scan a rencontré une erreur. La caméra a été arrêtée ; saisissez la référence manuellement.';
}

function failScan(message) {
  stopScanning();
  $('#scan-feedback').textContent = message;
  $('#scan-feedback').classList.add('error');
}

async function openScanner() {
  const dialog = $('#scan-dialog');
  $('#scan-feedback').classList.remove('error');
  $('#scan-feedback').textContent = 'Initialisation de la caméra…';
  dialog.showModal();

  if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
    failScan('La caméra n’est pas accessible dans ce navigateur. Saisissez la référence manuellement.');
    return;
  }
  if (typeof window.BarcodeDetector !== 'function') {
    failScan('Le scan de codes-barres et QR n’est pas pris en charge par ce navigateur. Saisissez la référence manuellement.');
    return;
  }

  const session = ++scanSession;
  try {
    const detector = new window.BarcodeDetector();
    const stream = await navigator.mediaDevices.getUserMedia({video: {facingMode: {ideal: 'environment'}}, audio: false});
    if (session !== scanSession || !dialog.open) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    scanStream = stream;
    const video = $('#scan-video');
    video.srcObject = stream;
    await video.play();
    if (session !== scanSession) return;
    $('#scan-feedback').textContent = 'Placez un code-barres ou un QR code dans le cadre.';

    const detect = async () => {
      if (session !== scanSession || !scanStream) return;
      try {
        const codes = await detector.detect(video);
        if (codes.length) {
          const detectedValue = codes.find((code) => typeof code.rawValue === 'string')?.rawValue ?? '';
          const value = normalizeUserInput(detectedValue);
          if (!value) {
            failScan('Le code détecté ne contient aucune référence. Fermez le scanner et saisissez la référence manuellement.');
            return;
          }
          if (value.length > ORDER_REFERENCE_MAX_LENGTH) {
            failScan(`La référence détectée dépasse ${ORDER_REFERENCE_MAX_LENGTH} caractères. Fermez le scanner et saisissez une référence plus courte manuellement.`);
            return;
          }
          stopScanning();
          if (dialog.open) dialog.close();
          $('#order-reference').value = value;
          updateTaskSelection();
          $('#order-reference').focus();
          toast(`Référence ${value} scannée — démarrez-la quand vous êtes prêt`);
          return;
        }
        scanFrame = requestAnimationFrame(detect);
      } catch (error) {
        failScan(scanErrorMessage(error));
      }
    };
    scanFrame = requestAnimationFrame(detect);
  } catch (error) {
    failScan(scanErrorMessage(error));
  }
}

function closeScanner() {
  const dialog = $('#scan-dialog');
  stopScanning();
  if (dialog.open) dialog.close();
  $('#order-reference').focus();
  toast('Scan annulé — saisie manuelle disponible');
}


function formatClock(milliseconds) {
  const seconds = Math.floor(Math.max(0, milliseconds) / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return [hours, minutes, secs].map((value) => String(value).padStart(2, '0')).join(':');
}

function taskElapsedMs(task, now = Date.now()) {
  const activeMs = task.status === 'running' && task.lastStartedAt !== null ? Math.max(0, now - task.lastStartedAt) : 0;
  return task.accumulatedMs + activeMs;
}

function pauseTaskAt(task, timestamp) {
  if (task.status !== 'running') return;
  task.accumulatedMs = taskElapsedMs(task, timestamp);
  task.status = 'paused';
  task.lastStartedAt = null;
}

function resetTaskSelection() {
  $('#order-reference').value = '';
  updateTaskSelection();
}

function startTimer() {
  const order = normalizeUserInput($('#order-reference').value);
  if (!order) {
    showTaskFieldError('order-reference', 'order-reference-error', 'Indiquez une référence de commande.');
    $('#order-reference').focus();
    return;
  }
  if (order.length > ORDER_REFERENCE_MAX_LENGTH) {
    showTaskFieldError('order-reference', 'order-reference-error', `La référence ne peut pas dépasser ${ORDER_REFERENCE_MAX_LENGTH} caractères.`);
    $('#order-reference').focus();
    return;
  }
  clearTaskFieldError('order-reference', 'order-reference-error');
  const now = Date.now();
  openTasks.push({
    id: `${now}-${Math.random().toString(36).slice(2, 9)}`,
    client: UNIDENTIFIED_CLIENT,
    order,
    operator: AUTHENTICATED_OPERATOR,
    status: 'running',
    createdAt: now,
    accumulatedMs: 0,
    lastStartedAt: now
  });
  persistOpenTasks();
  resetTaskSelection();
  renderOpenTasks();
  setWarehouseTab('open', true);
  toast(`${order} démarrée`);
}

function pauseTask(taskId) {
  const task = openTasks.find((item) => item.id === taskId);
  if (!task || task.status !== 'running') return;
  pauseTaskAt(task, Date.now());
  persistOpenTasks();
  renderOpenTasks();
  setWarehouseTab('open');
  toast(`${task.order} mise en pause`);
}

function resumeTask(taskId) {
  const task = openTasks.find((item) => item.id === taskId);
  if (!task || task.status !== 'paused') return;
  const now = Date.now();
  task.status = 'running';
  task.lastStartedAt = now;
  persistOpenTasks();
  renderOpenTasks();
  setWarehouseTab('open');
  toast(`${task.order} reprise`);
}

function finishTask(taskId) {
  const task = openTasks.find((item) => item.id === taskId);
  if (!task) return;
  pauseTaskAt(task, Date.now());
  persistOpenTasks();
  warehouseTab = 'open';
  pendingTask = task;
  const roundedMinutes = Math.max(1, Math.ceil(task.accumulatedMs / 60000));
  $('#confirm-client').textContent = task.client;
  $('#confirm-order').textContent = task.order;
  $('#confirm-operator').textContent = task.operator || LEGACY_OPERATOR;
  $('#duration-hours').value = Math.floor(roundedMinutes / 60);
  $('#duration-minutes').value = roundedMinutes % 60;
  $('#comment').value = '';
  $('#duration-error').classList.add('hidden');
  showView('confirm');
}

function formatStartTime(timestamp) {
  return new Intl.DateTimeFormat('fr-FR', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'}).format(new Date(timestamp));
}

function renderOpenTasks() {
  const list = $('#open-tasks-list');
  const now = Date.now();
  $('#open-tasks-count').textContent = `${openTasks.length} ouverte${openTasks.length > 1 ? 's' : ''}`;
  $('#warehouse-open-count').textContent = openTasks.length;
  $('#warehouse-open-count').setAttribute('aria-label', `${openTasks.length} préparation${openTasks.length > 1 ? 's' : ''} ouverte${openTasks.length > 1 ? 's' : ''}`);
  list.innerHTML = openTasks.length ? openTasks.map((task) => {
    const running = task.status === 'running';
    return `<article class="open-task${running ? ' is-running' : ''}">
      <div class="open-task-main"><div><strong>${escapeHtml(task.order)}</strong><span>${escapeHtml(task.client)} · ${escapeHtml(task.operator || LEGACY_OPERATOR)}</span></div><span class="task-status ${running ? 'running' : 'paused'}">${running ? 'En cours' : 'En pause'}</span></div>
      <dl><div><dt>Début</dt><dd>${escapeHtml(formatStartTime(task.createdAt))}</dd></div><div><dt>Durée cumulée</dt><dd class="open-task-duration" data-task-duration="${escapeHtml(task.id)}">${formatClock(taskElapsedMs(task, now))}</dd></div></dl>
      <div class="open-task-actions">${running
        ? `<button class="secondary" type="button" data-task-action="pause" data-task-id="${escapeHtml(task.id)}" aria-label="Mettre en pause la préparation ${escapeHtml(task.order)}">Pause</button>`
        : `<button class="secondary" type="button" data-task-action="resume" data-task-id="${escapeHtml(task.id)}" aria-label="Reprendre la préparation ${escapeHtml(task.order)}">Reprendre</button>`}
        <button class="primary" type="button" data-task-action="finish" data-task-id="${escapeHtml(task.id)}" aria-label="Terminer la préparation ${escapeHtml(task.order)}">Terminer</button>
      </div>
    </article>`;
  }).join('') : '<div class="open-tasks-empty">Aucune préparation ouverte.</div>';
}

function refreshRunningDurations() {
  const now = Date.now();
  openTasks.filter((task) => task.status === 'running').forEach((task) => {
    const output = document.querySelector(`[data-task-duration="${CSS.escape(task.id)}"]`);
    if (output) output.textContent = formatClock(taskElapsedMs(task, now));
  });
}

function saveEntry() {
  const hours = Number.parseInt($('#duration-hours').value, 10) || 0;
  const minutesPart = Number.parseInt($('#duration-minutes').value, 10) || 0;
  const total = hours * 60 + minutesPart;
  if (!pendingTask || hours < 0 || minutesPart < 0 || minutesPart > 59 || total <= 0) {
    $('#duration-error').classList.remove('hidden');
    return;
  }
  $('#duration-error').classList.add('hidden');
  entries.push({
    id: Date.now(), date: DEMO_DATE, client: pendingTask.client, order: pendingTask.order,
    minutes: total, operator: pendingTask.operator || LEGACY_OPERATOR, comment: $('#comment').value.trim(), status: 'À contrôler'
  });
  persistEntries();
  const taskId = pendingTask.id;
  const order = pendingTask.order;
  openTasks = openTasks.filter((task) => task.id !== taskId);
  persistOpenTasks();
  pendingTask = null;
  warehouseTab = 'history';
  showView('warehouse');
  toast(`${order} enregistrée dans la synthèse`);
}

function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours ? `${hours} h ${String(mins).padStart(2, '0')}` : `${mins} min`;
}

function formatMoney(value) {
  return value.toLocaleString('fr-CH', {style:'currency', currency:'CHF'});
}

function formatDate(date) {
  return new Intl.DateTimeFormat('fr-FR', {day:'2-digit', month:'short', year:'numeric'}).format(new Date(`${date}T12:00:00`));
}

function renderRecent() {
  const recent = entries.filter((entry) => entry.date === DEMO_DATE).slice().reverse();
  $('#warehouse-history-count').textContent = recent.length;
  $('#warehouse-history-count').setAttribute('aria-label', `${recent.length} saisie${recent.length > 1 ? 's' : ''} enregistrée${recent.length > 1 ? 's' : ''}`);
  $('#today-total').textContent = `${formatDuration(recent.reduce((sum, entry) => sum + entry.minutes, 0))} aujourd’hui`;
  $('#recent-list').innerHTML = recent.length ? recent.slice(0, 4).map((entry) => `<div class="recent-item"><div><strong>${escapeHtml(entry.order)}</strong><small>${escapeHtml(entry.client)}</small></div><div><small>${escapeHtml(entry.operator)}</small><small>${escapeHtml(entry.status)}</small></div><span class="duration">${formatDuration(entry.minutes)}</span></div>`).join('') : '<div class="recent-item"><span>Aucune saisie aujourd’hui.</span></div>';
}

function getFilteredEntries(clientOverride) {
  const month = $('#month-filter').value;
  const client = clientOverride || $('#client-filter').value;
  const status = $('#status-filter').value;
  return entries.filter((entry) => entry.date.startsWith(month) && (client === 'all' || entry.client === client) && (status === 'all' || entry.status === status));
}

function groupByClient(filtered) {
  return filtered.reduce((groups, entry) => {
    if (!groups[entry.client]) groups[entry.client] = {client:entry.client, count:0, minutes:0, review:false};
    groups[entry.client].count += 1;
    groups[entry.client].minutes += entry.minutes;
    groups[entry.client].review ||= entry.status === 'À contrôler';
    return groups;
  }, {});
}

function updateBillingClientFilter() {
  const filter = $('#client-filter');
  const current = filter.value || 'all';
  const clients = [...new Set([...Object.keys(orders), ...entries.map((entry) => entry.client)])].sort((a, b) => a.localeCompare(b, 'fr'));
  filter.innerHTML = '<option value="all">Tous les clients</option>' + clients.map((client) => `<option>${escapeHtml(client)}</option>`).join('');
  filter.value = clients.includes(current) ? current : 'all';
}

function renderBilling() {
  updateBillingClientFilter();
  const filtered = getFilteredEntries();
  const groups = Object.values(groupByClient(filtered)).sort((a,b) => a.client.localeCompare(b.client));
  const minutes = filtered.reduce((sum, entry) => sum + entry.minutes, 0);
  const reviewCount = filtered.filter((entry) => entry.status === 'À contrôler').length;
  $('#kpi-grid').innerHTML = [
    ['Clients', groups.length, ''], ['Préparations', filtered.length, ''], ['Temps total', formatDuration(minutes), 'orange'], ['Montant estimé*', formatMoney(minutes / 60 * RATE), 'green']
  ].map(([label,value,color]) => `<div class="kpi ${color}"><span>${label}</span><strong>${value}</strong></div>`).join('');
  $('#result-count').textContent = `${groups.length} client${groups.length > 1 ? 's' : ''} · ${reviewCount} saisie${reviewCount > 1 ? 's' : ''} à contrôler`;
  $('#billing-rows').innerHTML = groups.length ? groups.map((group) => `<tr><td><strong>${escapeHtml(group.client)}</strong></td><td>${group.count}</td><td class="duration">${formatDuration(group.minutes)}</td><td>${formatMoney(group.minutes / 60 * RATE)}</td><td><span class="status ${group.review ? 'review' : 'valid'}">${group.review ? 'À contrôler' : 'Validé'}</span></td><td><button class="detail-button" type="button" data-client="${escapeHtml(group.client)}">Voir le détail →</button></td></tr>`).join('') : '<tr><td class="empty" colspan="6">Aucune saisie ne correspond aux filtres.</td></tr>';
  $$('.detail-button').forEach((button) => button.addEventListener('click', () => showDetail(button.dataset.client)));
}

function monthLabel(value) {
  const [year, month] = value.split('-').map(Number);
  const text = new Intl.DateTimeFormat('fr-FR', {month:'long', year:'numeric'}).format(new Date(year, month - 1, 1));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function showDetail(client) {
  detailClient = client;
  const filtered = getFilteredEntries(client);
  const minutes = filtered.reduce((sum, entry) => sum + entry.minutes, 0);
  $('#detail-title').textContent = client;
  $('#detail-month').textContent = monthLabel($('#month-filter').value);
  $('#detail-kpis').innerHTML = [['Préparations',filtered.length],['Temps total',formatDuration(minutes)],['Montant estimé*',formatMoney(minutes / 60 * RATE)]].map(([label,value]) => `<div class="kpi"><span>${label}</span><strong>${value}</strong></div>`).join('');
  $('#detail-rows').innerHTML = filtered.length ? filtered.map((entry) => `<tr><td>${formatDate(entry.date)}</td><td><strong>${escapeHtml(entry.order)}</strong></td><td>${escapeHtml(entry.operator)}</td><td class="duration">${formatDuration(entry.minutes)}</td><td>${escapeHtml(entry.comment || '—')}</td><td><span class="status ${entry.status === 'Validé' ? 'valid' : 'review'}">${escapeHtml(entry.status)}</span></td></tr>`).join('') : '<tr><td class="empty" colspan="6">Aucune préparation.</td></tr>';
  showView('detail');
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]));
}

function csvEscape(value) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function exportCsv(client) {
  const filtered = getFilteredEntries(client);
  const lines = [
    ['Date','Client','Commande','Opérateur','Durée (minutes)','Durée affichée','Commentaire','Statut','Montant estimé CHF (tarif fictif)'],
    ...filtered.map((entry) => [entry.date,entry.client,entry.order,entry.operator,entry.minutes,formatDuration(entry.minutes),entry.comment,entry.status,(entry.minutes / 60 * RATE).toFixed(2).replace('.', ',')])
  ];
  const csv = '\uFEFF' + lines.map((line) => line.map(csvEscape).join(';')).join('\r\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const suffix = client && client !== 'all' ? `-${client.toLowerCase().replace(/\s/g, '-')}` : '';
  anchor.href = url;
  anchor.download = `somatra-temps-${$('#month-filter').value}${suffix}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  toast(`${filtered.length} ligne${filtered.length > 1 ? 's' : ''} exportée${filtered.length > 1 ? 's' : ''} en CSV`);
}

function toast(message) {
  window.clearTimeout(toastTimer);
  $('#toast').textContent = message;
  $('#toast').classList.add('show');
  toastTimer = window.setTimeout(() => $('#toast').classList.remove('show'), 3200);
}

$$('[data-login]').forEach((button) => button.addEventListener('click', () => setProfile(button.dataset.login)));
$$('[data-action]').forEach((button) => button.addEventListener('click', () => navigate(button.dataset.action)));
$$('[data-warehouse-tab]').forEach((button) => button.addEventListener('click', () => setWarehouseTab(button.dataset.warehouseTab)));
$('#switch-profile').addEventListener('click', () => showView('login'));
$('#task-form').addEventListener('submit', (event) => event.preventDefault());
$('#order-reference').addEventListener('input', updateTaskSelection);
$('#scan-order').addEventListener('click', openScanner);
$('#close-scan-dialog').addEventListener('click', closeScanner);
$('#cancel-scan').addEventListener('click', closeScanner);
$('#scan-dialog').addEventListener('cancel', (event) => {
  event.preventDefault();
  closeScanner();
});
$('#scan-dialog').addEventListener('close', stopScanning);
$('#timer-button').addEventListener('click', startTimer);
$('#open-tasks-list').addEventListener('click', (event) => {
  const button = event.target.closest('[data-task-action]');
  if (!button) return;
  const {taskAction, taskId} = button.dataset;
  if (taskAction === 'pause') pauseTask(taskId);
  if (taskAction === 'resume') resumeTask(taskId);
  if (taskAction === 'finish') finishTask(taskId);
});
$('#save-entry').addEventListener('click', saveEntry);
['month-filter','client-filter','status-filter'].forEach((id) => $(`#${id}`).addEventListener('change', renderBilling));
$('#export-csv').addEventListener('click', () => exportCsv());
$('#detail-export').addEventListener('click', () => exportCsv(detailClient));
window.setInterval(refreshRunningDurations, 1000);

$('#warehouse-greeting').textContent = AUTHENTICATED_OPERATOR;
updateTaskSelection();
updateBillingClientFilter();
showView('login');
