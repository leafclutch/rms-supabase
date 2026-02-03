

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, Clock, Utensils, Home, Bell } from 'lucide-react';
import { useOrderStore } from '../../store/useOrderStore';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';

// Dummy data to use if order is not found
const dummyOrder = {
  id: '1',
  status: 'preparing',
  items: [
    { id: '101', name: 'Paneer Butter Masala', quantity: 2, price: 250 },
    { id: '102', name: 'Butter Naan', quantity: 4, price: 40 },
  ],
  totalAmount: 2 * 250 + 4 * 40,
};

export const OrderTracking: React.FC = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { getOrderById } = useOrderStore();

  // Use 'dummyOrder' if nothing found for getOrderById, to avoid lint/type errors
  const [order, setOrder] = useState<any>(null);
  const [notifications] = useState<string[]>([]);

  useEffect(() => {
    if (orderId) {
      const foundOrder = getOrderById(orderId);
      setOrder(foundOrder || dummyOrder);
    } else {
      setOrder(dummyOrder);
    }


  }, [orderId, getOrderById]);

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card>
          <div className="text-center py-8">
            <p className="text-gray-600">Order not found</p>
            <div className="mt-4">
              <Button onClick={() => navigate('/menu')}>
                Back to Menu
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Timeline step logic for 'preparing' and 'served'
  const statusSteps = [
    { status: 'pending', label: 'Order Received', icon: CheckCircle, active: true },
    { status: 'preparing', label: 'Being Prepared', icon: Utensils, active: ['preparing', 'served', 'paid'].includes(order.status) },
    { status: 'served', label: 'Ready to Serve', icon: Bell, active: ['served', 'paid'].includes(order.status) },
  ];

  // Determine progress bar height based on status
  function getProgressBarHeight(status: string): string {
    if (status === 'served') return '100%';
    if (status === 'preparing') return '50%';
    return '0%';
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/menu')}
            className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-semibold mb-4"
          >
            <Home className="w-4 h-4" />
            Back to Menu
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Track Your Order</h1>
          <p className="text-gray-600 mt-1">Order #{order.id}</p>
        </div>

        {/* Status Timeline */}
        <Card className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Order Status</h2>

          <div className="relative">
            {/* Progress Line */}
            <div className="absolute left-6 top-6 bottom-6 w-1 bg-gray-200">
              <div
                className="bg-indigo-600 w-full transition-all duration-500"
                style={{ height: getProgressBarHeight(order.status) }}
              />
            </div>

            {/* Steps */}
            <div className="relative space-y-8">
              {statusSteps.map((step) => (
                <div key={step.status} className="flex items-start gap-4">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center border-4 transition-all duration-300 ${step.active
                      ? 'bg-indigo-600 border-indigo-600 shadow-lg'
                      : 'bg-white border-gray-300'
                      }`}
                  >
                    <step.icon className={`w-6 h-6 ${step.active ? 'text-white' : 'text-gray-400'}`} />
                  </div>
                  <div className="flex-1 pt-2">
                    <p className={`font-bold text-lg ${step.active ? 'text-gray-900' : 'text-gray-400'}`}>
                      {step.label}
                    </p>
                    {step.active && order.status === step.status && (
                      <p className="text-sm text-indigo-600 mt-1 flex items-center gap-2">
                        <Clock className="w-4 h-4 animate-pulse" />
                        In progress...
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Order Details */}
        <Card>
          <h2 className="text-xl font-bold text-gray-900 mb-4">Order Details</h2>

          <div className="space-y-3">
            {order.items.map((item: any) => (
              <div key={item.id} className="flex justify-between items-center py-3 border-b last:border-0">
                <div>
                  <p className="font-semibold text-gray-800">{item.name}</p>
                  <p className="text-sm text-gray-600">Quantity: {item.quantity}</p>
                </div>
                <p className="font-bold text-lg">Rs. {item.price * item.quantity}</p>
              </div>
            ))}
          </div>

          <div className="border-t mt-4 pt-4">
            <div className="flex justify-between items-center">
              <span className="text-xl font-bold">Total</span>
              <span className="text-2xl font-bold text-indigo-600">Rs. {order.totalAmount}</span>
            </div>
          </div>
        </Card>

        {/* Notifications */}
        {notifications.length > 0 && (
          <Card className="mt-6">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Updates</h3>
            <div className="space-y-2">
              {notifications.map((notif, index) => (
                <div key={index} className="bg-blue-50 p-3 rounded-lg text-sm text-blue-900">
                  {notif}
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default OrderTracking;