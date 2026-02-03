
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CheckCircle, Clock, Utensils, ArrowRight } from 'lucide-react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import { useCustomerOrderStore } from '../../store/useCustomerOrderStore';
import { useCustomerCartStore } from '../../store/useCustomerCartStore';

// If session or table info needed, you may want additional imports as required.
// import { useSessionStore } from '../../store/useSessionStore';

export const OrderSuccess: React.FC = () => {
    const navigate = useNavigate();
    const { orderId } = useParams<{ orderId: string }>();
    const { getOrderById } = useCustomerOrderStore();

    // getOrderById may return undefined if orderId is missing or wrong
    const [order, setOrder] = useState<any>(() => (orderId ? getOrderById(orderId) : null));

    useEffect(() => {
        if (orderId) {
            setOrder(getOrderById(orderId));
        }
    }, [orderId, getOrderById]);

    const { addToCart } = useCustomerCartStore();

    const handleAddMoreItems = () => {
        // Add previous order items to cart
        if (order?.items) {
            order.items.forEach((item: any) => {
                // The MenuItem type (from MenuItem in ../types/menu) requires isAvailable
                addToCart({
                    id: item.id,
                    name: item.name ?? item.itemName,
                    price: item.price ?? (item.total && item.quantity ? item.total / item.quantity : 0),
                    image: item.image ?? '🍽️',
                    category: item.category ?? 'Other',
                    isVeg: item.isVeg ?? true,
                    isAvailable: item.isAvailable ?? true,
                    isSpecial: item.isSpecial ?? false,
                    department: item.department ?? 'KITCHEN',
                }, item.quantity);
            });
        }
        navigate('/menu');
    };


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

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 p-4 flex items-center justify-center">
            <div className="max-w-2xl w-full">
                <Card className="text-center">
                    <div className="py-8">
                        {/* Success Icon */}
                        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-fade-in">
                            <CheckCircle className="w-12 h-12 text-green-600" />
                        </div>

                        {/* Title */}
                        <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
                            Order Placed Successfully!
                        </h1>
                        <p className="text-lg text-gray-600 mb-8">
                            Thank you for your order
                        </p>

                        {/* Order Details */}
                        <div className="bg-gray-50 rounded-xl p-6 mb-8 text-left">
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <p className="text-sm text-gray-600 mb-1">Order Number</p>
                                    <p className="text-lg font-bold text-indigo-600">
                                        #{order.orderNumber ?? order.id}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600 mb-1">Table</p>
                                    <p className="text-lg font-bold">{order.tableNumber ?? '--'}</p>
                                </div>
                            </div>

                            <div className="border-t pt-4">
                                <p className="text-sm text-gray-600 mb-2">Order Items</p>
                                <div className="space-y-2">
                                    {(order.items || []).map((item: any) => (
                                        <div key={item.id} className="flex justify-between text-sm">
                                            <span className="text-gray-800">
                                                {item.quantity}x {item.name ?? item.itemName}
                                            </span>
                                            <span className="font-semibold">
                                                Rs. {item.total ?? (item.quantity && item.price ? item.quantity * item.price : '')}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="border-t mt-4 pt-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-lg font-bold">Total Amount</span>
                                    <span className="text-2xl font-bold text-indigo-600">
                                        Rs. {order.finalAmount ?? order.totalAmount ?? '--'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Status Timeline */}
                        <div className="bg-blue-50 rounded-xl p-6 mb-8">
                            <div className="flex items-center justify-center gap-3 mb-4">
                                <Clock className="w-5 h-5 text-blue-600 animate-pulse" />
                                <p className="font-semibold text-blue-900">
                                    Your order is being prepared
                                </p>
                            </div>
                            <p className="text-sm text-gray-600">
                                Estimated preparation time: <span className="font-semibold">15-20 minutes</span>
                            </p>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col sm:flex-row gap-4">
                            <div className="w-full sm:w-auto">
                                <Button
                                    variant="outline"
                                    onClick={handleAddMoreItems}
                                    fullWidth
                                >
                                    <span className="flex items-center justify-center gap-2">
                                        <Utensils className="w-4 h-4" />
                                        Add More Items
                                    </span>
                                </Button>

                            </div>
                            <div className="w-full sm:w-auto">
                                <Button
                                    onClick={() => navigate(`/order-tracking/${order.id ?? order.orderNumber}`)}
                                    fullWidth
                                >
                                    <span className="flex items-center justify-center gap-2">
                                        Track Order
                                        <ArrowRight className="w-4 h-4" />
                                    </span>
                                </Button>
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Additional Info */}
                <div className="mt-6 text-center">
                    <p className="text-sm text-gray-600">
                        You can add more items to your order at any time
                    </p>
                </div>
            </div>
        </div>
    );
};