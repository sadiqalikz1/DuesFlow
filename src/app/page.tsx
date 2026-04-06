
"use client";

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { StatsGrid } from '@/components/dashboard/stats-grid';
import { AgingReport } from '@/components/dashboard/aging-report';
import { 
  useCollection, 
  useFirestore, 
  useMemoFirebase,
  useUser
} from '@/firebase';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Download, Plus, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { differenceInDays } from 'date-fns';
import { useCurrency } from '@/hooks/use-currency';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';

export default function Dashboard() {
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const router = useRouter();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { formatCurrency } = useCurrency();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  const branchesQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'branches');
  }, [firestore, user]);
  const { data: branches } = useCollection(branchesQuery);

  const suppliersQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'suppliers');
  }, [firestore, user]);
  const { data: suppliers } = useCollection(suppliersQuery);

  const invoicesQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    const invCol = collection(firestore, 'invoices');
    if (selectedBranch !== 'all') {
      return query(invCol, where('branchId', '==', selectedBranch), limit(100));
    }
    return query(invCol, orderBy('dueDate', 'asc'), limit(100));
  }, [firestore, selectedBranch]);
  const { data: invoices, isLoading: invoicesLoading } = useCollection(invoicesQuery);

  const stats = useMemo(() => {
    const invs = invoices || [];
    const totalOutstanding = invs.reduce((sum, inv) => sum + (inv.remainingBalance || 0), 0);
    const totalOverdue = invs.filter(inv => inv.status === 'Overdue').reduce((sum, inv) => sum + (inv.remainingBalance || 0), 0);
    const upcoming7Days = invs.filter(inv => {
      if (inv.status === 'Paid') return false;
      const diff = differenceInDays(new Date(inv.dueDate), new Date());
      return diff >= 0 && diff <= 7;
    }).reduce((sum, inv) => sum + (inv.remainingBalance || 0), 0);
    const upcoming30Days = invs.filter(inv => {
      if (inv.status === 'Paid') return false;
      const diff = differenceInDays(new Date(inv.dueDate), new Date());
      return diff >= 0 && diff <= 30;
    }).reduce((sum, inv) => sum + (inv.remainingBalance || 0), 0);

    return {
      totalOutstanding,
      totalOverdue,
      upcoming7Days,
      upcoming30Days,
      upcoming15Days: 0
    };
  }, [invoices]);

  const agingData = useMemo(() => {
    const invs = invoices?.filter(i => i.status === 'Overdue' || i.status === 'Partially Paid') || [];
    const ranges = [
      { range: '0-30 Days', amount: 0, color: 'hsl(var(--primary))' },
      { range: '31-60 Days', amount: 0, color: 'hsl(var(--accent))' },
      { range: '61-90 Days', amount: 0, color: '#f59e0b' },
      { range: '90+ Days', amount: 0, color: 'hsl(var(--destructive))' },
    ];

    invs.forEach(inv => {
      const diff = differenceInDays(new Date(), new Date(inv.dueDate));
      if (diff > 0 && diff <= 30) ranges[0].amount += inv.remainingBalance;
      else if (diff > 30 && diff <= 60) ranges[1].amount += inv.remainingBalance;
      else if (diff > 60 && diff <= 90) ranges[2].amount += inv.remainingBalance;
      else if (diff > 90) ranges[3].amount += inv.remainingBalance;
    });

    return ranges;
  }, [invoices]);

  return (
    <SidebarInset className="flex-1 overflow-auto bg-background">
      <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b bg-background px-4 md:px-8">
        <SidebarTrigger className="-ml-1" />
        <div className="flex-1">
          <h2 className="text-xl md:text-2xl font-bold font-headline text-slate-900 tracking-tight truncate">Dues Overview</h2>
        </div>
        <div className="flex items-center gap-2">
           <Link href="/upload" className="hidden sm:block">
            <Button size="sm" className="bg-primary">
              <Plus className="mr-2 h-4 w-4" />
              New Entry
            </Button>
          </Link>
        </div>
      </header>

      <main className="p-4 md:p-8 space-y-8">
        <section className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-muted-foreground">Real-time aggregation of your accounts payable.</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border shadow-sm">
              <span className="text-xs font-semibold text-muted-foreground uppercase">Branch:</span>
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger className="w-[140px] md:w-[180px] border-none shadow-none focus:ring-0 h-8">
                  <SelectValue placeholder="All Branches" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  {branches?.map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" className="h-10">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </section>

        <StatsGrid stats={stats} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <AgingReport data={agingData} />
          
          <Card className="border-none shadow-sm overflow-hidden bg-white h-full">
            <CardHeader>
              <CardTitle className="text-lg font-headline">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {!invoicesLoading && invoices && invoices.length > 0 ? (
                   invoices.slice(0, 5).map(inv => (
                    <div key={inv.id} className="flex gap-4 items-start">
                      <div className="w-2 h-2 rounded-full bg-accent mt-2 shrink-0" />
                      <div className="flex-1 space-y-1">
                        <p className="text-sm font-semibold">Invoice {inv.invoiceNumber}</p>
                        <p className="text-xs text-muted-foreground">Due on {inv.dueDate}</p>
                        <Badge variant="outline" className="text-[9px] uppercase font-bold py-0">{inv.status}</Badge>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground italic text-center py-10">No recent activity detected.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mb-12">
          <Card className="border-none shadow-sm overflow-hidden bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-4 border-b">
              <div>
                <CardTitle className="text-lg font-headline">Critical Pending Invoices</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">Requiring immediate action.</p>
              </div>
              <Link href="/reports">
                <Button variant="ghost" size="sm" className="text-primary font-semibold">View All</Button>
              </Link>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="font-bold min-w-[120px]">Invoice #</TableHead>
                    <TableHead className="font-bold min-w-[150px]">Supplier</TableHead>
                    <TableHead className="font-bold hidden md:table-cell">Branch</TableHead>
                    <TableHead className="font-bold min-w-[100px]">Due Date</TableHead>
                    <TableHead className="font-bold text-right min-w-[100px]">Amount</TableHead>
                    <TableHead className="font-bold text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices?.map((inv) => (
                    <TableRow key={inv.id} className="hover:bg-slate-50/50">
                      <TableCell className="font-mono text-xs font-semibold">{inv.invoiceNumber}</TableCell>
                      <TableCell className="font-medium">
                        {suppliers?.find(s => s.id === inv.supplierId)?.name || 'Unknown'}
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden md:table-cell">
                        {branches?.find(b => b.id === inv.branchId)?.name || 'Unknown'}
                      </TableCell>
                      <TableCell className="text-sm">{inv.dueDate}</TableCell>
                      <TableCell className="text-right font-bold">{formatCurrency(inv.remainingBalance || 0)}</TableCell>
                      <TableCell className="text-center">
                        <Badge 
                          variant={inv.status === 'Overdue' ? 'destructive' : 'secondary'}
                          className="font-bold text-[10px] uppercase tracking-wider px-2 py-0.5"
                        >
                          {inv.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!invoices || invoices.length === 0) && !invoicesLoading && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-20 text-muted-foreground">No pending invoices found.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </main>
    </SidebarInset>
  );
}
