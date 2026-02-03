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

// Redundant service removed. Use order.service.ts for all order creations.





export const getActiveOrdersService = async () => {
    // Fetch orders with status pending, preparing, served
    const orders = await prisma.order.findMany({
        where: {
            status: { in: ['pending', 'preparing', 'served'] }
        },
        include: {
            table: true,
            items: {
                include: { menuItem: true }
            }
        },
        orderBy: { createdAt: 'desc' }
    });
    return { orders };
};

export const serveOrderService = async (orderId: string) => {
    const order = await prisma.order.update({
        where: { id: orderId },
        data: { status: 'served' }
    });


    return { message: 'Order marked as served', order };
};

export const preparingOrderService = async (orderId: string) => {
    const order = await prisma.order.update({
        where: { id: orderId },
        data: { status: 'preparing' }
    });


    return { message: 'Order is being prepared', order };
};

export const getBillService = async (orderId: string) => {
    const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
            items: { include: { menuItem: true } },
            table: true
        }
    });
    if (!order) throw new AppError('Order not found', 404);

    return { order };
};

const recalculateOrderTotal = async (orderId: string, tx?: any) => {
    const p = tx || prisma;
    const items = await p.orderItem.findMany({
        where: { orderId }
    });

    const totalAmount = items.reduce((acc: number, item: any) => {
        return acc + (Number(item.priceSnapshot) * item.quantity);
    }, 0);

    await p.order.update({
        where: { id: orderId },
        data: { totalAmount }
    });

    return totalAmount;
};

export const reduceOrderItemService = async (orderId: string, menuItemId: string, quantity: number) => {
    return await prisma.$transaction(async (tx: any) => {
        const orderItem = await tx.orderItem.findFirst({
            where: { orderId, menuItemId }
        });

        if (!orderItem) throw new AppError('Item not found in order', 404);

        if (orderItem.quantity <= quantity) {
            // Remove item if quantity becomes 0 or less
            await tx.orderItem.delete({ where: { id: orderItem.id } });
        } else {
            // Reduce quantity
            await tx.orderItem.update({
                where: { id: orderItem.id },
                data: { quantity: { decrement: quantity } }
            });
        }

        const newTotal = await recalculateOrderTotal(orderId, tx);


        return { message: 'Item quantity reduced', newTotal };
    });
};

export const cancelOrderItemService = async (orderId: string, menuItemId: string) => {
    return await prisma.$transaction(async (tx: any) => {
        const orderItem = await tx.orderItem.findFirst({
            where: { orderId, menuItemId }
        });

        if (!orderItem) throw new AppError('Item not found in order', 404);

        await tx.orderItem.delete({ where: { id: orderItem.id } });

        const newTotal = await recalculateOrderTotal(orderId, tx);


        return { message: 'Item removed from order', newTotal };
    });
};

export const getOrderHistoryService = async () => {
    const [orders, creditTransactions, debtSettlements] = await Promise.all([
        prisma.order.findMany({
            where: { status: 'paid' },
            include: {
                table: true,
                items: { include: { menuItem: true } }
            },
            orderBy: { updatedAt: 'desc' }
        }),
        prisma.creditTransaction.findMany({
            orderBy: { createdAt: 'desc' }
        }),
        prisma.debtSettlement.findMany({
            orderBy: { createdAt: 'desc' }
        })
    ]);
    return { orders, creditTransactions, debtSettlements };
};

export const addItemsToOrderService = async (orderId: string, items: { menuItemId: string, quantity: number }[]) => {
    return await prisma.$transaction(async (tx: any) => {
        const order = await tx.order.findUnique({ where: { id: orderId } });
        if (!order) throw new AppError('Order not found', 404);
        if (order.status === 'paid' || order.status === 'cancelled') {
            throw new AppError('Cannot add items to a completed or cancelled order', 400);
        }

        for (const item of items) {
            const menuItem = await tx.menuItem.findUnique({ where: { id: item.menuItemId } });
            if (!menuItem) continue;

            const existingItem = await tx.orderItem.findFirst({
                where: { orderId, menuItemId: item.menuItemId }
            });

            if (existingItem) {
                await tx.orderItem.update({
                    where: { id: existingItem.id },
                    data: { quantity: { increment: item.quantity } }
                });
            } else {
                await tx.orderItem.create({
                    data: {
                        orderId,
                        menuItemId: item.menuItemId,
                        quantity: item.quantity,
                        priceSnapshot: menuItem.price
                    }
                });
            }
        }

        const newTotal = await recalculateOrderTotal(orderId, tx);


        return { message: 'Items added to order', newTotal };
    });
};
