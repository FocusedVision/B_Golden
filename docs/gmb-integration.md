# Google My Business Integration

## Overview
This document outlines the integration with Google My Business (GMB) API, which enables our platform to manage and monitor business locations, reviews, and insights.

## Setup

### Prerequisites
1. Google Cloud Platform account
2. GMB API enabled in your project
3. Service account with GMB API access
4. Valid credentials file (JSON)

### Configuration
1. Set the following environment variables:
   ```
   GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json
   ```

2. Ensure the service account has the following OAuth scopes:
   - `https://www.googleapis.com/auth/business.manage`

## API Endpoints

### Location Management

#### GET /gmb/locations/:placeId
Fetches details for a specific location.

**Response:**
```json
{
  "name": "locations/123456789",
  "locationId": "123456789",
  "primaryPhone": "+1234567890",
  "primaryCategory": {
    "displayName": "Restaurant"
  },
  "websiteUri": "https://example.com",
  "regularHours": {
    "periods": [...]
  }
}
```

#### GET /gmb/locations/:placeId/reviews
Retrieves reviews for a location.

**Response:**
```json
{
  "reviews": [
    {
      "reviewId": "123",
      "reviewer": {
        "profilePhotoUrl": "...",
        "displayName": "John Doe"
      },
      "starRating": 5,
      "comment": "Great service!",
      "createTime": "2024-03-20T10:00:00Z"
    }
  ]
}
```

#### POST /gmb/locations/:placeId/review-link
Generates a review link for a location.

**Response:**
```json
{
  "reviewUrl": "https://search.google.com/local/writereview?placeid=123456789"
}
```

### Review Management

#### GET /gmb/locations/:placeId/verify-review
Verifies if a review exists for a tenant.

**Parameters:**
- `tenantEmail`: Email address of the tenant

**Response:**
```json
{
  "exists": true
}
```

#### POST /gmb/locations/:placeId/reviews/:reviewId/respond
Responds to a review.

**Request Body:**
```json
{
  "comment": "Thank you for your feedback!"
}
```

### Analytics and Insights

#### GET /gmb/locations/:placeId/insights
Retrieves business insights and metrics.

**Response:**
```json
{
  "metrics": {
    "views": {
      "total": 1000,
      "breakdown": {...}
    },
    "actions": {
      "total": 500,
      "breakdown": {...}
    }
  }
}
```

#### GET /gmb/locations/:placeId/review-metrics
Gets detailed review statistics.

**Response:**
```json
{
  "total": 100,
  "averageRating": 4.5,
  "ratingDistribution": {
    "1": 5,
    "2": 10,
    "3": 15,
    "4": 30,
    "5": 40
  },
  "responseRate": 85,
  "recentReviews": [...]
}
```

## Monitoring

The integration includes comprehensive metrics tracking:

1. API Call Metrics:
   - Success/failure rates
   - Response times
   - Error rates

2. Review Metrics:
   - Total reviews
   - Average rating
   - Rating distribution
   - Response rate

3. Business Metrics:
   - View counts
   - Action counts
   - Search performance

## Error Handling

The integration implements robust error handling:

1. API Errors:
   - Rate limiting
   - Authentication failures
   - Invalid requests

2. Data Validation:
   - Required fields
   - Data format
   - Business rules

3. Recovery:
   - Automatic retries
   - Fallback mechanisms
   - Error logging

## Best Practices

1. Rate Limiting:
   - Implement appropriate delays between requests
   - Use batch operations when possible
   - Monitor quota usage

2. Data Caching:
   - Cache frequently accessed data
   - Implement cache invalidation
   - Use appropriate TTLs

3. Error Recovery:
   - Implement retry logic
   - Use exponential backoff
   - Log all errors

4. Security:
   - Secure credential storage
   - Regular token rotation
   - Access control

## Troubleshooting

Common issues and solutions:

1. Authentication Errors:
   - Verify credentials file
   - Check API access
   - Validate scopes

2. Rate Limiting:
   - Implement backoff
   - Reduce request frequency
   - Use batch operations

3. Data Sync Issues:
   - Check network connectivity
   - Verify data format
   - Monitor error logs

## Support

For issues or questions:
1. Check the error logs
2. Review the metrics dashboard
3. Contact the development team 