interface KPICardProps {
  title: string;
  value: string | number;
  icon: string;
  color: string;
  trend?: string;
  subtitle?: string;
  /** Texto del boton de accion (opcional). */
  actionLabel?: string;
  actionIcon?: string;
  onAction?: () => void;
}

export default function KPICard({
  title,
  value,
  icon,
  color,
  trend,
  subtitle,
  actionLabel,
  actionIcon = 'ri-arrow-right-line',
  onAction,
}: KPICardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-500 mb-2">{title}</p>
          <h3 className="text-3xl font-bold text-gray-900">{value}</h3>
          {trend && (
            <p className={`text-sm mt-2 ${trend.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
              {trend} vs mes anterior
            </p>
          )}
          {subtitle && <p className="text-xs text-gray-500 mt-2">{subtitle}</p>}
          {actionLabel && onAction && (
            <button
              type="button"
              onClick={onAction}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-inbox-archive-line"></i>
              {actionLabel}
              <i className={`${actionIcon} text-sm`}></i>
            </button>
          )}
        </div>
        <div className={`${color} w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0`}>
          <i className={`${icon} text-white text-2xl`}></i>
        </div>
      </div>
    </div>
  );
}