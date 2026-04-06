
'use client';

import * as React from 'react';
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
  LogIn,
  Settings,
  Menu
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useUser, useAuth, initiateAnonymousSignIn } from '@/firebase';
import { signOut } from 'firebase/auth';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar
} from '@/components/ui/sidebar';

const navItems = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Upload Purchases', href: '/upload', icon: FileUp },
  { name: 'Make Payments', href: '/payments', icon: CreditCard },
  { name: 'Ledger Reports', href: '/reports', icon: History },
  { name: 'Suppliers', href: '/suppliers', icon: Users },
  { name: 'Branches', href: '/branches', icon: Building2 },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const { state } = useSidebar();

  const handleAuth = () => {
    if (user) {
      signOut(auth);
    } else {
      initiateAnonymousSignIn(auth);
    }
  };

  return (
    <Sidebar collapsible="icon" className="border-r bg-white shadow-sm">
      <SidebarHeader className="p-4 flex flex-row items-center gap-3 h-16">
        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shrink-0">
          <CreditCard className="text-white w-6 h-6" />
        </div>
        {state !== 'collapsed' && (
          <div className="flex flex-col">
            <h1 className="text-lg font-bold tracking-tight text-primary font-headline leading-tight">DuesFlow</h1>
            <p className="text-[10px] text-muted-foreground uppercase font-semibold">Financial Control</p>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarMenu>
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <SidebarMenuItem key={item.name}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  tooltip={item.name}
                  className={cn(
                    "transition-all duration-200 h-10 px-3",
                    isActive 
                      ? "bg-primary text-white hover:bg-primary/90 hover:text-white" 
                      : "text-muted-foreground hover:bg-secondary hover:text-primary"
                  )}
                >
                  <Link href={item.href}>
                    <item.icon className={cn("w-5 h-5")} />
                    <span>{item.name}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t bg-slate-50/50">
        <div className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-xl border bg-white shadow-sm transition-all duration-200",
          state === 'collapsed' ? "p-1 justify-center border-none shadow-none bg-transparent" : ""
        )}>
          <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white font-bold text-xs uppercase shrink-0">
            {user ? (user.displayName?.[0] || user.email?.[0] || 'U') : '?'}
          </div>
          {state !== 'collapsed' && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold truncate">{user ? (user.displayName || user.email || 'Active User') : 'Guest'}</p>
              <p className="text-[10px] text-muted-foreground truncate">{user ? 'Authorized Session' : 'No Session'}</p>
            </div>
          )}
        </div>
        <Button 
          variant="ghost" 
          className={cn(
            "w-full justify-start mt-2 px-3",
            user ? "text-destructive hover:text-destructive hover:bg-destructive/10" : "text-primary hover:text-primary hover:bg-primary/10",
            state === 'collapsed' ? "justify-center px-0" : ""
          )} 
          size="sm"
          onClick={handleAuth}
          disabled={isUserLoading}
        >
          {user ? <LogOut className="h-4 w-4 shrink-0" /> : <LogIn className="h-4 w-4 shrink-0" />}
          {state !== 'collapsed' && <span className="ml-2">{user ? 'Sign Out' : 'Sign In'}</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
