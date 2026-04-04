
"use client";

import { useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { StatsGrid } from '@/components/dashboard/stats-grid';
import { AgingReport } from '@/components/dashboard/aging-report';
import { getStats, BRANCHES, INVOICES, SUPPLIERS } from '@/lib/mock-data';
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
import { Filter, Download, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Dashboard() {
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const stats = getStats(selectedBranch === 'all' ? undefined : selectedBranch);

  const filteredInvoices = selectedBranch === 'all' 
    ? INVOICES 
    : INVOICES.filter(inv => inv.branchId === selectedBranch);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 ml-64 p-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h2 className="text-3xl font-bold font-headline text-slate-900 tracking-tight">Dues Overview</h2>
            <p className="text-muted-foreground mt-1">Real-time aggregation of your accounts payable.</p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border shadow-sm">
              <span className="text-xs font-semibold text-muted-foreground uppercase">Branch:</span>
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger className="w-[180px] border-none shadow-none focus:ring-0 h-8">
                  <SelectValue placeholder="All Branches" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  {BRANCHES.map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" className="h-10">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button className="h-10 bg-primary hover:bg-primary/90">
              <Plus className="mr-2 h-4 w-4" />
              New Entry
            </Button>
          </div>
        </header>

        <StatsGrid stats={stats} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
          <AgingReport />
          
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-headline">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="flex gap-4 items-start">
                    <div className="w-2 h-2 rounded-full bg-accent mt-2 shrink-0" />
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-semibold">Payment logged for {SUPPLIERS[i % 5].name}</p>
                      <p className="text-xs text-muted-foreground">FIFO Deduction applied to INV#1024</p>
                      <p className="text-[10px] text-muted-foreground font-medium uppercase">{i * 12} mins ago</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8">
          <Card className="border-none shadow-sm overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-lg font-headline">Critical Pending Invoices</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">Showing top overdue entries requiring immediate action.</p>
              </div>
              <Button variant="ghost" size="sm" className="text-primary font-semibold">View All</Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="font-bold">Invoice #</TableHead>
                    <TableHead className="font-bold">Supplier</TableHead>
                    <TableHead className="font-bold">Branch</TableHead>
                    <TableHead className="font-bold">Due Date</TableHead>
                    <TableHead className="font-bold text-right">Amount</TableHead>
                    <TableHead className="font-bold text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.slice(0, 10).map((inv) => (
                    <TableRow key={inv.id} className="hover:bg-slate-50/50">
                      <TableCell className="font-mono text-xs font-semibold">{inv.invoiceNumber}</TableCell>
                      <TableCell className="font-medium">{SUPPLIERS.find(s => s.id === inv.supplierId)?.name}</TableCell>
                      <TableCell className="text-muted-foreground">{BRANCHES.find(b => b.id === inv.branchId)?.name}</TableCell>
                      <TableCell className="text-sm">{inv.dueDate}</TableCell>
                      <TableCell className="text-right font-bold">₹{inv.remainingBalance.toLocaleString()}</TableCell>
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
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
