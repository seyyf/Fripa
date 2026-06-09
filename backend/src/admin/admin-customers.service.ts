import { Injectable } from '@nestjs/common';
import { PrismaService } from '../shop/prisma.service';

export interface AdminCustomer {
  name: string;
  phone: string;
  email: string;
  address: string;
  orders: number;
  total: number;
  lastOrderAt: Date;
}

@Injectable()
export class AdminCustomersService {
  constructor(private readonly prisma: PrismaService) {}

  // Derive customers from orders (no accounts), grouped by phone (falling back to
  // email). Most recent order wins for the contact details; sorted by spend.
  async list(): Promise<AdminCustomer[]> {
    const orders = await this.prisma.order.findMany({ orderBy: { createdAt: 'desc' } });
    const byKey = new Map<string, AdminCustomer>();
    for (const o of orders) {
      const key = o.customerPhone.trim() || o.customerEmail.trim().toLowerCase() || o.id;
      const existing = byKey.get(key);
      if (existing) {
        existing.orders += 1;
        existing.total += o.total;
      } else {
        // First seen = latest order (list is desc) → use its contact + date.
        byKey.set(key, {
          name: o.customerName,
          phone: o.customerPhone,
          email: o.customerEmail,
          address: o.customerAddress,
          orders: 1,
          total: o.total,
          lastOrderAt: o.createdAt,
        });
      }
    }
    return [...byKey.values()].sort((a, b) => b.total - a.total);
  }
}
