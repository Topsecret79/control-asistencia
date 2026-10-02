// Motor de Control de Asistencia y Estadísticas Mensuales

// Almacenamiento seguro compatible con iOS Safari y modo local
const safeStorage = {
  _mem: {},
  getItem(key) {
    try {
      if (typeof window !== 'undefined' && 'localStorage' in window && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch (e) {}
    return this._mem[key] || null;
  },
  setItem(key, val) {
    try {
      if (typeof window !== 'undefined' && 'localStorage' in window && window.localStorage) {
        window.localStorage.setItem(key, val);
        return;
      }
    } catch (e) {}
    this._mem[key] = String(val);
  }
};
if (typeof window !== 'undefined') window.safeStorage = safeStorage;

class AttendanceManager {
  constructor() {
    this.storageKey = 'control_asistencia_data_v1';
    
    // Lista de trabajadores
    this.workers = [
      { id: 1, name: 'Juan', active: true },
      { id: 2, name: 'Carlos', active: true },
      { id: 3, name: 'Antonio', active: true },
      { id: 4, name: 'Pedro', active: true }
    ];

    // Registros por fecha: { "YYYY-MM-DD": [workerId1, workerId2, ...] }
    this.records = {};

    // Facturación por fecha y ruta: { "YYYY-MM-DD": { [workerId]: number } }
    this.billingRecords = {};

    this.load();
  }

  save() {
    try {
      safeStorage.setItem(this.storageKey, JSON.stringify({
        workers: this.workers,
        records: this.records,
        billingRecords: this.billingRecords
      }));
    } catch (e) {
      console.warn('Error al guardar datos de asistencia', e);
    }
  }

  load() {
    try {
      const data = safeStorage.getItem(this.storageKey);
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed.workers && Array.isArray(parsed.workers)) {
          this.workers = parsed.workers;
        }
        if (parsed.records && typeof parsed.records === 'object') {
          this.records = parsed.records;
        }
        if (parsed.billingRecords && typeof parsed.billingRecords === 'object') {
          this.billingRecords = parsed.billingRecords;
        }
      }
      // Garantizar que cada ruta/trabajador tenga defaultBilling numérico
      this.workers.forEach(w => {
        if (typeof w.defaultBilling !== 'number') {
          w.defaultBilling = 0;
        }
      });
    } catch (e) {
      console.warn('Error al cargar datos de asistencia', e);
    }
  }

  // --- GESTIÓN DE TRABAJADORES Y RUTAS ---

  addWorker(name, defaultBilling = 0) {
    const trimmed = name ? name.trim() : '';
    if (!trimmed) return null;
    const newWorker = {
      id: Date.now(),
      name: trimmed,
      defaultBilling: parseFloat(defaultBilling) || 0,
      active: true
    };
    this.workers.push(newWorker);
    this.save();
    return newWorker;
  }

  editWorker(id, newName) {
    const trimmed = newName ? newName.trim() : '';
    if (!trimmed) return false;
    const worker = this.workers.find(w => w.id === id);
    if (worker) {
      worker.name = trimmed;
      this.save();
      return true;
    }
    return false;
  }

  deleteWorker(id) {
    const index = this.workers.findIndex(w => w.id === id);
    if (index !== -1) {
      this.workers.splice(index, 1);
      // Eliminar también de registros pasados
      Object.keys(this.records).forEach(dateStr => {
        this.records[dateStr] = (this.records[dateStr] || []).filter(wId => wId !== id);
      });
      Object.keys(this.billingRecords).forEach(dateStr => {
        if (this.billingRecords[dateStr]) {
          delete this.billingRecords[dateStr][id];
        }
      });
      this.save();
      return true;
    }
    return false;
  }

  getWorker(id) {
    return this.workers.find(w => w.id === id) || null;
  }

  getActiveWorkers() {
    return this.workers.filter(w => w.active);
  }

  // --- FACTURACIÓN POR RUTA Y DÍA ---

  setDailyBilling(dateStr, workerId, amount) {
    const val = parseFloat(amount);
    const num = isNaN(val) ? 0 : Math.max(0, val);
    if (!this.billingRecords[dateStr]) {
      this.billingRecords[dateStr] = {};
    }
    this.billingRecords[dateStr][workerId] = num;
    const worker = this.getWorker(workerId);
    if (worker) {
      worker.defaultBilling = num;
    }
    this.save();
    return num;
  }

  getDailyBilling(dateStr, workerId) {
    if (this.billingRecords[dateStr] && typeof this.billingRecords[dateStr][workerId] === 'number') {
      return this.billingRecords[dateStr][workerId];
    }
    const worker = this.getWorker(workerId);
    return (worker && typeof worker.defaultBilling === 'number') ? worker.defaultBilling : 0;
  }

  getDailyTotalBilling(dateStr) {
    const attendees = this.records[dateStr] || [];
    return attendees.reduce((sum, wId) => {
      return sum + this.getDailyBilling(dateStr, wId);
    }, 0);
  }

  // --- GESTIÓN DE ASISTENCIA DIARIA ---

  isWorkerPresent(dateStr, workerId) {
    const dayList = this.records[dateStr] || [];
    return dayList.includes(workerId);
  }

  setAttendance(dateStr, workerId, isPresent = true) {
    if (!this.records[dateStr]) {
      this.records[dateStr] = [];
    }
    const list = this.records[dateStr];
    const idx = list.indexOf(workerId);
    if (isPresent && idx === -1) {
      list.push(workerId);
    } else if (!isPresent && idx !== -1) {
      list.splice(idx, 1);
    }
    this.save();
    return isPresent;
  }

  toggleAttendance(dateStr, workerId) {
    if (!this.records[dateStr]) {
      this.records[dateStr] = [];
    }
    const list = this.records[dateStr];
    const idx = list.indexOf(workerId);
    if (idx === -1) {
      list.push(workerId);
    } else {
      list.splice(idx, 1);
    }
    this.save();
    return idx === -1; // true si ahora está presente
  }

  markAll(dateStr, present = true) {
    if (present) {
      this.records[dateStr] = this.getActiveWorkers().map(w => w.id);
    } else {
      this.records[dateStr] = [];
    }
    this.save();
  }

  getDayCount(dateStr) {
    return (this.records[dateStr] || []).length;
  }

  // --- ESTADÍSTICAS Y LISTA MENSUAL ORDENADA ---

  /**
   * Obtiene la clasificación mensual ordenada de mayor a menor número de días trabajados
   * e incluye el total facturado por cada ruta/persona y el total global del mes.
   * @param {number} year - Ej: 2026
   * @param {number} month - 1 a 12
   */
  getMonthlyRanking(year, month) {
    const padMonth = String(month).padStart(2, '0');
    const monthPrefix = `${year}-${padMonth}`;

    // Obtener todas las fechas del mes registradas
    const monthDates = Object.keys(this.records).filter(d => d.startsWith(monthPrefix) && (this.records[d] || []).length > 0);
    const totalRecordedDays = monthDates.length;

    // Calcular días trabajados y facturación de cada ruta en el mes
    const statsMap = {};
    this.workers.forEach(w => {
      statsMap[w.id] = {
        id: w.id,
        name: w.name,
        daysWorked: 0,
        totalBilled: 0,
        dates: [] // [{ date: string, billing: number }]
      };
    });

    monthDates.forEach(dateStr => {
      const attendees = this.records[dateStr] || [];
      attendees.forEach(wId => {
        if (statsMap[wId]) {
          const billing = this.getDailyBilling(dateStr, wId);
          statsMap[wId].daysWorked++;
          statsMap[wId].totalBilled += billing;
          statsMap[wId].dates.push({ date: dateStr, billing });
        }
      });
    });

    // Convertir a lista y ordenar de mayor a menor días trabajados (si empatan, por facturación)
    const ranking = Object.values(statsMap).sort((a, b) => {
      if (b.daysWorked !== a.daysWorked) {
        return b.daysWorked - a.daysWorked;
      }
      if (b.totalBilled !== a.totalBilled) {
        return b.totalBilled - a.totalBilled;
      }
      return a.name.localeCompare(b.name);
    });

    // Asignar rangos, porcentajes y calcular facturación total global
    const maxDays = ranking.length > 0 ? ranking[0].daysWorked : 0;
    const minDays = ranking.length > 0 ? ranking[ranking.length - 1].daysWorked : 0;
    let monthGrandTotalBilled = 0;

    ranking.forEach((item, index) => {
      monthGrandTotalBilled += item.totalBilled;
      item.rank = index + 1;
      item.percentage = totalRecordedDays > 0 ? Math.round((item.daysWorked / totalRecordedDays) * 100) : 0;
      item.isLeader = item.daysWorked > 0 && item.daysWorked === maxDays;
      item.isLast = ranking.length > 1 && item.daysWorked === minDays;
    });

    return {
      year,
      month,
      monthName: this.getMonthName(month),
      totalRecordedDays,
      monthGrandTotalBilled,
      ranking,
      mostWorked: ranking.filter(r => r.isLeader),
      leastWorked: ranking.filter(r => r.isLast)
    };
  }

  getMonthName(month) {
    const names = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return names[month - 1] || 'Mes';
  }

  // Genera texto limpio y formateado para compartir la lista mensual en WhatsApp
  getShareableMonthlyText(year, month) {
    const data = this.getMonthlyRanking(year, month);
    let text = `📋 *CONTROL DE JORNADAS Y FACTURACIÓN - ${data.monthName.toUpperCase()} ${year}*\n`;
    text += `Total de días con trabajo: ${data.totalRecordedDays} días\n`;
    text += `💰 *Facturación Total del Mes:* ${data.monthGrandTotalBilled.toLocaleString('es-ES')} €\n\n`;
    text += `🏆 *LISTA OFICIAL (DÍAS Y FACTURACIÓN):*\n`;

    if (data.ranking.length === 0 || data.totalRecordedDays === 0) {
      text += `_No hay jornadas registradas en este mes._`;
      return text;
    }

    data.ranking.forEach((r, i) => {
      let medal = `${i + 1}. `;
      if (i === 0 && r.daysWorked > 0) medal = `1. 🥇 `;
      else if (i === 1 && r.daysWorked > 0) medal = `2. 🥈 `;
      else if (i === 2 && r.daysWorked > 0) medal = `3. 🥉 `;

      let extra = '';
      if (r.isLeader && r.daysWorked > 0) extra = ' (El que más trabajó)';
      else if (r.isLast && r.daysWorked < data.mostWorked[0].daysWorked) extra = ' (Menos días)';

      text += `${medal}*${r.name}*: ${r.daysWorked} días • *${r.totalBilled.toLocaleString('es-ES')} €*${extra}\n`;
    });

    return text;
  }
}

window.attendanceManager = new AttendanceManager();
