'use strict';

const DEMO_DATE = '2026-08-04';
const RATE = 42;
const STORAGE_KEY = 'somatra-demo-entries-v1';
const orders = {
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
let currentView = 'login';
let timerInterval = null;
let timerStartedAt = 0;
let elapsedDemoSeconds = 0;
let pendingTask = null;
let detailClient = null;
let toastTimer = null;

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

function showView(name) {
  $$('.view').forEach((view) => view.classList.add('hidden'));
  $(`#view-${name}`).classList.remove('hidden');
  currentView = name;
  const loggedIn = name !== 'login';
  $('#switch-profile').classList.toggle('hidden', !loggedIn);
  $('#mobile-nav').classList.toggle('hidden', !loggedIn || name === 'confirm');
  $$('#mobile-nav button').forEach((button) => button.classList.toggle('active', button.dataset.action === name || (name === 'detail' && button.dataset.action === 'billing')));
  if (name === 'warehouse') renderRecent();
  if (name === 'billing') renderBilling();
  window.scrollTo(0, 0);
  $('#app').focus({preventScroll:true});
}

function navigate(action) {
  if (action === 'home') showView(currentView === 'login' ? 'login' : (currentView === 'warehouse' || currentView === 'confirm' ? 'warehouse' : 'billing'));
  if (action === 'warehouse') showView('warehouse');
  if (action === 'billing') showView('billing');
}

function setProfile(profile) {
  showView(profile === 'warehouse' ? 'warehouse' : 'billing');
  toast(profile === 'warehouse' ? 'Profil magasinier activé' : 'Profil facturation activé');
}

function populateOrders() {
  const client = $('#client-select').value;
  const select = $('#order-select');
  select.innerHTML = client ? '<option value="">Sélectionner une commande…</option>' + orders[client].map((order) => `<option>${order}</option>`).join('') : '<option value="">Choisir d’abord un client…</option>';
  select.disabled = !client;
  updateTaskSelection();
}

function updateTaskSelection() {
  const client = $('#client-select').value;
  const order = $('#order-select').value;
  const complete = Boolean(client && order);
  $('#task-summary').classList.toggle('hidden', !complete);
  $('#timer-button').disabled = !complete;
  if (complete) {
    $('#selected-client').textContent = client;
    $('#selected-order').textContent = order;
  }
}

function formatClock(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return [hours, minutes, secs].map((value) => String(value).padStart(2, '0')).join(':');
}

function startTimer() {
  const client = $('#client-select').value;
  const order = $('#order-select').value;
  if (!client || !order) return;
  pendingTask = {client, order};
  timerStartedAt = Date.now();
  elapsedDemoSeconds = 0;
  $('#timer-state').textContent = 'PRÉPARATION EN COURS';
  $('#timer-state').classList.add('running');
  $('#timer-button').innerHTML = '<span aria-hidden="true">■</span> Arrêter et confirmer';
  $('#timer-button').classList.add('stop');
  $('#cancel-timer').classList.remove('hidden');
  $('#client-select').disabled = true;
  $('#order-select').disabled = true;
  timerInterval = window.setInterval(() => {
    elapsedDemoSeconds = Math.floor((Date.now() - timerStartedAt) / 1000 * 10);
    $('#timer').textContent = formatClock(elapsedDemoSeconds);
  }, 100);
}

function stopTimer() {
  window.clearInterval(timerInterval);
  timerInterval = null;
  elapsedDemoSeconds = Math.max(1, Math.floor((Date.now() - timerStartedAt) / 1000 * 10));
  const roundedMinutes = Math.max(1, Math.ceil(elapsedDemoSeconds / 60));
  $('#confirm-client').textContent = pendingTask.client;
  $('#confirm-order').textContent = pendingTask.order;
  $('#duration-hours').value = Math.floor(roundedMinutes / 60);
  $('#duration-minutes').value = roundedMinutes % 60;
  $('#comment').value = '';
  $('#duration-error').classList.add('hidden');
  resetTimerUI(false);
  showView('confirm');
}

function resetTimerUI(clearTask = true) {
  if (timerInterval) window.clearInterval(timerInterval);
  timerInterval = null;
  timerStartedAt = 0;
  elapsedDemoSeconds = 0;
  $('#timer').textContent = '00:00:00';
  $('#timer-state').textContent = 'PRÊT À DÉMARRER';
  $('#timer-state').classList.remove('running');
  $('#timer-button').innerHTML = '<span aria-hidden="true">▶</span> Démarrer la préparation';
  $('#timer-button').classList.remove('stop');
  $('#cancel-timer').classList.add('hidden');
  $('#client-select').disabled = false;
  $('#order-select').disabled = !$('#client-select').value;
  if (clearTask) pendingTask = null;
  updateTaskSelection();
}

function cancelTimer() {
  resetTimerUI(true);
  toast('Tâche annulée — aucune saisie créée');
}

function saveEntry() {
  const hours = Number.parseInt($('#duration-hours').value, 10) || 0;
  const minutesPart = Number.parseInt($('#duration-minutes').value, 10) || 0;
  const total = hours * 60 + minutesPart;
  if (hours < 0 || minutesPart < 0 || minutesPart > 59 || total <= 0) {
    $('#duration-error').classList.remove('hidden');
    return;
  }
  $('#duration-error').classList.add('hidden');
  entries.push({
    id: Date.now(), date: DEMO_DATE, client: pendingTask.client, order: pendingTask.order,
    minutes: total, operator: 'Opérateur démo', comment: $('#comment').value.trim(), status: 'À contrôler'
  });
  persistEntries();
  const order = pendingTask.order;
  resetTimerUI(true);
  $('#task-form').reset();
  populateOrders();
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
  $('#today-total').textContent = `${formatDuration(recent.reduce((sum, entry) => sum + entry.minutes, 0))} aujourd’hui`;
  $('#recent-list').innerHTML = recent.length ? recent.slice(0, 4).map((entry) => `<div class="recent-item"><div><strong>${escapeHtml(entry.order)}</strong><small>${escapeHtml(entry.client)}</small></div><div><small>${escapeHtml(entry.operator)}</small><small>${entry.status}</small></div><span class="duration">${formatDuration(entry.minutes)}</span></div>`).join('') : '<div class="recent-item"><span>Aucune saisie aujourd’hui.</span></div>';
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

function renderBilling() {
  const filtered = getFilteredEntries();
  const groups = Object.values(groupByClient(filtered)).sort((a,b) => a.client.localeCompare(b.client));
  const minutes = filtered.reduce((sum, entry) => sum + entry.minutes, 0);
  const reviewCount = filtered.filter((entry) => entry.status === 'À contrôler').length;
  $('#kpi-grid').innerHTML = [
    ['Clients', groups.length, ''], ['Préparations', filtered.length, ''], ['Temps total', formatDuration(minutes), 'orange'], ['Montant estimé*', formatMoney(minutes / 60 * RATE), 'green']
  ].map(([label,value,color]) => `<div class="kpi ${color}"><span>${label}</span><strong>${value}</strong></div>`).join('');
  $('#result-count').textContent = `${groups.length} client${groups.length > 1 ? 's' : ''} · ${reviewCount} saisie${reviewCount > 1 ? 's' : ''} à contrôler`;
  $('#billing-rows').innerHTML = groups.length ? groups.map((group) => `<tr><td><strong>${group.client}</strong></td><td>${group.count}</td><td class="duration">${formatDuration(group.minutes)}</td><td>${formatMoney(group.minutes / 60 * RATE)}</td><td><span class="status ${group.review ? 'review' : 'valid'}">${group.review ? 'À contrôler' : 'Validé'}</span></td><td><button class="detail-button" type="button" data-client="${group.client}">Voir le détail →</button></td></tr>`).join('') : '<tr><td class="empty" colspan="6">Aucune saisie ne correspond aux filtres.</td></tr>';
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
  $('#detail-rows').innerHTML = filtered.length ? filtered.map((entry) => `<tr><td>${formatDate(entry.date)}</td><td><strong>${escapeHtml(entry.order)}</strong></td><td>${escapeHtml(entry.operator)}</td><td class="duration">${formatDuration(entry.minutes)}</td><td>${escapeHtml(entry.comment || '—')}</td><td><span class="status ${entry.status === 'Validé' ? 'valid' : 'review'}">${entry.status}</span></td></tr>`).join('') : '<tr><td class="empty" colspan="6">Aucune préparation.</td></tr>';
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
$('#switch-profile').addEventListener('click', () => { if (timerInterval && !window.confirm('Un chronomètre est actif. Quitter et annuler cette tâche ?')) return; resetTimerUI(true); showView('login'); });
$('#client-select').addEventListener('change', populateOrders);
$('#order-select').addEventListener('change', updateTaskSelection);
$('#timer-button').addEventListener('click', () => timerInterval ? stopTimer() : startTimer());
$('#cancel-timer').addEventListener('click', cancelTimer);
$('#save-entry').addEventListener('click', saveEntry);
['month-filter','client-filter','status-filter'].forEach((id) => $(`#${id}`).addEventListener('change', renderBilling));
$('#export-csv').addEventListener('click', () => exportCsv());
$('#detail-export').addEventListener('click', () => exportCsv(detailClient));

showView('login');
