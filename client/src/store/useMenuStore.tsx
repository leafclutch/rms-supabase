import { create } from "zustand";
import type { MenuItem } from "../types/menu";
import {
  fetchMenuItems,
  addMenuItem,
  updateMenuItem as updateMenuItemApi,
  deleteMenuItem as deleteMenuItemApi,
  updateMenuItemAvailability as toggleAvailabilityApi,
  toggleSpecial as toggleSpecialApi,
  addCategory as addCategoryApi,
  updateCategory as updateCategoryApi,
  deleteCategory as deleteCategoryApi,
} from "../api/menu";
import toast from "react-hot-toast";

interface MenuStore {
  categories: any[]; // original category structure from backend
  items: MenuItem[]; // flattened items for search/filter
  selectedCategory: string;
  searchQuery: string;

  setSelectedCategory: (category: string) => void;
  setSearchQuery: (query: string) => void;

  fetchAll: () => Promise<void>;
  addItem: (data: any) => Promise<void>;
  updateMenuItem: (id: string, data: any) => Promise<void>;
  deleteMenuItem: (id: string) => Promise<void>;
  toggleAvailability: (id: string, isAvailable: boolean) => Promise<void>;
  toggleSpecial: (id: string, isSpecial: boolean) => Promise<void>;

  addCategory: (name: string) => Promise<void>;
  updateCategory: (id: string, name: string) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;

  getFilteredItems: () => MenuItem[];
}

export const useMenuStore = create<MenuStore>((set, get) => ({
  categories: [],
  items: [],
  selectedCategory: "All",
  searchQuery: "",

  setSelectedCategory: (category) => set({ selectedCategory: category }),
  setSearchQuery: (query) => set({ searchQuery: query }),

  fetchAll: async () => {
    const categoriesFromApi = await fetchMenuItems(); // array of categories with nested items

    // Flatten items for search/filter
    const flatItems: MenuItem[] = categoriesFromApi.flatMap(category =>
      (category.items || []).map((item: MenuItem) => ({
        ...item,
        category: category.categoryName, // add category name to item
      }))
    );

    set({
      categories: categoriesFromApi,
      items: flatItems,
    });
  },

  addCategory: async (name: string) => {
    try {
      await addCategoryApi(name);
      await get().fetchAll();
      toast.success("Category added successfully!");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to add category");
    }
  },

  updateCategory: async (id: string, name: string) => {
    try {
      await updateCategoryApi(id, name);
      await get().fetchAll();
      toast.success("Category updated successfully!");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to update category");
    }
  },

  deleteCategory: async (id: string) => {
    try {
      await deleteCategoryApi(id);
      await get().fetchAll();
      toast.success("Category deleted successfully!");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to delete category");
    }
  },

  getFilteredItems: () => {
    const { items, selectedCategory, searchQuery } = get();
    return items.filter(item => {
      const matchCategory =
        selectedCategory === "All" ||
        (selectedCategory === "Veg" && item.isVeg) ||
        (selectedCategory === "Non-Veg" && !item.isVeg) ||
        (selectedCategory === "Special" && item.isSpecial) ||
        item.category === selectedCategory;

      const matchSearch = (item.name || "").toLowerCase().includes(searchQuery.toLowerCase());

      return matchCategory && matchSearch;
    });
  },

  addItem: async (data: any) => {
    const result = await addMenuItem(data);
    const newItem = result.menuItem;
    // Add category property if needed
    const itemWithCategory = { ...newItem, category: newItem.category?.name || "Uncategorized" };
    set({ items: [...get().items, itemWithCategory] });
    toast.success("Menu item added successfully!");
  },

  updateMenuItem: async (id: string, data: any) => {
    try {
      const result = await updateMenuItemApi(id, data);
      const savedItem = result.menuItem;
      set({
        items: get().items.map(i =>
          i.id === savedItem.id ? { ...savedItem, category: savedItem.category?.name || "Uncategorized" } : i
        ),
      });
      toast.success("Menu item updated successfully!");
    } catch (error) {
      console.error(error);
      toast.error("Failed to update menu item");
    }
  },

  deleteMenuItem: async (id: string) => {
    await deleteMenuItemApi(id);
    set({ items: get().items.filter(i => i.id !== id) });
    toast.success("Menu item deleted successfully!");
  },

  // Add/update availability by fetching from the API and updating store
  toggleAvailability: async (id: string) => {
    const item = get().items.find(i => i.id === id);
    if (!item) return;
    try {
      const updated = await toggleAvailabilityApi(id, !item.isAvailable);
      set({
        items: get().items.map(i =>
          i.id === id ? { ...i, isAvailable: updated.menuItem?.isAvailable ?? updated.isAvailable } : i
        ),
      });
      toast.success(
        `Marked as ${updated.menuItem?.isAvailable ?? updated.isAvailable ? "available" : "unavailable"}`
      );
    } catch (error) {
      console.error(error);
      toast.error("Failed to update availability");
    }
  },

  toggleSpecial: async (id: string) => {
    const item = get().items.find(i => i.id === id);
    if (!item) return;
    try {
      const updated = await toggleSpecialApi(id, !item.isSpecial);
      set({
        items: get().items.map(i => (i.id === id ? { ...i, isSpecial: updated.menuItem?.isSpecial ?? updated.isSpecial } : i)),
      });
      toast.success(
        updated.menuItem?.isSpecial ?? updated.isSpecial
          ? `${item.name} Marked as Special`
          : `${item.name} Unmarked as Special`
      );
    } catch (error) {
      console.error(error);
      toast.error("Failed to update special status");
    }
  },
}));
