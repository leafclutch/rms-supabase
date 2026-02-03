


import React, { useState } from 'react';
import { ShoppingCart, Trash2, X, AlertCircle, Plus, Minus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCustomerCartStore } from '../../store/useCustomerCartStore';
import { useCustomerOrderStore, type CustomerOrder } from '../../store/useCustomerOrderStore';
import { toast } from 'react-hot-toast';

interface CartSidebarProps {
  setShowCart: (show: boolean) => void;
  tableCode?: string;
  existingOrder?: CustomerOrder | null;
}

const CartSidebar: React.FC<CartSidebarProps> = ({
  setShowCart,
  tableCode,
  existingOrder
}) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const {
    cart,
    getTotalAmount,
    updateQuantity,
    removeFromCart,
    clearCart
  } = useCustomerCartStore();

  const { createOrder } = useCustomerOrderStore();

  const cartTotal = getTotalAmount();
  const customerType = tableCode ? "DINE_IN" : "WALK_IN";

  const handleCheckout = async () => {
    if (!cart.length) {
      toast.error("Cart is empty");
      return;
    }

    if (customerType === "DINE_IN" && !tableCode) {
      toast.error("Table code is missing. Please scan the QR code.");
      return;
    }

    setLoading(true);

    try {
      let order: CustomerOrder | null = null;

      // Create new order
      order = await createOrder({
        items: cart,
        tableCode: tableCode || undefined,
        customerType,
      });

      if (order) {
        toast.success('Order placed successfully!');
      }

      if (order) {
        clearCart();
        setShowCart(false);
        navigate(`/order-success/${order.orderId}`);
      }
    } catch (err: any) {
      console.error('Checkout failed:', err);
      toast.error(err?.message || 'Checkout failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={() => setShowCart(false)}
      ></div>

      {/* Sidebar */}
      <div className="fixed right-0 top-0 bottom-0 w-full md:w-96 lg:w-[480px] bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 lg:p-6 bg-orange-600 text-white">
          <h3 className="text-lg lg:text-xl font-bold">My Cart</h3>
          <button
            onClick={() => setShowCart(false)}
            className="p-1 hover:bg-orange-700 rounded"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Existing Order Alert */}
        {existingOrder && (
          <div className="bg-blue-50 border-b-2 border-blue-200 p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-blue-900">
                  Adding to Existing Order
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  Order #{existingOrder.orderNumber} | Current: Rs. {existingOrder.totalAmount}
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  New items will be appended to your current order
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <ShoppingCart className="w-16 h-16 lg:w-20 lg:h-20 mb-4" />
              <p className="text-lg lg:text-xl font-semibold">Your cart is empty</p>
              <p className="text-sm lg:text-base mt-2">Add items to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {cart.map(item => (
                <div
                  key={item.id}
                  className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="text-3xl lg:text-4xl">{item.image}</div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-sm lg:text-base truncate">
                      {item.name}
                    </h4>
                    <p className="text-orange-600 font-bold text-sm lg:text-base">
                      Rs. {item.price}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      Total: Rs. {item.price * item.quantity}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQuantity(item.id, -1)}
                      className="w-8 h-8 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-100 font-bold flex items-center justify-center"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-8 text-center font-semibold">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.id, 1)}
                      className="w-8 h-8 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-100 font-bold flex items-center justify-center"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="text-red-600 hover:bg-red-50 p-2 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4 lg:w-5 lg:h-5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Checkout Button */}
        {cart.length > 0 && (
          <div className="border-t p-4 lg:p-6 bg-white">
            {existingOrder && (
              <div className="mb-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-700">Existing Order:</span>
                  <span className="font-bold">Rs. {existingOrder.totalAmount}</span>
                </div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-700">New Items:</span>
                  <span className="font-bold">Rs. {cartTotal}</span>
                </div>
                <div className="flex justify-between text-base font-bold border-t pt-2 mt-2">
                  <span className="text-gray-900">New Total:</span>
                  <span className="text-indigo-600">
                    Rs. {existingOrder.totalAmount + cartTotal}
                  </span>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-600 text-base lg:text-lg">
                {existingOrder ? 'Items Total:' : 'Subtotal:'}
              </span>
              <span className="font-bold text-xl lg:text-2xl">Rs. {cartTotal}</span>
            </div>
            <button
              onClick={handleCheckout}
              disabled={loading}
              className="w-full bg-orange-600 text-white py-3 lg:py-4 rounded-lg font-bold text-base lg:text-lg hover:bg-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Processing...
                </>
              ) : existingOrder ? (
                `Add to Order #${existingOrder.orderNumber}`
              ) : (
                'Proceed to Checkout'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CartSidebar;