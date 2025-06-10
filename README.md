# BlobNest Backend

BlobNest Backend is a robust, secure, and scalable API service for managing Azure Blob Storage accounts. It provides a comprehensive set of endpoints for container management, file operations, user authentication, and detailed analytics.

Frontend repository: [BlobNest Frontend](https://github.com/elkhayate/blobnest-frontend)

## Features

- **Container Management**
  - Create, read, update, and delete containers
  - Set container access levels and metadata
  - List containers with pagination and filtering

- **File Operations**
  - Upload, download, and delete files
  - File metadata management
  - File preview support
  - Batch operations

- **User Management**
  - Role-based access control (Admin, Viewer, Uploader)
  - Company-based user organization
  - Secure authentication with Supabase
  - User session management

- **Dashboard & Analytics**
  - Real-time storage metrics
  - Container statistics
  - File type distribution
  - Activity tracking
  - Change feed integration

- **Audit Logging**
  - Comprehensive activity tracking
  - Operation history
  - User action logging
  - Azure Storage change feed integration

## Technology Stack

- **Runtime**: Node.js with Express.js
- **Language**: TypeScript
- **Database**: Supabase (PostgreSQL)
- **Storage**: Azure Blob Storage
- **Authentication**: Supabase Auth
- **Validation**: Zod
- **Logging**: Winston
- **API Documentation**: OpenAPI/Swagger
- **Testing**: Jest

## Prerequisites

- Node.js (v16 or higher)
- Azure Storage Account with Blob Storage
- Supabase Account
- TypeScript
- npm or yarn
 