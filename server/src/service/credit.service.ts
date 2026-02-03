import prisma from '../config/prisma.ts';
import { AppError } from '../utils/appError.ts';
import { CreditTransactionType } from '@prisma/client';

export const createCreditAccount = async (data: { fullName: string; phoneNumber: string }) => {
    const existing = await prisma.customer.findUnique({ where: { phoneNumber: data.phoneNumber } });
    if (existing) throw new AppError('A customer with this phone number already exists', 400);

    return await prisma.customer.create({
        data: {
            fullName: data.fullName,
            phoneNumber: data.phoneNumber,
        }
    });
};

export const searchCreditAccounts = async (query: string) => {
    return await prisma.customer.findMany({
        where: {
            OR: [
                { fullName: { contains: query, mode: 'insensitive' } },
                { phoneNumber: { contains: query } }
            ]
        }
    });
};

export const getCreditAccountDetails = async (accountId: string) => {
    const customer = await prisma.customer.findUnique({
        where: { id: accountId },
        include: {
            ledger: {
                orderBy: { createdAt: 'desc' },
                include: {
                    order: {
                        include: {
                            items: {
                                include: {
                                    menuItem: true
                                }
                            }
                        }
                    }
                }
            }
        }
    });

    if (!customer) throw new AppError('Customer not found', 404);
    return customer;
};

export const recordDebtPayment = async (accountId: string, amount: number, description?: string) => {
    return await prisma.$transaction(async (tx: any) => {
        const customer = await tx.customer.findUnique({ where: { id: accountId } });
        if (!customer) throw new AppError('Customer not found', 404);

        const paymentAmount = Number(amount);
        if (paymentAmount <= 0) throw new AppError('Payment amount must be greater than 0', 400);

        // Record the transaction
        const transaction = await tx.creditTransaction.create({
            data: {
                customerId: accountId,
                amount: paymentAmount,
                type: CreditTransactionType.PAYMENT,
                description: description || 'Debt payment settlement'
            }
        });

        // Update customer balance
        const updatedCustomer = await tx.customer.update({
            where: { id: accountId },
            data: {
                totalDue: { decrement: paymentAmount }
            }
        });

        const unpaidOrders = await tx.order.findMany({
            where: {
                customerId: accountId,
                paymentMethod: 'CREDIT',
                creditAmount: { gt: 0 }
            },
            orderBy: { createdAt: 'asc' } // Oldest first
        });

        let remainingPayment = paymentAmount;

        for (const order of unpaidOrders) {
            if (remainingPayment <= 0) break;

            const orderCredit = Number(order.creditAmount);
            const deduct = Math.min(orderCredit, remainingPayment);

            await (tx as any).order.update({
                where: { id: order.id },
                data: {
                    creditAmount: { decrement: deduct },
                    settledAmount: { increment: deduct }
                }
            });

            // Record settlement (using any cast for newly added model)
            await (tx as any).debtSettlement.create({
                data: {
                    customerId: accountId,
                    orderId: order.id,
                    amount: deduct,
                    method: 'CASH',
                    description: `Settlement for Order #${order.id.slice(0, 8)}`
                }
            });

            remainingPayment -= deduct;
        }

        return { transaction, updatedCustomer };
    });
};

export const listAllCreditAccounts = async () => {
    return await prisma.customer.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
            _count: {
                select: { ledger: true }
            },
            ledger: {
                take: 1,
                orderBy: { createdAt: 'desc' },
                select: { createdAt: true }
            }
        }
    });
};

export const updateAccount = async (accountId: string, data: { fullName?: string; phoneNumber?: string }) => {
    try {
        return await prisma.customer.update({
            where: { id: accountId },
            data
        });
    } catch (error: any) {
        if (error.code === 'P2002') {
            throw new AppError('A customer with this phone number already exists', 400);
        }
        throw error;
    }
};

export const deleteAccount = async (accountId: string) => {
    const customer = await prisma.customer.findUnique({ where: { id: accountId } });
    if (!customer) throw new AppError('Customer not found', 404);

    if (Number(customer.totalDue) !== 0) {
        throw new AppError('Cannot delete a credit account with an outstanding balance. Please settle the debt first.', 400);
    }

    return await prisma.$transaction(async (tx: any) => {
        // 1. Delete Credit Transactions (Ledger)
        await tx.creditTransaction.deleteMany({ where: { customerId: accountId } });

        // 2. Delete Debt Settlements
        await tx.debtSettlement.deleteMany({ where: { customerId: accountId } });

        // 3. Disconnect Orders (Set customerId to null to preserve order history but break FK)
        await tx.order.updateMany({
            where: { customerId: accountId },
            data: { customerId: null }
        });

        // 4. Finally, delete the customer
        return await tx.customer.delete({ where: { id: accountId } });
    });
};

export const recordCreditCharge = async (accountId: string, amount: number, description?: string) => {
    return await prisma.$transaction(async (tx: any) => {
        const customer = await tx.customer.findUnique({ where: { id: accountId } });
        if (!customer) throw new AppError('Customer not found', 404);

        const chargeAmount = Number(amount);
        if (chargeAmount <= 0) throw new AppError('Charge amount must be greater than 0', 400);

        // Record the transaction
        const transaction = await tx.creditTransaction.create({
            data: {
                customerId: accountId,
                amount: chargeAmount,
                type: CreditTransactionType.CHARGE,
                description: description || 'Manual debt entry'
            }
        });

        // Update customer balance
        const updatedCustomer = await tx.customer.update({
            where: { id: accountId },
            data: {
                totalDue: { increment: chargeAmount }
            }
        });

        return { transaction, updatedCustomer };
    });
};
