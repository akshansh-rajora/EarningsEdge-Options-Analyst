# EarningsEdge — Options Analyst

Options analyst web app powered by historical CSV data (2013-2022). This tool helps options traders make better earnings plays by analyzing historical price data and volatility metrics (https://earnings-edge-options-analyst.vercel.app).

## Features

- **Historical Data**: Uses CSV file with 2013-2022 price data for 5 stocks (AAPL, DIS, FMC, KO, ORA)
- **Historical Volatility Analysis**: Computes 30-day historical volatility and HV rank
- **Deterministic Analysis**: Generates options trade strategies based on volatility metrics
- **Real-time Scoring**: Provides confidence scores and multi-dimensional analysis
- **Strategy Recommendations**: Suggests specific options strategies with entry timing and risk management

## Project Structure

### Frontend (`frontend/`)
- **src/App.tsx** — Main React component with dark teal theme
- **src/main.tsx** — React entry point
- **index.html** — HTML template
- **vite.config.ts** — Vite configuration with API proxy
- **package.json** — Frontend dependencies

### Backend (`backend/`)
- **analyse-route.ts** — Express route handler at `POST /api/analyse`. Loads CSV data, computes historical volatility metrics, and generates deterministic analysis
- **health-route.ts** — Health check endpoint
- **app.ts** — Express app setup (CORS, JSON, pino-http logging)
- **routes-index.ts** — Express router configuration
- **index.ts** — Server entry point
- **lib/logger.ts** — Pino logger configuration
- **build.mjs** — ESBuild configuration
- **package.json** — Backend dependencies
- **data.csv** — Historical price data file (2013-2022)

## Setup Instructions

### Prerequisites
- Node.js 20+
- npm or pnpm
- CSV data file (2526ADFTcourseworkData.csv)

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env
```

4. Edit `.env` (optional - defaults work):
```
PORT=8080
LOG_LEVEL=info
SESSION_SECRET=your_random_secret_string_here
```

5. Ensure CSV data file is in the project root or backend directory:
```
2526ADFTcourseworkData.csv
```

5. Start the backend server:
```bash
npm run dev
```

The backend will run on `http://localhost:8080`

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The frontend will run on `http://localhost:3000` and proxy API calls to the backend.

## API Contract

`POST /api/analyse`
Body: `{ "ticker": "AAPL" }`
Returns: JSON with verdict, confidence, scoring, market data, strategy, risks, and brief.

**Available tickers:** AAPL, DIS, FMC, KO, ORA

## Historical Data

The app loads historical price data from CSV file (2013-2022) for each ticker, including:
- Daily close prices
- 180-day high/low calculations
- 30-day historical volatility
- HV rank (percentile over 180-day lookback)
- Large daily move analysis

## Deployment

### GitHub Setup

1. Initialize git repository:
```bash
git init
```

2. Add all files:
```bash
git add .
```

3. Create initial commit:
```bash
git commit -m "Initial commit: EarningsEdge AI Options Analyst"
```

4. Create a new repository on GitHub
5. Add remote origin:
```bash
git remote add origin https://github.com/your-username/earningsedge.git
```

6. Push to GitHub:
```bash
git branch -M main
git push -u origin main
```

### Deployment Options

#### Vercel (Recommended for Frontend)
1. Connect your GitHub repository to Vercel
2. Set root directory to `frontend`
3. Add environment variables for the backend API URL
4. Deploy

#### Railway/Render/Fly.io (Backend)
1. Connect your GitHub repository
2. Set root directory to `backend`
3. Add environment variables (PORT, LOG_LEVEL, etc.)
4. Upload CSV data file
5. Deploy

#### Replit (Full Stack)
1. Import the repository into Replit
2. Upload CSV data file
3. Configure the `.env` file in the Replit secrets
4. Use the Replit deployment feature

## Environment Variables

- `PORT` — Backend port to listen on (default 8080)
- `LOG_LEVEL` — Logging level (debug, info, warn, error)
- `SESSION_SECRET` — Any random string for session management
- `CSV_FILENAME` — Optional: path to CSV data file (defaults to 2526ADFTcourseworkData.csv)
- `AVAILABLE_TICKERS` — Optional: comma-separated list of available tickers (defaults to AAPL,DIS,FMC,KO,ORA)

## Tech Stack

- **Frontend**: React 18 + Vite + TypeScript
- **Backend**: Express 5 + Node.js 20+
- **Data**: CSV file (historical price data 2013-2022)
- **Styling**: Inline CSS with dark teal theme
- **Logging**: Pino with pino-http

## Educational Use Only

This tool is for educational purposes only and does not constitute financial advice. Always do your own research and consult with a qualified financial advisor before making trading decisions.
