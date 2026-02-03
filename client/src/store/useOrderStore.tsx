import { create } from 'zustand';
import { createOrder, getOrders, preparingOrder, serveOrder, getOrderHistory } from '../api/orders';
import api from '../api/axios';
import { supabase } from '../api/supabaseClient';
import toast from 'react-hot-toast';
import { Bell, ClipboardCheck, XCircle } from 'lucide-react';
import type { Order, OrderStatus } from '../types/order';

interface OrderStore {
    orders: Order[];
    historyOrders: Order[]; // Added historyOrders to keep them separate
    currentOrder: Order | null;
    selectedStatus: string;
    searchQuery: string;
    isLoading: boolean;
    error: string | null;
    isHistoryMode: boolean;
    historyCreditTransactions: any[];
    historyDebtSettlements: any[];

    fetchOrders: () => Promise<void>;
    fetchHistory: () => Promise<void>;
    updateOrderStatus: (orderId: string, newStatus: OrderStatus) => Promise<void>;
    cancelOrder: (orderId: string) => Promise<void>;
    updateOrderItem: (orderId: string, menuItemId: string, action: 'increment' | 'decrement') => Promise<void>;
    setCurrentOrder: (order: Order | null) => void;
    setSelectedStatus: (status: string) => void;
    setSearchQuery: (query: string) => void;
    getFilteredOrders: () => Order[];
    getOrderById: (id: string) => Order | null;
    addOrder: (order: any) => Promise<void>;
    updateOrder: (orderId: string, updates: Partial<Order>) => void;
    initializeRealtime: () => () => void;
    setIsHistoryMode: (isHistory: boolean) => void;
}

