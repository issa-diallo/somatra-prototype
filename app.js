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
const CLIENT_MAX_LENGTH = 120;
const COMMENT_MAX_LENGTH = 240;
const EDIT_DURATION_MAX_HOURS = 23;
const ENTRY_STATUSES = ['À contrôler', 'Validé'];
const ACTIVITIES = ['Préparation de commande', 'Réception de marchandise', 'Rangement', 'Inventaire', 'Retour d’événement', 'Autre'];
const MISSING_ACTIVITY_LABEL = 'Non renseignée';
const TRACKING_BATCH_SIZE = 20;
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
let referenceClientAssignments = new Map();
reconcileReferenceClientAssignments();
let currentView = 'login';
let pendingTask = null;
let detailClient = null;
let toastTimer = null;
let scanStream = null;
let scanFrame = null;
let scanSession = 0;
let warehouseTab = 'new';
let activeProfile = null;
let editingEntryId = null;
let trackingVisibleLimit = TRACKING_BATCH_SIZE;
let trackingPdfUrl = null;
let trackingPdfBlob = null;
let trackingPdfFilename = '';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function loadEntries() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return seedEntries.map((entry) => ({...entry}));
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return seedEntries.map((entry) => ({...entry}));
    return migrateLegacyClients(parsed, STORAGE_KEY);
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
    const saved = migrateLegacyClients(JSON.parse(localStorage.getItem(OPEN_TASKS_STORAGE_KEY)), OPEN_TASKS_STORAGE_KEY);
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
        lastStartedAt: Number.isFinite(task.lastStartedAt) ? task.lastStartedAt : null,
        ...(Object.prototype.hasOwnProperty.call(task, 'activity') ? {activity:task.activity} : {})
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

function isAllowedActivity(value) {
  return typeof value === 'string' && ACTIVITIES.includes(value);
}

function activityDisplayLabel(record) {
  if (!record || typeof record.activity !== 'string' || record.activity.length === 0) return MISSING_ACTIVITY_LABEL;
  return record.activity;
}

function activityOptions(selectedActivity, emptyLabel = 'Sélectionner une activité') {
  return `<option value="">${escapeHtml(emptyLabel)}</option>${ACTIVITIES.map((activity) => `<option value="${escapeHtml(activity)}"${selectedActivity === activity ? ' selected' : ''}>${escapeHtml(activity)}</option>`).join('')}`;
}

function referenceKey(value) {
  return normalizeUserInput(value).toLocaleLowerCase('fr');
}

function seedClientForReference(reference) {
  const key = referenceKey(reference);
  for (const [client, clientOrders] of Object.entries(seedOrders)) {
    if (clientOrders.some((order) => referenceKey(order) === key)) return client;
  }
  return null;
}

function automaticClientSuffix(index) {
  let value = index + 1;
  let suffix = '';
  while (value > 0) {
    value -= 1;
    suffix = String.fromCharCode(65 + (value % 26)) + suffix;
    value = Math.floor(value / 26);
  }
  return suffix;
}

function persistedClientForRecord(record) {
  if (!record || typeof record.client !== 'string' || typeof record.order !== 'string') return null;
  const client = normalizeUserInput(record.client);
  const order = normalizeUserInput(record.order);
  if (!client || client.length > CLIENT_MAX_LENGTH || client === UNIDENTIFIED_CLIENT) return null;
  // L'ancien fallback stockait la référence elle-même comme client : il ne constitue pas une attribution.
  return referenceKey(client) === referenceKey(order) ? null : client;
}

function automaticClientIndex(client) {
  const match = /^Client ([A-Z]+)$/.exec(client);
  if (!match) return null;
  return [...match[1]].reduce((index, character) => index * 26 + character.charCodeAt(0) - 64, 0) - 1;
}

function buildReferenceClientAssignments(savedEntries, savedOpenTasks) {
  const assignments = new Map();
  const records = [...savedEntries, ...savedOpenTasks];
  const reservedAutomaticIndexes = new Set();

  records.forEach((record) => {
    if (!record || typeof record.order !== 'string' || seedClientForReference(record.order)) return;
    const client = persistedClientForRecord(record);
    const index = client === null ? null : automaticClientIndex(client);
    if (index !== null) reservedAutomaticIndexes.add(index);
  });

  records.forEach((record) => {
    if (!record || typeof record.order !== 'string' || seedClientForReference(record.order)) return;
    const key = referenceKey(record.order);
    const client = persistedClientForRecord(record);
    // Pour des données historiques conflictuelles, la première attribution valide des entrées,
    // puis des tâches ouvertes, gagne. Une édition explicite est propagée avant la reconstruction.
    if (key && client && !assignments.has(key)) assignments.set(key, client);
  });

  let nextAutomaticIndex = 0;
  records.forEach((record) => {
    if (!record || typeof record.order !== 'string' || seedClientForReference(record.order)) return;
    const key = referenceKey(record.order);
    if (!key || assignments.has(key)) return;
    while (reservedAutomaticIndexes.has(nextAutomaticIndex)) nextAutomaticIndex += 1;
    assignments.set(key, `Client ${automaticClientSuffix(nextAutomaticIndex)}`);
    reservedAutomaticIndexes.add(nextAutomaticIndex);
  });
  return assignments;
}

