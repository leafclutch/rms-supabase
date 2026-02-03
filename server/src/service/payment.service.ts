import prisma from '../config/prisma.ts';
import { AppError } from '../utils/appError.ts';
import { OrderStatus, PaymentMethod, CreditTransactionType } from '@prisma/client';

interface Discount {
    type: 'FIXED' | 'PERCENT';
    value: number;
}

interface PaymentPayload {
    orderId: string;
    discount?: Discount;
    cashAmount?: number;
    onlineAmount?: number;
    customerPhone?: string; // For credit
}

// Helper: Calculate final payable amount
export const calculateFinalPayable = (totalAmount: number, discount?: Discount) => {
    let finalAmount = Number(totalAmount);
    let discountAmount = 0;

    if (discount) {
        if (discount.type === 'FIXED') {
            discountAmount = discount.value;
        } else if (discount.type === 'PERCENT') {
            discountAmount = (finalAmount * discount.value) / 100;
        }
        finalAmount = finalAmount - discountAmount;
    }

    // Ensure no negative amount
    finalAmount = Math.max(0, finalAmount);

    return { finalAmount, discountAmount };
};

// Helper: Validate order and get details
const getOrder = async (orderId: string) => {
    const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { payments: true }
    });

    if (!order) throw new AppError('Order not found', 404);

    // Status Validations
    if (order.status === OrderStatus.paid) throw new AppError('Order is already paid', 400);
    if (order.status === OrderStatus.cancelled) throw new AppError('Cannot pay for a cancelled order', 400);

    // Amount Validation
    if (Number(order.totalAmount) <= 0) {
        throw new AppError('Order total amount must be greater than 0 to process payment', 400);
    }

    return order;
};

// Helper: Log details for "Print Bill" (mock)
const generateBillData = (order: any, finalAmount: number, discountAmount: number, method: PaymentMethod = PaymentMethod.CASH) => {
    return {
        orderId: order.id,
        tableId: order.tableId,
        totalAmount: Number(order.totalAmount),
        discountAmount: discountAmount,
        finalPayable: finalAmount,
        paymentMethod: method,
        timestamp: new Date()
    };
};

export const processCashPayment = async ({ orderId, discount, cashAmount }: PaymentPayload) => {
    const order = await getOrder(orderId);
    const { finalAmount, discountAmount } = calculateFinalPayable(Number(order.totalAmount), discount);

    if (!cashAmount || cashAmount < finalAmount) {
        throw new AppError(`Insufficient cash amount. Expected: ${finalAmount}`, 400);
    }

    const change = cashAmount - finalAmount;

    // Transaction
    const updatedOrder = await prisma.$transaction(async (tx) => {
        // Create Payment Record
        await tx.payment.create({
            data: {
                orderId,
                method: PaymentMethod.CASH,
                cashAmount: finalAmount,
            }
        });

        // Update Order
        return await tx.order.update({
            where: { id: orderId },
            data: {
                status: OrderStatus.paid,
                discountAmount: discountAmount,
                discountValue: discount?.value || null,
                discountType: discount?.type || null,
                dueAmount: 0,
                cashAmount: finalAmount,
                paymentMethod: PaymentMethod.CASH,
            }
        });
    });


    return {
        message: 'Cash payment successful',
        change,
        bill: generateBillData(order, finalAmount, discountAmount, PaymentMethod.CASH)
    };
};

export const processOnlinePayment = async ({ orderId, discount }: PaymentPayload) => {
    const order = await getOrder(orderId);
    const { finalAmount, discountAmount } = calculateFinalPayable(Number(order.totalAmount), discount);

    const updatedOrder = await prisma.$transaction(async (tx) => {
        await tx.payment.create({
            data: {
                orderId,
                method: PaymentMethod.ONLINE,
                onlineAmount: finalAmount,
            }
        });

        return await tx.order.update({
            where: { id: orderId },
            data: {
                status: OrderStatus.paid,
                discountAmount: discountAmount,
                discountValue: discount?.value || null,
                discountType: discount?.type || null,
                dueAmount: 0,
                onlineAmount: finalAmount,
                paymentMethod: PaymentMethod.ONLINE,
            }
        });
    });


    return {
        message: 'Online payment successful',
        bill: generateBillData(order, finalAmount, discountAmount, PaymentMethod.ONLINE)
    };
};

