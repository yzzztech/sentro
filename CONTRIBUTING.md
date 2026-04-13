# Contributing to Sentro

Thanks for your interest in contributing. Here's how to get started.

## Development Setup

```bash
# Clone the repo
git clone https://github.com/yzzztech/sentro.git
cd sentro

# Install dependencies
npm install

# Start a local Postgres
docker run --name sentro-db \
  -e POSTGRES_USER=sentro \
  -e POSTGRES_PASSWORD=sentro \
  -e POSTGRES_DB=sentro \
  -p 5432:5432 -d postgres:16-alpine

# Set up environment
cp .env.example .env

# Push schema and generate Prisma client
cd apps/web && npx prisma db push && npx prisma generate
cd ../..

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), create your admin account, and you're live.

## Project Structure

```
sentro/
  apps/web/          # Next.js 15 dashboard + API
  packages/sdk/      # TypeScript SDK (@sentro/sdk)
  packages/sdk-python/ # Python SDK (sentro-sdk)
```

## Running Tests

**TypeScript SDK:**
```bash
cd packages/sdk
npm test                # run tests
npm run test:coverage   # run with coverage report
```

**Python SDK:**
```bash
cd packages/sdk-python
pip install pytest pytest-cov
pytest                  # runs with coverage automatically
```

## Making Changes

1. Fork the repo and create a branch (`git checkout -b my-feature`)
2. Make your changes
3. Run tests and make sure they pass
4. Commit with a clear message
5. Push and open a Pull Request

## Code Style

- TypeScript strict mode everywhere
- Prisma for all database access (no raw SQL)
- React Server Components for dashboard pages
- Tailwind CSS for styling

## Good First Issues

Look for issues labeled [`good first issue`](https://github.com/yzzztech/sentro/labels/good%20first%20issue) on GitHub.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
