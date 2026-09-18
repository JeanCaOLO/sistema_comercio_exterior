// Utilidades de fechas para evitar el corrimiento de un día por zona horaria.
// Las fechas guardadas como 'YYYY-MM-DD' (solo día) se interpretan como fecha LOCAL,
// no como medianoche UTC, para que no retrocedan un día en zonas horarias UTC-.

export const parseFechaSegura = (fecha: string): Date => {
  if (!fecha) return new Date(NaN);
  const soloFecha = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  if (soloFecha) {
    return new Date(Number(soloFecha[1]), Number(soloFecha[2]) - 1, Number(soloFecha[3]));
  }
  return new Date(fecha);
};

export const formatearFecha = (fecha: string): string => {
  const date = parseFechaSegura(fecha);
  if (Number.isNaN(date.getTime())) return fecha || '';
  return date.toLocaleDateString('es-ES');
};

export const formatearFechaCorta = (fecha: string): string => {
  const date = parseFechaSegura(fecha);
  if (Number.isNaN(date.getTime())) return fecha || '';
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const hoyLocal = (): string => {
  const hoy = new Date();
  const año = hoy.getFullYear();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const dia = String(hoy.getDate()).padStart(2, '0');
  return `${año}-${mes}-${dia}`;
};

// ── Días hábiles (excluye fines de semana y feriados de Costa Rica) ──

// Feriados fijos de Costa Rica [mes, día] (0 = enero)
const FERIADOS_FIJOS_CR: [number, number][] = [
  [0, 1],   // 1 de enero — Año Nuevo
  [3, 11],  // 11 de abril — Día de Juan Santamaría
  [4, 1],   // 1 de mayo — Día del Trabajador
  [6, 25],  // 25 de julio — Anexión del Partido de Nicoya
  [7, 2],   // 2 de agosto — Día de la Virgen de los Ángeles
  [7, 15],  // 15 de agosto — Día de la Madre
  [8, 15],  // 15 de septiembre — Día de la Independencia
  [11, 1],  // 1 de diciembre — Abolición del Ejército
  [11, 25], // 25 de diciembre — Navidad
];

// Domingo de Pascua (algoritmo de Meeus/Jones/Butcher)
const domingoPascua = (anio: number): Date => {
  const a = anio % 19;
  const b = Math.floor(anio / 100);
  const c = anio % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31); // 3 = marzo, 4 = abril
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(anio, mes - 1, dia);
};

const esFeriado = (fecha: Date): boolean => {
  const mes = fecha.getMonth();
  const dia = fecha.getDate();
  const anio = fecha.getFullYear();

  if (FERIADOS_FIJOS_CR.some(([m, d]) => m === mes && d === dia)) return true;

  // Semana Santa: Jueves Santo y Viernes Santo
  const pascua = domingoPascua(anio);
  const juevesSanto = new Date(pascua);
  juevesSanto.setDate(pascua.getDate() - 3);
  const viernesSanto = new Date(pascua);
  viernesSanto.setDate(pascua.getDate() - 2);

  if (
    (mes === juevesSanto.getMonth() && dia === juevesSanto.getDate()) ||
    (mes === viernesSanto.getMonth() && dia === viernesSanto.getDate())
  ) {
    return true;
  }

  return false;
};

export const diasHabilesEntre = (fechaInicio: string | Date, fechaFin: string | Date): number => {
  const inicio = typeof fechaInicio === 'string' ? parseFechaSegura(fechaInicio) : new Date(fechaInicio);
  const fin = typeof fechaFin === 'string' ? parseFechaSegura(fechaFin) : new Date(fechaFin);

  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) return 0;

  const ini = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
  const finDia = new Date(fin.getFullYear(), fin.getMonth(), fin.getDate());
  if (finDia <= ini) return 0;

  let dias = 0;
  const cursor = new Date(ini);
  cursor.setDate(cursor.getDate() + 1);
  while (cursor <= finDia) {
    const diaSemana = cursor.getDay(); // 0 = domingo, 6 = sábado
    if (diaSemana !== 0 && diaSemana !== 6 && !esFeriado(cursor)) {
      dias++;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return dias;
};