// FILE: src/components/admin/payment/PaymentModal.tsx (COMPLETE VERSION)

import React, { useState } from 'react';
import { Wallet, Smartphone, CreditCard, Users, DollarSign, Percent } from 'lucide-react';
import { toast } from 'react-hot-toast';
import type { Customer } from '../../../types/Customer';
import type { Order } from '../../../types/order';
import { useOrderStore } from '../../../store/useOrderStore';
import { useCreditStore } from '../../../store/useCreditStore';
import Modal from '../../common/Modal';
import Input from '../../common/Input';
import { CreditSearch } from '../../../pages/admin/CreditSearch';
import Button from '../../common/Button';

interface PaymentModalProps {
  order: Order;
  onClose: () => void;
  onSuccess: () => void;
}

type PaymentMethod = 'cash' | 'online' | 'credit' | 'mixed';

export const PaymentModal: React.FC<PaymentModalProps> = ({ order, onClose, onSuccess }) => {
  const [activeTab, setActiveTab] = useState<PaymentMethod>('cash');

  // Discount state
  const [discountType, setDiscountType] = useState<'fixed' | 'percentage'>('percentage');
  const [discountValue, setDiscountValue] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);

  // Payment amounts
  const [cashAmount, setCashAmount] = useState(order.totalAmount);
  const [onlineAmount, setOnlineAmount] = useState(0);
  const [transactionId, setTransactionId] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [processing, setProcessing] = useState(false);

  const { updateOrder } = useOrderStore();
  const { addCreditTransaction } = useCreditStore();

  // Calculate discount amount whenever type or value changes
  React.useEffect(() => {
    let amount = 0;
    if (discountType === 'fixed') {
      amount = Math.min(discountValue, order.totalAmount);
    } else {
      amount = (order.totalAmount * discountValue) / 100;
    }
    setDiscountAmount(amount);
  }, [discountType, discountValue, order.totalAmount]);

  const finalAmount = order.totalAmount - discountAmount;

  const handlePayment = async () => {
    setProcessing(true);

    try {
      // Validate based on payment method
      if (activeTab === 'cash') {
        if (cashAmount < finalAmount) {
          throw new Error('Cash amount is less than the final amount');
        }
      } else if (activeTab === 'online') {
        if (!transactionId.trim()) {
          throw new Error('Please enter transaction ID');
        }
      } else if (activeTab === 'credit') {
        if (!selectedCustomer) {
          throw new Error('Please select a customer');
        }

        // Add debt to customer account
        await addCreditTransaction(selectedCustomer.id, {
          customerId: selectedCustomer.id,
          orderId: order.id,
          type: 'debt',
          amount: finalAmount,
          notes: `Order #${order.orderNumber || order.id} - Table ${order.tableNumber}`
        });

        toast.success(`Rs. ${finalAmount} added to ${selectedCustomer.name}'s credit account`);

      } else if (activeTab === 'mixed') {
        const total = cashAmount + onlineAmount;
        if (Math.abs(total - finalAmount) > 0.01) {
          throw new Error(`Total payment must equal Rs. ${finalAmount.toFixed(2)}`);
        }
      }

      // Update order
      await updateOrder(order.id, {
        paymentMethod: activeTab.toUpperCase() as any, // Cast to any to avoid strict type issues if types mismatch slightly
        status: 'paid', // Changed from 'completed' to 'paid' to match OrderStatus type
        discountType: discountValue > 0 ? (discountType === 'percentage' ? 'PERCENT' : 'FIXED') : undefined,
        discountValue: discountValue > 0 ? discountValue : undefined,
        finalAmount: finalAmount,
        finalAmountAfterDiscount: finalAmount
      });

      toast.success('Payment processed successfully!');
      onSuccess();
    } catch (error: any) {
      if (error && typeof error === 'object' && 'message' in error) {
        toast.error((error as { message?: string }).message || 'Payment processing failed');
      } else if (typeof error === 'string') {
        toast.error(error);
      } else {
        toast.error('Payment processing failed');
      }
    } finally {
      setProcessing(false);
    }
  };

  const tabs: { key: PaymentMethod; label: string; icon: React.ReactNode }[] = [
    { key: 'cash', label: 'Cash', icon: <Wallet className="w-5 h-5" /> },
    { key: 'online', label: 'Online', icon: <Smartphone className="w-5 h-5" /> },
    { key: 'mixed', label: 'Mixed', icon: <CreditCard className="w-5 h-5" /> },
    { key: 'credit', label: 'Credit', icon: <Users className="w-5 h-5" /> },
  ];

  return (
    <Modal isOpen={true} onClose={onClose} size="xl" title="Process Payment">
      <div className="space-y-6">
        {/* Order Summary */}
        <div className="bg-gray-50 rounded-xl p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-600">Order #{order.orderNumber || order.id}</span>
            <span className="font-semibold">Table {order.tableNumber}</span>
          </div>
          <div className="flex justify-between items-center text-lg font-bold border-t pt-2 mt-2">
            <span>Original Total:</span>
            <span>Rs. {order.totalAmount}</span>
          </div>
        </div>

        {/* Discount Section */}
        <div className="bg-gray-50 rounded-xl p-4 space-y-4">
          <h3 className="font-bold text-gray-800">Apply Discount</h3>

          <div className="flex gap-2">
            <button
              onClick={() => setDiscountType('percentage')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg font-semibold transition-all ${discountType === 'percentage'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-700 border-2 border-gray-300'
                }`}
            >
              <Percent className="w-4 h-4" />
              Percentage
            </button>
            <button
              onClick={() => setDiscountType('fixed')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg font-semibold transition-all ${discountType === 'fixed'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-700 border-2 border-gray-300'
                }`}
            >
              <DollarSign className="w-4 h-4" />
              Fixed Amount
            </button>
          </div>

          <Input
            type="number"
            label={discountType === 'percentage' ? 'Discount Percentage' : 'Discount Amount'}
            value={discountValue}
            onChange={(e) => setDiscountValue(Number(e.target.value))}
            min={0}
            max={discountType === 'percentage' ? 100 : order.totalAmount}
            placeholder="0"
          />

          <div className="bg-white rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Original Total:</span>
              <span className="font-semibold">Rs. {order.totalAmount}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Discount:</span>
              <span className="font-semibold text-green-600">- Rs. {discountAmount.toFixed(2)}</span>
            </div>
            <div className="border-t pt-2 flex justify-between">
              <span className="font-bold">Final Total:</span>
              <span className="font-bold text-xl text-indigo-600">
                Rs. {finalAmount.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Final Amount Display */}
        <div className="bg-indigo-50 border-2 border-indigo-200 rounded-xl p-4">
          <div className="flex justify-between items-center">
            <span className="text-lg font-bold text-gray-800">Amount to Pay:</span>
            <span className="text-3xl font-bold text-indigo-600">Rs. {finalAmount.toFixed(2)}</span>
          </div>
        </div>

        {/* Payment Method Tabs */}
        <div className="flex gap-2 bg-gray-100 p-2 rounded-xl overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-semibold transition-all whitespace-nowrap ${activeTab === tab.key
                ? 'bg-white text-indigo-600 shadow-md'
                : 'text-gray-600 hover:text-gray-800'
                }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Payment Method Content */}
        <div className="min-h-[200px]">
          {activeTab === 'cash' && (
            <div className="space-y-4">
              <Input
                type="number"
                label="Cash Received"
                value={cashAmount}
                onChange={(e) => setCashAmount(Number(e.target.value))}
                icon={<Wallet className="w-5 h-5" />}
                min={finalAmount}
              />
              {cashAmount >= finalAmount && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-1">Change to Return:</p>
                  <p className="text-2xl font-bold text-green-600">
                    Rs. {(cashAmount - finalAmount).toFixed(2)}
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'online' && (
            <div className="space-y-4">
              <div className="bg-blue-50 rounded-lg p-4 text-sm text-gray-700">
                <p className="font-semibold mb-2">Accepted Payment Methods:</p>
                <ul className="space-y-1">
                  <li>• eSewa / Khalti / IME Pay</li>
                  <li>• Bank Transfer</li>
                  <li>• QR Code Scan</li>
                </ul>
              </div>
              <Input
                type="text"
                label="Transaction ID / Reference Number"
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                placeholder="TXN123456789"
                icon={<Smartphone className="w-5 h-5" />}
              />
            </div>
          )}

          {activeTab === 'mixed' && (
            <div className="space-y-4">
              <Input
                type="number"
                label="Cash Amount"
                value={cashAmount}
                onChange={(e) => {
                  const cash = Number(e.target.value);
                  setCashAmount(cash);
                  setOnlineAmount(Math.max(0, finalAmount - cash));
                }}
                icon={<Wallet className="w-5 h-5" />}
                max={finalAmount}
              />
              <Input
                type="number"
                label="Online Amount"
                value={onlineAmount}
                onChange={(e) => {
                  const online = Number(e.target.value);
                  setOnlineAmount(online);
                  setCashAmount(Math.max(0, finalAmount - online));
                }}
                icon={<Smartphone className="w-5 h-5" />}
                max={finalAmount}
              />
              <div className={`rounded-lg p-4 ${Math.abs((cashAmount + onlineAmount) - finalAmount) < 0.01
                ? 'bg-green-50 border border-green-200'
                : 'bg-red-50 border border-red-200'
                }`}>
                <p className="text-sm font-semibold mb-1">Total Entered:</p>
                <p className="text-xl font-bold">Rs. {(cashAmount + onlineAmount).toFixed(2)}</p>
                <p className="text-sm text-gray-600 mt-1">
                  Required: Rs. {finalAmount.toFixed(2)}
                </p>
              </div>
            </div>
          )}

          {activeTab === 'credit' && (
            <div className="space-y-4">
              <CreditSearch onSelectCustomer={setSelectedCustomer} />

              {selectedCustomer && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border-2 border-indigo-200">
                  <h4 className="font-bold text-gray-800 mb-3">Transaction Summary</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Current Outstanding:</span>
                      <span className="font-bold text-red-600">
                        Rs. {selectedCustomer.totalCredit.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Order Amount:</span>
                      <span className="font-bold text-orange-600">Rs. {finalAmount.toFixed(2)}</span>
                    </div>
                    <div className="border-t pt-2 flex justify-between">
                      <span className="font-bold text-gray-800">New Outstanding:</span>
                      <span className="font-bold text-red-600 text-lg">
                        Rs. {(selectedCustomer.totalCredit + finalAmount).toLocaleString()}
                      </span>
                    </div>
                    {/* Available Credit Removed */}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 pt-4 border-t">
          <Button variant="outline" fullWidth onClick={onClose} disabled={processing}>
            Cancel
          </Button>
          <Button
            fullWidth
            onClick={handlePayment}
            loading={processing}
            disabled={processing}
          >
            {processing ? 'Processing...' : `Confirm Payment - Rs. ${finalAmount.toFixed(2)}`}
          </Button>
        </div>
      </div>
    </Modal>
  );
};