# Cursor Pagination Backend

A Node.js/Express and PostgreSQL backend demonstrating high-performance, consistent cursor-based pagination over 200,000 products.

## Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment**:
   Ensure `.env` contains your PostgreSQL database URL:
   ```env
   DATABASE_URL="postgresql://username:password@host/db?sslmode=require"
   ```

3. **Database Migration**:
   Create tables and composite indexes in PostgreSQL:
   ```bash
   npx prisma migrate dev --name init
   ```

4. **Seed Database**:
   Populate the database with 200,000 products (takes ~30-60s):
   ```bash
   npm run seed
   ```

## Running the Application

*   **Start Server**:
    ```bash
    npm start
    ```
*   **Run Integration Tests**:
    Tests verification of page-to-page consistency, real-time insertion handling, and query performance:
    ```bash
    npm test
    ```

## Endpoints

*   `GET /products`
    *   **Params**: `limit` (default 20, max 100), `category` (optional), `cursor` (optional, format: `ISOStringDate_id`).
    *   **Response**: Returns `products` and `nextCursor`.
*   `POST /products`: Creates a new product (JSON body: `name`, `category`).
*   `PUT /products/:id`: Updates a product's name/category (shifts its pagination order).
