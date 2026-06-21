import { spawn } from 'child_process';
import { PrismaClient } from '@prisma/client';
import assert from 'assert';

const prisma = new PrismaClient();

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTests() {
  // Start the server on a test port
  const PORT = 3123;
  const env = { ...process.env, PORT: PORT.toString() };
  console.log('Spawning server process...');
  const serverProcess = spawn('node', ['server.js'], { env, stdio: 'inherit' });

  serverProcess.on('error', (err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });

  serverProcess.on('exit', (code) => {
    if (code !== null && code !== 0) {
      console.error(`Server process exited unexpectedly with code ${code}`);
      process.exit(1);
    }
  });

  // Give the server 3 seconds to start up
  await delay(3000);

  const baseUrl = `http://127.0.0.1:${PORT}`;

  try {
    console.log('\n--- Test 1: Fetching Page 1 ---');
    const res1 = await fetch(`${baseUrl}/products?limit=5`);
    const data1 = await res1.json();
    assert.strictEqual(data1.products.length, 5, 'Page 1 should return 5 products');
    console.log('Page 1 fetched successfully. First product:', data1.products[0].name);

    const page1Ids = new Set(data1.products.map(p => p.id));
    const nextCursor = data1.nextCursor;
    assert.ok(nextCursor, 'Should return a nextCursor');
    console.log(`Page 1 nextCursor: ${nextCursor}`);

    console.log('\n--- Test 2: Fetching Page 2 ---');
    const res2 = await fetch(`${baseUrl}/products?limit=5&cursor=${nextCursor}`);
    const data2 = await res2.json();
    assert.strictEqual(data2.products.length, 5, 'Page 2 should return 5 products');
    
    for (const p of data2.products) {
      assert.ok(!page1Ids.has(p.id), `Duplicate product found on Page 2: ${p.name}`);
    }
    console.log('Page 2 fetched successfully. No duplicates found.');

    console.log('\n--- Test 3: Simulating Real-time Insertion ---');
    const resCreate = await fetch(`${baseUrl}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Brand New iPhone 18', category: 'electronics' }),
    });
    const newProduct = await resCreate.json();
    console.log(`Created new product: ${newProduct.name} (${newProduct.id})`);

    console.log('Fetching Page 2 again with the same cursor...');
    const res2Again = await fetch(`${baseUrl}/products?limit=5&cursor=${nextCursor}`);
    const data2Again = await res2Again.json();
    
    const containsNewProduct = data2Again.products.some(p => p.id === newProduct.id);
    assert.strictEqual(containsNewProduct, false, 'Newly created product should NOT appear on Page 2 when using the old cursor');
    console.log('Verified: New product did not bleed into Page 2 (no duplicate or shift).');

    console.log('\n--- Test 4: Simulating Real-time Update ---');
    const productToUpdate = data2.products[0];
    console.log(`Updating product: ${productToUpdate.name} to shift its position to newest...`);
    
    const resUpdate = await fetch(`${baseUrl}/products/${productToUpdate.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: productToUpdate.name + ' (Updated)' }),
    });
    const updatedProduct = await resUpdate.json();
    console.log(`Product updated. New updatedAt: ${updatedProduct.updatedAt}`);

    // Fetch Page 2 again with the same cursor
    console.log('Fetching Page 2 again with the same cursor to verify updated product shifted out...');
    const res2AfterUpdate = await fetch(`${baseUrl}/products?limit=5&cursor=${nextCursor}`);
    const data2AfterUpdate = await res2AfterUpdate.json();
    
    const containsUpdatedProduct = data2AfterUpdate.products.some(p => p.id === productToUpdate.id);
    assert.strictEqual(containsUpdatedProduct, false, 'Updated product should have shifted out of Page 2');
    console.log('Verified: Updated product shifted out of Page 2 correctly.');

    console.log('\n--- Test 5: Measuring Query Performance ---');
    const start = Date.now();
    const resPerf = await fetch(`${baseUrl}/products?limit=100&category=electronics`);
    const dataPerf = await resPerf.json();
    const duration = Date.now() - start;
    console.log(`Retrieved ${dataPerf.products.length} products. Total request duration: ${duration}ms`);
    console.log(`Server-side query processing time (serverDurationMs): ${dataPerf.meta.serverDurationMs}`);
    
    console.log('\n=============================================');
    console.log('All pagination consistency and performance tests PASSED!');
    console.log('=============================================');
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  } finally {
    console.log('Cleaning up server process...');
    serverProcess.kill();
    await prisma.$disconnect();

    await delay(500);
    process.exit(0);
  }
}

runTests();
