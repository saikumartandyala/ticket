'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Ticket, PlusCircle, LayoutDashboard, LogIn, LogOut, Bell } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

export const Navbar: React.FC = () => {
  const pathname = usePathname();
  const { isAuthenticated, user, logout } = useAuthStore();

  const navItems = [
    { label: 'Browse Tickets', path: '/tickets', icon: Ticket },
    { label: 'Post Ticket', path: '/post', icon: PlusCircle },
  ];

  if (isAuthenticated) {
    navItems.push({ label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard });
  }

  return (
    <nav className="sticky top-0 z-50 bg-[#090d16]/80 backdrop-blur-md border-b border-white/5 py-4 px-6 md:px-12 flex justify-between items-center">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2">
        <div className="bg-gradient-to-r from-blue-500 to-indigo-500 p-2 rounded-xl text-white shadow-lg shadow-blue-500/20">
          <Ticket className="w-5 h-5" />
        </div>
        <span className="font-bold text-lg tracking-wider bg-gradient-to-r from-slate-100 to-slate-300 bg-clip-text text-transparent">
          LastMinute<span className="text-blue-400 font-extrabold">Pass</span>
        </span>
      </Link>

      {/* Navigation Links */}
      <div className="hidden md:flex items-center gap-8">
        {navItems.map((item) => {
          const isActive = pathname === item.path;
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`flex items-center gap-2 text-sm font-semibold transition-colors duration-200 ${
                isActive ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <item.icon className="w-4 h-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Authentication and Profile actions */}
      <div className="flex items-center gap-4">
        {isAuthenticated ? (
          <div className="flex items-center gap-4">
            {/* Notification Icon */}
            <Link href="/dashboard" className="p-2 text-slate-400 hover:text-slate-200 hover:bg-white/5 rounded-full transition relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-blue-500 rounded-full border border-[#090d16]" />
            </Link>
            
            {/* User Profile Avatar */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 text-xs font-bold flex items-center justify-center">
                {user?.name ? user.name.split(' ').map(n=>n[0]).join('').substring(0, 2).toUpperCase() : 'U'}
              </div>
              <span className="text-xs text-slate-300 font-medium hidden sm:inline">{user?.name || 'User'}</span>
            </div>

            {/* Logout */}
            <button 
              onClick={logout}
              className="text-slate-400 hover:text-rose-400 p-2 hover:bg-white/5 rounded-full transition"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <Link 
            href="/auth" 
            className="flex items-center gap-2 text-xs font-bold px-4 py-2 border border-white/10 hover:border-white/20 rounded-full text-slate-300 hover:text-white transition bg-white/5"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Login / Register</span>
          </Link>
        )}
      </div>
    </nav>
  );
};
