import app from "../src/app.js";
import { connectToDB } from "../src/config/prisma.js";

connectToDB();

export default app;