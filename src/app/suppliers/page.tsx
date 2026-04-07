'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useCollection, useFirestore, useMemoFirebase, addDocumentNonBlocking } from '@/firebase';
import { collection, serverTimestamp, Timestamp } from 'firebase/firestore';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import Link from 'next/link';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import {
  Plus, Mail, Phone, ExternalLink, LayoutList, Upload, Search,
  Building2, ShieldCheck, CreditCard, Users, Loader2,
  Filter, ChevronLeft, ChevronRight, MoreHorizontal,
  ArrowUpDown, ListFilter, Tag, Calendar, Edit3
} from 'lucide-react';
import { SupplierImportDialog } from '@/components/suppliers/supplier-import-dialog';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function SuppliersPage() {
  const firestore = useFirestore();
  const suppliersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'suppliers');
  }, [firestore]);
  const { data: suppliers, isLoading } = useCollection(suppliersQuery);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showOnlyNew, setShowOnlyNew] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [newSupplier, setNewSupplier] = useState({
    name: '',
    category: '',
    email: '',
    phone: '',
    address: '',
    vatNumber: '',
    defaultCreditDays: 30,
  });

  const handleAddSupplier = () => {
    if (!newSupplier.name || !firestore) return;
    addDocumentNonBlocking(collection(firestore, 'suppliers'), {
      ...newSupplier,
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setNewSupplier({ name: '', category: '', email: '', phone: '', address: '', vatNumber: '', defaultCreditDays: 30 });
    setIsDialogOpen(false);
  };

  // Categories for filter
  const categories = useMemo(() => {
    if (!suppliers) return [];
    const cats = new Set(suppliers.map(s => s.category).filter(Boolean));
    return Array.from(cats);
  }, [suppliers]);

  const filteredSuppliers = useMemo(() => {
    if (!suppliers) return [];
    let filtered = suppliers;
    
    // Date for 'new' check
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    // Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(s =>
        s.name?.toLowerCase().includes(term) ||
        s.email?.toLowerCase().includes(term) ||
        s.phone?.toLowerCase().includes(term) ||
        s.vatNumber?.toLowerCase().includes(term)
      );
    }
    
    // Category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(s => s.category === categoryFilter);
    }

    // New filter (Interactive Card)
    if (showOnlyNew) {
      filtered = filtered.filter(s => {
        if (!s.createdAt) return false;
        const d = s.createdAt.toDate ? s.createdAt.toDate() : new Date(s.createdAt);
        return d > oneMonthAgo;
      });
    }
    
    return filtered;
  }, [suppliers, searchTerm, categoryFilter, showOnlyNew]);

  // Pagination logic
  const totalPages = Math.ceil(filteredSuppliers.length / pageSize);
  const paginatedSuppliers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredSuppliers.slice(start, start + pageSize);
  }, [filteredSuppliers, currentPage, pageSize]);

  // Summary stats for filter cards
  const stats = useMemo(() => {
    if (!suppliers) return { total: 0, categories: 0, new: 0 };
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    
    return {
      total: suppliers.length,
      categories: categories.length,
      new: suppliers.filter(s => {
        if (!s.createdAt) return false;
        const d = s.createdAt.toDate ? s.createdAt.toDate() : new Date(s.createdAt);
        return d > oneMonthAgo;
      }).length
    };
  }, [suppliers, categories]);

  if (isLoading) return (
    <div className="flex items-center justify-center h-screen bg-slate-50/30">
      <div className="flex flex-col items-center gap-4">
        <div className="p-4 bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 ring-1 ring-slate-100">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
        <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Hydrating Supplier Registry...</p>
      </div>
    </div>
  );

  return (
    <SidebarInset className="flex-1 bg-background">
      <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-3 border-b bg-white/80 backdrop-blur-md px-4 md:px-8">
        <SidebarTrigger className="-ml-1" />
        <div className="h-4 w-[1px] bg-slate-200 hidden md:block" />
        <div className="flex items-center gap-2">
          <div className="p-2 bg-primary/10 rounded-xl">
            <Users className="w-4 h-4 text-primary" />
          </div>
          <h2 className="text-lg font-bold font-headline text-slate-900 tracking-tight">Supplier Master</h2>
          <Badge variant="outline" className="bg-slate-50 border-slate-200 text-slate-500 font-bold text-xs ml-1">
            {filteredSuppliers.length} Total
          </Badge>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <Input
              placeholder="Search by name, email, vat..."
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-9 h-9 bg-slate-50 border-slate-100 rounded-full text-xs w-48 focus:w-80 transition-all"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsImportOpen(true)}
            className="rounded-full border-slate-200 gap-1.5 h-9 text-xs font-bold"
          >
            <Upload className="w-3.5 h-3.5" /> Import
          </Button>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="rounded-full shadow-lg shadow-primary/20 gap-1.5 h-9 text-xs font-bold px-4">
                <Plus className="h-3.5 w-3.5" /> Add New
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-[2.5rem] max-w-md border-none shadow-2xl p-0 overflow-hidden">
              <div className="bg-slate-900 px-8 py-8">
                <DialogHeader>
                  <DialogTitle className="text-white text-xl font-black tracking-tight">Register Supplier</DialogTitle>
                  <p className="text-slate-400 text-xs mt-1 font-medium">Add a new party to your accounting system.</p>
                </DialogHeader>
              </div>
              <div className="p-8 space-y-5 overflow-y-auto max-h-[70vh]">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Business Name *</Label>
                  <Input
                    value={newSupplier.name}
                    onChange={e => setNewSupplier({ ...newSupplier, name: e.target.value })}
                    placeholder="Enter legal trade name"
                    className="bg-slate-50 border-none rounded-2xl h-12 px-4 font-medium focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Category</Label>
                    <Input
                      value={newSupplier.category}
                      onChange={e => setNewSupplier({ ...newSupplier, category: e.target.value })}
                      placeholder="e.g. FMCG"
                      className="bg-slate-50 border-none rounded-2xl h-12 px-4 font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Payment Term</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        value={newSupplier.defaultCreditDays}
                        onChange={e => setNewSupplier({ ...newSupplier, defaultCreditDays: parseInt(e.target.value) || 30 })}
                        className="bg-slate-50 border-none rounded-2xl h-12 pl-4 pr-10 font-medium"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">DAYS</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Primary Phone</Label>
                    <Input
                      value={newSupplier.phone}
                      onChange={e => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                      placeholder="e.g. +971"
                      className="bg-slate-50 border-none rounded-2xl h-12 px-4 font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Email Address</Label>
                    <Input
                      value={newSupplier.email}
                      onChange={e => setNewSupplier({ ...newSupplier, email: e.target.value })}
                      placeholder="billing@..."
                      className="bg-slate-50 border-none rounded-2xl h-12 px-4 font-medium"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">VAT / TRN (Optional)</Label>
                  <Input
                    value={newSupplier.vatNumber}
                    onChange={e => setNewSupplier({ ...newSupplier, vatNumber: e.target.value })}
                    placeholder="Tax Registration Number"
                    className="bg-slate-50 border-none rounded-2xl h-12 px-4 font-mono text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Location Address</Label>
                  <Input
                    value={newSupplier.address}
                    onChange={e => setNewSupplier({ ...newSupplier, address: e.target.value })}
                    placeholder="Office, City"
                    className="bg-slate-50 border-none rounded-2xl h-12 px-4 font-medium"
                  />
                </div>

                <div className="pt-2">
                  <Button className="w-full rounded-full h-12 font-black uppercase tracking-widest text-xs shadow-xl shadow-primary/20 hover:shadow-primary/40 transition-all" onClick={handleAddSupplier}>
                    Complete Registration
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="p-4 md:p-8 space-y-8 max-w-[1600px] mx-auto w-full">
        <SupplierImportDialog open={isImportOpen} onOpenChange={setIsImportOpen} />

        {/* ── Filter Cards / Summary Stats ────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card 
            className={`border-none shadow-sm ring-1 ring-slate-100 rounded-[2rem] overflow-hidden group transition-all duration-300 cursor-pointer ${!showOnlyNew && categoryFilter === 'all' && !searchTerm ? 'ring-primary/40 bg-primary/5' : 'bg-white hover:ring-primary/20'}`}
            onClick={() => {
              setShowOnlyNew(false);
              setCategoryFilter('all');
              setSearchTerm('');
            }}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-2xl group-hover:bg-primary group-hover:text-white transition-colors duration-500 ${!showOnlyNew && categoryFilter === 'all' && !searchTerm ? 'bg-primary text-white' : 'bg-primary/10 text-primary'}`}>
                  <Users className="w-5 h-5" />
                </div>
                <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-100 font-bold text-[10px] uppercase">Active Fleet</Badge>
              </div>
              <p className="text-3xl font-black text-slate-900 tracking-tight">{stats.total}</p>
              <p className="text-xs text-slate-400 mt-1 font-medium">Total registered suppliers</p>
            </CardContent>
          </Card>

          <Card 
            className={`border-none shadow-sm ring-1 ring-slate-100 rounded-[2rem] overflow-hidden group transition-all duration-300 cursor-pointer ${showOnlyNew ? 'ring-green-500/40 bg-green-50/50' : 'bg-white hover:ring-green-500/20'}`}
            onClick={() => setShowOnlyNew(!showOnlyNew)}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-2xl group-hover:bg-green-500 group-hover:text-white transition-colors duration-500 ${showOnlyNew ? 'bg-green-500 text-white' : 'bg-green-50 text-green-600'}`}>
                  <Calendar className="w-5 h-5" />
                </div>
                <Badge variant="outline" className="bg-green-50 text-green-600 border-green-100 font-bold text-[10px] uppercase">New Additions</Badge>
              </div>
              <p className="text-3xl font-black text-slate-900 tracking-tight">{stats.new}</p>
              <p className="text-xs text-slate-400 mt-1 font-medium">Joined in last 30 days</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm ring-1 ring-slate-100 rounded-[2rem] bg-white overflow-hidden group hover:ring-blue-500/20 transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-blue-50 rounded-2xl group-hover:bg-blue-500 group-hover:text-white transition-colors duration-500">
                  <Tag className="w-5 h-5 text-blue-600 group-hover:text-white" />
                </div>
                <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-100 font-bold text-[10px] uppercase">Diversity</Badge>
              </div>
              <p className="text-3xl font-black text-slate-900 tracking-tight">{stats.categories}</p>
              <p className="text-xs text-slate-400 mt-1 font-medium">Unique business segments</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm ring-1 ring-slate-100 rounded-[2rem] bg-white overflow-hidden group hover:ring-slate-900/20 transition-all duration-300">
            <CardContent className="p-6 bg-slate-900 text-white">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-white/10 rounded-2xl">
                  <ShieldCheck className="w-5 h-5 text-white" />
                </div>
                <Badge variant="outline" className="bg-white/5 text-white/60 border-white/10 font-bold text-[10px] uppercase">Compliance</Badge>
              </div>
              <p className="text-3xl font-black tracking-tight">100%</p>
              <p className="text-xs text-white/40 mt-1 font-medium">Verified master data records</p>
            </CardContent>
          </Card>
        </div>

        {/* ── Table & Filter Logic ────────────────────────────────────────── */}
        <Card className="border-none shadow-sm ring-1 ring-slate-100 rounded-[2.5rem] bg-white overflow-hidden">
          <CardHeader className="px-8 pt-8 pb-6 bg-slate-50/50 border-b">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1">
                <CardTitle className="text-xl font-black text-slate-900">Directory</CardTitle>
                <CardDescription className="text-xs font-medium">Manage and monitor all supplier accounts</CardDescription>
              </div>
              
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 bg-white rounded-full px-4 py-1.5 ring-1 ring-slate-200">
                  <ListFilter className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Category:</span>
                  <Select value={categoryFilter} onValueChange={(v) => {
                    setCategoryFilter(v);
                    setCurrentPage(1);
                  }}>
                    <SelectTrigger className="border-none bg-transparent h-auto p-0 text-xs font-bold w-auto focus:ring-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-none shadow-2xl">
                      <SelectItem value="all">All Segments</SelectItem>
                      {categories.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="h-4 w-[1px] bg-slate-200 hidden sm:block mx-1" />

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Show:</span>
                  <Select value={pageSize.toString()} onValueChange={(v) => {
                    setPageSize(parseInt(v));
                    setCurrentPage(1);
                  }}>
                    <SelectTrigger className="w-16 h-8 bg-white border-slate-200 rounded-full text-xs font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-none shadow-2xl">
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:hidden mt-2 w-full">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <Input
                      placeholder="Quick search..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="pl-9 h-10 bg-white border-slate-200 rounded-full text-xs w-full"
                    />
                  </div>
                </div>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow className="hover:bg-transparent border-b-slate-100">
                  <TableHead className="py-5 pl-8 text-[11px] font-black uppercase tracking-tight text-slate-500">Business Identity</TableHead>
                  <TableHead className="py-5 text-[11px] font-black uppercase tracking-tight text-slate-500">Industry</TableHead>
                  <TableHead className="py-5 text-[11px] font-black uppercase tracking-tight text-slate-500">Contact</TableHead>
                  <TableHead className="py-5 text-[11px] font-black uppercase tracking-tight text-slate-500 text-center">VAT Compliance</TableHead>
                  <TableHead className="py-5 text-[11px] font-black uppercase tracking-tight text-slate-500 text-center">Term</TableHead>
                  <TableHead className="py-5 pr-8 text-[11px] font-black uppercase tracking-tight text-slate-500 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedSuppliers.map((supplier) => (
                  <TableRow key={supplier.id} className="hover:bg-slate-50/50 transition-colors border-b-slate-50 group">
                    <TableCell className="py-5 pl-8">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-primary font-black text-sm group-hover:scale-110 transition-transform">
                          {supplier.name?.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-black text-slate-900 leading-tight">{supplier.name}</span>
                          <div className="flex items-center gap-1.5 mt-1">
                            <Building2 className="w-3 h-3 text-slate-300" />
                            <span className="text-[11px] font-medium text-slate-500">{supplier.address || 'Location Not Set'}</span>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-5">
                      <Badge variant="outline" className="rounded-full px-3 py-0.5 bg-slate-50 border-slate-200 text-slate-500 font-bold text-[10px] uppercase tracking-wider">
                        {supplier.category || 'General'}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-5">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                          <Mail className="w-3 h-3 text-slate-300" />
                          {supplier.email || '—'}
                        </div>
                        <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
                          <Phone className="w-3 h-3 text-slate-300" />
                          {supplier.phone || '—'}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-5 text-center">
                      {supplier.vatNumber ? (
                        <div className="flex flex-col items-center">
                          <div className="flex items-center gap-1.5 text-[10px] font-black text-primary uppercase">
                            <ShieldCheck className="w-3 h-3" /> TRN Verified
                          </div>
                          <span className="text-[10px] font-mono text-slate-400 mt-0.5 leading-none">{supplier.vatNumber}</span>
                        </div>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest leading-none">—</span>
                      )}
                    </TableCell>
                    <TableCell className="py-5 text-center">
                      <div className="inline-flex flex-col items-center justify-center w-12 h-12 rounded-2xl bg-slate-50 ring-1 ring-slate-100">
                        <span className="text-xs font-black text-slate-900 leading-none">{supplier.defaultCreditDays || 30}</span>
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter mt-1">Days</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-5 pr-8 text-right">
                      <div className="flex justify-end gap-2">
                        <Link href={`/suppliers/${supplier.id}`}>
                          <Button variant="ghost" size="sm" className="rounded-full h-8 px-4 text-xs font-black hover:bg-primary/5 hover:text-primary transition-all">
                            Ledger
                          </Button>
                        </Link>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full opacity-40 group-hover:opacity-100">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-2xl border-none shadow-2xl p-2 min-w-[160px]">
                            <DropdownMenuLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-3 py-2">Account Actions</DropdownMenuLabel>
                            <DropdownMenuItem className="rounded-xl flex items-center gap-2 cursor-pointer font-bold text-xs py-2.5">
                              <Edit3 className="w-3.5 h-3.5" /> Edit Profile
                            </DropdownMenuItem>
                            <DropdownMenuItem className="rounded-xl flex items-center gap-2 cursor-pointer font-bold text-xs py-2.5">
                              <CreditCard className="w-3.5 h-3.5" /> Record Payment
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-slate-100" />
                            <DropdownMenuItem className="rounded-xl flex items-center gap-2 cursor-pointer font-bold text-xs py-2.5 text-red-600 focus:text-red-600 focus:bg-red-50">
                              Archive Supplier
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredSuppliers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-32 text-center">
                      <div className="flex flex-col items-center">
                        <div className="w-16 h-16 bg-slate-50 rounded-[2rem] flex items-center justify-center mb-4 ring-1 ring-slate-100">
                          <Search className="w-6 h-6 text-slate-300" />
                        </div>
                        <p className="font-black text-slate-900 tracking-tight">No Matching Suppliers</p>
                        <p className="text-xs text-slate-400 mt-1 max-w-[200px]">We couldn't find any suppliers matching your current filters or search term.</p>
                        <Button variant="ghost" size="sm" className="mt-6 rounded-full text-primary font-bold" onClick={() => {
                          setSearchTerm('');
                          setCategoryFilter('all');
                        }}>
                          Clear All Filters
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
          
          <CardFooter className="px-8 py-6 border-t bg-slate-50/30 flex items-center justify-between">
            <p className="text-xs font-bold text-slate-400">
              Showing <span className="text-slate-900 font-black">{(currentPage-1)*pageSize + 1}</span> to <span className="text-slate-900 font-black">{Math.min(currentPage*pageSize, filteredSuppliers.length)}</span> of <span className="text-slate-900 font-black">{filteredSuppliers.length}</span> entries
            </p>
            
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="icon" 
                className="h-9 w-9 rounded-full border-slate-200"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => prev - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <div className="flex items-center gap-1 px-2">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pageNum = i + 1; // Simplistic pagination for now
                  return (
                    <Button 
                      key={pageNum}
                      variant={currentPage === pageNum ? "default" : "ghost"}
                      size="icon"
                      className={`h-9 w-9 rounded-full text-xs font-black ${currentPage === pageNum ? 'shadow-lg shadow-primary/20' : ''}`}
                      onClick={() => setCurrentPage(pageNum)}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
                {totalPages > 5 && <span className="text-slate-300 px-1 font-bold">...</span>}
              </div>

              <Button 
                variant="outline" 
                size="icon" 
                className="h-9 w-9 rounded-full border-slate-200"
                disabled={currentPage === totalPages || totalPages === 0}
                onClick={() => setCurrentPage(prev => prev + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardFooter>
        </Card>
      </main>
    </SidebarInset>
  );
}
