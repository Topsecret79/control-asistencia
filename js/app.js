// Controlador Principal de la App de Control de Asistencia y Jornadas

class SoundFX {
  constructor() {
    this.ctx = null;
  }
  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) this.ctx = new AudioContext();
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }
  playBeep(freq = 600, duration = 0.08) {
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {}
  }
  clickPresent() {
    this.playBeep(700, 0.07);
    if (navigator.vibrate) navigator.vibrate(20);
  }
  clickAbsent() {
    this.playBeep(450, 0.07);
    if (navigator.vibrate) navigator.vibrate(15);
  }
}

const sounds = new SoundFX();

// Estado de la interfaz
let activeDate = new Date(); // Fecha actual seleccionada para pasar lista
let statsYear = activeDate.getFullYear();
let statsMonth = activeDate.getMonth() + 1; // 1 a 12
let currentTab = 'attendance';

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initDateControls();
  initStatsControls();
  initWorkersControls();
  initPWA();

  // Render inicial
  renderDateDisplay();
  renderAttendance();
  renderRanking();
  renderWorkersDirectory();
});

// Pestañas de navegación
function initTabs() {
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabId = tab.getAttribute('data-tab');
      switchTab(tabId);
    });
  });
}

function switchTab(tabId) {
  currentTab = tabId;
  document.querySelectorAll('.nav-tab').forEach(t => {
    t.classList.toggle('active', t.getAttribute('data-tab') === tabId);
  });
  document.querySelectorAll('.tab-pane').forEach(p => {
    p.classList.toggle('active', p.id === `pane-${tabId}`);
  });

  const titles = {
    attendance: 'Control de Asistencia',
    ranking: 'Lista y Cierre de Mes',
    workers: 'Gestión de Personas'
  };
  document.getElementById('brand-title').textContent = titles[tabId] || 'Control de Asistencia';

  if (tabId === 'ranking') renderRanking();
  if (tabId === 'workers') renderWorkersDirectory();
  if (tabId === 'attendance') renderAttendance();
}

// Formateo de fecha YYYY-MM-DD
function getDateString(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function initDateControls() {
  const dateInput = document.getElementById('selected-date-input');

  // Inicializar input de fecha con hoy
  dateInput.value = getDateString(activeDate);

  dateInput.addEventListener('change', (e) => {
    if (e.target.value) {
      const parts = e.target.value.split('-');
      activeDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      renderDateDisplay();
      renderAttendance();
    }
  });

  document.getElementById('btn-prev-day').addEventListener('click', () => {
    activeDate.setDate(activeDate.getDate() - 1);
    dateInput.value = getDateString(activeDate);
    renderDateDisplay();
    renderAttendance();
  });

  document.getElementById('btn-next-day').addEventListener('click', () => {
    activeDate.setDate(activeDate.getDate() + 1);
    dateInput.value = getDateString(activeDate);
    renderDateDisplay();
    renderAttendance();
  });

  document.getElementById('btn-today').addEventListener('click', () => {
    activeDate = new Date();
    dateInput.value = getDateString(activeDate);
    renderDateDisplay();
    renderAttendance();
  });

  // Marcar todos / desmarcar todos
  document.getElementById('btn-check-all').addEventListener('click', () => {
    const dStr = getDateString(activeDate);
    window.attendanceManager.markAll(dStr, true);
    sounds.clickPresent();
    renderAttendance();
  });

  document.getElementById('btn-uncheck-all').addEventListener('click', () => {
    const dStr = getDateString(activeDate);
    window.attendanceManager.markAll(dStr, false);
    sounds.clickAbsent();
    renderAttendance();
  });
}

function renderDateDisplay() {
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const str = activeDate.toLocaleDateString('es-ES', options);
  document.getElementById('date-display-label').textContent = str;
}

// --- RENDERIZADO DE ASISTENCIA DIARIA ---

function renderAttendance() {
  const manager = window.attendanceManager;
  const dStr = getDateString(activeDate);
  const container = document.getElementById('attendance-list-container');
  container.innerHTML = '';

  const workers = manager.getActiveWorkers();
  let presentCount = 0;

  workers.forEach(worker => {
    const isPresent = manager.isWorkerPresent(dStr, worker.id);
    if (isPresent) presentCount++;

    const card = document.createElement('div');
    card.className = `worker-attendance-card ${isPresent ? 'present' : ''}`;
    card.setAttribute('data-id', worker.id);

    card.innerHTML = `
      <div class="worker-info">
        <div class="worker-avatar">${worker.name.charAt(0).toUpperCase()}</div>
        <div class="worker-name-row">
          <span class="worker-name-text">${worker.name}</span>
          <button type="button" class="btn-rename" title="Editar nombre de ${worker.name}">✏️</button>
        </div>
      </div>
      <div class="status-pill">
        ${isPresent ? 'Trabajó ✅' : 'Descanso ⚪'}
      </div>
    `;

    // Toque para marcar/desmarcar
    card.addEventListener('click', (e) => {
      if (e.target.closest('.btn-rename')) return;
      const nowPresent = manager.toggleAttendance(dStr, worker.id);
      if (nowPresent) sounds.clickPresent();
      else sounds.clickAbsent();
      renderAttendance();
    });

    // Botón para renombrar persona al vuelo
    const renameBtn = card.querySelector('.btn-rename');
    renameBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const nuevo = prompt(`Cambiar nombre de "${worker.name}":`, worker.name);
      if (nuevo && nuevo.trim() && nuevo.trim() !== worker.name) {
        manager.editWorker(worker.id, nuevo);
        renderAttendance();
      }
    });

    container.appendChild(card);
  });

  // Actualizar contador del día
  document.getElementById('attendees-counter').textContent = `${presentCount} de ${workers.length}`;
}

