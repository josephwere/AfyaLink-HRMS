import dotenv from 'dotenv';
dotenv.config();

export const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';
export const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';
