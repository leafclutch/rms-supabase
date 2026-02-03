import prisma from '../config/prisma.ts';
import { AppError } from '../utils/appError.ts';

interface OrderItemInput {
    menuItemId: string;
    quantity: number;
}

interface CreateOrderInput {
    tableCode: string;
    customerType: 'DINE_IN' | 'WALK_IN' | 'ONLINE';
    items: OrderItemInput[];
    mobileNumber?: string;
    customerName?: string;
}

export const createOrUpdateOrderService = async (data: CreateOrderInput) => {
    const { tableCode, items, mobileNumber, customerName, customerType } = data;
    let targetTableCode = tableCode;

    // 1. Resolve Customer Account (if mobile number provided)
    let customerId: string | undefined = undefined;
    if (mobileNumber) {
        const customer = await prisma.customer.findUnique({ where: { phoneNumber: mobileNumber } });
        if (customer) {
            customerId = customer.id;
        }
    }

    // 2. Intelligent Walk-in Merging
    if (customerType === 'WALK_IN' && !targetTableCode && (customerId || mobileNumber || customerName)) {
        // Search for an active order already associated with this customer
        // We prioritize customerId if found, otherwise name/phone combination
        const activeWalkInOrder = await prisma.order.findFirst({
            where: {
                OR: [
                    customerId ? { customerId } : {},
                    mobileNumber ? { customerPhone: mobileNumber } : {},
                    customerName ? { customerName } : {}
                ].filter(condition => Object.keys(condition).length > 0),
                status: { in: ['pending', 'preparing', 'served'] }
            },
            include: { table: true }
        });

        if (activeWalkInOrder) {
            targetTableCode = activeWalkInOrder.table.tableCode;
        }
    }

    if (customerType === 'WALK_IN' && !targetTableCode) {
        // Generate a new unique virtual table only if no active order found
        targetTableCode = `WALKIN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    }

    if (!targetTableCode) {
        if (customerType === 'ONLINE') {
            // Generate unique table code for online orders to prevent merging
            // If phone is provided, use it to group orders for that user, otherwise unique timestamp
            if (mobileNumber) {
                targetTableCode = `ONLINE-${mobileNumber}`;
            } else {
                targetTableCode = `ONLINE-${Date.now()}`;
            }
        }
        else throw new AppError('Table code is required', 400);
    }

    // 3. Find or Create Table (Virtual if needed)
    let table = await prisma.table.findUnique({ where: { tableCode: targetTableCode } });
    if (!table) {
        if (customerType === 'ONLINE' || customerType === 'WALK_IN') {
            const { v4: uuidv4 } = await import('uuid');
            const tableTypeMap: any = {
                'DINE_IN': 'PHYSICAL',
                'WALK_IN': 'WALK_IN',
                'ONLINE': 'ONLINE'
            };

            table = await prisma.table.create({
                data: {
                    tableCode: targetTableCode,
                    tableType: tableTypeMap[customerType] || 'PHYSICAL',
                    qrToken: uuidv4(),
                }
            });
        } else {
            throw new AppError(`Table with code "${targetTableCode}" not found. Please ensure the table is registered in the system.`, 400);
        }
    }

    // 4. Check for OPEN (pending/preparing/served) order on this table.
    const activeStatuses: any[] = ['pending', 'preparing', 'served'];

    let order: any = await prisma.order.findFirst({
        where: {
            tableId: table.id,
            status: { in: activeStatuses },
        },
        include: { items: true }
    });

    // 5. Create or Update
    if (!order) {
        order = await prisma.order.create({
            data: {
                tableId: table.id,
                customerId: customerId ?? null,
                customerName: customerName ?? null,
                customerPhone: mobileNumber ?? null,
                status: 'pending',
            },
            include: { items: true }
        });
    } else {
        // Update existing order info if provided
        await prisma.order.update({
            where: { id: order.id },
            data: {
                customerName: customerName ?? order.customerName,
                customerPhone: mobileNumber ?? order.customerPhone,
                customerId: customerId ?? order.customerId,
                // Reset status to pending if it was served or preparing, so admin sees "Start Preparing" again for new items
                status: (order.status === 'served' || order.status === 'preparing') ? 'pending' : order.status
            }
        });
    }

    if (!order) throw new AppError('Failed to create or retrieve order', 500);

    // Track added items for notification
    const addedItemsForNotify: { name: string; quantity: number }[] = [];

    // Add Items
    for (const item of items) {
        // Fetch price
        const menuItem = await prisma.menuItem.findUnique({ where: { id: item.menuItemId } });
        if (!menuItem) continue;

        const price = Number(menuItem.price);

        // Upsert OrderItem: If same item exists in order, increment qty
        const existingItem = await prisma.orderItem.findFirst({
            where: { orderId: order.id, menuItemId: item.menuItemId }
        });

        if (existingItem) {
            await prisma.orderItem.update({
                where: { id: existingItem.id },
                data: { quantity: { increment: item.quantity } }
            });
        } else {
            await prisma.orderItem.create({
                data: {
                    orderId: order.id,
                    menuItemId: item.menuItemId,
                    quantity: item.quantity,
                    priceSnapshot: price
                }
            });
        }

        // Add to notification list
        addedItemsForNotify.push({
            name: menuItem.name,
            quantity: item.quantity
        });
    }

    // Recalculate total from scratch to ensure accuracy and prevent double counting
    const allItems = await prisma.orderItem.findMany({
        where: { orderId: order.id },
        select: { priceSnapshot: true, quantity: true }
    });

    const calculatedTotal = allItems.reduce((acc, item) => {
        return acc + (Number(item.priceSnapshot) * item.quantity);
    }, 0);

    await prisma.order.update({
        where: { id: order.id },
        data: { totalAmount: calculatedTotal }
    });

    try {
        await import('./inventory.service.js').then(s => s.deductStockForOrderService(order.id, items));
    } catch (err) {

    }


    // Re-fetch the full order with items and table details to return to the frontend
    const fullOrder = await prisma.order.findUnique({
        where: { id: order.id },
        include: {
            items: {
                include: {
                    menuItem: {
                        select: {
                            name: true,
                            price: true
                        }
                    }
                }
            },
            table: {
                select: {
                    tableCode: true
                }
            }
        }
    });

    if (!fullOrder) throw new AppError('Order not found after creation', 500);

    return {
        message: 'Order placed successfully',
        order: {
            ...fullOrder,
            orderId: fullOrder.id, // for frontend compatibility
            totalAmount: Number(fullOrder.totalAmount)
        }
    };
};

export const getOrderService = async (id: string) => {
    const order = await prisma.order.findUnique({
        where: { id },
        include: {
            items: {
                include: {
                    menuItem: {
                        select: {
                            name: true,
                            price: true,
                            isVeg: true
                        }
                    }
                }
            }
        }
    });

    if (!order) throw new AppError('Order not found', 404);

    return { order };
};

export const cancelOrderService = async (orderId: string) => {
    const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { items: true }
    });

    if (!order) throw new AppError('Order not found', 404);
    if (order.status === 'cancelled') throw new AppError('Order is already cancelled', 400);

    // Restore inventory
    try {
        await import('./inventory.service.js').then(s => s.restoreStockForOrderService(order.id, order.items));
    } catch (err) {

    }

    const cancelledOrder = await prisma.order.update({
        where: { id: orderId },
        data: { status: 'cancelled' },
        include: { items: true }
    });


    return { message: 'Order cancelled successfully', order: cancelledOrder };
};

export const updateOrderItemQuantityService = async (orderId: string, menuItemId: string, action: 'increment' | 'decrement') => {
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order) throw new AppError('Order not found', 404);
    if (order.status === 'cancelled' || order.status === 'served' || order.status === 'paid') {
        throw new AppError('Cannot modify items for this order status', 400);
    }

    const item = order.items.find(i => i.menuItemId === menuItemId);
    if (!item) throw new AppError('Item not found in order', 404);

    if (action === 'decrement' && item.quantity <= 1) {
        // Remove item if qty becomes 0
        await prisma.orderItem.delete({ where: { id: item.id } });

        // Restore stock for 1 unit
        try {
            await import('./inventory.service.js').then(s => s.restoreStockForOrderService(orderId, [{ menuItemId, quantity: 1 }]));
        } catch (e) { }
    } else {
        const adjustment = action === 'increment' ? 1 : -1;
        await prisma.orderItem.update({
            where: { id: item.id },
            data: { quantity: { increment: adjustment } }
        });

        // Update inventory
        try {
            if (action === 'increment') {
                await import('./inventory.service.js').then(s => s.deductStockForOrderService(orderId, [{ menuItemId, quantity: 1 }]));
            } else {
                await import('./inventory.service.js').then(s => s.restoreStockForOrderService(orderId, [{ menuItemId, quantity: 1 }]));
            }
        } catch (e) { }
    }

    // Recalculate Total
    const allItems = await prisma.orderItem.findMany({ where: { orderId } });
    const newTotal = allItems.reduce((acc, i) => acc + (Number(i.priceSnapshot) * i.quantity), 0);

    const updatedOrder = await prisma.order.update({
        where: { id: orderId },
        data: { totalAmount: newTotal },
        include: { items: { include: { menuItem: true } } }
    });


    return { message: 'Order updated', order: updatedOrder };
};
