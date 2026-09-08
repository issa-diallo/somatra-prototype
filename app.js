'use strict';

const DEMO_DATE = '2026-08-04';
const STORAGE_KEY = 'somatra-demo-entries-v1';
const CLIENTS_STORAGE_KEY = 'somatra-demo-clients-v1';
const OPEN_TASKS_STORAGE_KEY = 'somatra-demo-open-preparations-v1';
const RESET_STORAGE_VALUES = new Map([
  [STORAGE_KEY, '[]'],
  [CLIENTS_STORAGE_KEY, '{}'],
  [OPEN_TASKS_STORAGE_KEY, '[]']
]);
const AUTHENTICATED_OPERATOR = 'Magasinier démo';
const LEGACY_OPERATOR = 'Magasinier non renseigné (ancienne tâche)';
const UNIDENTIFIED_CLIENT = 'Client à identifier';
const OPERATOR_MAX_LENGTH = 80;
const ORDER_REFERENCE_MAX_LENGTH = 120;
const CLIENT_MAX_LENGTH = 120;
const COMMENT_MAX_LENGTH = 240;
const EDIT_DURATION_MAX_HOURS = 23;
const ENTRY_STATUS_TO_VALIDATE = 'À valider';
const ENTRY_STATUS_VALIDATED = 'Validé';
const LEGACY_ENTRY_STATUS_TO_REVIEW = 'À contrôler';
const ENTRY_STATUSES = [ENTRY_STATUS_TO_VALIDATE, ENTRY_STATUS_VALIDATED];
const ACTIVITIES = ['Préparation de commande', 'Réception de marchandise', 'Rangement', 'Inventaire', 'Retour d’événement', 'Autre'];
const MISSING_ACTIVITY_LABEL = 'Non renseignée';
const MISSING_DEPARTMENT_LABEL = 'Non renseigné';
const DEPARTMENT_MAX_LENGTH = 80;
const TRACKING_BATCH_SIZE = 20;
const seedOrders = {
  'Client A': ['CMD-2026-0142', 'CMD-2026-0151', 'CMD-A-0003', 'CMD-A-0004'],
  'Client B': ['CMD-2026-0147', 'CMD-2026-0155', 'CMD-B-0003', 'CMD-B-0004'],
  'Client C': ['CMD-2026-0149', 'CMD-2026-0158', 'CMD-C-0003', 'CMD-C-0004'],
  'Client D': ['CMD-D-0001', 'CMD-D-0002', 'CMD-D-0003', 'CMD-D-0004'],
  'Client E': ['CMD-E-0001', 'CMD-E-0002', 'CMD-E-0003', 'CMD-E-0004'],
  'Client F': ['CMD-F-0001', 'CMD-F-0002', 'CMD-F-0003', 'CMD-F-0004']
};
const SEED_PREPARATIONS_PER_CLIENT = 40;
const seedMonthTargets = [
  {month:'2026-08', totalMinutes:85714, clientCount:6, preparationsPerClient:SEED_PREPARATIONS_PER_CLIENT},
  {month:'2026-07', totalMinutes:84286, clientCount:6, preparationsPerClient:38},
  {month:'2025-08', totalMinutes:60000, clientCount:5, preparationsPerClient:25}
];

function createSeedEntries() {
  const allClients = Object.keys(seedOrders);
  const comments = ['', '', '', 'Contrôle de démonstration', '', 'Flux standard fictif'];
  return seedMonthTargets.flatMap(({month, totalMinutes, clientCount, preparationsPerClient}, monthIndex) => {
    const clients = allClients.slice(0, clientCount);
    const entriesPerMonth = clients.length * preparationsPerClient;
    const baseMinutes = Math.floor(totalMinutes / entriesPerMonth);
    const extraMinutes = totalMinutes % entriesPerMonth;
    return clients.flatMap((client, clientIndex) => Array.from({length:preparationsPerClient}, (_, preparationIndex) => {
      const monthEntryIndex = clientIndex * preparationsPerClient + preparationIndex;
      const day = (preparationIndex * 3 + clientIndex * 5 + monthIndex) % 28 + 1;
      const clientOrders = seedOrders[client];
      return {
        id: monthIndex * 10000 + monthEntryIndex + 1,
        date: `${month}-${String(day).padStart(2, '0')}`,
        client,
        order: clientOrders[(preparationIndex + monthIndex) % clientOrders.length],
        minutes: baseMinutes + (monthEntryIndex < extraMinutes ? 1 : 0),
        operator: `Opérateur ${String((clientIndex + preparationIndex) % clients.length + 1).padStart(2, '0')}`,
        activity: ACTIVITIES[(clientIndex + preparationIndex + monthIndex) % ACTIVITIES.length],
        comment: comments[(preparationIndex + clientIndex * 2) % comments.length],
        status: ENTRY_STATUS_VALIDATED
      };
    }));
  });
}

