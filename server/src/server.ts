process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import app from "./app.js";
import { connectToDB } from "./config/prisma.ts";
import { createServer } from 'http';

const PORT = process.env.PORT;

const startServer = async () => {
    await connectToDB();

    const server = createServer(app);

    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });

    setInterval(() => { }, 1000 * 60 * 60);
};

startServer();