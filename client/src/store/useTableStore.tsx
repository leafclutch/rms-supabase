import { create } from 'zustand';
import { getAllTablesApi } from '../api/admin';

interface Table {
    id: string;
    tableCode: string;
    tableType: 'PHYSICAL' | 'CABIN' | 'OUTSIDE' | 'WALK_IN' | 'ONLINE';
}

interface TableState {
    tables: Table[];
    isLoading: boolean;
    error: string | null;
    fetchTables: () => Promise<void>;
}

export const useTableStore = create<TableState>((set) => ({
    tables: [],
    isLoading: false,
    error: null,
    fetchTables: async () => {
        set({ isLoading: true, error: null });
        try {
            const response = await getAllTablesApi();
            const groupedTables = response.tables;
            const allTables = Object.values(groupedTables).flat() as Table[];
            set({ tables: allTables, isLoading: false });
        } catch (error) {
            console.error(error);
            set({ error: 'Failed to fetch tables', isLoading: false });
        }
    },
}));