const seedEntries = createSeedEntries();

let entries = loadEntries();
let orders = loadClients();
let openTasks = loadOpenTasks();
let referenceClientAssignments = new Map();
reconcileReferenceClientAssignments();
let currentView = 'warehouse';
let pendingTask = null;
let toastTimer = null;
let scanStream = null;
let scanFrame = null;
let scanSession = 0;
let warehouseTab = 'new';
let editingEntryId = null;
let trackingVisibleLimit = TRACKING_BATCH_SIZE;
let preparedReport = null;
let preparedReportUrl = null;
let resetDialogTrigger = null;
let resetInProgress = false;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function loadEntries() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return seedEntries.map((entry) => ({...entry}));
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return seedEntries.map((entry) => ({...entry}));
    return normalizeEntryStatuses(migrateLegacyClients(parsed, STORAGE_KEY));
  } catch (error) {
    return seedEntries.map((entry) => ({...entry}));
  }
}

function persistEntries() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)); } catch (error) { /* Démo utilisable sans stockage persistant. */ }
}

function normalizeEntryStatuses(savedEntries) {
  return savedEntries.map((entry) => entry && entry.status === LEGACY_ENTRY_STATUS_TO_REVIEW
    ? {...entry, status:ENTRY_STATUS_TO_VALIDATE}
    : entry);
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
        ...(Object.prototype.hasOwnProperty.call(task, 'activity') ? {activity:task.activity} : {}),
        ...(Object.prototype.hasOwnProperty.call(task, 'department') ? {department:task.department} : {})
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

function departmentDisplayLabel(record) {
  return record && typeof record.department === 'string' && record.department.trim() ? record.department : MISSING_DEPARTMENT_LABEL;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]));
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
  $('#mobile-nav').classList.toggle('hidden', name === 'confirm');
  renderMobileNav(name);
  if (name === 'warehouse') {
    renderTracking();
    renderOpenTasks();
    renderWarehouseTab();
  }
  $('#app').scrollTop = 0;
  if (name === 'warehouse' && warehouseTab === 'new') $('#order-reference').focus({preventScroll:true});
  else $('#app').focus({preventScroll:true});
}

function navigate(action) {
  if (action === 'home') showView('warehouse');
  if (action === 'warehouse') {
    warehouseTab = currentView === 'confirm' ? 'open' : 'new';
    showView('warehouse');
  }
}

