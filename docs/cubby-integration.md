# Cubby PMS Integration Documentation

## Overview
The Cubby PMS integration provides a robust connection between our system and Cubby Property Management System. It handles facility and tenant synchronization, webhook processing, and provides comprehensive monitoring capabilities.

## Setup

### Prerequisites
- Node.js 14.x or higher
- PostgreSQL database
- Cubby PMS API credentials

### Environment Variables
Configure the following environment variables in your `.env` file:

```env
# Cubby PMS API Configuration
CUBBY_API_URL=https://api.cubbypms.com/v1
CUBBY_API_KEY=your_api_key_here
CUBBY_WEBHOOK_SECRET=your_webhook_secret_here

# Optional Configuration
CUBBY_SYNC_SCHEDULE="0 */6 * * *"  # Default: Every 6 hours
```

### Installation
1. Install dependencies:
```bash
npm install
```

2. Initialize the database:
```bash
npm run db:migrate
```

3. Start the server:
```bash
npm start
```

## API Endpoints

### Authentication
All endpoints except webhooks require authentication using JWT tokens.

### Facility Management

#### Get All Facilities
```http
GET /cubby/facilities
Authorization: Bearer <token>
```
Response:
```json
{
    "facilities": [
        {
            "id": "string",
            "name": "string",
            "gmb_place_id": "string",
            "gmb_link": "string",
            "city": "string",
            "state": "string",
            "timezone": "string",
            "context_notes": "string",
            "created_at": "datetime",
            "updated_at": "datetime"
        }
    ]
}
```

#### Get Facility Details
```http
GET /cubby/facilities/:facilityId
Authorization: Bearer <token>
```

#### Sync Facilities
```http
POST /cubby/sync/facilities
Authorization: Bearer <token>
```
Response:
```json
{
    "message": "Facility sync completed",
    "details": {
        "successCount": 10,
        "failureCount": 0,
        "total": 10
    }
}
```

### Tenant Management

#### Get Facility Tenants
```http
GET /cubby/tenants/:facilityId
Authorization: Bearer <token>
```

#### Get Tenant Details
```http
GET /cubby/tenants/:tenantId
Authorization: Bearer <token>
```

#### Sync Tenants
```http
POST /cubby/sync/tenants/:facilityId
Authorization: Bearer <token>
```
Response:
```json
{
    "message": "Tenant sync completed",
    "details": {
        "successCount": 50,
        "failureCount": 0,
        "total": 50
    }
}
```

### Webhooks

#### Webhook Endpoint
```http
POST /cubby/webhook
X-Cubby-Signature: <signature>
```
Supported events:
- `tenant.created`
- `tenant.updated`
- `facility.created`
- `facility.updated`

### Monitoring

#### Get Metrics
```http
GET /cubby/metrics
Authorization: Bearer <token>
```
Response:
```json
{
    "cubby": {
        "apiCalls": {
            "total": 1000,
            "success": 990,
            "failure": 10,
            "byEndpoint": {
                "/api/v1/facilities": {
                    "total": 100,
                    "success": 98,
                    "failure": 2,
                    "avgDuration": 250
                }
            }
        },
        "sync": {
            "facilities": {
                "total": 50,
                "success": 48,
                "failure": 2,
                "lastSync": "2024-03-14T12:00:00Z",
                "duration": [250, 300, 280]
            },
            "tenants": {
                "total": 500,
                "success": 495,
                "failure": 5,
                "lastSync": "2024-03-14T12:00:00Z",
                "duration": [1200, 1300, 1250]
            }
        },
        "webhooks": {
            "total": 100,
            "success": 98,
            "failure": 2,
            "byEvent": {
                "tenant.created": {
                    "total": 50,
                    "success": 49,
                    "failure": 1
                }
            }
        }
    }
}
```

#### Health Check
```http
GET /cubby/health
Authorization: Bearer <token>
```
Response:
```json
{
    "status": "healthy",
    "details": {
        "facilitySync": {
            "status": "healthy",
            "lastSync": "2024-03-14T12:00:00Z",
            "successRate": 98.5
        },
        "tenantSync": {
            "status": "healthy",
            "lastSync": "2024-03-14T12:00:00Z",
            "successRate": 99.2
        },
        "api": {
            "status": "healthy",
            "successRate": 99.8
        }
    }
}
```

## Error Handling

### HTTP Status Codes
- 200: Success
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 500: Internal Server Error

### Error Response Format
```json
{
    "error": "Error message",
    "details": "Detailed error information"
}
```

## Monitoring and Alerts

### Health Checks
The system performs the following health checks:
- Facility sync within last 6 hours
- Tenant sync within last 6 hours
- API success rate above 95%

### Metrics
The following metrics are tracked:
- API call success/failure rates
- Sync operation success/failure rates
- Webhook processing success/failure rates
- Operation durations
- Per-endpoint performance

### Logging
All operations are logged with the following information:
- Operation type
- Success/failure status
- Duration
- Error details (if any)

## Best Practices

### Webhook Configuration
1. Configure webhook URL in Cubby PMS dashboard
2. Set webhook secret in environment variables
3. Verify webhook signature in requests
4. Handle webhook events asynchronously

### Sync Operations
1. Run initial sync after setup
2. Monitor sync operations through metrics
3. Set up alerts for failed syncs
4. Review sync logs regularly

### Error Handling
1. Implement retry logic for transient failures
2. Log all errors with context
3. Monitor error rates through metrics
4. Set up alerts for high error rates

## Troubleshooting

### Common Issues

#### Sync Failures
1. Check API credentials
2. Verify network connectivity
3. Review error logs
4. Check data validation

#### Webhook Issues
1. Verify webhook signature
2. Check webhook URL configuration
3. Review webhook logs
4. Test webhook endpoint

#### Performance Issues
1. Monitor API response times
2. Check sync operation durations
3. Review database performance
4. Analyze error rates

## Support

For support issues:
1. Check the logs for error details
2. Review the metrics for performance issues
3. Contact the development team
4. Provide relevant logs and metrics data 