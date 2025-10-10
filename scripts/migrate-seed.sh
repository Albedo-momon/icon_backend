#!/bin/bash

echo "🚀 Starting database migration and seed..."

# Run Prisma migrations
echo "📦 Running Prisma migrations..."
npx prisma migrate dev --name init

# Run seed script
echo "🌱 Running seed script..."
npx prisma db seed

echo "✅ Migration and seed completed successfully!"