function clientForReference(reference) {
  const seedClient = seedClientForReference(reference);
  if (seedClient) return seedClient;
  const key = referenceKey(reference);
  if (!referenceClientAssignments.has(key)) {
    const reservedAutomaticIndexes = new Set(
      [...referenceClientAssignments.values()]
        .map(automaticClientIndex)
        .filter((index) => index !== null)
    );
    let nextAutomaticIndex = 0;
    while (reservedAutomaticIndexes.has(nextAutomaticIndex)) nextAutomaticIndex += 1;
    referenceClientAssignments.set(key, `Client ${automaticClientSuffix(nextAutomaticIndex)}`);
  }
  return referenceClientAssignments.get(key);
}

function applyAutomaticClients(records) {
  let changed = false;
  records.forEach((record) => {
    if (!record || typeof record.order !== 'string') return;
    const seedClient = seedClientForReference(record.order);
    const assignedClient = seedClient || referenceClientAssignments.get(referenceKey(record.order));
    if (assignedClient && record.client !== assignedClient) {
      record.client = assignedClient;
      changed = true;
    }
  });
  return changed;
}

function reconcileReferenceClientAssignments() {
  referenceClientAssignments = buildReferenceClientAssignments(entries, openTasks);
  const entriesChanged = applyAutomaticClients(entries);
  const openTasksChanged = applyAutomaticClients(openTasks);
  if (entriesChanged) persistEntries();
  if (openTasksChanged) persistOpenTasks();
}

function migrateLegacyClients(records, storageKey) {
  if (!Array.isArray(records)) return records;
  let migrated = false;
  const result = records.map((record) => {
    if (!record || record.client !== UNIDENTIFIED_CLIENT || typeof record.order !== 'string') return record;
    const order = normalizeUserInput(record.order);
    if (!order || order.length > ORDER_REFERENCE_MAX_LENGTH) return record;
    migrated = true;
    return {...record, client: order, order};
  });
  if (migrated) {
    try { localStorage.setItem(storageKey, JSON.stringify(result)); } catch (error) { /* La migration reste appliquée en mémoire. */ }
  }
  return result;
}

function showView(name) {
  $$('.view').forEach((view) => view.classList.add('hidden'));
  $(`#view-${name}`).classList.remove('hidden');
  currentView = name;
  const loggedIn = name !== 'login';
  $('#switch-profile').classList.toggle('hidden', !loggedIn);
  $('#mobile-nav').classList.toggle('hidden', !loggedIn || name === 'confirm');
  renderMobileNav(name);
  if (name === 'warehouse') {
    renderTracking();
    renderOpenTasks();
    renderWarehouseTab();
  }
  if (name === 'billing') renderBilling();
  $('#app').scrollTop = 0;
  if (name === 'warehouse' && warehouseTab === 'new') $('#order-reference').focus({preventScroll:true});
  else $('#app').focus({preventScroll:true});
}

function navigate(action) {
  if (action === 'profile-select') {
    activeProfile = null;
    showView('login');
    return;
  }
  if (action === 'home') showView(currentView === 'login' ? 'login' : (currentView === 'warehouse' || currentView === 'confirm' ? 'warehouse' : 'billing'));
  if (action === 'warehouse') {
    if (activeProfile !== 'warehouse') return;
    warehouseTab = currentView === 'confirm' ? 'open' : 'new';
    showView('warehouse');
  }
  if (action === 'billing' && activeProfile === 'billing') showView('billing');
}

function setProfile(profile) {
  activeProfile = profile;
  if (profile === 'warehouse') warehouseTab = 'new';
  showView(profile === 'warehouse' ? 'warehouse' : 'billing');
  toast(profile === 'warehouse' ? 'Profil magasinier activé' : 'Profil facturation activé');
}

function renderMobileNav(name) {
  const nav = $('#mobile-nav');
  if (!activeProfile) {
    nav.innerHTML = '';
    return;
  }
  if (activeProfile === 'warehouse') {
    nav.innerHTML = '<button type="button" data-mobile-warehouse-tab="new"><span>＋</span>Nouvelle</button><button type="button" data-mobile-warehouse-tab="open"><span>◷</span>En cours</button><button type="button" data-mobile-warehouse-tab="tracking"><span>▤</span>Suivi</button><button type="button" data-action="profile-select"><span>⇄</span>Profil</button>';
    $$('[data-mobile-warehouse-tab]').forEach((button) => button.classList.toggle('active', name === 'warehouse' && button.dataset.mobileWarehouseTab === warehouseTab));
  } else {
    nav.innerHTML = '<button type="button" data-action="billing"><span>▥</span>Facturation</button><button type="button" data-action="profile-select"><span>⇄</span>Changer de profil</button>';
    nav.querySelector('[data-action="billing"]').classList.toggle('active', name === 'billing' || name === 'detail');
  }
}

