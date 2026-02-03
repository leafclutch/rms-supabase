

import { useEffect } from "react";
import {
  TrendingUp,
  Users,
  Package,
  ShoppingBag,
  Wallet,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import ToggleSideBar from "../../components/admin/ToggleSideBar";
import { useOrderStore } from "../../store/useOrderStore";

const AdminDashboardView = () => {
  const navigate = useNavigate();
  const { orders, fetchOrders, initializeRealtime, historyOrders, fetchHistory } = useOrderStore();

  useEffect(() => {
    fetchOrders();
    fetchHistory();
    const cleanup = initializeRealtime();
    return cleanup;
  }, []);

  // Filter and sort for truly "recent" active orders
  const recentOrders = [...orders]
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 5);

  // Calculate Today's Revenue (Cash + Online, excluding Credit)
  const todaysRevenue = [...orders, ...historyOrders].reduce((acc, order) => {
    const dateObj = new Date(order.createdAt || order.updatedAt || Date.now());
    const today = new Date();
    const isToday = dateObj.getDate() === today.getDate() &&
      dateObj.getMonth() === today.getMonth() &&
      dateObj.getFullYear() === today.getFullYear();

    if (!isToday) return acc;

    let cash = Number(order.cashAmount || 0);
    let online = Number(order.onlineAmount || 0);
    let credit = Number(order.creditAmount || 0);

    // Logic to handle anonymous credit as cash (matching AdminOrdersView)
    if (credit > 0 && !order.customerId) {
      cash += credit;
    }

    // Only add realized payments (Cash + Online)
    // If mixed, cash and online are added. Credit part is ignored.
    return acc + cash + online;
  }, 0);

  const stats = [
    {
      label: "Today's Revenue",
      value: "Rs. " + todaysRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }),
      icon: Wallet,
      color: "text-green-600",
      bg: "bg-green-100",
    },
    {
      label: "Active Orders",
      value: orders.length.toString(),
      icon: TrendingUp,
      color: "text-blue-600",
      bg: "bg-blue-100",
    },
    {
      label: "Tables Occupied",
      value: [...new Set(orders.map(o => o.tableNumber).filter(Boolean))].length.toString(),
      icon: Users,
      color: "text-purple-600",
      bg: "bg-purple-100",
    },
    {
      label: "Menu Items",
      value: "...", // This would need useMenuStore
      icon: Package,
      color: "text-orange-600",
      bg: "bg-orange-100",
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
      case 'served':
      case 'paid':
        return "bg-green-100 text-green-800";
      case 'preparing':
        return "bg-yellow-100 text-yellow-800";
      case 'pending':
        return "bg-blue-100 text-blue-800";
      case 'cancelled':
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b px-4 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <ToggleSideBar />
            <h1 className="text-xl lg:text-2xl font-bold">Dashboard</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600 hidden md:block">
              Welcome back, Admin!
            </span>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
            {stats.map((stat, idx) => (
              <div
                key={idx}
                className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow"
              >
                <div
                  className={`${stat.bg} w-12 h-12 rounded-lg flex items-center justify-center mb-4`}
                >
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
                <div className="text-2xl lg:text-3xl font-bold mb-1">
                  {stat.value}
                </div>
                <div className="text-sm text-gray-600">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
            <h2 className="text-lg lg:text-xl font-bold mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <button
                onClick={() => navigate("/admin/menu")}
                className="p-4 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-all"
              >
                Manage Menu
              </button>
              <button
                onClick={() => navigate("/admin/orders")}
                className="p-4 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all"
              >
                View Orders
              </button>
              <button
                onClick={() => navigate("/admin/inventory")}
                className="p-4 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-all"
              >
                Check Inventory
              </button>
              <button
                onClick={() => navigate("/admin/reports")}
                className="p-4 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-all"
              >
                View Reports
              </button>
            </div>
          </div>

          {/* Recent Orders */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg lg:text-xl font-bold">Recent Orders</h2>
              <button
                onClick={() => navigate("/admin/orders")}
                className="text-orange-600 hover:text-orange-700 font-semibold text-sm"
              >
                View All →
              </button>
            </div>

            <div className="space-y-4">
              {recentOrders.length > 0 ? (
                recentOrders.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                        <ShoppingBag className="w-6 h-6 text-orange-600" />
                      </div>
                      <div>
                        <div className="font-semibold">
                          Order #{order.orderNumber || order.id.toString().slice(-4)}
                        </div>
                        <div className="text-sm text-gray-600">
                          {order.tableNumber ? `Table ${order.tableNumber}` : 'WALK-IN'} • {order.customerName || 'Guest'}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg">
                        Rs. {order.totalAmount}
                      </div>
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(order.status)}`}
                      >
                        {order.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500 font-medium">
                  No active orders found.
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default AdminDashboardView;