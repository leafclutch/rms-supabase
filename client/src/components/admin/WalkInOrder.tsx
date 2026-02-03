
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search,
  ShoppingCart,
  MoveLeft,
  Trash2,
  User,
  Check,
  X,
  SquarePen,
} from 'lucide-react';
import { useMenuStore } from '../../store/useMenuStore';
import type { MenuItem } from '../../types/menu';
import { useCartStore } from '../../store/useCartStore';
import { useOrderStore } from '../../store/useOrderStore';
import { useCreditStore } from '../../store/useCreditStore';
import { CheckCircle } from 'lucide-react';
import type { Customer } from '../../types/Customer';

// Types for product.image
type ProductImage =
  | string
  | {
    url: string;
    alt?: string;
  }
  | undefined
  | null;

export const WalkInOrder: React.FC = () => {
  const navigate = useNavigate();

  // Zustand stores
  const {
    items: menuItems,
    categories,
    selectedCategory,
    searchQuery,
    setSelectedCategory,
    setSearchQuery,
    fetchAll,
    getFilteredItems,
  } = useMenuStore();

  const { items: cartItems, addItem, removeItem, updateQuantity, getTotalAmount, getTotalItems, clearCart } = useCartStore();
  const { currentOrder, updateOrder, addOrder, fetchOrders, orders, initializeRealtime } = useOrderStore();

  const [allItems, setAllItems] = useState<MenuItem[]>([]);
  const originalCustomerNameRef = useRef(currentOrder?.customerName || '');
  const [customerName, setCustomerName] = useState(currentOrder?.customerName || '');
  const [mobileNumber, setMobileNumber] = useState(currentOrder?.customerPhone || '');
  const [isEditingCustomer, setIsEditingCustomer] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);

  const { customers, fetchCustomers: fetchCreditCustomers } = useCreditStore();
  const [foundCustomer, setFoundCustomer] = useState<Customer | null>(null);

  // Fetch menu items from store (backend)
  useEffect(() => {
    fetchAll().then(() => {
      setAllItems(getFilteredItems());
    });
    fetchOrders();
    fetchCreditCustomers();
    const cleanup = initializeRealtime();
    return () => cleanup && cleanup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchAll, fetchOrders, initializeRealtime, fetchCreditCustomers]);

  // Lookup customer by phone
  useEffect(() => {
    if (isEditingCustomer && mobileNumber.length >= 7) {
      const matched = customers.find((c: Customer) =>
        c.phone === mobileNumber ||
        c.phone.replace(/\D/g, '') === mobileNumber.replace(/\D/g, '')
      );
      setFoundCustomer(matched || null);
    } else {
      setFoundCustomer(null);
    }
  }, [mobileNumber, customers, isEditingCustomer]);

  // Sync filtered items whenever store updates
  useEffect(() => {
    setAllItems(getFilteredItems());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuItems, categories, selectedCategory, searchQuery]);

  // Add "All" category
  const categoryOptions = [
    { categoryId: 'all', categoryName: 'All' },
    ...(categories ?? []),
  ];

  // Auto-set category if not selected
  useEffect(() => {
    if (categoryOptions.length && !selectedCategory) {
      setSelectedCategory(categoryOptions[0].categoryName || categoryOptions[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, selectedCategory]);

  // Update customer name if changed outside
  useEffect(() => {
    if (
      typeof currentOrder?.customerName === 'string' &&
      currentOrder.customerName !== '' &&
      currentOrder.customerName !== originalCustomerNameRef.current
    ) {
      originalCustomerNameRef.current = currentOrder.customerName;
      setCustomerName(currentOrder.customerName);
      setMobileNumber(currentOrder.customerPhone || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrder?.customerName, currentOrder?.customerPhone]);

  // Sync customer from URL query
  const [searchParams] = useSearchParams();
  const customerFromQuery = searchParams.get('customer');
  useEffect(() => {
    if (!customerFromQuery) return;

    setCustomerName(customerFromQuery);
    originalCustomerNameRef.current = customerFromQuery;

    if (currentOrder) {
      updateOrder(currentOrder.id, { customerName: customerFromQuery });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerFromQuery, currentOrder]);

  // Filtered menu items
  const filteredProducts = allItems.filter((item) => {
    const matchesCategory =
      selectedCategory === 'All' ||
      selectedCategory === undefined ||
      item.category === selectedCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Cart helpers
  const orderTotal = getTotalAmount();
  const itemCount = getTotalItems();

  // Remove "out of stock" and "limited stock" feature: allow adding any item regardless of product.isAvailable

  const handleAddItem = (product: MenuItem) => {
    // No stock checks, just add item
    addItem(product);
  };

  const handleIncreaseItem = (productId: string) => {
    const product = menuItems.find((p) => p.id === productId);
    if (product) addItem(product);
  };

  const handleDecreaseItem = (productId: string) => updateQuantity(productId, -1);

  const getProductQuantity = (productId: string) => {
    const item = cartItems.find((i) => i.id === productId);
    return item?.quantity || 0;
  };

  const handleSaveCustomerName = () => {
    if (foundCustomer) {
      setCustomerName(foundCustomer.name);
      setMobileNumber(foundCustomer.phone);
    }
    setIsEditingCustomer(false);
    setFoundCustomer(null);
  };

  /**
   * Place the order using the cart items, customer, etc.
   * FIX: include price and name for each item in the order, as some backends require these for display and receipt.
   */
  const handlePlaceOrder = async () => {
    setOrderError(null);
    setOrderSuccess(null);

    if (placingOrder) return; // Prevent double click
    if (!cartItems.length) {
      setOrderError('Cart is empty!');
      return;
    }
    setPlacingOrder(true);
    try {
      // Prepare order structure; fix: include price & name in each item
      const newOrder = {
        customerType: "WALK_IN" as "WALK_IN",
        customerName: customerName.trim() || "Walk-in Customer",
        mobileNumber: mobileNumber.trim() || undefined,
        items: cartItems.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        })),
        total: orderTotal,
      };
      // Use addOrder from useOrderStore
      try {
        // Await must match the backend or zustand store signature
        await addOrder(newOrder);
        setOrderSuccess("Order placed successfully!");
        clearCart();
        setTimeout(() => {
          navigate("/admin/orders");
        }, 1200);
      } catch (error: any) {
        setOrderError(error?.message || "Failed to place order.");
      }
    } catch (err: any) {
      setOrderError(err?.message || "Failed to place order.");
    } finally {
      setPlacingOrder(false);
    }
  };

  /**
   * Returns the JSX for displaying the image emoji or an img tag.
   */
  function renderProductImage(imageField: ProductImage, productName: string) {
    if (!imageField) {
      return '🍽️';
    }
    if (typeof imageField === 'string') {
      return imageField;
    }
    if (
      typeof imageField === 'object' &&
      typeof imageField.url === 'string'
    ) {
      return (
        <img
          src={imageField.url}
          alt={imageField.alt || productName}
          className="w-12 h-12"
        />
      );
    }
    return '🍽️';
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Walk-In Order</h1>
            <div className="flex items-center gap-2 mt-1 text-sm">
              <User className="w-4 h-4 text-gray-400" />
              {!isEditingCustomer ? (
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-orange-600">
                    {customerName || 'Walk-in Customer'}
                    {mobileNumber && <span className="text-gray-400 font-normal ml-1">({mobileNumber})</span>}
                  </span>
                  <button onClick={() => setIsEditingCustomer(true)} className="text-blue-600 hover:underline">
                    <SquarePen size={16} />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 relative">
                  <input
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value)}
                    className="border-2 border-orange-300 rounded-md px-2 py-1 text-sm focus:border-orange-500 outline-none w-40"
                    placeholder="Mobile Number"
                    autoFocus
                  />
                  <input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="border-2 border-gray-200 rounded-md px-2 py-1 text-sm focus:border-orange-500 outline-none w-40"
                    placeholder="Customer Name"
                  />
                  {foundCustomer && (
                    <div className="absolute top-full left-0 mt-1 p-2 bg-white border-2 border-green-500 rounded-lg shadow-lg z-50 min-w-[200px]">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <div>
                            <p className="font-bold text-[10px] text-green-600 uppercase">Existing Customer</p>
                            <p className="text-sm font-semibold text-gray-900">{foundCustomer.name}</p>
                          </div>
                        </div>
                        <button
                          onClick={handleSaveCustomerName}
                          className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700"
                        >
                          Use This
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <button onClick={handleSaveCustomerName} className="text-green-600 hover:bg-green-50 p-1 rounded-md">
                      <Check size={16} />
                    </button>
                    <button
                      onClick={() => {
                        setCustomerName(originalCustomerNameRef.current);
                        setMobileNumber(currentOrder?.customerPhone || '');
                        setIsEditingCustomer(false);
                        setFoundCustomer(null);
                      }}
                      className="text-red-500 hover:bg-red-50 p-1 rounded-md"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center justify-center gap-1 px-4 py-2 rounded-xl bg-orange-500 text-white font-semibold hover:bg-orange-600"
          >
            <MoveLeft size={16} />
            Back
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Menu Section */}
          <section className="lg:col-span-2 space-y-6">
            {/* Search & Filter */}
            <div className="bg-white p-4 lg:p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Filter Menu</h3>
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-lg font-semibold text-gray-700 focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <select
                className="w-full p-3 border-2 border-gray-300 rounded-lg font-semibold text-gray-700 focus:border-indigo-500 focus:outline-none"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                disabled={!!searchQuery.trim()}
              >
                {categoryOptions.map((cat) => (
                  <option key={cat.categoryId || (typeof cat === 'string' ? cat : '')} value={cat.categoryName || (typeof cat === 'string' ? cat : '')}>
                    {cat.categoryName || (typeof cat === 'string' ? cat : '')}
                  </option>
                ))}
              </select>
            </div>

            {/* Menu Items */}
            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-4 pb-2 border-b-2">Menu Items</h2>
              <div className="space-y-4">
                {filteredProducts.length === 0 ? (
                  <div className="text-center py-20 text-gray-400">
                    <ShoppingCart className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p className="text-lg">No items available</p>
                  </div>
                ) : (
                  filteredProducts.map((product) => {
                    const qty = getProductQuantity(product.id);

                    return (
                      <div key={product.id} className="bg-white rounded-2xl p-5 shadow-sm border hover:shadow-md transition">
                        <div className="flex justify-between items-start">
                          <div className="flex gap-4">
                            <span className="text-4xl">
                              {renderProductImage(product.image as ProductImage, product.name)}
                            </span>
                            <div>
                              <h4 className="font-bold text-lg flex items-center gap-2">
                                {product.name} <span>{product.isVeg ? '🟢' : '🔴'}</span>
                              </h4>
                              <p className="text-sm text-gray-500">{product.category}</p>
                              <p className="text-orange-600 font-bold mt-1">Rs. {product.price}</p>
                            </div>
                          </div>

                          {qty === 0 ? (
                            <button
                              onClick={() => handleAddItem(product)}
                              className="px-5 py-2 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600"
                            >
                              Add
                            </button>
                          ) : (
                            <div className="flex items-center gap-3 bg-orange-50 px-3 py-2 rounded-xl">
                              <button onClick={() => handleDecreaseItem(product.id)}>-</button>
                              <span className="font-bold">{qty}</span>
                              <button onClick={() => handleIncreaseItem(product.id)}>+</button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Active Walk-in Orders Section */}
            <div className="mt-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-4 pb-2 border-b-2">Recent Walk-in Orders</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {orders
                  .filter(o => (o.table?.tableType === 'WALK_IN' || o.tableNumber?.startsWith('WALKIN')) && ['pending', 'preparing', 'served'].includes(o.status))
                  .length === 0 ? (
                  <p className="text-gray-400 col-span-full py-4 text-center bg-white rounded-xl border border-dashed">No active walk-in orders</p>
                ) : (
                  orders
                    .filter(o => (o.table?.tableType === 'WALK_IN' || o.tableNumber?.startsWith('WALKIN')) && ['pending', 'preparing', 'served'].includes(o.status))
                    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
                    .map((order) => (
                      <div key={order.id} className="bg-white p-4 rounded-xl shadow-sm border hover:shadow-md transition cursor-pointer" onClick={() => navigate('/admin/orders')}>
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-bold text-gray-800">{order.customerName || 'Walk-in'}</p>
                            <p className="text-xs text-gray-500">{new Date(order.createdAt || '').toLocaleTimeString()}</p>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${order.status === 'pending' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                            {order.status}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-600">{order.items.length} items</span>
                          <span className="font-bold text-orange-600">Rs. {order.totalAmount}</span>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>
          </section>

          {/* Cart Sidebar */}
          <aside className="bg-white rounded-2xl shadow-md p-6 sticky top-24">
            <h2 className="text-xl font-bold mb-4">Your Cart</h2>
            {itemCount === 0 ? (
              <p className="text-gray-400 text-center py-10">Cart is empty</p>
            ) : (
              cartItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between mb-3 gap-3">
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">{item.name} × {item.quantity}</p>
                  </div>
                  <span className="font-semibold text-gray-700">Rs. {item.price * item.quantity}</span>
                  <button onClick={() => removeItem(item.id)} className="text-red-500 hover:text-red-700 transition" title="Remove item">
                    <Trash2 size={18} />
                  </button>
                </div>
              ))
            )}
            <div className="border-t pt-4 mt-4">
              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span className="text-orange-600">Rs. {orderTotal}</span>
              </div>
              {orderError && (
                <div className="text-red-500 text-center mt-2 text-sm">{orderError}</div>
              )}
              {orderSuccess && (
                <div className="text-green-600 text-center mt-2 text-sm">{orderSuccess}</div>
              )}
              <button
                className="w-full mt-4 bg-orange-500 text-white py-3 rounded-xl font-bold"
                disabled={placingOrder || itemCount === 0}
                onClick={handlePlaceOrder}
              >
                {placingOrder ? "Placing..." : "Place Order"}
              </button>
            </div>
          </aside>
        </div>
      </main>

      <footer className="text-center py-4 bg-gray-200 text-gray-600 text-sm mt-12">
        Restaurant POS System © 2024
      </footer>
    </div>
  );
};

export default WalkInOrder;
