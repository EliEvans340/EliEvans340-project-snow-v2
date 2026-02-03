# ProjectSnow

US Ski Resort Guide - Live snow reports, conditions, and information.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/projectsnow)

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS (dark mode default, ice-blue accent colors)
- ESLint + Prettier
- Vercel (deployment)

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

## Deployment

This project is configured for deployment on [Vercel](https://vercel.com).

### Automatic Deployments

- **Production**: Pushes to `main` branch automatically deploy to production
- **Preview**: Pull requests automatically generate preview deployments with unique URLs

### Environment Variables

Configure the following environment variables in your Vercel project settings:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Neon PostgreSQL connection string |
| `NEXT_PUBLIC_APP_URL` | No | Public URL of the deployed app (auto-set by Vercel) |

#### Setting Environment Variables in Vercel

1. Go to your project in the Vercel dashboard
2. Navigate to **Settings** > **Environment Variables**
3. Add each variable with appropriate values for Production/Preview/Development

### Edge Runtime

For API routes or pages that need Edge runtime (for lower latency), add the following export:

```typescript
export const runtime = 'edge';
```

This is compatible with Vercel's Edge Network and Neon's serverless driver.

### Build Settings

The project uses default Vercel settings for Next.js:

- **Build Command**: `npm run build`
- **Output Directory**: `.next`
- **Install Command**: `npm install`
- **Development Command**: `npm run dev`
