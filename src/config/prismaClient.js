// import { PrismaClient } from "@prisma/client";

// ✅ Initialize Prisma Client
// const prisma = new PrismaClient();

// export default prisma;

import { PrismaClient as UserClient } from '../../prisma/generated/userClient/index.js';  // Adjust path if needed
import { PrismaClient as CatalogClient } from '../../prisma/generated/catalogClient/index.js';

const userDb = new UserClient();
const  catalogDb = new CatalogClient();

export { userDb,  catalogDb };

