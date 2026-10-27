import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export interface TrendPoint {
  label: string;
  checkins: number;
}

export function TrendChart({ data }: { data: TrendPoint[] }) {
  if (data.length === 0) return null;
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#323238" />
          <XAxis dataKey="label" stroke="#A8A8B3" fontSize={12} />
          <YAxis stroke="#A8A8B3" fontSize={12} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#202024',
              borderColor: '#323238',
              borderRadius: '12px',
              color: '#E1E1E6',
            }}
          />
          <Bar dataKey="checkins" fill="#8257E5" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
