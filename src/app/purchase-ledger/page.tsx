'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Search, FileText, AlertTriangle, CheckCircle2, Calendar, DollarSign, Loader2, TrendingUp, Eye, ChevronDown,
} from 'lucide-react';
import { format, parse, isValid as isValidDate } from 'date-fns';
import { useCollection, useMemoFirebase, useFirestore } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useUserRole } from '@/hooks/use-user-role';
import Link from 'next/link';

type TransactionType = 'invoice' | 'debitNote' | 'creditNote';

interface Transaction {
  id: string;
  type: TransactionType;
  date: string;
  supplierName: string;
  referenceNumber: string;
  amount: number;
  debitAmount: number;
  creditAmount: number;
  reason?: string;
  dueDate?: string;
  status?: string;
  branchId: string;
  supplierId: string;
}

export default function PurchaseLedgerPage() {
  const firestore = useFirestore();
  const { isAdmin, isLoading: isRoleLoading } = useUserRole();

  // State
  const [filterSupplier, setFilterSupplier] = useState('');
  const [filterType, setFilterType] = useState<TransactionType | 'all'>('all');
  const [filterFromDate, setFilterFromDate] = useState('');
  const [filterToDate, setFilterToDate] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'supplier' | 'amount'>('date');
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Load all transaction types
  const invoicesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'invoices');
  }, [firestore]);
  const { data: invoices } = useCollection(invoicesQuery);

  const debitNotesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'debitNotes');
  }, [firestore]);
  const { data: debitNotes } = useCollection(debitNotesQuery);

  const creditNotesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'creditNotes');
  }, [firestore]);
  const { data: creditNotes } = useCollection(creditNotesQuery);

  const suppliersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'suppliers');
  }, [firestore]);
  const { data: suppliers } = useCollection(suppliersQuery);

  // Normalize and combine all transactions
  const transactions: Transaction[] = useMemo(() => {
    const all: Transaction[] = [];

    invoices?.forEach(inv => {
      const amount = inv.amount || 0;
      all.push({
        id: inv.id,
        type: 'invoice',
        date: inv.invoiceDate || inv.date || '',
        supplierName: suppliers?.find(s => s.id === inv.supplierId)?.name || 'Unknown',
        referenceNumber: inv.invoiceNumber || '',
        amount: amount,
        debitAmount: amount,
        creditAmount: 0,
        dueDate: inv.dueDate || '',
        status: inv.status || 'Pending',
        branchId: inv.branchId || '',
        supplierId: inv.supplierId || '',
      });
    });

    debitNotes?.forEach(dn => {
      const amount = dn.amount || dn.debitAmount || dn.noteAmount || 0;
      if (amount > 0) {
        all.push({
          id: dn.id,
          type: 'debitNote',
          date: dn.date || '',
          supplierName: suppliers?.find(s => s.id === dn.supplierId)?.name || 'Unknown',
          referenceNumber: dn.referenceNumber || '',
          amount: amount,
          debitAmount: amount,
          creditAmount: 0,
          reason: dn.reason || '',
          branchId: dn.branchId || '',
          supplierId: dn.supplierId || '',
        });
      }
    });

    creditNotes?.forEach(cn => {
      const amount = cn.amount || cn.creditAmount || cn.noteAmount || 0;
      if (amount > 0) {
        all.push({
          id: cn.id,
          type: 'creditNote',
          date: cn.date || '',
          supplierName: suppliers?.find(s => s.id === cn.supplierId)?.name || 'Unknown',
          referenceNumber: cn.referenceNumber || '',
          amount: amount,
          debitAmount: 0,
          creditAmount: amount,
          reason: cn.reason || '',
          branchId: cn.branchId || '',
          supplierId: cn.supplierId || '',
        });
      }
    });

    return all;
  }, [invoices, debitNotes, creditNotes, suppliers]);

  // Apply filters
  const filtered = useMemo(() => {
    return transactions.filter(t => {
      if (filterType !== 'all' && t.type !== filterType) return false;
      if (filterSupplier && !t.supplierName.toLowerCase().includes(filterSupplier.toLowerCase())) return false;
      if (filterFromDate && t.date < filterFromDate) return false;
      if (filterToDate && t.date > filterToDate) return false;
      return true;
    });
  }, [transactions, filterSupplier, filterType, filterFromDate, filterToDate]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterSupplier, filterType, filterFromDate, filterToDate]);

  // Apply sorting
  const sorted = useMemo(() => {
    const copy = [...filtered];
    if (sortBy === 'date') {
      copy.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } else if (sortBy === 'supplier') {
      copy.sort((a, b) => a.supplierName.localeCompare(b.supplierName));
    } else if (sortBy === 'amount') {
      copy.sort((a, b) => b.amount - a.amount);
    }
    return copy;
  }, [filtered, sortBy]);

  // Apply pagination
  const paginationInfo = useMemo(() => {
    const totalItems = sorted.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedData = sorted.slice(startIndex, endIndex);

    return {
      totalItems,
      totalPages,
      currentPage,
      paginatedData,
    };
  }, [sorted, currentPage]);

  // Calculate summary
  const summary = useMemo(() => {
    const invoiceTotal = sorted
      .filter(t => t.type === 'invoice')
      .reduce((sum, t) => sum + t.amount, 0);
    const debitTotal = sorted
      .filter(t => t.type === 'debitNote')
      .reduce((sum, t) => sum + t.amount, 0);
    const creditTotal = sorted
      .filter(t => t.type === 'creditNote')
      .reduce((sum, t) => sum + t.amount, 0);
    const totalDebits = sorted.reduce((sum, t) => sum + t.debitAmount, 0);
    const totalCredits = sorted.reduce((sum, t) => sum + t.creditAmount, 0);

    return {
      totalTransactions: sorted.length,
      invoiceTotal,
      debitTotal,
      creditTotal,
      totalDebits,
      totalCredits,
      netPayable: invoiceTotal + debitTotal - creditTotal,
    };
  }, [sorted]);

  const GetTypeIcon = (type: TransactionType) => {
    switch (type) {
      case 'invoice':
        return <FileText className="w-3.5 h-3.5 text-blue-600" />;
      case 'debitNote':
        return <AlertTriangle className="w-3.5 h-3.5 text-orange-600" />;
      case 'creditNote':
        return <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />;
    }
  };

  const GetTypeLabel = (type: TransactionType) => {
    switch (type) {
      case 'invoice':
        return 'Invoice';
      case 'debitNote':
        return 'Debit Note';
      case 'creditNote':
        return 'Credit Note';
    }
  };

  const GetTypeBadgeVariant = (type: TransactionType) => {
    switch (type) {
      case 'invoice':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'debitNote':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'creditNote':
        return 'bg-green-50 text-green-700 border-green-200';
    }
  };

  if (isRoleLoading) {
    return (
      <div className="p-8 h-screen flex flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-slate-500 font-medium">Loading...</p>
      </div>
    );
  }

  return (
    <SidebarInset className="flex-1 bg-background">
      <header className="sticky top-0 z-10 flex h-20 shrink-0 items-center gap-4 border-b bg-background/80 backdrop-blur-md px-4 md:px-8">
        <SidebarTrigger className="-ml-1" />
        <div className="h-4 w-[1px] bg-slate-200 hidden md:block" />
        <div className="flex flex-col">
          <h2 className="text-lg font-bold font-headline text-slate-900 tracking-tight">Purchase Ledger</h2>
          <p className="text-xs text-slate-500 mt-0.5">Unified view of all purchase transactions</p>
        </div>
        <div className="ml-auto flex gap-2">
          <Link href="/upload">
            <Button variant="outline" size="sm" className="rounded-full text-xs font-bold">
              + Upload
            </Button>
          </Link>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 bg-slate-50/40">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="border-none shadow-sm ring-1 ring-slate-100 rounded-2xl bg-white">
            <CardContent className="pt-6">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Total Transactions</div>
              <div className="text-2xl font-black text-slate-900">{summary.totalTransactions}</div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm ring-1 ring-slate-100 rounded-2xl bg-white">
            <CardContent className="pt-6">
              <div className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-2">Total Invoices</div>
              <div className="text-2xl font-black text-slate-900">{summary.invoiceTotal.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm ring-1 ring-slate-100 rounded-2xl bg-white">
            <CardContent className="pt-6">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-700 mb-2">Total Debits</div>
              <div className="text-2xl font-black text-slate-900">{summary.totalDebits.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm ring-1 ring-slate-100 rounded-2xl bg-white">
            <CardContent className="pt-6">
              <div className="text-[10px] font-black uppercase tracking-widest text-red-600 mb-2">Total Credits</div>
              <div className="text-2xl font-black text-slate-900">{summary.totalCredits.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm ring-1 ring-slate-100 rounded-2xl bg-gradient-to-br from-primary/5 to-primary/10">
            <CardContent className="pt-6">
              <div className="text-[10px] font-black uppercase tracking-widest text-primary mb-2">Net Payable</div>
              <div className="text-2xl font-black text-primary">{summary.netPayable.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="border-none shadow-sm ring-1 ring-slate-100 rounded-2xl bg-white">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Search className="w-4 h-4 text-primary" />
              Filters & Sort
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-slate-600">Supplier</Label>
                <Input
                  placeholder="Search supplier..."
                  value={filterSupplier}
                  onChange={(e) => setFilterSupplier(e.target.value)}
                  className="h-10 rounded-xl border-slate-200"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-slate-600">Type</Label>
                <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
                  <SelectTrigger className="h-10 rounded-xl border-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="invoice">Invoices</SelectItem>
                    <SelectItem value="debitNote">Debit Notes</SelectItem>
                    <SelectItem value="creditNote">Credit Notes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-slate-600">From Date</Label>
                <Input
                  type="date"
                  value={filterFromDate}
                  onChange={(e) => setFilterFromDate(e.target.value)}
                  className="h-10 rounded-xl border-slate-200"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-slate-600">To Date</Label>
                <Input
                  type="date"
                  value={filterToDate}
                  onChange={(e) => setFilterToDate(e.target.value)}
                  className="h-10 rounded-xl border-slate-200"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-slate-600">Sort By</Label>
                <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                  <SelectTrigger className="h-10 rounded-xl border-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date">Date (Newest)</SelectItem>
                    <SelectItem value="supplier">Supplier Name</SelectItem>
                    <SelectItem value="amount">Amount (Highest)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Transactions Table */}
        <Card className="border-none shadow-sm ring-1 ring-slate-100 rounded-2xl bg-white overflow-hidden">
          <CardHeader className="pb-4 border-b">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Transactions ({sorted.length})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {sorted.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-slate-500 text-sm">No transactions found matching your filters.</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b border-slate-100 bg-slate-50">
                        <TableHead className="h-12 px-6 text-xs font-bold">Date</TableHead>
                        <TableHead className="h-12 px-6 text-xs font-bold">Supplier</TableHead>
                        <TableHead className="h-12 px-6 text-xs font-bold">Type</TableHead>
                        <TableHead className="h-12 px-6 text-xs font-bold">Reference</TableHead>
                        <TableHead className="h-12 px-6 text-xs font-bold text-right">Debit</TableHead>
                        <TableHead className="h-12 px-6 text-xs font-bold text-right">Credit</TableHead>
                        <TableHead className="h-12 px-6 text-xs font-bold">Due Date</TableHead>
                        <TableHead className="h-12 px-6 text-xs font-bold">Status</TableHead>
                        <TableHead className="h-12 px-6 text-xs font-bold text-center">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginationInfo.paginatedData.map((t) => (
                        <TableRow key={`${t.type}-${t.id}`} className="border-b border-slate-50 hover:bg-slate-50">
                          <TableCell className="px-6 py-4 text-sm font-medium">
                            {format(new Date(t.date), 'MMM d, yyyy')}
                          </TableCell>
                          <TableCell className="px-6 py-4 text-sm font-medium">{t.supplierName}</TableCell>
                          <TableCell className="px-6 py-4">
                            <Badge variant="outline" className={`${GetTypeBadgeVariant(t.type)} border text-xs font-bold flex items-center gap-1 w-fit`}>
                              {GetTypeIcon(t.type)}
                              {GetTypeLabel(t.type)}
                            </Badge>
                          </TableCell>
                          <TableCell className="px-6 py-4 text-sm font-mono text-slate-600">{t.referenceNumber}</TableCell>
                          <TableCell className="px-6 py-4 text-sm font-bold text-right text-slate-700">{t.debitAmount > 0 ? t.debitAmount.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—'}</TableCell>
                          <TableCell className="px-6 py-4 text-sm font-bold text-right text-red-600">{t.creditAmount > 0 ? t.creditAmount.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—'}</TableCell>
                          <TableCell className="px-6 py-4 text-sm font-medium">
                            {t.dueDate ? format(new Date(t.dueDate), 'MMM d, yyyy') : '—'}
                          </TableCell>
                          <TableCell className="px-6 py-4 text-sm">
                            {t.status && (
                              <Badge variant="outline" className="text-xs font-bold">{t.status}</Badge>
                            )}
                          </TableCell>
                          <TableCell className="px-6 py-4 text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedTransaction(t)}
                              className="h-8 px-3 rounded-lg hover:bg-primary/10 text-primary"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {/* Pagination Controls */}
                {paginationInfo.totalPages > 1 && (
                  <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50">
                    <div className="text-sm text-slate-600 font-medium">
                      Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, paginationInfo.totalItems)} of {paginationInfo.totalItems} transactions
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className="rounded-lg"
                      >
                        Previous
                      </Button>
                      <div className="flex items-center gap-1 px-3">
                        <span className="text-sm font-medium text-slate-700">
                          {currentPage} / {paginationInfo.totalPages}
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(Math.min(paginationInfo.totalPages, currentPage + 1))}
                        disabled={currentPage === paginationInfo.totalPages}
                        className="rounded-lg"
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detail Modal */}
      <Dialog open={!!selectedTransaction} onOpenChange={() => setSelectedTransaction(null)}>
        <DialogContent className="rounded-[2rem] max-w-lg border-none shadow-2xl">
          {selectedTransaction && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3 mb-2">
                  {GetTypeIcon(selectedTransaction.type)}
                  <DialogTitle className="text-xl font-black">
                    {GetTypeLabel(selectedTransaction.type)} Details
                  </DialogTitle>
                </div>
                <DialogDescription className="text-xs text-slate-600">
                  Full transaction details and information
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Date</p>
                    <p className="text-sm font-bold text-slate-900">{format(new Date(selectedTransaction.date), 'MMM d, yyyy')}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Reference</p>
                    <p className="text-sm font-bold text-slate-900 font-mono">{selectedTransaction.referenceNumber}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Supplier</p>
                    <p className="text-sm font-bold text-slate-900">{selectedTransaction.supplierName}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Debit Amount</p>
                    <p className="text-lg font-black text-slate-700">{selectedTransaction.debitAmount > 0 ? selectedTransaction.debitAmount.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Credit Amount</p>
                    <p className="text-lg font-black text-red-600">{selectedTransaction.creditAmount > 0 ? selectedTransaction.creditAmount.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Type</p>
                    <Badge className={GetTypeBadgeVariant(selectedTransaction.type)}>{GetTypeLabel(selectedTransaction.type)}</Badge>
                  </div>
                  {selectedTransaction.reason && (
                    <div className="col-span-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Reason / Note</p>
                      <p className="text-sm text-slate-700">{selectedTransaction.reason}</p>
                    </div>
                  )}
                  {selectedTransaction.status && (
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Status</p>
                      <Badge variant="outline">{selectedTransaction.status}</Badge>
                    </div>
                  )}
                  {selectedTransaction.dueDate && (
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Due Date</p>
                      <p className="text-sm font-bold text-slate-900">{format(new Date(selectedTransaction.dueDate), 'MMM d, yyyy')}</p>
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedTransaction(null)} className="rounded-full">
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </SidebarInset>
  );
}
