import { create } from 'zustand';
import type { CreditTransaction, Customer } from '../types/Customer';
import toast from 'react-hot-toast';
import { addCustomer, fetchCustomers, getCustomerDetails, settleDebt } from '../api/credit';

interface CreditStore {
  customers: Customer[];
  isLoading: boolean;
  error: string | null;

  fetchCustomers: () => Promise<void>;
  fetchCustomerDetails: (id: string) => Promise<void>;
  addCustomer: (customer: Omit<Customer, 'id' | 'createdAt' | 'creditHistory' | 'totalCredit'>) => Promise<Customer>;
  updateCustomer: (id: string, updates: Partial<Customer>) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;
  getCustomerById: (id: string) => Customer | undefined;
  searchCustomers: (query: string) => Customer[];

  addCreditTransaction: (
    customerId: string,
    transaction: Omit<CreditTransaction, 'id' | 'timestamp' | 'balance'>
  ) => Promise<CreditTransaction>;

  settleDebt: (customerId: string, amount: number, notes?: string) => Promise<void>;
  getCreditHistory: (customerId: string) => CreditTransaction[];
  getTotalOutstanding: () => number;
  clearError: () => void;
}

export const useCreditStore = create<CreditStore>((set, get) => ({
  customers: [],
  isLoading: false,
  error: null,

  fetchCustomers: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetchCustomers();
      const customers = response.data.map((c: any) => ({
        id: c.id,
        name: c.fullName || c.name,
        phone: c.phoneNumber || c.phone,
        email: c.email,
        totalCredit: Number(c.totalDue || c.totalCredit || 0),
        creditHistory: [],
        createdAt: c.createdAt ? new Date(c.createdAt) : new Date(),
        updatedAt: c.ledger && c.ledger.length > 0 ? new Date(c.ledger[0].createdAt) : (c.updatedAt ? new Date(c.updatedAt) : new Date(c.createdAt)),
        ledgerCount: c._count?.ledger || 0
      }));
      set({ customers, isLoading: false });
    } catch (error) {
      console.error(error);
      set({ error: 'Failed to fetch customers', isLoading: false });
    }
  },

  fetchCustomerDetails: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await getCustomerDetails(id);
      const data = response.data;

      // Map transactions and calculate balances
      // Backend returns ledger ordered by desc (newest first)
      let currentBalance = Number(data.totalDue);

      const creditHistory: CreditTransaction[] = (data.ledger || []).map((txn: any) => {
        const type = txn.type === 'PAYMENT' ? 'payment' : 'debt';
        const amount = Number(txn.amount);

        // The balance after this transaction was applied
        const balanceSnapshot = currentBalance;

        // Calculate balance *before* this transaction for the *next* iteration (which is the previous transaction in time)
        if (type === 'debt') {
          currentBalance -= amount;
        } else {
          currentBalance += amount;
        }

        return {
          id: txn.id,
          customerId: txn.customerId,
          orderId: txn.orderId,
          type,
          amount,
          balance: balanceSnapshot,
          notes: txn.description,
          timestamp: new Date(txn.createdAt),
          order: txn.order ? {
            id: txn.order.id,
            items: (txn.order.items || []).map((item: any) => ({
              id: item.id,
              quantity: item.quantity,
              menuItem: {
                name: item.menuItem?.name || 'Unknown Item',
                price: Number(item.menuItem?.price || 0)
              }
            }))
          } : undefined
        };
      });

      // Update the specific customer in the store
      set(state => ({
        customers: state.customers.map(c =>
          c.id === id ? {
            ...c,
            totalCredit: Number(data.totalDue),
            creditHistory: creditHistory // Newest first
          } : c
        ),
        isLoading: false
      }));

    } catch (error: any) {

      toast.error('Failed to load customer details');
      set({ isLoading: false });
    }
  },

  addCustomer: async (customerData) => {
    const { name, phone } = customerData;

    try {
      if (!phone || phone.length < 10) {
        throw new Error('Invalid phone number');
      }

      const exists = get().customers.find(c => c.phone === phone);
      if (exists) throw new Error('Customer already exists');

      // Call backend API - backend expects fullName and phoneNumber
      const response = await addCustomer(name, phone);
      const apiCustomer = response.data;

      const newCustomer: Customer = {
        ...apiCustomer,
        name: apiCustomer.fullName, // Ensure mapping
        phone: apiCustomer.phoneNumber,
        totalCredit: apiCustomer.totalCredit ?? 0,
        creditHistory: [],
        createdAt: apiCustomer.createdAt ? new Date(apiCustomer.createdAt) : new Date(),
        id: apiCustomer.id,
      };

      set(state => ({
        customers: [...state.customers, newCustomer],
        error: null
      }));

      return newCustomer;
    } catch (error: any) {
      const message = error?.message || 'Failed to add customer';
      set(state => ({
        ...state,
        error: message
      }));
      toast.error(message);
      throw error;
    }
  },

  updateCustomer: async (id, updates) => {
    // Ideally call API here too, but for now just updating local state to resolve type error and prepare for future
    set(state => ({
      customers: state.customers.map(c =>
        c.id === id ? { ...c, ...updates } : c
      )
    }));
  },

  deleteCustomer: async (id) => {
    try {
      // Call API to delete
      await import('../api/credit').then(api => api.deleteCustomer(id));

      // Update local state
      set(state => ({
        customers: state.customers.filter(c => c.id !== id)
      }));
      toast.success('Customer deleted successfully');
    } catch (error: any) {

      // Extract error message from backend
      const message = error.response?.data?.message || error.message || 'Failed to delete customer';
      toast.error(message);
      throw error;
    }
  },

  getCustomerById: (id) =>
    get().customers.find(c => c.id === id),

  searchCustomers: (query) =>
    get().customers.filter(c =>
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      c.phone.includes(query)
    ),

  addCreditTransaction: async (customerId, transactionData) => {
    const customer = get().customers.find(c => c.id === customerId);
    if (!customer) throw new Error('Customer not found');

    try {
      // Call backend API to persist the debt
      const response = await import('../api/credit').then(api =>
        api.addDebt(customerId, transactionData.amount, transactionData.notes)
      );

      const newBalance = Number(response.data.updatedCustomer.totalDue);
      const txn = response.data.transaction;

      const transaction: CreditTransaction = {
        id: txn.id,
        customerId: txn.customerId,
        orderId: txn.orderId,
        type: 'debt',
        amount: Number(txn.amount),
        balance: newBalance,
        notes: txn.description,
        timestamp: new Date(txn.createdAt)
      };

      set(state => ({
        customers: state.customers.map(c =>
          c.id === customerId
            ? {
              ...c,
              totalCredit: newBalance,
              creditHistory: [transaction, ...c.creditHistory]
            }
            : c
        )
      }));

      return transaction;
    } catch (error: any) {

      toast.error('Failed to record debt');
      throw error;
    }
  },

  settleDebt: async (customerId, amount, notes) => {
    try {
      await settleDebt(customerId, amount, notes);
      // Refresh customer details to get the transaction and updated balance
      await get().fetchCustomerDetails(customerId);
      // Also update list if needed or simple local update? 
      // fetchCustomerDetails updates the customer in the list, so we are good.
      toast.success('Debt settled successfully');
    } catch (error: any) {

      toast.error(error.message || 'Failed to settle debt');
      throw error;
    }
  },

  getCreditHistory: (customerId) =>
    get().customers.find(c => c.id === customerId)?.creditHistory || [],

  getTotalOutstanding: () =>
    get().customers.reduce((sum, c) => sum + c.totalCredit, 0),

  clearError: () => set({ error: null })
}));