function renderMobileNav(name) {
  const nav = $('#mobile-nav');
  nav.innerHTML = `
    <button type="button" data-mobile-warehouse-tab="new"><span class="mobile-nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></span><span>Nouvelle</span></button>
    <button type="button" data-mobile-warehouse-tab="open"><span class="mobile-nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/></svg></span><span>En cours</span></button>
    <button type="button" data-mobile-warehouse-tab="tracking"><span class="mobile-nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 6h11M8 12h11M8 18h11"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></svg></span><span>Suivi</span></button>
    <button type="button" data-reset-mobile><span class="mobile-nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.3-5.7L4 8"/><path d="M4 4v4h4"/></svg></span><span>Données</span></button>`;
  $$('[data-mobile-warehouse-tab]').forEach((button) => {
    const active = name === 'warehouse' && button.dataset.mobileWarehouseTab === warehouseTab;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
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
  $('#task-department').value = '';
  clearTaskFieldError('task-activity', 'task-activity-error');
  updateTaskSelection();
}

function startTimer() {
  const order = normalizeUserInput($('#order-reference').value);
  const activity = $('#task-activity').value;
  const department = normalizeUserInput($('#task-department').value);
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
  if (department.length > DEPARTMENT_MAX_LENGTH) {
    showTaskFieldError('task-department', 'task-department-error', `Le département ne peut pas dépasser ${DEPARTMENT_MAX_LENGTH} caractères.`);
    $('#task-department').focus();
    return;
  }
  clearTaskFieldError('task-department', 'task-department-error');
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
    ...(activity ? {activity} : {}),
    ...(department ? {department} : {})
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
  $('#confirm-department').value = task.department || '';
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
      <div class="open-task-main"><div><strong>${escapeHtml(task.order)}</strong><span>${escapeHtml(task.client)} · ${escapeHtml(task.operator || LEGACY_OPERATOR)}</span><span class="open-task-activity">Département : ${escapeHtml(departmentDisplayLabel(task))} · Activité : ${escapeHtml(activityDisplayLabel(task))}</span></div><span class="task-status ${running ? 'running' : 'paused'}">${running ? 'En cours' : 'En pause'}</span></div>
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
  const department = normalizeUserInput($('#confirm-department').value);
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
  if (department.length > DEPARTMENT_MAX_LENGTH) {
    showTaskFieldError('confirm-department', 'confirm-department-error', `Le département ne peut pas dépasser ${DEPARTMENT_MAX_LENGTH} caractères.`);
    $('#confirm-department').focus();
    return;
  }
  clearTaskFieldError('confirm-department', 'confirm-department-error');
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
    minutes: total, operator: pendingTask.operator || LEGACY_OPERATOR, activity, ...(department ? {department} : {}), comment, status: ENTRY_STATUS_TO_VALIDATE
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
  const invalidStatusOption = ENTRY_STATUSES.includes(entry.status)
    ? ''
    : `<option value="" selected>Statut « ${escapeHtml(entry.status)} » non proposé — choisissez</option>`;
  return `<form class="tracking-edit-form" data-edit-entry-id="${escapeHtml(entry.id)}" novalidate>
    <div class="tracking-edit-grid">
      <label>Client/commande<input name="client" type="text" value="${escapeHtml(entry.client)}" maxlength="${CLIENT_MAX_LENGTH}" autocomplete="off" required></label>
      <label>Référence<input name="order" type="text" value="${escapeHtml(entry.order)}" maxlength="${ORDER_REFERENCE_MAX_LENGTH}" autocomplete="off" required></label>
      <label>Département <span class="optional">(facultatif)</span><input name="department" type="text" value="${escapeHtml(entry.department || '')}" maxlength="${DEPARTMENT_MAX_LENGTH}" autocomplete="off"></label>
      <label>Opérateur<input name="operator" type="text" value="${escapeHtml(entry.operator || LEGACY_OPERATOR)}" maxlength="${OPERATOR_MAX_LENGTH}" autocomplete="off" required></label>
      <label>Date<input name="date" type="date" value="${escapeHtml(entry.date)}" required></label>
      <label>Activité<select name="activity" required>${activityOptions(isAllowedActivity(entry.activity) ? entry.activity : '')}</select></label>
      <fieldset><legend>Durée</legend><div class="tracking-duration-fields"><label>Heures<input name="hours" type="number" value="${escapeHtml(hours)}" min="0" max="${EDIT_DURATION_MAX_HOURS}" inputmode="numeric" required></label><label>Minutes<input name="minutes" type="number" value="${escapeHtml(minutes)}" min="0" max="59" inputmode="numeric" required></label></div></fieldset>
      <label>Statut<select name="status" required>${invalidStatusOption}${ENTRY_STATUSES.map((status) => `<option value="${escapeHtml(status)}"${entry.status === status ? ' selected' : ''}>${escapeHtml(status)}</option>`).join('')}</select></label>
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
    <button class="tracking-row-button" type="button" data-entry-action="edit" data-entry-id="${escapeHtml(entry.id)}" aria-label="Modifier la préparation, client ${escapeHtml(entry.client)}, référence ${escapeHtml(entry.order)}, département ${escapeHtml(departmentDisplayLabel(entry))}, activité ${escapeHtml(activityDisplayLabel(entry))}, statut ${escapeHtml(entry.status)}, date ${escapeHtml(formatShortDate(entry.date))}, durée ${escapeHtml(formatDuration(entry.minutes))}">
      <span class="tracking-row-content">
        <span class="tracking-row-main"><strong>${escapeHtml(entry.client)}</strong><span class="status ${entry.status === ENTRY_STATUS_VALIDATED ? 'valid' : 'review'}">${escapeHtml(entry.status)}</span></span>
        <span class="tracking-row-meta"><span class="tracking-row-reference">${escapeHtml(entry.order)}</span><span aria-hidden="true"> · </span><span>${escapeHtml(formatShortDate(entry.date))}</span><span aria-hidden="true"> · </span><span class="duration">${formatDuration(entry.minutes)}</span></span>
        <span class="tracking-row-activity">Département : ${escapeHtml(departmentDisplayLabel(entry))} · Activité : ${escapeHtml(activityDisplayLabel(entry))}</span>
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
  const department = normalizeUserInput(form.elements.department.value);
  const operator = normalizeUserInput(form.elements.operator.value);
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
  if (department.length > DEPARTMENT_MAX_LENGTH) errors.push({name:'department', message:`Le département ne peut pas dépasser ${DEPARTMENT_MAX_LENGTH} caractères.`});
  if (!operator) errors.push({name:'operator', message:'Indiquez un opérateur.'});
  else if (operator.length > OPERATOR_MAX_LENGTH) errors.push({name:'operator', message:`L’opérateur ne peut pas dépasser ${OPERATOR_MAX_LENGTH} caractères.`});
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
  Object.assign(entry, {client:assignedClient, order, operator, date, minutes:totalMinutes, activity, status});
  if (department) entry.department = department;
  else delete entry.department;
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

function monthLabel(value) {
  const [year, month] = value.split('-').map(Number);
  const text = new Intl.DateTimeFormat('fr-FR', {month:'long', year:'numeric'}).format(new Date(year, month - 1, 1));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function clearPreparedReport() {
  if (preparedReportUrl) URL.revokeObjectURL(preparedReportUrl);
  preparedReportUrl = null;
  preparedReport = null;
  $('#report-preview').removeAttribute('data');
}

function showTrackingReportError(message) {
  const output = $('#tracking-report-error');
  output.textContent = message;
  output.classList.toggle('hidden', !message);
}

function reportEntries() {
  const month = $('#tracking-month-filter').value;
  const order = $('#tracking-order-filter').value;
  const client = $('#tracking-client-filter').value;
  return entries.filter((entry) => entry.date.startsWith(month) && (order === 'all' || entry.order === order) && (client === 'all' || entry.client === client));
}

function prepareTrackingReport(allClients) {
  showTrackingReportError('');
  const month = $('#tracking-month-filter').value;
  const client = allClients ? 'all' : $('#tracking-client-filter').value;
  if (month === 'all') {
    showTrackingReportError('Sélectionnez un mois pour préparer les relevés.');
    $('#tracking-month-filter').focus();
    return;
  }
  if (!allClients && client === 'all') {
    showTrackingReportError('Sélectionnez un client pour préparer son PDF.');
    $('#tracking-client-filter').focus();
    return;
  }
  const filtered = reportEntries();
  if (!filtered.length) {
    showTrackingReportError('Aucune saisie ne correspond au périmètre. Aucun fichier n’a été créé.');
    return;
  }
  try {
    clearPreparedReport();
    preparedReport = SomatraReports.prepareArtifact(filtered, month, client);
    const blob = new Blob([preparedReport.bytes], {type:preparedReport.mime});
    preparedReportUrl = URL.createObjectURL(blob);
    $('#report-summary').textContent = `${monthLabel(month)} · ${client === 'all' ? 'Tous les clients filtrés' : client} · ${preparedReport.pdfCount} PDF · format ${preparedReport.format}`;
    $('#report-preview-wrap').classList.toggle('hidden', preparedReport.format !== 'PDF');
    if (preparedReport.format === 'PDF') $('#report-preview').data = preparedReportUrl;
    $('#download-prepared-report').textContent = `Télécharger le ${preparedReport.format}`;
    $('#report-download-status').textContent = '';
    $('#report-send-status').textContent = '';
    $('#report-download-status').classList.add('hidden');
    $('#report-send-status').classList.add('hidden');
    $('#send-prepared-report').disabled = false;
    $('#report-dialog').showModal();
  } catch (error) {
    clearPreparedReport();
    showTrackingReportError('La génération locale a échoué. Rechargez la page puis réessayez.');
  }
}

function downloadPreparedReport() {
  if (!preparedReport || !preparedReportUrl) return;
  const anchor = document.createElement('a');
  anchor.href = preparedReportUrl;
  anchor.download = preparedReport.filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  const status = $('#report-download-status');
  status.textContent = `Téléchargement lancé : ${preparedReport.filename}.`;
  status.classList.remove('hidden');
  toast(`Téléchargement ${preparedReport.format} lancé`);
}

function simulatePreparedReportSend() {
  if (!preparedReport) return;
  const sameBytes = preparedReport.bytes;
  const status = $('#report-send-status');
  status.dataset.byteLength = String(sameBytes.byteLength);
  status.textContent = `Envoi simulé : les ${sameBytes.byteLength} octets du ${preparedReport.format} préparé sont réutilisés à l’identique. Personne n’a rien reçu et aucune requête réseau n’a été effectuée.`;
  status.classList.remove('hidden');
  status.scrollIntoView({block:'nearest'});
  $('#send-prepared-report').disabled = true;
}

function closeReportDialog() {
  const dialog = $('#report-dialog');
  if (dialog.open) dialog.close();
  clearPreparedReport();
}

function toast(message) {
  window.clearTimeout(toastTimer);
  $('#toast').textContent = message;
  $('#toast').classList.add('show');
  toastTimer = window.setTimeout(() => $('#toast').classList.remove('show'), 3200);
}

function showResetError(message) {
  const error = $('#reset-error');
  error.textContent = message;
  error.classList.toggle('hidden', !message);
  if (message) error.focus();
}

function openResetDialog() {
  resetDialogTrigger = document.activeElement;
  showResetError('');
  $('#reset-dialog').showModal();
  $('#cancel-reset').focus();
}

function closeResetDialog() {
  if (resetInProgress) return;
  const dialog = $('#reset-dialog');
  if (dialog.open) dialog.close();
}

function setResetActionsDisabled(disabled) {
  $('#confirm-reset').disabled = disabled;
  $('#load-full-demo').disabled = disabled;
}

function restoreResetSnapshot(storage, snapshot) {
  let compensationFailed = false;
  snapshot.forEach((value, key) => {
    try {
      if (value === null) storage.removeItem(key);
      else storage.setItem(key, value);
    } catch (error) {
      compensationFailed = true;
    }
  });
  snapshot.forEach((value, key) => {
    try {
      if (storage.getItem(key) !== value) compensationFailed = true;
    } catch (error) {
      compensationFailed = true;
    }
  });
  return compensationFailed;
}

function resetDemo() {
  if (resetInProgress) return;
  resetInProgress = true;
  setResetActionsDisabled(true);
  showResetError('');
  let storage;
  let snapshot;
  let stateSnapshot;
  try {
    storage = window.localStorage;
    snapshot = new Map([...RESET_STORAGE_VALUES.keys()].map((key) => [key, storage.getItem(key)]));
    stateSnapshot = {
      entries,
      orders,
      openTasks,
      referenceClientAssignments,
      pendingTask,
      editingEntryId,
      trackingVisibleLimit
    };
    RESET_STORAGE_VALUES.forEach((value, key) => storage.setItem(key, value));
    RESET_STORAGE_VALUES.forEach((value, key) => {
      if (storage.getItem(key) !== value) throw new Error('Vérification du stockage impossible');
    });

    entries = [];
    orders = {};
    openTasks = [];
    referenceClientAssignments = new Map();
    pendingTask = null;
    editingEntryId = null;
    trackingVisibleLimit = TRACKING_BATCH_SIZE;
    showTrackingReportError('');
    renderTracking();
    renderOpenTasks();
  } catch (error) {
    if (stateSnapshot) {
      ({
        entries,
        orders,
        openTasks,
        referenceClientAssignments,
        pendingTask,
          editingEntryId,
        trackingVisibleLimit
      } = stateSnapshot);
    }
    const compensationFailed = storage && snapshot ? restoreResetSnapshot(storage, snapshot) : false;
    resetInProgress = false;
    setResetActionsDisabled(false);
    showResetError(compensationFailed
      ? 'La réinitialisation a échoué et certaines données locales n’ont pas pu être restaurées ou vérifiées. Rechargez la page, puis réessayez.'
      : 'La réinitialisation a échoué. Vos données locales ont été conservées ou restaurées. Réessayez après avoir rechargé la page.');
    return;
  }

  window.location.reload();
}

function loadFullDemo() {
  if (resetInProgress) return;
  resetInProgress = true;
  setResetActionsDisabled(true);
  showResetError('');
  let storage;
  let snapshot;
  try {
    storage = window.localStorage;
    snapshot = new Map([...RESET_STORAGE_VALUES.keys()].map((key) => [key, storage.getItem(key)]));
    const demoStorageValues = new Map([
      [STORAGE_KEY, JSON.stringify(seedEntries)],
      [CLIENTS_STORAGE_KEY, JSON.stringify(seedOrders)],
      [OPEN_TASKS_STORAGE_KEY, '[]']
    ]);
    demoStorageValues.forEach((value, key) => storage.setItem(key, value));
    demoStorageValues.forEach((value, key) => {
      if (storage.getItem(key) !== value) throw new Error('Vérification du stockage impossible');
    });
  } catch (error) {
    const compensationFailed = storage && snapshot ? restoreResetSnapshot(storage, snapshot) : false;
    resetInProgress = false;
    setResetActionsDisabled(false);
    showResetError(compensationFailed
      ? 'Le chargement a échoué et certaines données locales n’ont pas pu être restaurées ou vérifiées. Rechargez la page, puis réessayez.'
      : 'Le chargement a échoué. Vos données locales ont été conservées ou restaurées. Réessayez après avoir rechargé la page.');
    return;
  }

  window.location.reload();
}

document.addEventListener('click', (event) => {
  const actionButton = event.target.closest('[data-action]');
  if (actionButton) navigate(actionButton.dataset.action);
  const mobileTab = event.target.closest('[data-mobile-warehouse-tab]');
  if (mobileTab) setWarehouseTab(mobileTab.dataset.mobileWarehouseTab, true);
  if (event.target.closest('[data-reset-mobile]')) openResetDialog();
});
$$('[data-warehouse-tab]').forEach((button) => button.addEventListener('click', () => setWarehouseTab(button.dataset.warehouseTab)));
$('#task-form').addEventListener('submit', (event) => event.preventDefault());
$('#order-reference').addEventListener('input', updateTaskSelection);
$('#task-department').addEventListener('input', () => { if ($('#task-department').value.length <= DEPARTMENT_MAX_LENGTH) clearTaskFieldError('task-department', 'task-department-error'); });
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
$('#confirm-department').addEventListener('input', () => { if ($('#confirm-department').value.length <= DEPARTMENT_MAX_LENGTH) clearTaskFieldError('confirm-department', 'confirm-department-error'); });
$('#confirm-activity').addEventListener('change', () => {
  if (isAllowedActivity($('#confirm-activity').value)) clearTaskFieldError('confirm-activity', 'confirm-activity-error');
});
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
$('#prepare-client-pdf').addEventListener('click', () => prepareTrackingReport(false));
$('#prepare-all-zip').addEventListener('click', () => prepareTrackingReport(true));
$('#download-prepared-report').addEventListener('click', downloadPreparedReport);
$('#send-prepared-report').addEventListener('click', simulatePreparedReportSend);
$('#close-report-dialog').addEventListener('click', closeReportDialog);
$('#report-dialog').addEventListener('cancel', (event) => { event.preventDefault(); closeReportDialog(); });
$('#open-reset-dialog').addEventListener('click', openResetDialog);
$('#close-reset-dialog').addEventListener('click', closeResetDialog);
$('#cancel-reset').addEventListener('click', closeResetDialog);
$('#load-full-demo').addEventListener('click', loadFullDemo);
$('#confirm-reset').addEventListener('click', resetDemo);
$('#reset-dialog').addEventListener('cancel', (event) => {
  event.preventDefault();
  closeResetDialog();
});
$('#reset-dialog').addEventListener('click', (event) => {
  if (event.target === event.currentTarget) closeResetDialog();
});
$('#reset-dialog').addEventListener('close', () => {
  if (resetDialogTrigger && resetDialogTrigger.isConnected) resetDialogTrigger.focus();
  resetDialogTrigger = null;
});
window.setInterval(refreshRunningDurations, 1000);

$('#warehouse-greeting').textContent = AUTHENTICATED_OPERATOR;
$('#task-activity').innerHTML = activityOptions('', 'Choisir après');
updateTaskSelection();
showView('warehouse');
