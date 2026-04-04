
import { Statistics } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { 
  IndianRupee, 
  AlertCircle, 
  CalendarClock, 
  ArrowUpRight 
} from 'lucide-react';

interface StatsGridProps {
  stats: Statistics;
}

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(val);
};

export function StatsGrid({ stats }: StatsGridProps) {
  const items = [
    {
      label: 'Total Outstanding',
      value: formatCurrency(stats.totalOutstanding),
      icon: IndianRupee,
      color: 'bg-primary',
      trend: '+12% from last month'
    },
    {
      label: 'Total Overdue',
      value: formatCurrency(stats.totalOverdue),
      icon: AlertCircle,
      color: 'bg-destructive',
      trend: '5 Critical suppliers'
    },
    {
      label: 'Due in 7 Days',
      value: formatCurrency(stats.upcoming7Days),
      icon: CalendarClock,
      color: 'bg-accent',
      trend: '8 Invoices pending'
    },
    {
      label: 'Due in 30 Days',
      value: formatCurrency(stats.upcoming30Days),
      icon: CalendarClock,
      color: 'bg-blue-400',
      trend: '24 Invoices total'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {items.map((item, idx) => (
        <Card key={idx} className="overflow-hidden border-none shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-0">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`${item.color} p-2.5 rounded-xl shadow-lg shadow-black/5`}>
                  <item.icon className="w-5 h-5 text-white" />
                </div>
                <div className="flex items-center text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full uppercase">
                  <ArrowUpRight className="w-3 h-3 mr-1" />
                  Active
                </div>
              </div>
              <p className="text-sm font-medium text-muted-foreground">{item.label}</p>
              <h3 className="text-2xl font-bold mt-1 text-slate-900 font-headline">{item.value}</h3>
              <p className="text-[11px] text-muted-foreground mt-2 font-medium">{item.trend}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
