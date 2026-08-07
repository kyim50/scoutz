# Community Map Assistant - Backend

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Required environment variables:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anon key
- `SUPABASE_SERVICE_KEY` - Supabase service role key
- `OPENAI_API_KEY` - OpenAI API key
- `MAPBOX_TOKEN` - Mapbox token
- `AWS_*` - AWS credentials for S3
- `JWT_SECRET` - Secret for JWT tokens

**Supabase magic link (app uses this when `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY` are set):**
- Supabase sends the email. Clicking the link verifies and opens the app; session is stored so opening the app again also logs you in.
- In Supabase Dashboard → **Authentication** → **URL Configuration**, add `cite://auth/callback` to **Redirect URLs**.
- On iOS the link often opens the app without the token (fragment stripped). To fix: host `docs/supabase-auth-redirect.html` at a URL, add that URL to Supabase Redirect URLs, and set `EXPO_PUBLIC_SUPABASE_REDIRECT_URL` in the frontend `.env`. The page redirects instantly to the app with the token.

Optional (if not using Supabase magic link – backend sends email):
- `SMTP_*` - To send magic link emails from the backend. `MAGIC_LINK_APP_SCHEME` (default `cite`), `SMTP_FROM`, `MAGIC_LINK_BASE_URL`.

### 3. Database Setup

Make sure your Supabase database has:
- PostGIS extension enabled
- pgvector extension enabled
- All tables from DATABASE_SCHEMA.md created
- Stored procedures created (get_nearby_pins, get_upcoming_events)

### 4. Run Development Server

```bash
npm run dev
```

Server will start on `http://localhost:3000`

### 5. Test the API

```bash
curl http://localhost:3000/health
```

## API Endpoints

### Authentication (magic link)
- With Supabase: frontend uses `signInWithOtp`; Supabase sends the email. Link opens the app (or a tiny redirect page first on iOS) and the app signs the user in; session is persisted so reopening the app keeps them logged in.
- `POST /api/auth/pending-signup` - Store name/username before Supabase signup (body: `{ "email", "name", "username?" }`). No auth required.
- `POST /api/auth/magic-link` - Backend login magic link (body: `{ "email" }`) – used when Supabase is not configured.
- `POST /api/auth/signup-magic-link` - Backend signup magic link – used when Supabase is not configured.
- `POST /api/auth/verify-magic-link` - Exchange backend token for JWT (body: `{ "token" }`)
- `POST /api/auth/refresh` - Refresh token
- `GET /api/auth/me` - Get current user (accepts backend JWT or Supabase access token)

### Search
- `POST /api/search` - AI-powered natural language search
- `GET /api/search/pins` - Direct pin search
- `GET /api/search/events` - Direct event search

### Pins
- `POST /api/pins` - Create pin
- `GET /api/pins/nearby` - Get nearby pins
- `GET /api/pins/:id` - Get pin details
- `PUT /api/pins/:id` - Update pin
- `DELETE /api/pins/:id` - Delete pin
- `POST /api/pins/:id/verify` - Verify pin

### Events
- `POST /api/events` - Create event
- `GET /api/events/upcoming` - Get upcoming events

## Project Structure

```
backend/
├── src/
│   ├── config/           # Configuration files (Supabase, OpenAI, AWS)
│   ├── controllers/      # Request handlers
│   ├── middleware/       # Express middleware (auth, validation, etc.)
│   ├── routes/           # API route definitions
│   ├── services/         # Business logic services
│   ├── utils/            # Utility functions
│   └── index.ts          # Application entry point
├── package.json
├── tsconfig.json
└── .env.example
```

## Development

### Run tests
```bash
npm test
```

### Lint code
```bash
npm run lint
```

### Format code
```bash
npm run format
```

### Build for production
```bash
npm run build
npm start
```

## Deployment

See main documentation for AWS deployment instructions.

## Notes

- Rate limiting is enabled (60 req/min for general, 30 for search, 10 for uploads)
- All endpoints return JSON in standardized format
- Authentication uses JWT tokens (15min expiry, with refresh tokens)
- Logging is configured with Winston
- Error handling is centralized

## Need Help?

Refer to the main documentation in `/docs` folder.