export const processMixedPayment = async ({ orderId, discount, cashAmount, onlineAmount }: PaymentPayload) => {
    const order = await getOrder(orderId);
    const { finalAmount, discountAmount } = calculateFinalPayable(Number(order.totalAmount), discount);

    const cAmount = Number(cashAmount || 0);
    const oAmount = Number(onlineAmount || 0);

    if (Math.abs((cAmount + oAmount) - finalAmount) > 0.01) {
        throw new AppError(`Total payment (${cAmount + oAmount}) does not match final payable (${finalAmount})`, 400);
    }

    const updatedOrder = await prisma.$transaction(async (tx) => {
        await tx.payment.create({
            data: {
                orderId,
                method: PaymentMethod.MIXED,
                cashAmount: cAmount,
                onlineAmount: oAmount,
            }
        });

        return await tx.order.update({
            where: { id: orderId },
            data: {
                status: OrderStatus.paid,
                discountAmount: discountAmount,
                discountValue: discount?.value || null,
                discountType: discount?.type || null,
                dueAmount: 0,
                cashAmount: cAmount,
                onlineAmount: oAmount,
                paymentMethod: PaymentMethod.MIXED,
            }
        });
    });


    return {
        message: 'Mixed payment successful',
        bill: generateBillData(order, finalAmount, discountAmount, PaymentMethod.MIXED)
    };
};

export const processCreditPayment = async ({ orderId, customerPhone, discount }: PaymentPayload) => {
    if (!customerPhone) throw new AppError('Customer phone required for credit payment', 400);

    const order = await getOrder(orderId);
    const { finalAmount, discountAmount } = calculateFinalPayable(Number(order.totalAmount), discount);

    // Find Credit Account
    let customer = await prisma.customer.findUnique({ where: { phoneNumber: customerPhone } });
    if (!customer) {
        throw new AppError('Credit account not found. Would you like to create a credit account for this customer?', 404);
    }

    const updatedOrder = await prisma.$transaction(async (tx) => {
        // Create a CHARGE Transaction (ADD DEBT)
        await tx.creditTransaction.create({
            data: {
                customerId: customer!.id,
                orderId,
                amount: finalAmount,
                type: CreditTransactionType.CHARGE,
                description: `Order #${order.id.slice(0, 8).toUpperCase()} - Credit Charge`
            }
        });

        //  Increase Customer totalDue
        const updatedCustomer = await tx.customer.update({
            where: { id: customer!.id },
            data: {
                totalDue: { increment: finalAmount }
            }
        });

        // Mark Order as PAID (Financially closed, debt moved to ledger)
        return await tx.order.update({
            where: { id: orderId },
            data: {
                status: OrderStatus.paid,
                paymentMethod: PaymentMethod.CREDIT,
                customerId: customer!.id,
                discountAmount: discountAmount,
                discountValue: discount?.value || null,
                discountType: discount?.type || null,
                dueAmount: 0,
                creditAmount: finalAmount,
                cashAmount: 0,
                onlineAmount: 0
            }
        });
    });

    //WhatsApp Notification only log
    const newTotalDue = Number(customer.totalDue) + finalAmount;
    console.log(`[WhatsApp Mock] To: ${customerPhone} | Message: ₹${finalAmount} added to your credit. Total due: ₹${newTotalDue}`);


    return {
        message: 'Credit payment successful',
        bill: generateBillData(order, finalAmount, 0, PaymentMethod.CREDIT)
    };
};


