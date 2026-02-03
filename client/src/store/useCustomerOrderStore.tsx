

import { create } from "zustand";
import { toast } from "react-hot-toast";
import type { MenuItem } from "../types/menu";
import { createOrder } from "../api/orders";

export interface CustomerOrder {
  orderId: string;
  orderNumber: string;
  items: { menuItemId: string; quantity: number }[];
  totalAmount: number;
  finalAmount?: number;
  status: "pending" | "preparing" | "served" | "paid" | "cancelled";
  createdAt: string;
  tableCode?: string;
  customerType: "DINE_IN" | "WALK_IN" | "ONLINE";
  customerName?: string;
  mobileNumber?: string;
}

interface CustomerOrderStore {
  recentOrder: CustomerOrder | null;
  orders: CustomerOrder[];

  createOrder: (payload: {
    items: (MenuItem & { quantity: number })[];
    tableCode?: string;
    customerType: "DINE_IN" | "WALK_IN" | "ONLINE";
    customerName?: string;
    mobileNumber?: string;
  }) => Promise<CustomerOrder | null>;

  getOrderById: (id: string) => CustomerOrder | null;
  updateOrderStatus: (id: string, status: "pending" | "preparing" | "served" | "paid" | "cancelled") => Promise<void>;
  fetchOrders: () => Promise<void>;
}

export const useCustomerOrderStore = create<CustomerOrderStore>((set, get) => ({
  recentOrder: null,
  orders: [],

  createOrder: async ({ items, tableCode, customerType, customerName, mobileNumber }) => {
    try {
      if (!items || items.length === 0) {
        throw new Error("Cannot create order with empty cart");
      }

      const mappedItems = items.map(item => ({
        menuItemId: item.id,
        quantity: item.quantity
      }));

      const response = await createOrder({
        items: mappedItems,
        tableCode,
        customerType,
        customerName,
        mobileNumber
      });

      // Handle both wrapped { order: ... } and direct order responses
      const newOrder = response?.order || response;

      if (!newOrder || !newOrder.orderId) {
        throw new Error("Order creation failed - invalid response from server");
      }

      set({
        recentOrder: newOrder,
        orders: [...get().orders, newOrder]
      });

      toast.success(response?.message || "Order placed successfully!");
      return newOrder;
    } catch (error: any) {

      const errorMessage = error?.response?.data?.message ||
        error?.message ||
        "Failed to create order";
      toast.error(errorMessage);
      return null;
    }
  },

  getOrderById: (id: string) => {
    const { orders } = get();
    return orders.find((o) => o.orderId === id || o.orderNumber === id) || null;
  },

  updateOrderStatus: async (id, status) => {
    try {
      await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      set((state) => ({
        orders: state.orders.map((o) =>
          o.orderId === id ? { ...o, status } : o
        ),
        recentOrder:
          state.recentOrder && state.recentOrder.orderId === id
            ? { ...state.recentOrder, status }
            : state.recentOrder,
      }));

      toast.success("Order status updated!");
    } catch (error: any) {

      toast.error("Failed to update order");
    }
  },

  fetchOrders: async () => {
    try {
      const res = await fetch("/api/orders");
      if (!res.ok) throw new Error("Failed to fetch orders");
      const data: CustomerOrder[] = await res.json();
      set({ orders: data });
    } catch (error: any) {
      console.error(error);
      toast.error("Failed to fetch orders");
    }
  },
}));