// --- ESTADÍSTICAS Y LISTA ORDENADA DE FIN DE MES ---

function initStatsControls() {
  document.getElementById('btn-prev-month').addEventListener('click', () => {
    statsMonth--;
    if (statsMonth < 1) {
      statsMonth = 12;
      statsYear--;
    }
    renderRanking();
  });

  document.getElementById('btn-next-month').addEventListener('click', () => {
    statsMonth++;
    if (statsMonth > 12) {
      statsMonth = 1;
      statsYear++;
    }
    renderRanking();
  });

  // Botón Copiar para WhatsApp
  document.getElementById('btn-share-whatsapp').addEventListener('click', () => {
    const text = window.attendanceManager.getShareableMonthlyText(statsYear, statsMonth);

    // Si soporta Web Share API en móvil
    if (navigator.share) {
      navigator.share({
        title: `Jornadas ${window.attendanceManager.getMonthName(statsMonth)} ${statsYear}`,
        text: text
      }).catch(() => copyToClipboard(text));
    } else {
      copyToClipboard(text);
    }
  });

  // Cerrar modal de desglose
  document.getElementById('btn-close-worker-modal').addEventListener('click', () => {
    document.getElementById('modal-worker-dates').classList.remove('open');
  });
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast('¡Lista copiada! Ya puedes pegarla en WhatsApp');
  }).catch(() => {
    prompt('Copia este texto para WhatsApp:', text);
  });
}

function showToast(msg) {
  const toast = document.getElementById('toast-msg');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2800);
}

function renderRanking() {
  const manager = window.attendanceManager;
  const data = manager.getMonthlyRanking(statsYear, statsMonth);

  // Cabecera del mes
  document.getElementById('stats-month-title').textContent = `${data.monthName} ${data.year}`;
  document.getElementById('stats-month-days').textContent = `Total de días con trabajo: ${data.totalRecordedDays}`;

  // Tarjeta: El que más trabajó
  const topNames = data.mostWorked.map(w => w.name).join(', ') || '-';
  const topDays = data.mostWorked.length > 0 ? data.mostWorked[0].daysWorked : 0;
  document.getElementById('highlight-top-name').textContent = topNames;
  document.getElementById('highlight-top-days').textContent = `${topDays} días`;

  // Tarjeta: El que menos trabajó
  const bottomNames = (data.leastWorked.length > 0 && data.leastWorked[0].daysWorked < topDays)
    ? data.leastWorked.map(w => w.name).join(', ')
    : '-';
  const bottomDays = (data.leastWorked.length > 0 && data.leastWorked[0].daysWorked < topDays)
    ? data.leastWorked[0].daysWorked
    : 0;
  document.getElementById('highlight-bottom-name').textContent = bottomNames;
  document.getElementById('highlight-bottom-days').textContent = `${bottomDays} días`;

  // Lista oficial ordenada de fin de mes
  const listContainer = document.getElementById('monthly-ranking-container');
  listContainer.innerHTML = '';

  if (data.ranking.length === 0 || data.totalRecordedDays === 0) {
    listContainer.innerHTML = '<div style="text-align:center; color: var(--text-dim); padding: 18px; font-size: 0.9rem;">No hay jornadas registradas en este mes.</div>';
    return;
  }

  data.ranking.forEach((item, index) => {
    const row = document.createElement('div');
    row.className = 'ranking-item';

    let rankIcon = `${item.rank}º`;
    if (index === 0 && item.daysWorked > 0) rankIcon = '🥇';
    else if (index === 1 && item.daysWorked > 0) rankIcon = '🥈';
    else if (index === 2 && item.daysWorked > 0) rankIcon = '🥉';

    row.innerHTML = `
      <div class="ranking-item-top-row">
        <span class="rank-badge ${index < 3 ? 'rank-' + (index + 1) : ''}">${rankIcon}</span>
        <span class="ranking-worker-name">${item.name}</span>
        <div class="ranking-days-count">
          ${item.daysWorked} <span>días</span>
        </div>
      </div>
      <div class="progress-bar-bg">
        <div class="progress-bar-fill" style="width: ${item.percentage}%;"></div>
      </div>
    `;

    // Al tocar una persona, ver desglose de fechas trabajadas
    row.addEventListener('click', () => {
      openWorkerDatesModal(item.name, item.dates, data.monthName, data.year);
    });

    listContainer.appendChild(row);
  });
}

