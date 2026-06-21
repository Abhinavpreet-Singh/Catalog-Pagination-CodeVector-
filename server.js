import express from 'express';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { performance } from 'perf_hooks';

dotenv.config();

const prisma = new PrismaClient({
  // Log queries to verify indexes are being used and monitor performance
  log: [
    { level: 'query', emit: 'event' },
    { level: 'info', emit: 'stdout' },
    { level: 'warn', emit: 'stdout' },
    { level: 'error', emit: 'stdout' },
  ],
});

// Bind query events to print SQL execution time in the terminal
prisma.$on('query', (e) => {
  console.log(`Query: ${e.query} | Duration: ${e.duration}ms`);
});

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// GET /products
app.get('/products', async (req, res) => {
  const startTime = performance.now();
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const category = req.query.category;
    const cursor = req.query.cursor;

    const whereClause = {};
    if (category) {
      whereClause.category = category;
    }

    if (cursor) {
      const parts = cursor.split('_');
      if (parts.length >= 2) {
        const cursorTimeStr = parts[0];
        const cursorId = parts.slice(1).join('_');
        const cursorTime = new Date(cursorTimeStr);

        if (!isNaN(cursorTime.getTime()) && cursorId) {
          whereClause.OR = [
            {
              updatedAt: { lt: cursorTime },
            },
            {
              AND: [
                { updatedAt: cursorTime },
                { id: { lt: cursorId } },
              ],
            },
          ];
        }
      }
    }

    const products = await prisma.product.findMany({
      where: whereClause,
      orderBy: [
        { updatedAt: 'desc' },
        { id: 'desc' },
      ],
      take: limit,
    });

    let nextCursor = null;
    if (products.length === limit) {
      const lastProduct = products[products.length - 1];
      nextCursor = `${lastProduct.updatedAt.toISOString()}_${lastProduct.id}`;
    }

    const endTime = performance.now();
    const serverDurationMs = (endTime - startTime).toFixed(2);

    res.json({
      products,
      nextCursor,
      meta: {
        count: products.length,
        limit,
        serverDurationMs: `${serverDurationMs}ms`,
      },
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/products', async (req, res) => {
  try {
    const { name, category } = req.body;
    if (!name || !category) {
      return res.status(400).json({ error: 'Name and category are required' });
    }

    const product = await prisma.product.create({
      data: {
        name,
        category,
      },
    });

    res.status(201).json(product);
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category } = req.body;

    const product = await prisma.product.update({
      where: { id },
      data: {
        ...(name ? { name } : {}),
        ...(category ? { category } : {}),
      },
    });

    res.json(product);
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const product = await prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(product);
  } catch (error) {
    console.error('Error retrieving product:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
