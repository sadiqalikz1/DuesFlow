
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  FileUp, 
  Users, 
  CreditCard, 
  History, 
  Building2, 
  LogOut,
  ChevronRight,
  LogIn,
  Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useUser, useAuth, initiateAnonymousSignIn } from '@/firebase';
import { signOut } from 'firebase/auth';

const navItems = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Upload Purchases', href: '/upload', icon: FileUp },
  { name: 'Make Payments', href: '/payments', icon: CreditCard },
  { name: 'Ledger Reports', href: '/reports', icon: History },
  { name: 'Suppliers', href: '/suppliers', icon: Users },
  { name: 'Branches', href: '/branches', icon: Building2 },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, isUserLoading } = useUser();
  const auth = useAuth();

  const handleAuth = () => {
    if (user) {
      signOut(auth);
    } else {
      initiateAnonymousSignIn(auth);
    }
  };

  return (
    <div className="flex flex-col h-screen w-64 border-r bg-white shadow-sm fixed left-0 top-0">
      <div className="p-6 flex items-center gap-3">
        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
          <CreditCard className="text-white w-6 h-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-primary font-headline">DuesFlow</h1>
          <p className="text-[10px] text-muted-foreground uppercase font-semibold">Financial Control</p>
        </div>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link key={item.name} href={item.href}>
              <div className={cn(
                "flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-200 group cursor-pointer",
                isActive 
                  ? "bg-primary text-white shadow-md shadow-primary/20" 
                  : "text-muted-foreground hover:bg-secondary hover:text-primary"
              )}>
                <div className="flex items-center gap-3">
                  <item.icon className={cn("w-5 h-5", isActive ? "text-white" : "text-muted-foreground group-hover:text-primary")} />
                  <span className="font-medium text-sm">{item.name}</span>
                </div>
                {isActive && <ChevronRight className="w-4 h-4" />}
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t bg-slate-50/50">
        <div className="flex items-center gap-3 px-3 py-3 mb-4 rounded-xl border bg-white shadow-sm">
          <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white font-bold text-xs uppercase">
            {user ? (user.displayName?.[0] || user.email?.[0] || 'U') : '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold truncate">{user ? (user.displayName || user.email || 'Active User') : 'Guest'}</p>
            <p className="text-[10px] text-muted-foreground truncate">{user ? 'Authorized Session' : 'No Session'}</p>
          </div>
        </div>
        <Button 
          variant="ghost" 
          className={cn(
            "w-full justify-start",
            user ? "text-destructive hover:text-destructive hover:bg-destructive/10" : "text-primary hover:text-primary hover:bg-primary/10"
          )} 
          size="sm"
          onClick={handleAuth}
          disabled={isUserLoading}
        >
          {user ? (
            <>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </>
          ) : (
            <>
              <LogIn className="mr-2 h-4 w-4" />
              Sign In
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
