
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Cell } from 'recharts';

const data = [
  { range: '0-30 Days', amount: 450000, color: 'hsl(var(--primary))' },
  { range: '31-60 Days', amount: 320000, color: 'hsl(var(--accent))' },
  { range: '61-90 Days', amount: 150000, color: '#f59e0b' },
  { range: '90+ Days', amount: 80000, color: 'hsl(var(--destructive))' },
];

export function AgingReport() {
  return (
    <Card className="col-span-1 lg:col-span-2 border-none shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-headline">Aging Report</CardTitle>
        <CardDescription>Accounts payable distribution by overdue age</CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <XAxis 
                dataKey="range" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 12, fill: '#64748b' }} 
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 12, fill: '#64748b' }}
                tickFormatter={(val) => `₹${val/1000}k`}
              />
              <ChartTooltip content={<ChartTooltipContent hideLabel />} />
              <Bar dataKey="amount" radius={[6, 6, 0, 0]} barSize={50}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
