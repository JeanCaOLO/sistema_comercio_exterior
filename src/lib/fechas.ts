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