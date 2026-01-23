
interface KPICardProps {
  title: string;
  value: string | number;
  icon: string;
  color: string;
  trend?: string;
}

export default function KPICard({ title, value, icon, color, trend }: KPICardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-gray-500 mb-2">{title}</p>
          <h3 className="text-3xl font-bold text-gray-900">{value}</h3>
          {trend && (
            <p className={`text-sm mt-2 ${trend.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
              {trend} vs mes anterior
            </p>
          )}
        </div>
        <div className={`${color} w-12 h-12 rounded-lg flex items-center justify-center`}>
          <i className={`${icon} text-white text-2xl`}></i>
        </div>
      </div>
    </div>
  );
}