function openWorkerDatesModal(workerName, dates, monthName, year) {
  document.getElementById('modal-worker-name').textContent = `${workerName} (${dates.length} días en ${monthName} ${year})`;
  const chipsContainer = document.getElementById('worker-dates-chips');
  chipsContainer.innerHTML = '';

  if (dates.length === 0) {
    chipsContainer.innerHTML = '<div style="color: var(--text-dim); font-size: 0.85rem;">No trabajó ningún día en este mes.</div>';
  } else {
    // Ordenar fechas cronológicamente
    dates.sort().forEach(dStr => {
      const parts = dStr.split('-');
      const dayNum = parseInt(parts[2], 10);
      const chip = document.createElement('div');
      chip.className = 'date-chip';
      chip.textContent = `Día ${dayNum} (${dStr})`;
      chipsContainer.appendChild(chip);
    });
  }

  document.getElementById('modal-worker-dates').classList.add('open');
}

// --- GESTIÓN DE TRABAJADORES ---

function initWorkersControls() {
  const addForm = document.getElementById('add-worker-form');
  const addInput = document.getElementById('new-worker-name-input');

  addForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = addInput.value.trim();
    if (name) {
      window.attendanceManager.addWorker(name);
      addInput.value = '';
      showToast(`Persona añadida: "${name}"`);
      renderWorkersDirectory();
      renderAttendance();
    }
  });
}

function renderWorkersDirectory() {
  const manager = window.attendanceManager;
  const list = document.getElementById('workers-directory-container');
  list.innerHTML = '';

  const workers = manager.workers;

  if (workers.length === 0) {
    list.innerHTML = '<div style="text-align:center; color: var(--text-dim); padding: 14px;">No hay personas registradas. Añade una arriba.</div>';
    return;
  }

  workers.forEach(w => {
    const item = document.createElement('div');
    item.className = 'worker-directory-item';
    item.innerHTML = `
      <span class="worker-dir-name">${w.name}</span>
      <div class="worker-dir-actions">
        <button type="button" class="icon-btn-action edit" title="Editar nombre">✏️</button>
        <button type="button" class="icon-btn-action delete" title="Eliminar">🗑️</button>
      </div>
    `;

    item.querySelector('.edit').addEventListener('click', () => {
      const nuevo = prompt(`Editar nombre de "${w.name}":`, w.name);
      if (nuevo && nuevo.trim() && nuevo.trim() !== w.name) {
        manager.editWorker(w.id, nuevo);
        renderWorkersDirectory();
        renderAttendance();
        renderRanking();
      }
    });

    item.querySelector('.delete').addEventListener('click', () => {
      if (confirm(`¿Estás seguro de eliminar a "${w.name}"? Se borrarán también sus registros pasados.`)) {
        manager.deleteWorker(w.id);
        renderWorkersDirectory();
        renderAttendance();
        renderRanking();
      }
    });

    list.appendChild(item);
  });
}

// --- PWA SERVICE WORKER Y ANCHO DE PANTALLA ---
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const banner = document.getElementById('pwa-install-banner');
  if (banner) banner.style.display = 'flex';
});

function initPWA() {
  const installBtn = document.getElementById('btn-pwa-install');
  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          const banner = document.getElementById('pwa-install-banner');
          if (banner) banner.style.display = 'none';
        }
        deferredPrompt = null;
      }
    });
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then(reg => console.log('SW de Asistencia registrado', reg.scope))
        .catch(err => console.warn('SW no disponible en local', err));
    });
  }
}
