/*
Here we import PrismaClient and create an instance of it, 
which we then export and use in other files to interact with database
(like in taskService).
*/
import { PrismaClient } from '@prisma/client';

const prisma=new PrismaClient();

export default prisma;