export const useOrderStore = create<OrderStore>((set, get) => ({
    orders: [],
    historyOrders: [],
    currentOrder: null,
    selectedStatus: 'all',
    searchQuery: '',
    isLoading: false,
    error: null,
    isHistoryMode: false,
    historyCreditTransactions: [],
    historyDebtSettlements: [],

    fetchOrders: async () => {
        set({ isLoading: true, error: null });
        try {
            const data = await getOrders();

            const ordersWithDefaults = (data.orders || data || []).map((order: any) => ({
                ...order,
                id: order.id || order._id || `order-${Date.now()}-${Math.random()}`,
                status: order.status || 'pending',
                items: order.items || [],
                totalAmount: Number(order.totalAmount || order.finalAmount || 0),
                tableNumber: order.table?.tableCode || order.tableNumber || (order.tableCode ? order.tableCode : undefined)
            }));

            set({ orders: ordersWithDefaults, isLoading: false });
        } catch (error) {
            console.error('Error fetching orders:', error);
            set({
                error: error instanceof Error ? error.message : 'Failed to fetch orders',
                isLoading: false,
                orders: []
            });
        }
    },

    fetchHistory: async () => {
        set({ isLoading: true, error: null });
        try {
            const data = await getOrderHistory();
            const historyWithDefaults = (data.orders || data || []).map((order: any) => ({
                ...order,
                id: order.id || order._id || `order-history-${Date.now()}`,
                status: 'paid',
                items: order.items || [],
                totalAmount: Number(order.totalAmount || order.finalAmount || 0),
                tableNumber: order.table?.tableCode || order.tableNumber || (order.tableCode ? order.tableCode : undefined)
            }));
            set({
                historyOrders: historyWithDefaults,
                historyCreditTransactions: data.creditTransactions || [],
                historyDebtSettlements: data.debtSettlements || [],
                isLoading: false
            });
        } catch (error) {
            console.error('Error fetching history:', error);
            set({ error: 'Failed to fetch order history', isLoading: false, historyOrders: [] });
        }
    },

    setIsHistoryMode: (isHistory: boolean) => {
        set({ isHistoryMode: isHistory, selectedStatus: 'all' });
        if (isHistory) {
            get().fetchHistory();
        } else {
            get().fetchOrders();
        }
    },

    addOrder: async (order: any) => {
        const payload = {
            customerType: "WALK_IN" as const,
            customerName: order.customerName,
            customerPhone: order.mobileNumber,
            items: order.items.map((item: any) => ({
                menuItemId: item?.id,
                quantity: item.quantity ?? 1,
            })),
        };

        try {
            const response = await createOrder(payload);
            const newOrder = response.order || response;

            // Map the new order to match the store's expected format
            const mappedOrder = {
                ...newOrder,
                tableNumber: newOrder.table?.tableCode || newOrder.tableNumber || "WALK_IN"
            };

            set((state) => ({
                orders: [mappedOrder, ...state.orders]
            }));
        } catch (error: any) {
            toast.error(error?.message || "Failed to place order.");
            throw error;
        }
    },

    initializeRealtime: () => {
        const { fetchOrders, fetchHistory } = get();

        const channel = supabase
            .channel('orders-realtime')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'orders' },
                async (payload: any) => {
                    if (!get().isHistoryMode) fetchOrders();

                    const tableId = payload.new.tableId || payload.new.table_id || payload.new.tableid;
                    if (!tableId) return;

                    // We need to fetch table code for the notification since payload only has tableId
                    const { data: tableData, error: tableError } = await supabase
                        .from('tables')
                        .select('tableCode')
                        .eq('id', tableId)
                        .maybeSingle();

                    if (tableError) console.error('Error fetching table record:', tableError);

                    toast.success(`New order received for ${tableData?.tableCode || 'Table'}!`, {
                        icon: <Bell className="w-5 h-5 text-orange-500" />,
                        duration: 5000
                    });
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'orders' },
                async (payload: any) => {

                    const oldStatus = payload.old?.status;
                    const newStatus = payload.new?.status;

                    if (newStatus === 'paid' && oldStatus !== 'paid') {
                        // Order paid event
                        fetchOrders();
                        fetchHistory();
                        return;
                    }

                    if (get().isHistoryMode) fetchHistory();
                    else fetchOrders();
                }
            )
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'order_items' },
                async (payload: any) => {
                    // Refresh orders to show the new item in the list/modal
                    if (!get().isHistoryMode) fetchOrders();

                    const menuItemId = payload.new.menuItemId || payload.new.menu_item_id || payload.new.menuitemid;
                    const orderId = payload.new.orderId || payload.new.order_id || payload.new.orderid;

                    if (!menuItemId || !orderId) return;

                    // Fetch item and order details (including order createdAt to detect if it's a new order)
                    const [itemRes, orderRes] = await Promise.all([
                        supabase.from('menu_items').select('name').eq('id', menuItemId).maybeSingle(),
                        supabase.from('orders').select('tableId, createdAt').eq('id', orderId).maybeSingle()
                    ]);

                    if (itemRes.error) console.error('Error fetching menu item:', itemRes.error);
                    if (orderRes.error) console.error('Error fetching order:', orderRes.error);

                    const itemData = itemRes.data;
                    const orderData = orderRes.data;

                    if (!orderData) return;

                    // --- LOGIC: Prevent double notification for new orders --- 
                    // If the item was created within 5 seconds of the order itself, 
                    // we assume it's part of the initial "New Order" and skip this toast.
                    const orderCreatedTime = new Date(orderData.createdAt).getTime();
                    const itemCreatedTime = new Date(payload.new.createdAt || payload.new.created_at || Date.now()).getTime();

                    if (Math.abs(itemCreatedTime - orderCreatedTime) < 5000) {
                        return;
                    }

                    let tableCode = 'Table';
                    const tableId = orderData.tableId;

                    if (tableId) {
                        const { data: tableData, error: tableFetchError } = await supabase
                            .from('tables')
                            .select('tableCode')
                            .eq('id', tableId)
                            .maybeSingle();

                        if (tableFetchError) console.error('Error fetching table data:', tableFetchError);
                        tableCode = tableData?.tableCode || 'Table';
                    }

                    toast.success(`${itemData?.name || 'Item'} is added on ${tableCode}`, {
                        icon: <Bell className="w-5 h-5 text-blue-500" />,
                        duration: 4000
                    });
                }
            )
            .subscribe((_status, err) => {
                if (err) console.error('Supabase subscription error:', err);
            });

        return () => {
            supabase.removeChannel(channel);
        };
    },

    updateOrderStatus: async (orderId: string, newStatus: OrderStatus) => {
        try {
            if (newStatus === 'preparing') {
                await preparingOrder(orderId);
            } else if (newStatus === 'served') {
                await serveOrder(orderId);
            } else {
                const response = await api.patch(`/admin/orders/${orderId}`, { status: newStatus });
                if (response.status !== 200) throw new Error('Failed to update order status');
            }

            set((state) => ({
                orders: state.orders.map((order) =>
                    order.id === orderId ? { ...order, status: newStatus } : order
                ),
            }));

            toast.success(`Order marked as ${newStatus}`, {
                icon: <ClipboardCheck className="w-5 h-5 text-green-500" />
            });
        } catch (error) {
            console.error('Error updating order status:', error);
            const msg = error instanceof Error ? error.message : 'Failed to update order';
            set({ error: msg });
            toast.error(msg, {
                icon: <XCircle className="w-5 h-5 text-red-500" />
            });
        }
    },

    cancelOrder: async (orderId: string) => {
        try {
            await api.patch(`/orders/${orderId}/cancel`);
            set(state => ({
                orders: state.orders.map(o => o.id === orderId ? { ...o, status: 'cancelled' } : o)
            }));
            toast.success('Order cancelled successfully');
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Failed to cancel order');
        }
    },

    updateOrderItem: async (orderId: string, menuItemId: string, action: 'increment' | 'decrement') => {
        try {
            const response = await api.patch(`/orders/${orderId}/items/${menuItemId}`, { action });

            // Check if response contains the updated order and update local state
            if (response.data && response.data.order) {
                const updatedOrder = response.data.order;

                set((state) => ({
                    orders: state.orders.map((order) =>
                        order.id === orderId ? { ...order, ...updatedOrder } : order
                    ),
                    // Also update currentOrder if it's the same one being viewed
                    currentOrder: state.currentOrder?.id === orderId
                        ? { ...state.currentOrder, ...updatedOrder }
                        : state.currentOrder
                }));
            } else {
                // Fallback if no order returned
                get().fetchOrders();
            }

        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Failed to update item quantity');
        }
    },

    setCurrentOrder: (order: Order | null) => {
        set({ currentOrder: order });
    },

    setSelectedStatus: (status: string) => {
        set({ selectedStatus: status });
    },

    setSearchQuery: (query: string) => {
        set({ searchQuery: query });
    },

    getFilteredOrders: () => {
        const { orders, historyOrders, selectedStatus, searchQuery, isHistoryMode } = get();

        // Separate History (Paid) from Active Management
        let baseOrders = isHistoryMode ? historyOrders : orders;

        let filtered = baseOrders;

        // Filter by status tabs
        if (selectedStatus !== 'all' && !isHistoryMode) {
            filtered = filtered.filter((order) => order.status === selectedStatus);
        }

        // Filter by search query
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();
            filtered = filtered.filter((order) => {
                const tableCode = (order.table?.tableCode || order.tableNumber || "").toLowerCase();
                const customerName = (order.customerName || "").toLowerCase();
                const customerPhone = (order.customerPhone || "").toLowerCase();
                const orderNumber = (order.orderNumber || "").toLowerCase();

                return (
                    tableCode.includes(query) ||
                    customerName.includes(query) ||
                    customerPhone.includes(query) ||
                    orderNumber.includes(query)
                );
            });
        }

        return filtered;
    },

    getOrderById: (id: string) => {
        const { orders } = get();
        return orders.find((o) => o.id === id || o.orderNumber === id) || null;
    },

    updateOrder: (orderId: string, updates: Partial<Order>) => {
        set((state) => ({
            orders: state.orders.map((order) =>
                order.id === orderId ? { ...order, ...updates } : order
            ),
        }));
    }
}));