function renderWarehouseTab() {
  $$('[data-warehouse-tab]').forEach((button) => {
    const active = button.dataset.warehouseTab === warehouseTab;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  $$('[data-warehouse-panel]').forEach((panel) => panel.classList.toggle('hidden', panel.dataset.warehousePanel !== warehouseTab));
  renderMobileNav('warehouse');
}

function setWarehouseTab(tab, moveFocus = false) {
  if (!['new', 'open', 'tracking'].includes(tab)) return;
  warehouseTab = tab;
  renderTracking();
  renderOpenTasks();
  renderWarehouseTab();
  $('#app').scrollTop = 0;
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
  $('#task-activity').value = '';
  clearTaskFieldError('task-activity', 'task-activity-error');
  updateTaskSelection();
}

function startTimer() {
  const order = normalizeUserInput($('#order-reference').value);
  const activity = $('#task-activity').value;
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
  if (activity && !isAllowedActivity(activity)) {
    showTaskFieldError('task-activity', 'task-activity-error', 'Sélectionnez une activité proposée ou choisissez après.');
    $('#task-activity').focus();
    return;
  }
  clearTaskFieldError('task-activity', 'task-activity-error');
  const now = Date.now();
  const client = clientForReference(order);
  openTasks.push({
    id: `${now}-${Math.random().toString(36).slice(2, 9)}`,
    client,
    order,
    operator: AUTHENTICATED_OPERATOR,
    status: 'running',
    createdAt: now,
    accumulatedMs: 0,
    lastStartedAt: now,
    ...(activity ? {activity} : {})
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
  $('#confirm-activity').innerHTML = activityOptions(isAllowedActivity(task.activity) ? task.activity : '');
  clearTaskFieldError('confirm-activity', 'confirm-activity-error');
  $('#comment').value = '';
  clearTaskFieldError('comment', 'comment-error');
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
      <div class="open-task-main"><div><strong>${escapeHtml(task.order)}</strong><span>${escapeHtml(task.client)} · ${escapeHtml(task.operator || LEGACY_OPERATOR)}</span><span class="open-task-activity">Activité : ${escapeHtml(activityDisplayLabel(task))}</span></div><span class="task-status ${running ? 'running' : 'paused'}">${running ? 'En cours' : 'En pause'}</span></div>
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
  const activity = $('#confirm-activity').value;
  if (!pendingTask || hours < 0 || minutesPart < 0 || minutesPart > 59 || total <= 0) {
    $('#duration-error').classList.remove('hidden');
    return;
  }
  if (!isAllowedActivity(activity)) {
    showTaskFieldError('confirm-activity', 'confirm-activity-error', 'Sélectionnez une activité proposée.');
    $('#confirm-activity').focus();
    return;
  }
  clearTaskFieldError('confirm-activity', 'confirm-activity-error');
  const comment = $('#comment').value.trim();
  if (comment.length > COMMENT_MAX_LENGTH) {
    showTaskFieldError('comment', 'comment-error', `Le commentaire ne peut pas dépasser ${COMMENT_MAX_LENGTH} caractères.`);
    $('#comment').focus();
    return;
  }
  clearTaskFieldError('comment', 'comment-error');
  $('#duration-error').classList.add('hidden');
  entries.push({
    id: Date.now(), date: DEMO_DATE, client: pendingTask.client, order: pendingTask.order,
    minutes: total, operator: pendingTask.operator || LEGACY_OPERATOR, activity, comment, status: 'À contrôler'
  });
  persistEntries();
  const taskId = pendingTask.id;
  const order = pendingTask.order;
  openTasks = openTasks.filter((task) => task.id !== taskId);
  persistOpenTasks();
  pendingTask = null;
  warehouseTab = 'tracking';
  showView('warehouse');
  toast(`${order} enregistrée dans le suivi`);
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

function formatShortDate(date) {
  return new Intl.DateTimeFormat('fr-FR', {day:'2-digit', month:'2-digit', year:'2-digit'}).format(new Date(`${date}T12:00:00`));
}

function isValidIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function updateSelectOptions(select, options, allLabel) {
  const current = select.value || 'all';
  select.innerHTML = `<option value="all">${escapeHtml(allLabel)}</option>` + options.map(({value, label}) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`).join('');
  select.value = current === 'all' || options.some((option) => option.value === current) ? current : 'all';
}

function updateTrackingFilters() {
  const months = [...new Set(entries.map((entry) => entry.date.slice(0, 7)))].sort().reverse();
  const clients = [...new Set(entries.map((entry) => entry.client))].sort((a, b) => a.localeCompare(b, 'fr'));
  const preparations = [...new Set(entries.map((entry) => entry.order))].sort((a, b) => a.localeCompare(b, 'fr'));
  updateSelectOptions($('#tracking-month-filter'), months.map((month) => ({value:month, label:monthLabel(month)})), 'Tous les mois');
  updateSelectOptions($('#tracking-client-filter'), clients.map((client) => ({value:client, label:client})), 'Tous les clients/commandes');
  updateSelectOptions($('#tracking-order-filter'), preparations.map((order) => ({value:order, label:order})), 'Toutes les préparations');
}

function updateTrackingFilterControls() {
  const activeCount = ['tracking-month-filter', 'tracking-client-filter', 'tracking-order-filter']
    .filter((id) => $(`#${id}`).value !== 'all').length;
  $('#tracking-filter-summary').textContent = activeCount === 0
    ? 'Tous les résultats'
    : `${activeCount} filtre${activeCount > 1 ? 's' : ''} actif${activeCount > 1 ? 's' : ''}`;
  $('#tracking-filter-reset').classList.toggle('hidden', activeCount === 0);
  $('#tracking-filter-reset').disabled = activeCount === 0;
}

function toggleTrackingFilters() {
  const filters = $('#tracking-filters');
  const isOpen = filters.classList.toggle('is-open');
  $('#tracking-filter-toggle').setAttribute('aria-expanded', String(isOpen));
}

function resetTrackingFilters(event) {
  const shouldRestoreFocus = event?.currentTarget === $('#tracking-filter-reset');
  ['tracking-month-filter', 'tracking-client-filter', 'tracking-order-filter']
    .forEach((id) => { $(`#${id}`).value = 'all'; });
  trackingVisibleLimit = TRACKING_BATCH_SIZE;
  editingEntryId = null;
  showTrackingReportError('');
  renderTracking();
  const toggle = $('#tracking-filter-toggle');
  if (shouldRestoreFocus && toggle.offsetParent !== null) toggle.focus();
}

function getTrackingEntries() {
  const month = $('#tracking-month-filter').value;
  const client = $('#tracking-client-filter').value;
  const order = $('#tracking-order-filter').value;
  return entries.filter((entry) => (month === 'all' || entry.date.startsWith(month)) && (client === 'all' || entry.client === client) && (order === 'all' || entry.order === order));
}

function trackingEntryForm(entry) {
  const hours = Math.floor(entry.minutes / 60);
  const minutes = entry.minutes % 60;
  return `<form class="tracking-edit-form" data-edit-entry-id="${escapeHtml(entry.id)}" novalidate>
    <div class="tracking-edit-grid">
      <label>Client/commande<input name="client" type="text" value="${escapeHtml(entry.client)}" maxlength="${CLIENT_MAX_LENGTH}" autocomplete="off" required></label>
      <label>Référence<input name="order" type="text" value="${escapeHtml(entry.order)}" maxlength="${ORDER_REFERENCE_MAX_LENGTH}" autocomplete="off" required></label>
      <label>Date<input name="date" type="date" value="${escapeHtml(entry.date)}" required></label>
      <label>Activité<select name="activity" required>${activityOptions(isAllowedActivity(entry.activity) ? entry.activity : '')}</select></label>
      <fieldset><legend>Durée</legend><div class="tracking-duration-fields"><label>Heures<input name="hours" type="number" value="${escapeHtml(hours)}" min="0" max="${EDIT_DURATION_MAX_HOURS}" inputmode="numeric" required></label><label>Minutes<input name="minutes" type="number" value="${escapeHtml(minutes)}" min="0" max="59" inputmode="numeric" required></label></div></fieldset>
      <label>Statut<select name="status" required>${ENTRY_STATUSES.map((status) => `<option value="${escapeHtml(status)}"${entry.status === status ? ' selected' : ''}>${escapeHtml(status)}</option>`).join('')}</select></label>
    </div>
    <div class="tracking-edit-error hidden" role="alert" aria-live="assertive"></div>
    <div class="tracking-edit-actions"><button class="secondary" type="button" data-entry-action="cancel">Annuler</button><button class="primary" type="submit">Enregistrer</button></div>
  </form>`;
}

function trackingEntryCard(entry) {
  if (String(entry.id) === editingEntryId) {
    return `<article class="tracking-item is-editing">${trackingEntryForm(entry)}</article>`;
  }
  return `<article class="tracking-item tracking-row">
    <button class="tracking-row-button" type="button" data-entry-action="edit" data-entry-id="${escapeHtml(entry.id)}" aria-label="Modifier la préparation, client ${escapeHtml(entry.client)}, référence ${escapeHtml(entry.order)}, activité ${escapeHtml(activityDisplayLabel(entry))}, statut ${escapeHtml(entry.status)}, date ${escapeHtml(formatShortDate(entry.date))}, durée ${escapeHtml(formatDuration(entry.minutes))}">
      <span class="tracking-row-content">
        <span class="tracking-row-main"><strong>${escapeHtml(entry.client)}</strong><span class="status ${entry.status === 'Validé' ? 'valid' : 'review'}">${escapeHtml(entry.status)}</span></span>
        <span class="tracking-row-meta"><span class="tracking-row-reference">${escapeHtml(entry.order)}</span><span aria-hidden="true"> · </span><span>${escapeHtml(formatShortDate(entry.date))}</span><span aria-hidden="true"> · </span><span class="duration">${formatDuration(entry.minutes)}</span></span>
        <span class="tracking-row-activity">Activité : ${escapeHtml(activityDisplayLabel(entry))}</span>
      </span>
      <span class="tracking-edit-indicator" aria-hidden="true">✎</span>
    </button>
  </article>`;
}

function startEditingEntry(entryId) {
  const entry = entries.find((item) => String(item.id) === String(entryId));
  if (!entry) return;
  editingEntryId = String(entry.id);
  renderTracking();
  const form = $('#tracking-list').querySelector('[data-edit-entry-id]');
  if (form) form.elements.client.focus({preventScroll:true});
}

function cancelEditingEntry() {
  editingEntryId = null;
  renderTracking();
}

function showTrackingEditErrors(form, errors) {
  form.querySelectorAll('[aria-invalid="true"]').forEach((field) => field.removeAttribute('aria-invalid'));
  errors.forEach(({name}) => form.elements[name]?.setAttribute('aria-invalid', 'true'));
  const output = form.querySelector('.tracking-edit-error');
  output.textContent = errors.map(({message}) => message).join(' ');
  output.classList.toggle('hidden', errors.length === 0);
  if (errors.length) form.elements[errors[0].name]?.focus();
}

function saveEditedEntry(form) {
  const entry = entries.find((item) => String(item.id) === editingEntryId);
  if (!entry || form.dataset.editEntryId !== editingEntryId) {
    cancelEditingEntry();
    return;
  }

  const client = normalizeUserInput(form.elements.client.value);
  const order = normalizeUserInput(form.elements.order.value);
  const date = form.elements.date.value;
  const hoursText = form.elements.hours.value.trim();
  const minutesText = form.elements.minutes.value.trim();
  const status = form.elements.status.value;
  const activity = form.elements.activity.value;
  const errors = [];
  if (!client) errors.push({name:'client', message:'Indiquez un client ou une commande.'});
  else if (client.length > CLIENT_MAX_LENGTH) errors.push({name:'client', message:`Le client ou la commande ne peut pas dépasser ${CLIENT_MAX_LENGTH} caractères.`});
  if (!order) errors.push({name:'order', message:'Indiquez une référence.'});
  else if (order.length > ORDER_REFERENCE_MAX_LENGTH) errors.push({name:'order', message:`La référence ne peut pas dépasser ${ORDER_REFERENCE_MAX_LENGTH} caractères.`});
  if (!isValidIsoDate(date)) errors.push({name:'date', message:'Indiquez une date valide.'});
  if (!/^\d+$/.test(hoursText) || Number(hoursText) > EDIT_DURATION_MAX_HOURS) errors.push({name:'hours', message:`Les heures doivent être comprises entre 0 et ${EDIT_DURATION_MAX_HOURS}.`});
  if (!/^\d+$/.test(minutesText) || Number(minutesText) > 59) errors.push({name:'minutes', message:'Les minutes doivent être comprises entre 0 et 59.'});
  const totalMinutes = /^\d+$/.test(hoursText) && /^\d+$/.test(minutesText) ? Number(hoursText) * 60 + Number(minutesText) : 0;
  if (!errors.some(({name}) => name === 'hours' || name === 'minutes') && totalMinutes <= 0) errors.push({name:'hours', message:'Indiquez une durée supérieure à zéro.'});
  if (!ENTRY_STATUSES.includes(status)) errors.push({name:'status', message:'Sélectionnez un statut proposé.'});
  if (!isAllowedActivity(activity)) errors.push({name:'activity', message:'Sélectionnez une activité proposée.'});
  if (errors.length) {
    showTrackingEditErrors(form, errors);
    return;
  }

  const newReferenceKey = referenceKey(order);
  const assignedClient = seedClientForReference(order) || client;
  Object.assign(entry, {client:assignedClient, order, date, minutes:totalMinutes, activity, status});
  [...entries, ...openTasks].forEach((record) => {
    if (record !== entry && referenceKey(record.order) === newReferenceKey) record.client = assignedClient;
  });
  reconcileReferenceClientAssignments();
  // L'entrée éditée doit être persistée même si la réconciliation n'a rien eu à modifier.
  persistEntries();
  persistOpenTasks();
  editingEntryId = null;
  renderTracking();
  toast(`${order} mise à jour`);
}

function renderTracking() {
  const existingForm = $('#tracking-list').querySelector('[data-edit-entry-id]');
  const draft = existingForm && existingForm.dataset.editEntryId === editingEntryId
    ? Object.fromEntries([...new FormData(existingForm).entries()])
    : null;
  const focusedFieldName = existingForm && document.activeElement?.form === existingForm ? document.activeElement.name : null;
  updateTrackingFilters();
  updateTrackingFilterControls();
  const filtered = getTrackingEntries().slice().sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  const visible = filtered.slice(0, trackingVisibleLimit);
  const remaining = Math.max(0, filtered.length - visible.length);
  const uniqueClients = new Set(filtered.map((entry) => entry.client)).size;
  const minutes = filtered.reduce((sum, entry) => sum + entry.minutes, 0);
  $('#warehouse-tracking-count').textContent = filtered.length;
  $('#warehouse-tracking-count').setAttribute('aria-label', `${filtered.length} saisie${filtered.length > 1 ? 's' : ''} au total`);
  $('#tracking-kpis').innerHTML = [
    ['Clients/commandes uniques', 'Clients', uniqueClients],
    ['Préparations', 'Préparations', filtered.length],
    ['Temps total', 'Temps total', formatDuration(minutes)]
  ].map(([desktopLabel, mobileLabel, value]) => `<div class="kpi" role="group" aria-label="${desktopLabel} : ${value}"><span class="kpi-label-desktop" aria-hidden="true">${desktopLabel}</span><span class="kpi-label-mobile" aria-hidden="true">${mobileLabel}</span><strong aria-hidden="true">${value}</strong></div>`).join('');
  $('#tracking-result-count').textContent = `${filtered.length} saisie${filtered.length > 1 ? 's' : ''} au total`;
  $('#tracking-list').innerHTML = filtered.length ? visible.map(trackingEntryCard).join('') : '<div class="tracking-empty">Aucune saisie ne correspond aux filtres sélectionnés.</div>';
  const restoredForm = draft ? $('#tracking-list').querySelector(`[data-edit-entry-id="${CSS.escape(editingEntryId)}"]`) : null;
  if (restoredForm) {
    Object.entries(draft).forEach(([name, value]) => {
      const field = restoredForm.elements[name];
      if (field && (!(field instanceof HTMLSelectElement) || [...field.options].some((option) => option.value === value))) field.value = value;
    });
    if (focusedFieldName) restoredForm.elements[focusedFieldName]?.focus({preventScroll:true});
  }
  const canLoadMore = remaining > 0 && editingEntryId === null;
  $('#tracking-load-more').classList.toggle('hidden', !canLoadMore);
  $('#tracking-load-more').disabled = !canLoadMore;
  $('#tracking-load-more-info').textContent = filtered.length ? `${visible.length} affichée${visible.length > 1 ? 's' : ''} · ${remaining} restante${remaining > 1 ? 's' : ''}` : '';
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
  $('#detail-rows').innerHTML = filtered.length ? filtered.map((entry) => `<tr><td>${formatDate(entry.date)}</td><td><strong>${escapeHtml(entry.order)}</strong></td><td>${escapeHtml(entry.operator)}</td><td class="duration">${formatDuration(entry.minutes)}</td><td>${escapeHtml(activityDisplayLabel(entry))}</td><td>${escapeHtml(entry.comment || '—')}</td><td><span class="status ${entry.status === 'Validé' ? 'valid' : 'review'}">${escapeHtml(entry.status)}</span></td></tr>`).join('') : '<tr><td class="empty" colspan="7">Aucune préparation.</td></tr>';
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
    ['Date','Client','Commande','Opérateur','Durée (minutes)','Durée affichée','Activité','Commentaire','Statut','Montant estimé CHF (tarif fictif)'],
    ...filtered.map((entry) => [entry.date,entry.client,entry.order,entry.operator,entry.minutes,formatDuration(entry.minutes),activityDisplayLabel(entry),entry.comment,entry.status,(entry.minutes / 60 * RATE).toFixed(2).replace('.', ',')])
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

function sanitizePdfText(value) {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function containsFinancialIndicator(value) {
  const text = sanitizePdfText(value);
  return /[€$£]|\b(?:chf|francs?|prix|tarifs?|montants?|factures?|facturations?|co[uû]ts?|valeurs?)\b/iu.test(text);
}

function truncatePdfText(value, maximumLength) {
  const characters = [...sanitizePdfText(value)];
  if (characters.length <= maximumLength) return characters.join('');
  return `${characters.slice(0, maximumLength - 1).join('')}…`;
}

function safePdfFreeText(value, maximumLength) {
  if (containsFinancialIndicator(value)) return 'Information retiree';
  return truncatePdfText(value, maximumLength);
}

function safePdfActivity(entry) {
  const label = activityDisplayLabel(entry);
  return isAllowedActivity(entry?.activity) ? truncatePdfText(label, 80) : safePdfFreeText(label, 80);
}

function wrapPdfText(value, maximumLength = 88) {
  const words = sanitizePdfText(value).split(' ');
  const lines = [];
  let line = '';
  words.forEach((word) => {
    const chunks = word.match(new RegExp(`.{1,${maximumLength}}`, 'g')) || [''];
    chunks.forEach((chunk) => {
      if (line && line.length + chunk.length + 1 > maximumLength) {
        lines.push(line);
        line = '';
      }
      line += `${line ? ' ' : ''}${chunk}`;
    });
  });
  if (line || !lines.length) lines.push(line);
  return lines;
}

function pdfByteArray(value) {
  const windows1252 = new Map([
    [0x20ac, 0x80], [0x201a, 0x82], [0x0192, 0x83], [0x201e, 0x84], [0x2026, 0x85],
    [0x2020, 0x86], [0x2021, 0x87], [0x02c6, 0x88], [0x2030, 0x89], [0x0160, 0x8a],
    [0x2039, 0x8b], [0x0152, 0x8c], [0x017d, 0x8e], [0x2018, 0x91], [0x2019, 0x92],
    [0x201c, 0x93], [0x201d, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97],
    [0x02dc, 0x98], [0x2122, 0x99], [0x0161, 0x9a], [0x203a, 0x9b], [0x0153, 0x9c],
    [0x017e, 0x9e], [0x0178, 0x9f]
  ]);
  return Uint8Array.from([...value].map((character) => {
    const codePoint = character.codePointAt(0);
    if (windows1252.has(codePoint)) return windows1252.get(codePoint);
    return codePoint <= 0xff ? codePoint : 0x3f;
  }));
}

function escapePdfString(value) {
  return sanitizePdfText(value).replace(/([\\()])/g, '\\$1');
}

function trackingPdfHeaderLines(filtered, month, continuation = false) {
  if (continuation) {
    return wrapPdfText(`Somatra - Releve mensuel - ${monthLabel(month)} (suite)`, 86)
      .map((text) => ({text, size:13, bold:true, gap:17}));
  }
  const clientFilter = $('#tracking-client-filter').value;
  const orderFilter = $('#tracking-order-filter').value;
  const safeClientFilter = clientFilter === 'all' ? 'Tous' : safePdfFreeText(clientFilter, CLIENT_MAX_LENGTH);
  const safeOrderFilter = orderFilter === 'all' ? 'Toutes' : safePdfFreeText(orderFilter, ORDER_REFERENCE_MAX_LENGTH);
  const totalMinutes = filtered.reduce((sum, entry) => sum + entry.minutes, 0);
  const uniqueClientCount = new Set(filtered.map((entry) => entry.client)).size;
  return [
    {text:'Somatra - Releve mensuel des preparations', size:17, bold:true, gap:24},
    {text:`Mois : ${monthLabel(month)}`, size:12, bold:true, gap:18},
    ...wrapPdfText(`Filtres actifs - Client/commande : ${safeClientFilter}`, 86)
      .map((text) => ({text, size:9, gap:13})),
    ...wrapPdfText(`Preparation : ${safeOrderFilter}`, 86)
      .map((text) => ({text, size:9, gap:13})),
    ...wrapPdfText(`Resume : ${filtered.length} preparation${filtered.length > 1 ? 's' : ''} - ${uniqueClientCount} client${uniqueClientCount > 1 ? 's' : ''} - ${formatDuration(totalMinutes)}`, 86)
      .map((text) => ({text, size:11, bold:true, gap:15})),
    {text:'Demonstration - donnees fictives - releve non financier', size:9, gap:22}
  ];
}

function trackingPdfEntryLines(entry) {
  const lines = [];
  const client = safePdfFreeText(entry.client, CLIENT_MAX_LENGTH);
  const order = safePdfFreeText(entry.order, ORDER_REFERENCE_MAX_LENGTH);
  const operator = safePdfFreeText(entry.operator, OPERATOR_MAX_LENGTH);
  const activity = safePdfActivity(entry);
  const comment = safePdfFreeText(entry.comment, COMMENT_MAX_LENGTH);
  wrapPdfText(`${formatShortDate(entry.date)} - ${client}`, 86)
    .forEach((text, index) => lines.push({text, size:10, bold:index === 0, gap:12}));
  wrapPdfText(`Reference : ${order} - Duree : ${formatDuration(entry.minutes)} - Statut : ${entry.status}`, 86)
    .forEach((text) => lines.push({text, size:9, gap:11}));
  if (operator) {
    wrapPdfText(`Operateur : ${operator}`, 86).forEach((text) => lines.push({text, size:9, gap:11}));
  }
  wrapPdfText(`Activite : ${activity}`, 86).forEach((text) => lines.push({text, size:9, gap:11}));
  if (comment) {
    wrapPdfText(`Commentaire : ${comment}`, 86).forEach((text) => lines.push({text, size:9, gap:11}));
  }
  lines.push({text:'', size:5, gap:7});
  return lines;
}

function createPdfBlob(filtered, month) {
  const pageTop = 800;
  const pageBottom = 48;
  const pages = [trackingPdfHeaderLines(filtered, month)];
  let y = pageTop - pages[0].reduce((height, line) => height + line.gap, 0);
  filtered.forEach((entry) => {
    const entryLines = trackingPdfEntryLines(entry);
    const entryHeight = entryLines.reduce((height, line) => height + line.gap, 0);
    if (y - entryHeight < pageBottom) {
      pages.push(trackingPdfHeaderLines(filtered, month, true));
      y = pageTop - pages.at(-1).reduce((height, line) => height + line.gap, 0);
    }
    pages.at(-1).push(...entryLines);
    y -= entryHeight;
  });

  const objects = new Map();
  const pageReferences = pages.map((_, index) => 6 + index * 2);
  objects.set(1, '<< /Type /Catalog /Pages 2 0 R >>');
  objects.set(2, `<< /Type /Pages /Kids [${pageReferences.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`);
  objects.set(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  objects.set(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  pages.forEach((lines, index) => {
    const contentId = 5 + index * 2;
    const pageId = contentId + 1;
    let y = 800;
    const commands = lines.map((line) => {
      const command = `BT /${line.bold ? 'F2' : 'F1'} ${line.size} Tf 48 ${y} Td (${escapePdfString(line.text)}) Tj ET`;
      y -= line.gap;
      return command;
    }).join('\n');
    objects.set(contentId, `<< /Length ${pdfByteArray(commands).length} >>\nstream\n${commands}\nendstream`);
    objects.set(pageId, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`);
  });

  const chunks = [pdfByteArray('%PDF-1.4\n%âãÏÓ\n')];
  const offsets = [0];
  let byteLength = chunks[0].length;
  const objectCount = 4 + pages.length * 2;
  for (let id = 1; id <= objectCount; id += 1) {
    offsets[id] = byteLength;
    const chunk = pdfByteArray(`${id} 0 obj\n${objects.get(id)}\nendobj\n`);
    chunks.push(chunk);
    byteLength += chunk.length;
  }
  const xrefOffset = byteLength;
  const xref = `xref\n0 ${objectCount + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  chunks.push(pdfByteArray(xref));
  return new Blob(chunks, {type:'application/pdf'});
}

function clearTrackingPdf() {
  if (trackingPdfUrl) URL.revokeObjectURL(trackingPdfUrl);
  trackingPdfUrl = null;
  trackingPdfBlob = null;
  trackingPdfFilename = '';
  $('#pdf-preview').removeAttribute('data');
}

function closeTrackingPdf() {
  const dialog = $('#pdf-dialog');
  if (dialog.open) dialog.close();
  clearTrackingPdf();
}

function showTrackingReportError(message) {
  $('#tracking-report-error').textContent = message;
  $('#tracking-report-error').classList.toggle('hidden', !message);
}

function createTrackingPdf() {
  showTrackingReportError('');
  const month = $('#tracking-month-filter').value;
  if (month === 'all') {
    showTrackingReportError('Sélectionnez un mois pour créer le relevé mensuel.');
    $('#tracking-month-filter').focus();
    return;
  }
  const filtered = getTrackingEntries().slice().sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
  if (!filtered.length) {
    showTrackingReportError('Aucune saisie ne correspond aux filtres actifs. Le PDF n’a pas été créé.');
    return;
  }
  try {
    clearTrackingPdf();
    trackingPdfBlob = createPdfBlob(filtered, month);
    trackingPdfUrl = URL.createObjectURL(trackingPdfBlob);
    trackingPdfFilename = `somatra-releve-${month}.pdf`;
    $('#pdf-preview').data = trackingPdfUrl;
    $('#pdf-send-status').textContent = '';
    $('#pdf-send-status').classList.add('hidden');
    $('#send-tracking-pdf').disabled = false;
    $('#pdf-dialog').showModal();
  } catch (error) {
    clearTrackingPdf();
    showTrackingReportError('Le PDF n’a pas pu être créé dans ce navigateur. Réessayez après avoir rechargé la page.');
  }
}

function downloadTrackingPdf() {
  if (!trackingPdfBlob || !trackingPdfUrl) return;
  const anchor = document.createElement('a');
  anchor.href = trackingPdfUrl;
  anchor.download = trackingPdfFilename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  toast('Téléchargement du relevé PDF lancé');
}

function simulateTrackingPdfSend() {
  if (!trackingPdfBlob) return;
  const status = $('#pdf-send-status');
  status.textContent = 'Envoi simulé confirmé : le relevé n’a été transmis à personne et aucune requête réseau n’a été effectuée.';
  status.classList.remove('hidden');
  status.scrollIntoView({ block: 'nearest' });
  $('#send-tracking-pdf').disabled = true;
  toast('Simulation d’envoi confirmée — aucune transmission réelle');
}

function toast(message) {
  window.clearTimeout(toastTimer);
  $('#toast').textContent = message;
  $('#toast').classList.add('show');
  toastTimer = window.setTimeout(() => $('#toast').classList.remove('show'), 3200);
}

$$('[data-login]').forEach((button) => button.addEventListener('click', () => setProfile(button.dataset.login)));
document.addEventListener('click', (event) => {
  const actionButton = event.target.closest('[data-action]');
  if (actionButton) navigate(actionButton.dataset.action);
  const mobileTab = event.target.closest('[data-mobile-warehouse-tab]');
  if (mobileTab && activeProfile === 'warehouse') setWarehouseTab(mobileTab.dataset.mobileWarehouseTab, true);
});
$$('[data-warehouse-tab]').forEach((button) => button.addEventListener('click', () => setWarehouseTab(button.dataset.warehouseTab)));
$('#switch-profile').addEventListener('click', () => navigate('profile-select'));
$('#task-form').addEventListener('submit', (event) => event.preventDefault());
$('#order-reference').addEventListener('input', updateTaskSelection);
$('#task-activity').addEventListener('change', () => clearTaskFieldError('task-activity', 'task-activity-error'));
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
$('#tracking-list').addEventListener('click', (event) => {
  const button = event.target.closest('[data-entry-action]');
  if (!button) return;
  if (button.dataset.entryAction === 'edit') startEditingEntry(button.dataset.entryId);
  if (button.dataset.entryAction === 'cancel') cancelEditingEntry();
});
$('#tracking-list').addEventListener('submit', (event) => {
  const form = event.target.closest('[data-edit-entry-id]');
  if (!form) return;
  event.preventDefault();
  saveEditedEntry(form);
});
$('#save-entry').addEventListener('click', saveEntry);
$('#comment').addEventListener('input', () => {
  if ($('#comment').value.length <= COMMENT_MAX_LENGTH) clearTaskFieldError('comment', 'comment-error');
});
$('#confirm-activity').addEventListener('change', () => {
  if (isAllowedActivity($('#confirm-activity').value)) clearTaskFieldError('confirm-activity', 'confirm-activity-error');
});
['month-filter','client-filter','status-filter'].forEach((id) => $(`#${id}`).addEventListener('change', renderBilling));
['tracking-month-filter','tracking-client-filter','tracking-order-filter'].forEach((id) => $(`#${id}`).addEventListener('change', () => {
  trackingVisibleLimit = TRACKING_BATCH_SIZE;
  editingEntryId = null;
  showTrackingReportError('');
  renderTracking();
}));
$('#tracking-filter-toggle').addEventListener('click', toggleTrackingFilters);
$('#tracking-filter-reset').addEventListener('click', resetTrackingFilters);
$('#tracking-load-more').addEventListener('click', () => {
  trackingVisibleLimit += TRACKING_BATCH_SIZE;
  renderTracking();
});
$('#export-csv').addEventListener('click', () => exportCsv());
$('#detail-export').addEventListener('click', () => exportCsv(detailClient));
$('#create-tracking-pdf').addEventListener('click', createTrackingPdf);
$('#download-tracking-pdf').addEventListener('click', downloadTrackingPdf);
$('#send-tracking-pdf').addEventListener('click', simulateTrackingPdfSend);
$('#close-pdf-dialog').addEventListener('click', closeTrackingPdf);
$('#pdf-dialog').addEventListener('cancel', (event) => {
  event.preventDefault();
  closeTrackingPdf();
});
window.setInterval(refreshRunningDurations, 1000);

$('#warehouse-greeting').textContent = AUTHENTICATED_OPERATOR;
$('#task-activity').innerHTML = activityOptions('', 'Choisir après');
updateTaskSelection();
updateBillingClientFilter();
showView('login');
