import app from "../src/app.ts";
import { connectToDB } from "../src/config/prisma.ts";

// Initialize DB connection (warm up)
connectToDB();

export default app;
