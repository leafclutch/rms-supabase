import { useState, useEffect } from 'react';
import { X, Printer, Receipt, Search, CheckCircle, XCircle, UserPlus, Minus, Plus, Trash2 } from 'lucide-react';
import logo from '../../assets/logo.png';
import { payCash, payOnline, payMixed, payCredit } from '../../api/payment';
import { searchCustomers, addCustomer } from '../../api/credit';
import type { Order, PaymentMethod, DiscountType } from '../../types/order';
import { useOrderStore } from '../../store/useOrderStore';
import toast from 'react-hot-toast';

interface ViewOrderDetailsModalProps {
    isOpen: boolean;
    order: Order | null;
    onClose: () => void;
}

const ViewOrderDetailsModal = ({ isOpen, order, onClose }: ViewOrderDetailsModalProps) => {
    const { cancelOrder, updateOrderItem } = useOrderStore();
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
    const [discountType, setDiscountType] = useState<DiscountType>('PERCENT');
    const [discountValue, setDiscountValue] = useState<number | ''>(0);
    const [finalAmount, setFinalAmount] = useState<number>(0);
    const [isSaving, setIsSaving] = useState(false);

    // Credit payment states
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [customerFound, setCustomerFound] = useState<boolean | null>(null);
    const [foundCustomer, setFoundCustomer] = useState<any>(null);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [newCustomerName, setNewCustomerName] = useState('');
    const [newCustomerPhone, setNewCustomerPhone] = useState('');

    // Mixed Payment State
    const [mixedCash, setMixedCash] = useState<number>(0);
    const [mixedOnline, setMixedOnline] = useState<number>(0);

    // Debounced Search Effect
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (searchQuery.length >= 2 && !customerFound) {
                setIsSearching(true);
                try {
                    const response = await searchCustomers(searchQuery);
                    setSearchResults(response.data || []);
                } catch (error) {
                    console.error("Search failed", error);
                    setSearchResults([]);
                } finally {
                    setIsSearching(false);
                }
            } else {
                setSearchResults([]);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [searchQuery, customerFound]);

    useEffect(() => {
        if (order) {
            const baseAmount = Number(order.totalAmount ?? order.finalAmount ?? 0);
            setFinalAmount(Number(order.finalAmountAfterDiscount ?? baseAmount));
            setPaymentMethod(order.paymentMethod ?? 'CASH');
            setDiscountType(order.discountType ?? 'PERCENT');
            setDiscountValue(Number(order.discountValue ?? 0));
            if (order.customerPhone) setSearchQuery(order.customerPhone);
        }
    }, [order]);

    // ... useEffect for discount calc ...

    // ... useEffect for mixed payment ...

    const handleMixedChange = (type: 'cash' | 'online', value: string) => {
        // ... handled in original code ...
        const val = parseFloat(value) || 0;
        if (type === 'cash') {
            setMixedCash(val);
            setMixedOnline(Math.max(0, finalAmount - val));
        } else {
            setMixedOnline(val);
            setMixedCash(Math.max(0, finalAmount - val));
        }
    };

    const baseAmount = order ? Number(order.totalAmount ?? order.finalAmount ?? 0) : 0;
    const currentDiscountValue = typeof discountValue === 'number' ? discountValue : 0;
    const discountAmount = discountType === 'PERCENT' ? (baseAmount * currentDiscountValue) / 100 : currentDiscountValue;
    const isCancelled = order?.status === 'cancelled';
    const isServed = order?.status === 'served';
    const isPaid = order?.status === 'paid';
    const canModify = !isCancelled && !isPaid && !isServed;

    // Manual search button fallback
    const handleSearchCustomer = async () => {
        // Debounce handles mostly, this is for immediate trigger
        if (!searchQuery || searchQuery.length < 2) return;
        setIsSearching(true);
        try {
            const response = await searchCustomers(searchQuery);
            setSearchResults(response.data || []);
        } finally {
            setIsSearching(false);
        }
    };

    const handleCreateAccount = async () => {
        if (!newCustomerName || !newCustomerPhone) return toast.error('Name & Phone required');

        // Strict Nepal Phone Validation: 10 digits, starts with 9
        const phoneRegex = /^9\d{9}$/;
        if (!phoneRegex.test(newCustomerPhone)) {
            return toast.error('Invalid Phone Number. Must be 10 digits and start with 9.');
        }

        try {
            const response = await addCustomer(newCustomerName, newCustomerPhone);
            setFoundCustomer(response.data || response);
            setCustomerFound(true);
            setShowCreateForm(false);
            setSearchQuery(''); // clear search to avoid confusion or keep it?
            toast.success('Account created');
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Failed to create account');
        }
    };

    const handleSavePayment = async () => {
        if (!order || isSaving) return;
        if (paymentMethod === 'CREDIT' && !customerFound) return toast.error('Verify customer for credit');

        setIsSaving(true);
        try {
            const val = typeof discountValue === 'number' ? discountValue : 0;
            const payload = {
                orderId: order.id,
                discount: val > 0 ? { type: discountType, value: val } : undefined,
                cashAmount: paymentMethod === 'CASH' || paymentMethod === 'MIXED' ? finalAmount : undefined,
                onlineAmount: paymentMethod === 'ONLINE' || paymentMethod === 'MIXED' ? finalAmount : undefined,
                customerPhone: paymentMethod === 'CREDIT' ? foundCustomer?.phoneNumber : undefined,
            };

            if (paymentMethod === 'CASH') await payCash(payload);
            else if (paymentMethod === 'ONLINE') await payOnline(payload);
            else if (paymentMethod === 'MIXED') {
                if (Math.abs(mixedCash + mixedOnline - finalAmount) > 1) {
                    return toast.error(`Total must equal Rs. ${finalAmount}`);
                }
                await payMixed({ ...payload, cashAmount: mixedCash, onlineAmount: mixedOnline });
            }
            else if (paymentMethod === 'CREDIT') await payCredit(payload);

            toast.success('Payment saved');
            onClose();
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Error saving payment');
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancelOrder = async () => {
        if (!order || !confirm('Are you sure you want to cancel this order?')) return;
        await cancelOrder(order.id);
        onClose();
    };

    const handleUpdateQuantity = async (itemId: string, action: 'increment' | 'decrement') => {
        if (!order) return;
        await updateOrderItem(order.id, itemId, action);
    };



    const handlePrint = async () => {
        if (!order) return;

        // Helper to convert image to base64
        const getBase64FromUrl = async (url: string): Promise<string> => {
            const data = await fetch(url);
            const blob = await data.blob();
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.readAsDataURL(blob);
                reader.onloadend = () => {
                    const base64data = reader.result;
                    resolve(base64data as string);
                };
            });
        };

        let logoDataUrl = '';
        try {
            logoDataUrl = await getBase64FromUrl(logo);
        } catch (e) {
            console.error("Failed to load logo", e);
        }

        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        // Calculate amounts for printing - use saved order data if available (for paid orders)
        const printBaseAmount = Number(order.totalAmount || 0);
        const printDiscountValue = Number(order.discountValue || 0);
        const printDiscountType = order.discountType || 'PERCENT';

        // Calculate discount amount
        const printDiscountAmount = printDiscountType === 'PERCENT'
            ? (printBaseAmount * printDiscountValue) / 100
            : printDiscountValue;

        // Calculate final payable amount
        const printFinalAmount = Math.max(0, printBaseAmount - printDiscountAmount);

        const orderTitle = order.orderNumber || order.id.slice(0, 8);
        const tableLabel = order.table?.tableCode || order.tableNumber;
        const orderDate = new Date(order.createdAt || Date.now()).toLocaleString();

        printWindow.document.write(`
            <html>
            <head>
                <title>Invoice #${orderTitle}</title>
                <style>
                    @page { size: auto; margin: 5mm; }
                    body { 
                        font-family: 'Helvetica', 'Arial', sans-serif; 
                        color: #333;
                        line-height: 1.3;
                        margin: 0;
                        padding: 10px;
                        width: 100%;
                        max-width: 130mm; /* Narrower width */
                        margin: 0 auto; 
                    }
                    .header { 
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        border-bottom: 2px solid #eee;
                        padding-bottom: 10px;
                        margin-bottom: 15px;
                    }
                    .header img { 
                        width: 50%;
                        height: auto; 
                        margin-bottom: 5px;
                        object-fit: contain;
                        display: block;
                    }
                    .header h2 { 
                        margin: 5px 0 0; 
                        font-size: 18px; 
                        font-weight: bold; 
                        color: #1a1a1a;
                        text-transform: uppercase;
                        letter-spacing: 1px;
                        text-align: center;
                    }
                    .header p { 
                        margin: 2px 0 0; 
                        font-size: 13px; 
                        color: #444; 
                        font-weight: 500;
                        text-align: center;
                    }
                    .header h1 { 
                        margin: 0; 
                        font-size: 24px; 
                        color: #1a1a1a;
                        text-transform: uppercase;
                        letter-spacing: 1px;
                    }
                    .header p { 
                        margin: 5px 0 0; 
                        font-size: 14px; 
                        color: #666; 
                    }
          /* ... styles kept same ... */
                    .invoice-info {
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 30px;
                    }
                    .info-block h3 {
                        font-size: 14px;
                        text-transform: uppercase;
                        color: #888;
                        margin: 0 0 10px;
                        border-bottom: 1px solid #eee;
                        padding-bottom: 5px;
                    }
                    .info-block p {
                        margin: 0 0 5px;
                        font-size: 14px;
                    }
                    .info-block p span {
                        font-weight: bold;
                        color: #333;
                    }

                    table { 
                        width: 100%; 
                        border-collapse: collapse; 
                        margin-bottom: 30px; 
                        font-size: 14px;
                    }
                    th { 
                        background-color: #f8f9fa;
                        color: #333;
                        font-weight: bold;
                        text-transform: uppercase;
                        font-size: 12px;
                        padding: 12px 15px;
                        text-align: left;
                        border-bottom: 2px solid #ddd;
                    }
                    td { 
                        padding: 12px 15px;
                        border-bottom: 1px solid #eee;
                    }
                    .text-right { text-align: right; }
                    .text-center { text-align: center; }
                    .nowrap { white-space: nowrap; }
                    
                    .summary-section {
                        display: flex;
                        justify-content: flex-end;
                    }
                    .totals { 
                        width: 300px;
                        background: #f8f9fa;
                        padding: 20px;
                        border-radius: 4px;
                    }
                    .totals p { 
                        display: flex; 
                        justify-content: space-between; 
                        margin: 0 0 10px;
                        font-size: 14px;
                    }
                    .totals .grand-total { 
                        font-weight: bold; 
                        font-size: 18px; 
                        color: #000;
                        margin-top: 15px; 
                        padding-top: 15px;
                        border-top: 2px solid #ddd;
                        margin-bottom: 0;
                    }
                    
                    .footer { 
                        text-align: center; 
                        margin-top: 50px; 
                        padding-top: 20px;
                        border-top: 1px solid #eee;
                        font-size: 12px;
                        color: #888;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    ${logoDataUrl ? `<img src="${logoDataUrl}" alt="RMS Logo" />` : ''}
                    <h2>Aaradhya Restaurant</h2>
                    <p>Mob: 9857042493, 9857045493</p>
                </div>

                <div class="invoice-info">
                    <div class="info-block" style="flex: 1;">
                        <h3>Order Details</h3>
                        <p>Order #: <span>${orderTitle}</span></p>
                        <p>Date: <span>${orderDate}</span></p>
                        <p>Payment: <span>${(order.paymentMethod || paymentMethod || 'CASH')}</span></p>
                    </div>
                    <div class="info-block" style="text-align: right; flex: 1;">
                        <h3>Customer Info</h3>
                        <p>Table: <span>${tableLabel || 'Walk-in'}</span></p>
                        ${order.customerName ? `<p>Customer: <span>${order.customerName}</span></p>` : ''}
                        ${order.customerPhone ? `<p>Phone: <span>${order.customerPhone}</span></p>` : ''}
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th style="width: 5%">#</th>
                            <th style="width: 35%">Item Description</th>
                            <th class="text-center" style="width: 10%">Qty</th>
                            <th class="text-right nowrap" style="width: 25%">Unit Price</th>
                            <th class="text-right nowrap" style="width: 25%">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${order.items.map((i, index) => `
                            <tr>
                                <td>${index + 1}</td>
                                <td>${i.menuItem.name}</td>
                                <td class="text-center">${i.quantity}</td>
                                <td class="text-right nowrap">Rs. ${Number(i.menuItem.price).toFixed(2)}</td>
                                <td class="text-right nowrap">Rs. ${(Number(i.menuItem.price) * i.quantity).toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div class="summary-section">
                    <div class="totals">
                        <p><span>Subtotal:</span> <span>Rs. ${printBaseAmount.toFixed(2)}</span></p>
                        ${printDiscountAmount > 0 ? `<p style="color: #d97706;"><span>Discount (${printDiscountType === 'PERCENT' ? printDiscountValue + '%' : 'Fixed'}):</span> <span>-Rs. ${printDiscountAmount.toFixed(2)}</span></p>` : ''}
                        <p class="grand-total"><span>Total Payable:</span> <span>Rs. ${printFinalAmount.toFixed(2)}</span></p>
                    </div>
                </div>

                <div class="footer">
                    <p>Thank you for dining with us!</p>
                </div>

                <script>
                    window.onload = function() {
                        setTimeout(() => {
                            window.print(); 
                            setTimeout(() => window.close(), 500);
                        }, 500);
                    };
                    setTimeout(() => {
                        window.print(); 
                        setTimeout(() => window.close(), 500);
                    }, 1000);
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    };

    if (!isOpen || !order) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-2 z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b flex items-center justify-between bg-white">
                    <div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-xl font-bold text-gray-900">Order #{order.orderNumber || order.id.slice(0, 8)}</h2>
                            <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase
                                ${order.status === 'served' ? 'bg-green-100 text-green-700' :
                                    order.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                                        'bg-orange-100 text-orange-700'}`}>
                                {order.status}
                            </span>
                        </div>
                        <p className="text-sm text-gray-500 mt-0.5">{order.table?.tableCode || order.tableNumber || 'N/A'} • {order.items.length} Items</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {!isCancelled && !isPaid && (
                            <button
                                onClick={handleCancelOrder}
                                className="px-3 py-1.5 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 flex items-center gap-1 transition-colors"
                            >
                                <XCircle className="w-4 h-4" /> Cancel Order
                            </button>
                        )}
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><X className="w-5 h-5 text-gray-500" /></button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50/50">
                    {/* Items Table */}
                    <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-gray-500 font-medium border-b">
                                <tr>
                                    <th className="px-4 py-3 text-left w-[40%]">Item Details</th>
                                    <th className="px-4 py-3 text-center">Qty</th>
                                    <th className="px-4 py-3 text-right">Price</th>
                                    <th className="px-4 py-3 text-right">Total</th>
                                    {canModify && <th className="px-4 py-3 text-center w-24">Actions</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {order.items.map(item => (
                                    <tr key={item.id} className="group hover:bg-gray-50/50">
                                        <td className="px-4 py-3">
                                            <p className="font-semibold text-gray-900">{item.menuItem.name}</p>
                                            <p className="text-xs text-gray-500">Rs. {Number(item.menuItem.price).toFixed(2)} each</p>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="inline-block px-2 py-1 bg-gray-100 rounded text-xs font-bold text-gray-700">
                                                {item.quantity}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right text-gray-600">{Number(item.menuItem.price).toFixed(2)}</td>
                                        <td className="px-4 py-3 text-right font-bold text-gray-900">{(Number(item.menuItem.price) * item.quantity).toFixed(2)}</td>
                                        {canModify && (
                                            <td className="px-4 py-3 text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    <button
                                                        onClick={() => handleUpdateQuantity(item.menuItemId, 'decrement')}
                                                        className="w-7 h-7 flex items-center justify-center rounded border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                                                    >
                                                        {item.quantity === 1 ? <Trash2 className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
                                                    </button>
                                                    <button
                                                        onClick={() => handleUpdateQuantity(item.menuItemId, 'increment')}
                                                        className="w-7 h-7 flex items-center justify-center rounded border border-green-200 text-green-600 hover:bg-green-50 transition-colors"
                                                    >
                                                        <Plus className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Payment & Summary Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Left: Payment Method */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                                <Receipt className="w-4 h-4 text-orange-600" /> Payment Method
                            </h3>

                            <div className="grid grid-cols-2 gap-3">
                                {(['CASH', 'ONLINE', 'MIXED', 'CREDIT'] as const).map(m => (
                                    <button
                                        key={m}
                                        onClick={() => setPaymentMethod(m)}
                                        className={`py-2.5 px-3 rounded-lg border text-xs font-bold transition-all flex items-center justify-center gap-2
                                            ${paymentMethod === m
                                                ? 'bg-gray-900 border-gray-900 text-white shadow-md'
                                                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                            }`}
                                    >
                                        {m}
                                    </button>
                                ))}
                            </div>

                            {/* Mixed Payment Inputs */}
                            {paymentMethod === 'MIXED' && (
                                <div className="p-4 border rounded-xl bg-orange-50 shadow-sm space-y-3 animate-in fade-in slide-in-from-top-2">
                                    <p className="text-xs text-orange-800 font-medium bg-orange-100 p-2 rounded">
                                        Mixed payment is split and added to Cash and Online daily totals respectively.
                                    </p>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-bold text-gray-700 mb-1 block">Cash Amount</label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs font-bold">Rs.</span>
                                                <input
                                                    type="number"
                                                    value={mixedCash === 0 ? '' : mixedCash}
                                                    onChange={(e) => handleMixedChange('cash', e.target.value)}
                                                    placeholder="0"
                                                    className="w-full pl-8 pr-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-gray-700 mb-1 block">Online Amount</label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs font-bold">Rs.</span>
                                                <input
                                                    type="number"
                                                    value={mixedOnline === 0 ? '' : mixedOnline}
                                                    onChange={(e) => handleMixedChange('online', e.target.value)}
                                                    placeholder="0"
                                                    className="w-full pl-8 pr-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Credit Customer Search */}
                            {paymentMethod === 'CREDIT' && (
                                <div className="p-4 border rounded-xl bg-white shadow-sm space-y-3 relative">
                                    <div className="flex gap-2">
                                        <div className="flex-1 relative">
                                            <input
                                                type="text"
                                                value={searchQuery}
                                                onChange={(e) => {
                                                    setSearchQuery(e.target.value);
                                                    setCustomerFound(null); // Reset found state on type
                                                    setFoundCustomer(null);
                                                }}
                                                placeholder="Search Name or Phone "
                                                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                                            />
                                            {/* Search Results Dropdown - Only show if there are actual results */}
                                            {searchQuery.length >= 2 && !customerFound && searchResults.length > 0 && (
                                                <div className="absolute top-full left-0 right-0 z-10 bg-white border rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                                                    {searchResults.map((customer: any) => (
                                                        <div
                                                            key={customer.id}
                                                            onClick={() => {
                                                                setFoundCustomer(customer);
                                                                setCustomerFound(true);
                                                                setSearchQuery('');
                                                            }}
                                                            className="p-2 hover:bg-orange-50 cursor-pointer border-b last:border-0"
                                                        >
                                                            <p className="text-sm font-bold text-gray-800">{customer.fullName || customer.name}</p>
                                                            <p className="text-xs text-gray-500">{customer.phoneNumber || customer.phone}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <button onClick={handleSearchCustomer} disabled={isSearching} className="bg-gray-900 text-white px-3 rounded-lg hover:bg-gray-800 transition-colors">
                                            <Search className="w-4 h-4" />
                                        </button>
                                    </div>

                                    {/* Selected Customer Display */}
                                    {customerFound === true && foundCustomer && (
                                        <div className="flex items-center justify-between text-sm font-medium text-green-700 bg-green-50 p-2 rounded-lg border border-green-100">
                                            <div className="flex items-center gap-2">
                                                <CheckCircle className="w-4 h-4" />
                                                <span>{foundCustomer.fullName || foundCustomer.name}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-green-600 bg-white px-2 py-0.5 rounded border border-green-200">
                                                    {foundCustomer.phoneNumber || foundCustomer.phone}
                                                </span>
                                                <button onClick={() => { setCustomerFound(false); setFoundCustomer(null); }} className="p-1 hover:bg-green-200 rounded text-green-800">
                                                    <XCircle className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Create New Customer Option - Show only if search has no results or explicitly requested */}
                                    {(!customerFound && searchQuery.length > 0 && searchResults.length === 0 && !isSearching) && !showCreateForm && (
                                        <div className="text-center pt-2">
                                            <p className="text-xs text-red-500 mb-1">Customer not found?</p>
                                            <button onClick={() => {
                                                // Smart pre-fill: if search looks like phone (digits only), fill phone; otherwise fill name
                                                const isPhone = /^\d+$/.test(searchQuery.trim());
                                                if (isPhone) {
                                                    setNewCustomerPhone(searchQuery.trim());
                                                    setNewCustomerName('');
                                                } else {
                                                    setNewCustomerName(searchQuery.trim());
                                                    setNewCustomerPhone('');
                                                }
                                                setShowCreateForm(true);
                                            }} className="text-xs text-blue-600 font-bold hover:underline flex items-center justify-center gap-1 w-full">
                                                <UserPlus className="w-3 h-3" /> Add New Customer
                                            </button>
                                        </div>
                                    )}

                                    {showCreateForm && (
                                        <div className="space-y-3 animate-in fade-in slide-in-from-top-2 p-3 bg-gray-50 rounded-lg border">
                                            <div className="flex justify-between items-center">
                                                <h4 className="text-xs font-bold text-gray-700">New Customer</h4>
                                                <button onClick={() => setShowCreateForm(false)}><X className="w-3 h-3 text-gray-400" /></button>
                                            </div>
                                            <input
                                                type="text"
                                                value={newCustomerName}
                                                onChange={(e) => setNewCustomerName(e.target.value)}
                                                placeholder="Full Name"
                                                className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:border-blue-500"
                                            />
                                            <div className="relative">
                                                <input
                                                    type="tel"
                                                    value={newCustomerPhone}
                                                    onChange={(e) => {
                                                        const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                                                        setNewCustomerPhone(val);
                                                    }}
                                                    placeholder="Mobile Number (10 digits)"
                                                    className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:border-blue-500"
                                                />
                                                {newCustomerPhone.length === 10 && (
                                                    <CheckCircle className="absolute right-3 top-2.5 w-4 h-4 text-green-500" />
                                                )}
                                            </div>
                                            <button
                                                onClick={handleCreateAccount}
                                                disabled={newCustomerPhone.length !== 10 || !newCustomerName}
                                                className="w-full bg-blue-600 text-white px-3 py-2 rounded-lg text-xs font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                Create Account
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Discount Input */}
                            {paymentMethod !== 'CREDIT' && (
                                <div className="p-4 border rounded-xl bg-white shadow-sm space-y-3">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold text-gray-700">Apply Discount</label>
                                        <div className="flex border rounded-lg overflow-hidden p-0.5 bg-gray-100">
                                            <button onClick={() => setDiscountType('PERCENT')} className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all ${discountType === 'PERCENT' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>%</button>
                                            <button onClick={() => setDiscountType('FIXED')} className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all ${discountType === 'FIXED' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>Rs</button>
                                        </div>
                                    </div>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={discountValue === 0 ? '' : discountValue}
                                            onChange={e => setDiscountValue(e.target.value === '' ? '' : Number(e.target.value))}
                                            placeholder="Enter discount value"
                                            className="w-full pl-3 pr-16 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-gray-200"
                                        />
                                        {discountAmount > 0 && (
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-green-600">
                                                -Rs. {discountAmount.toFixed(2)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Right: Bill Summary */}
                        <div className="flex flex-col gap-4">
                            <div className="bg-orange-50/50 p-5 rounded-xl border border-orange-100 flex flex-col justify-between h-full">
                                <h3 className="text-sm font-bold text-orange-800 mb-4 flex items-center gap-2">
                                    Bill Summary
                                </h3>
                                <div className="space-y-3">
                                    <div className="flex justify-between text-sm text-gray-600">
                                        <span>Subtotal</span>
                                        <span className="font-medium">Rs. {baseAmount.toFixed(2)}</span>
                                    </div>
                                    {paymentMethod !== 'CREDIT' && (
                                        <div className="flex justify-between text-sm text-green-600">
                                            <span>Discount</span>
                                            <span className="font-medium">- Rs. {discountAmount.toFixed(2)}</span>
                                        </div>
                                    )}
                                    <div className="pt-3 border-t border-orange-200 flex justify-between items-center mt-2">
                                        <span className="text-sm font-bold text-orange-900">TOTAL PAYABLE</span>
                                        <span className="text-2xl font-black text-gray-900">Rs. {finalAmount.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={handleSavePayment}
                                disabled={isSaving || (paymentMethod === 'CREDIT' && !customerFound) || order.status === 'paid'}
                                className="w-full bg-green-600 text-white py-3.5 rounded-xl font-bold text-sm uppercase hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all flex items-center justify-center gap-2"
                            >
                                {isSaving ? 'Processing...' : order.status === 'paid' ? 'Order Paid' : 'Receive Payment >'}
                            </button>

                            <button
                                onClick={handlePrint}
                                className="w-full bg-white border border-gray-200 text-gray-700 py-3 rounded-xl font-bold text-sm uppercase hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center justify-center gap-2"
                            >
                                <Printer className="w-4 h-4" /> Print Receipt
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ViewOrderDetailsModal;
