import type { Request, Response, NextFunction } from 'express';
import * as adminService from '../service/admin.service.ts';

export const getActiveOrders = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await adminService.getActiveOrdersService();
        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};

export const serveOrder = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { orderId } = req.params;
        if (!orderId || typeof orderId !== 'string') throw new Error('Valid Order ID is required'); // Should be handled by route param usually
        const result = await adminService.serveOrderService(orderId);


        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};

export const preparingOrder = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { orderId } = req.params;
        if (!orderId || typeof orderId !== 'string') throw new Error('Valid Order ID is required');
        const result = await adminService.preparingOrderService(orderId);


        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};

export const getBill = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { orderId } = req.params;
        if (!orderId || typeof orderId !== 'string') throw new Error('Valid Order ID is required');
        const result = await adminService.getBillService(orderId);
        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};
export const reduceOrderItem = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { orderId, menuItemId } = req.params;
        const { quantity } = req.body;
        if (!orderId || !menuItemId) throw new Error('Order ID and Menu Item ID are required');
        const result = await adminService.reduceOrderItemService(orderId as string, menuItemId as string, quantity || 1);
        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};

export const cancelOrderItem = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { orderId, menuItemId } = req.params;
        if (!orderId || !menuItemId) throw new Error('Order ID and Menu Item ID are required');
        const result = await adminService.cancelOrderItemService(orderId as string, menuItemId as string);
        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};

export const getOrderHistory = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await adminService.getOrderHistoryService();
        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};

export const addItemsToOrder = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { orderId } = req.params;
        const { items } = req.body;
        if (!orderId) throw new Error('Order ID is required');
        if (!items || !Array.isArray(items)) throw new Error('Items array is required');
        const result = await adminService.addItemsToOrderService(orderId as string, items);
        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};
