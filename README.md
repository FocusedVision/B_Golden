# Golden Reputation Backend

A Google-compliant review request and reputation management SaaS platform for self-storage facilities.

## Features

- Review Request Engine
- Automated Messaging (SMS/Email)
- Admin Dashboard
- Facility & Tenant Data Management
- Review Funnel Page
- Cubby PMS Integration
- Google My Business Integration

## Prerequisites

- Node.js (v14 or higher)
- PostgreSQL (v12 or higher)
- Google Cloud Platform account
- Twilio account (for SMS)
- SendGrid account (for email)

## Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd golden-reputation-backend
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env
```
Edit `.env` with your configuration values.

4. Run database migrations:
```bash
npm run migrate
```

5. Start the development server:
```bash
npm run dev
```

## Development

- `npm run dev` - Start development server with hot reload
- `npm run test` - Run tests
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

## API Documentation

### Health Checks
- `GET /health` - Basic health check
- `GET /health/db` - Database health check

## Environment Variables

See `.env.example` for all required environment variables.

## Contributing

1. Create a feature branch
2. Make your changes
3. Run tests and linting
4. Submit a pull request

## License

[Your License Here]