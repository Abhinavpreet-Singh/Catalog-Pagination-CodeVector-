import { PrismaClient } from '@prisma/client';
import { faker } from '@faker-js/faker';

const prisma = new PrismaClient();

const CATEGORIES = ['electronics', 'clothing', 'home', 'beauty', 'books', 'sports'];

async function main() {
  console.log('Starting seeding...');
  
  console.log('Cleaning up existing database...');
  await prisma.product.deleteMany({});
  
  const totalProducts = 200000;
  const chunkSize = 10000;
  const baseTime = new Date();

  for (let i = 0; i < totalProducts; i += chunkSize) {
    const products = [];
    for (let j = 0; j < chunkSize; j++) {
      const globalIndex = i + j;
      // Space out timestamps by 10 seconds per product to ensure a realistic sort order
      const date = new Date(baseTime.getTime() - globalIndex * 10000);
      
      products.push({
        name: faker.commerce.productName(),
        category: CATEGORIES[globalIndex % CATEGORIES.length],
        createdAt: date,
        updatedAt: date
      });
    }
    
    await prisma.product.createMany({
      data: products
    });
    console.log(`Inserted ${i + chunkSize} / ${totalProducts} products`);
  }
  
  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
