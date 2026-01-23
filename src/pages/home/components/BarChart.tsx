
interface BarChartProps {
  data: Array<{ name: string; count: number }>;
}

export default function BarChart({ data }: BarChartProps) {
  const maxValue = Math.max(...data.map(item => item.count));

  return (
    <div className="space-y-4">
      {data.map((item, index) => (
        <div key={index} className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-700 font-medium">{item.name}</span>
            <span className="text-gray-900 font-semibold">{item.count}</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
            <div
              className="bg-teal-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${(item.count / maxValue) * 100}%` }}
            ></div>
          </div>
        </div>
      ))}
    </div>
  );
}
