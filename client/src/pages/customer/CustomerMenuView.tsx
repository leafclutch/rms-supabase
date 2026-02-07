import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Search, ShoppingCart, X, Plus, Minus, Trash2, Check, ArrowLeft, MapPin } from "lucide-react";
import { useMenuStore } from "../../store/useMenuStore";
import { useCustomerOrderStore } from "../../store/useCustomerOrderStore";
import { useCustomerCartStore } from "../../store/useCustomerCartStore";

import type { MenuItem } from "../../types/menu";


function getImageProps(image: any, name: string) {
  if (!image) return { type: "none" };
  if (typeof image === "string") {
    return { type: "emoji", value: image };
  }
  if (typeof image === "object" && typeof image.url === "string") {
    return { type: "image", url: image.url, alt: (image.alt as string) || name };
  }
  return { type: "none" };
}

const CustomerMenuView: React.FC = () => {
  const { tableId } = useParams<{ tableId?: string }>();
  const navigate = useNavigate();

  const [searchParams] = useSearchParams();
  const customerName = searchParams.get('name');
  const customerPhone = searchParams.get('phone');


  const { fetchAll, categories, items } = useMenuStore();


  const {
    orders,
    createOrder,

  } = useCustomerOrderStore();


  const {
    cart,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    getTotalAmount,
    getTotalItems
  } = useCustomerCartStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [showCart, setShowCart] = useState(false);
  const [showOrderSuccess, setShowOrderSuccess] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<any>(null);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);


  useEffect(() => {
    fetchAll().catch(err => console.error("Failed to fetch menu:", err));
  }, []);


  const activeOrder = orders.find(
    (o) =>
      o.tableCode?.toLowerCase() === tableId?.toLowerCase() &&
      !["paid", "cancelled"].includes(o.status)
  );


  const placeOrder = async () => {
    if (cart.length === 0) {
      alert("Your cart is empty. Please add items to place an order.");
      return;
    }

    setIsPlacingOrder(true);

    try {
      const orderPayload = {
        items: cart,
        customerType: (tableId ? "DINE_IN" : "ONLINE") as "DINE_IN" | "ONLINE",
        tableCode: tableId ? tableId.toUpperCase() : undefined,
        customerName: customerName || undefined,
        mobileNumber: customerPhone || undefined,
      };


      const orderResult = await createOrder(orderPayload);

      if (orderResult) {
        setCurrentOrder(orderResult);
        clearCart();
        setShowCart(false);
        setShowOrderSuccess(true);

      } else {
        throw new Error("Order creation failed - no response from server");
      }
    } catch (error: any) {
      console.error("Error placing order:", error);
      const errorMessage = error?.response?.data?.message ||
        error?.message ||
        "Failed to place order. Please try again.";
      alert(errorMessage);
    } finally {
      setIsPlacingOrder(false);
    }
  };


  const filteredItems = items.filter((item) => {

    const matchesCat =
      selectedCategory === "All" ? true : item.category === selectedCategory;


    const matchesSearch = item.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());

    return matchesCat && matchesSearch;
  });



  const cartTotal = getTotalAmount();
  const cartItemCount = getTotalItems();


  const [notification, setNotification] = useState<{ message: string; show: boolean; }>({ message: "", show: false });

  const handleAddToCart = (item: MenuItem) => {
    addToCart(item);
    setNotification({ message: `${item.name}  added `, show: true });


    setTimeout(() => {
      setNotification((prev) => ({ ...prev, show: false }));
    }, 3000);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20 lg:pb-0">
      {/* Header */}
      <header className="bg-white shadow sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 flex justify-between items-center h-16 lg:h-20">
          <div className="flex items-center gap-4">
            {!tableId && (
              <button
                onClick={() => navigate("/")}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
            )}
            <div className="w-10 h-10 lg:w-12 lg:h-12 overflow-hidden rounded-full shadow-md border-2 border-[#16516f]/20">
              <img src="/logo.png" alt="Aaradhya Restaurant Logo" className="w-full h-full object-cover" />
            </div>
            <div>
              <h1 className="text-xl lg:text-2xl font-bold text-gray-900">
                Aaradhya Restaurant
              </h1>
              {tableId ? (
                <div className="flex items-center gap-1 text-xs lg:text-sm">
                  <MapPin className="w-3 h-3 lg:w-4 lg:h-4 text-[#16516f]" />
                  <span className="text-gray-600">Table: </span>
                  <span className="font-bold text-[#16516f]">
                    {tableId.toUpperCase()}
                  </span>
                </div>
              ) : (
                <p className="text-xs lg:text-sm text-gray-600">Online Order</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowCart((s) => !s)}
              className="hidden lg:block relative p-2 bg-[#16516f] text-white rounded-lg hover:bg-[#11425c]"
            >
              <ShoppingCart className="w-5 h-5 lg:w-6 lg:h-6" />
              {cartItemCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-[#16516f] border-2 border-white text-white text-xs w-6 h-6 rounded-full flex items-center justify-center font-bold shadow-sm">
                  {cartItemCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Category Filter - Directly below header */}
        <div className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 lg:px-8 py-4">
            <div className="flex items-start gap-3 overflow-x-auto pb-2 lg:pb-0 scrollbar-hide">
              {/* All Category */}
              <button
                onClick={() => setSelectedCategory("All")}
                className={`flex flex-col items-center justify-center min-w-[80px] p-3 rounded-xl transition-all ${selectedCategory === "All"
                  ? "bg-[#16516f]/10 border-2 border-[#16516f]"
                  : "bg-gray-100 border-2 border-transparent hover:bg-gray-200"
                  }`}
              >
                <div className="text-3xl mb-1">🍽️</div>
                <span className={`text-sm font-medium text-center ${selectedCategory === "All" ? "text-[#16516f]" : "text-gray-700"
                  }`}>
                  All
                </span>
              </button>

              {/* Dynamic Categories with Same Emoji */}
              {categories
                .filter((cat) => !!cat && cat.categoryName !== "All")
                .map((cat) => (
                  <button
                    key={cat.categoryId}
                    onClick={() => setSelectedCategory(cat.categoryName)}
                    className={`flex flex-col items-center justify-center min-w-[80px] p-3 rounded-xl transition-all ${selectedCategory === cat.categoryName
                      ? "bg-[#16516f]/10 border-2 border-[#16516f]"
                      : "bg-gray-100 border-2 border-transparent hover:bg-gray-200"
                      }`}
                  >
                    <div className="text-3xl mb-1">🍽️</div>
                    <span className={`text-sm font-medium text-center ${selectedCategory === cat.categoryName ? "text-[#16516f]" : "text-gray-700"
                      }`}>
                      {cat.categoryName}
                    </span>
                  </button>
                ))}
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 lg:px-8 py-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search menu items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
              />
            </div>
          </div>
        </div>
      </header>

      {/* Menu Grid */}
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-6 lg:py-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {filteredItems.map((item) => {
          const imgProps = getImageProps(item.image, item.name);
          return (
            <div
              key={item.id}
              className="bg-white rounded-xl shadow-lg p-4 flex flex-col gap-2 hover:shadow-2xl transition-all"
            >

              {/* Image */}
              <div className="text-4xl text-center">
                {imgProps.type === "emoji" ? (
                  imgProps.value
                ) : imgProps.type === "image" ? (
                  <img src={imgProps.url} alt={imgProps.alt || item.name} className="mx-auto w-16 h-16" />
                ) : (
                  "🍽️"
                )}
              </div>

              {/* Item info */}
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-lg truncate">{item.name}</h3>
                {item.isVeg === true && (
                  <div className="flex items-center justify-center w-4 h-4 border border-green-600 p-0.5 flex-shrink-0">
                    <div className="w-full h-full bg-green-600 rounded-full" />
                  </div>
                )}
                {item.isVeg === false && (
                  <div className="flex items-center justify-center w-4 h-4 border border-red-600 p-0.5 flex-shrink-0">
                    <div className="w-full h-full bg-red-600 rounded-full" />
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500">{item.category}</p>
              <p className="text-[#16516f] font-bold text-lg">Rs. {item.price}</p>
              <p className="text-gray-600 text-sm line-clamp-2">{item.description}</p>

              <button
                onClick={() => handleAddToCart(item)}
                disabled={!item.isAvailable}
                className="mt-auto w-full py-2 bg-[#16516f] text-white rounded-lg font-semibold hover:bg-[#11425c] disabled:bg-gray-300 disabled:cursor-not-allowed transition-all"
              >
                {item.isAvailable ? "Add to Cart" : "Unavailable"}
              </button>
            </div>
          );
        })}
      </div>

      {/* Cart Sidebar */}
      {showCart && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-end">
          <div className="bg-white w-full max-w-md h-full overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900">Your Cart</h2>
              <button onClick={() => setShowCart(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-4">
              {cart.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500 text-lg">Your cart is empty</p>
                  <p className="text-gray-400 text-sm mt-2">Add items to get started</p>
                </div>
              ) : (
                <>
                  <div className="space-y-4 mb-6">
                    {cart.map((item) => (
                      <div key={item.id} className="bg-gray-50 rounded-lg p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg">{item.name}</h3>
                            <p className="text-[#16516f] font-bold">Rs. {item.price}</p>
                          </div>
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="text-[#16516f] hover:bg-[#16516f]/10 p-2 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => updateQuantity(item.id, -1)}
                            className="w-8 h-8 hover:bg-gray-300 rounded-lg flex items-center justify-center text-[#16516f] border border-[#16516f]"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="font-bold text-lg w-8 text-center">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.id, 1)}
                            className="w-8 h-8 bg-[#16516f] hover:bg-[#11425c] text-white rounded-lg flex items-center justify-center"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                          <span className="ml-auto font-bold text-lg">
                            Rs. {item.price * item.quantity}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t pt-4 mb-6">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-600">Subtotal</span>
                      <span className="font-semibold">Rs. {cartTotal}</span>
                    </div>
                    <div className="flex justify-between items-center text-xl font-bold">
                      <span>Total</span>
                      <span className="text-[#16516f]">Rs. {cartTotal}</span>
                    </div>
                  </div>

                  <button
                    onClick={placeOrder}
                    disabled={isPlacingOrder}
                    className="w-full py-4 bg-[#16516f] hover:bg-[#11425c] text-white rounded-lg font-bold text-lg transition-all disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {isPlacingOrder ? "Placing Order..." : "Place Order"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Order Success Modal */}
      {showOrderSuccess && currentOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-8 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-12 h-12 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {activeOrder ? "Order Updated!" : "Order Placed Successfully!"}
            </h2>
            <p className="text-gray-600 mb-4">
              {activeOrder
                ? "Your items have been added to your existing order"
                : "Your order has been received"}
            </p>
            <div className="bg-[#16516f]/10 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-600 mb-1">Order Number</p>
              <p className="text-3xl font-bold text-[#16516f]">
                {currentOrder.orderNumber || currentOrder.orderId?.slice(0, 8) || "N/A"}
              </p>
              {tableId && (
                <div className="mt-2 flex items-center justify-center gap-1 text-sm">
                  <MapPin className="w-4 h-4 text-gray-600" />
                  <span className="text-gray-600">Table: </span>
                  <span className="font-bold text-gray-900">
                    {tableId.toUpperCase()}
                  </span>
                </div>
              )}
            </div>
            <div className="text-left bg-gray-50 rounded-lg p-4 mb-6">
              <p className="font-semibold mb-2">Order Summary:</p>
              {currentOrder?.items?.map((item: any) => (
                <div key={item.menuItemId || item.id} className="flex justify-between text-sm mb-1">
                  <span>
                    {(() => {
                      const mi = items.find((m) => m.id === (item.menuItemId || item.id));
                      return mi ? `${mi.name} x${item.quantity}` : `x${item.quantity}`;
                    })()}
                  </span>
                  <span>
                    {(() => {
                      const mi = items.find((m) => m.id === (item.menuItemId || item.id));
                      return mi ? `Rs. ${Number(mi.price) * item.quantity}` : "";
                    })()}
                  </span>
                </div>
              ))}
              <div className="border-t mt-2 pt-2 flex justify-between font-bold">
                <span>Total</span>
                <span className="text-[#16516f]">
                  Rs. {currentOrder?.totalAmount}
                </span>
              </div>
            </div>
            <button
              onClick={() => setShowOrderSuccess(false)}
              className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold"
            >
              Continue Shopping
            </button>
          </div>
        </div>
      )}

      {/* Floating Action Button for Mobile Cart - Moved up as requested */}
      <button
        onClick={() => setShowCart(true)}
        className="lg:hidden fixed bottom-32 right-6 w-14 h-14 bg-[#16516f] text-white rounded-full shadow-2xl flex items-center justify-center z-40 hover:bg-[#11425c] transition-transform hover:scale-105"
      >
        <ShoppingCart className="w-6 h-6" />
        {cartItemCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold border-2 border-[#16516f]">
            {cartItemCount}
          </span>
        )}
      </button>

      {/* Cart Notification Toast - Moved to top, smaller font ("proper professional way") */}
      {notification.show && (
        <div className="fixed top-24 left-1/2 transform -translate-x-1/2 bg-gray-900/95 backdrop-blur-sm text-white px-4 py-2.5 rounded-full shadow-xl z-50 flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
            <Check className="w-2.5 h-2.5 text-white" />
          </div>
          <span className="text-sm font-medium whitespace-nowrap">{notification.message}</span>
        </div>
      )}

    </div>
  );
};

export default CustomerMenuView;
