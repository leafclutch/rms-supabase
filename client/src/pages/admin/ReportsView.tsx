// ReportsView.tsx
import React, { useState, useEffect } from 'react';
import {
  Download,
  ChefHat,
  Coffee,
  Cigarette,
  Calendar,
  CreditCard,
  Banknote,
  Smartphone,
  Wallet,
  X,
  ChevronRight,
  Utensils
} from 'lucide-react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import { getSalesReport } from '../../api/reports';
import toast from 'react-hot-toast';

// Static for mapping icons/colors
const DEPARTMENTS = [
  { id: 'KITCHEN', name: 'Kitchen', icon: ChefHat, color: 'orange' },
  { id: 'DRINK', name: 'Drink', icon: Coffee, color: 'blue' },
  { id: 'BAKERY', name: 'Bakery', icon: Coffee, color: 'amber' },
  { id: 'HUKKA', name: 'Hookah', icon: Cigarette, color: 'purple' },
];

interface DepartmentDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  departmentName: string;
  items: { name: string; quantity: number; revenue: number }[];
  totalRevenue: number;
}

const DepartmentDetailsModal: React.FC<DepartmentDetailsModalProps> = ({ isOpen, onClose, departmentName, items, totalRevenue }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-center p-4 border-b">
          <div>
            <h3 className="font-bold text-lg text-gray-800">{departmentName} Details</h3>
            <p className="text-sm text-gray-500">Revenue Breakdown</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4">
          {items.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Utensils className="w-10 h-10 mx-auto mb-2 opacity-20" />
              <p>No items sold in this period.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="bg-white p-2 rounded-md shadow-sm text-xs font-bold text-gray-500 w-8 h-8 flex items-center justify-center">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">{item.name}</p>
                      <p className="text-xs text-gray-500">{item.quantity} units sold</p>
                    </div>
                  </div>
                  <p className="font-bold text-gray-900">Rs. {Math.round(item.revenue).toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 bg-gray-50 border-t rounded-b-xl flex justify-between items-center">
          <span className="font-medium text-gray-600">Total Department Revenue</span>
          <span className="font-bold text-lg text-gray-900">Rs. {Math.round(totalRevenue).toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
};


const ReportsView: React.FC = () => {
  const [filterDate, setFilterDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<any>(null);
  const [selectedDept, setSelectedDept] = useState<string | null>(null);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const data = await getSalesReport(filterDate, filterDate); // Daily report
      setReportData(data);
    } catch (error) {
      console.error("Failed to fetch report", error);
      toast.error("Failed to load sales report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [filterDate]);

  const salesSummary = reportData?.summary || { totalRevenue: 0, totalOrders: 0, totalDiscount: 0, netRevenue: 0, totalDebtSettled: 0 };
  const byPaymentMethod = reportData?.byPaymentMethod || { CASH: { amount: 0 }, ONLINE: { amount: 0 }, CREDIT: { amount: 0 } };
  const deptStats = reportData?.byDepartment || {};

  const getColorClasses = (color: string) => {
    const colors: any = {
      orange: { bg: 'bg-orange-100', text: 'text-orange-600', border: 'border-orange-500', ring: 'focus:ring-orange-500' },
      blue: { bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-500', ring: 'focus:ring-blue-500' },
      amber: { bg: 'bg-amber-100', text: 'text-amber-600', border: 'border-amber-500', ring: 'focus:ring-amber-500' },
      purple: { bg: 'bg-purple-100', text: 'text-purple-600', border: 'border-purple-500', ring: 'focus:ring-purple-500' },
    };
    return colors[color] || colors.orange;
  };

  const handleExport = () => {
    if (!reportData) return;

    const headers = [
      'Department',
      'TotalItems',
      'Revenue',
      'Cash',
      'Online',
      'Credit',
      'TotalPaidSales'
    ];

    const rows = DEPARTMENTS.map(dept => {
      const stats = deptStats[dept.id] || { revenue: 0, items: 0, cash: 0, online: 0, credit: 0 };
      const totalPaid = stats.cash + stats.online;

      return [
        dept.name,
        stats.items,
        Math.round(stats.revenue),
        Math.round(stats.cash),
        Math.round(stats.online),
        Math.round(stats.credit),
        Math.round(totalPaid)
      ].join(',');
    });

    // Add Overall Summary
    const summaryRow = [
      'TOTAL SALES',
      salesSummary.totalOrders, // Using total orders count here effectively
      Math.round(salesSummary.totalRevenue),
      Math.round(byPaymentMethod.CASH?.amount || 0),
      Math.round(byPaymentMethod.ONLINE?.amount || 0),
      Math.round(byPaymentMethod.CREDIT?.amount || 0),
      Math.round(salesSummary.netRevenue)
    ].join(',');

    const csvContent = [headers.join(','), ...rows, '', summaryRow].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `department_sales_report_${filterDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectedDeptData = selectedDept ? deptStats[selectedDept] : null;
  const selectedDeptName = DEPARTMENTS.find(d => d.id === selectedDept)?.name || '';

  return (
    <div className="h-screen bg-gray-50 overflow-hidden flex flex-col">
      <header className="bg-white border-b px-6 py-4 flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Sales Reports</h1>
            <p className="text-gray-600">Overview for <span className="font-semibold">{filterDate}</span></p>
          </div>
          <Button variant="outline" icon={<Download className="w-5 h-5" />} onClick={handleExport}>
            Export CSV
          </Button>
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-end md:items-center justify-between bg-gray-50 p-3 rounded-xl border border-gray-100">
          <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-500 uppercase">Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm bg-white"
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="p-6 overflow-y-auto flex-1">
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <div className="h-10 w-10 border-b-2 border-orange-600 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card className="border-l-4 border-orange-500 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-600 font-medium">Total Revenue (Paid)</p>
                  <Wallet className="w-5 h-5 text-orange-500" />
                </div>
                <p className="text-2xl font-bold text-gray-900">Rs. {salesSummary.netRevenue.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">{salesSummary.totalOrders} orders</p>
              </Card>

              <Card className="border-l-4 border-green-500 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-600 font-medium">Cash Sales</p>
                  <Banknote className="w-5 h-5 text-green-500" />
                </div>
                <p className="text-2xl font-bold text-gray-900">Rs. {(byPaymentMethod.CASH?.amount || 0).toLocaleString()}</p>
                <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                  <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${salesSummary.netRevenue ? ((byPaymentMethod.CASH?.amount || 0) / salesSummary.netRevenue) * 100 : 0}%` }}></div>
                </div>
              </Card>

              <Card className="border-l-4 border-blue-500 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-600 font-medium">Online Sales</p>
                  <Smartphone className="w-5 h-5 text-blue-500" />
                </div>
                <p className="text-2xl font-bold text-gray-900">Rs. {(byPaymentMethod.ONLINE?.amount || 0).toLocaleString()}</p>
                <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                  <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${salesSummary.netRevenue ? ((byPaymentMethod.ONLINE?.amount || 0) / salesSummary.netRevenue) * 100 : 0}%` }}></div>
                </div>
              </Card>

              <Card className="border-l-4 border-red-500 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-600 font-medium">Credit</p>
                  <CreditCard className="w-5 h-5 text-red-500" />
                </div>
                <p className="text-2xl font-bold text-gray-900">Rs. {(byPaymentMethod.CREDIT?.amount || 0).toLocaleString()}</p>
                {salesSummary.totalDebtSettled > 0 && (
                  <p className="text-xs text-emerald-600 mt-1 font-semibold">
                    + Rs. {salesSummary.totalDebtSettled.toLocaleString()} collected
                  </p>
                )}
              </Card>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-xl font-bold text-gray-800">Department Sales</h2>
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">Click on a card for details</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {DEPARTMENTS.map((dept) => {
                  const Icon = dept.icon;
                  const c = getColorClasses(dept.color);
                  const stats = deptStats[dept.id] || { revenue: 0, items: 0 };

                  return (
                    <Card
                      key={dept.id}
                      className={`border-l-4 ${c.border} shadow-sm overflow-hidden relative cursor-pointer hover:shadow-md transition-shadow`}
                      onClick={() => setSelectedDept(dept.id)}
                    >
                      <div className="flex items-center gap-3 mb-3 relative z-10">
                        <div className={`${c.bg} p-2 rounded-lg`}>
                          <Icon className={`${c.text} w-5 h-5`} />
                        </div>
                        <h3 className="font-bold text-gray-700">{dept.name}</h3>
                        <ChevronRight className="w-4 h-4 text-gray-400 ml-auto" />
                      </div>
                      <div className="space-y-1 relative z-10">
                        <p className="text-sm text-gray-500">Department Revenue</p>
                        <p className={`text-2xl font-bold ${c.text}`}>
                          Rs. {Math.round(stats.revenue).toLocaleString()}
                        </p>
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                          <p className="text-xs text-gray-400">Total Items Paid</p>
                          <p className="text-sm font-bold text-gray-600">{stats.items}</p>
                        </div>
                      </div>

                      {/* Subtile background decoration */}
                      <div className={`absolute -right-4 -bottom-4 opacity-5 ${c.text}`}>
                        <Icon className="w-20 h-20" />
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>

      <DepartmentDetailsModal
        isOpen={!!selectedDept}
        onClose={() => setSelectedDept(null)}
        departmentName={selectedDeptName}
        items={selectedDeptData?.topItems || []}
        totalRevenue={selectedDeptData?.revenue || 0}
      />
    </div >
  );
};

export default ReportsView;
