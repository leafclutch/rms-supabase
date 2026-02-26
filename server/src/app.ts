import express from "express";
const app = express();
import cors from 'cors';
import authRoutes from './routes/auth.router.js';
import tableRoutes from './routes/table.router.js';
import menuRoutes from './routes/menu.router.js';
import paymentRoutes from './routes/payment.router.js';
import orderRoutes from './routes/order.router.js';
import adminRoutes from './routes/admin.router.js';
import inventoryRoutes from './routes/inventory.router.js';
import reportsRoutes from './routes/reports.router.js';

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/public', express.static('public'));



app.use('/auth', authRoutes);
app.use('/tables', tableRoutes);
app.use('/menu', menuRoutes);
app.use('/payments', paymentRoutes);
app.use('/orders', orderRoutes);
app.use('/admin/inventory', inventoryRoutes);
app.use('/admin/reports', reportsRoutes);
app.use('/admin', adminRoutes);


app.get('/', (req, res) => {
  res.status(200).json({
    message: "API is running"
  });
});

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    status: err.status || 'error',
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

export default app;