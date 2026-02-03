

import React from "react";
import { BarChart3, Home, LogOut, Package, ShoppingBag, User, Utensils, X } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import {useAuthStore} from '../../store/useAuthStore' // Correct import for store usage



const menuItems = [
  { path: '/admin/dashboard', icon: Home, label: 'Dashboard' },
  { path: '/admin/menu', icon: Utensils, label: 'Menu' },
  { path: '/admin/orders', icon: ShoppingBag, label: 'Orders' },
  { path: '/admin/walk-in-customer', icon: ShoppingBag, label: 'Walk-In-Customer' },
  { path: '/admin/generate-qr', icon: ShoppingBag, label: 'Generate QR' },
  { path: '/admin/inventory', icon: ShoppingBag, label: 'Inventory' },
  { path: '/admin/credit', icon: Package, label: 'Credit' },
  { path: '/admin/reports', icon: BarChart3, label: 'Reports' },
];


interface AdminSidebarProps {
  sidebarOpen?: boolean;
  setSidebarOpen?: (open: boolean) => void;
}

const AdminSidebar: React.FC<AdminSidebarProps> = ({ sidebarOpen = false, setSidebarOpen = () => {} }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const {logout} = useAuthStore(); // get logout from zustand store

  return (
    <>
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      {/* Sidebar */}
      <div className={`fixed lg:static inset-y-0 left-0 transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 transition-transform duration-300 ease-in-out z-50 w-64 bg-slate-800 text-white flex flex-col`}>
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-3xl">🍽️</div>
              <div>
                <h2 className="font-bold text-lg">RMS Admin</h2>
                <p className="text-xs text-slate-400">Dashboard</p>
              </div>
            </div>
            <div onClick={() => setSidebarOpen(false)} className="lg:hidden">
              <X className="w-5 h-5" />
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {menuItems.map((item) => (
            <button
              key={item.path}
              onClick={() => {
                navigate(item.path);
                setSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                location.pathname === item.path || location.pathname.startsWith(item.path + '/')
                  ? 'bg-orange-600 text-white'
                  : 'text-slate-300 hover:bg-slate-700'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-700">
          <div className="flex items-center gap-3 px-4 py-3 bg-slate-700 rounded-lg mb-2">
            <User className="w-5 h-5" />
            <div className="flex-1">
              <p className="font-medium text-sm">Admin User</p>
              <p className="text-xs text-slate-400">admin@gmail.com</p>
            </div>
          </div>
          <button
            onClick={async () => {
                await logout();
                navigate('/admin/login');
                setSidebarOpen(false);
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-red-400 hover:bg-slate-700 rounded-lg transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-sm font-medium">Logout</span>
          </button>
        </div>
      </div>
    </>
  );
}  
export default AdminSidebar;