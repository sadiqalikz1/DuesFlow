# DuesFlow

A comprehensive accounts payable management system built with Next.js and Firebase, designed to streamline supplier invoice tracking, payment management, and financial reporting across multiple branches.

## Overview

DuesFlow is a modern web application that helps businesses manage their accounts payable efficiently. It provides real-time tracking of outstanding invoices, automated due date calculations, payment processing with FIFO allocation, and comprehensive reporting dashboards.

## About the App

### Purpose

DuesFlow is designed to transform how businesses manage their supplier payments and accounts payable. The application serves as a centralized platform for tracking, monitoring, and managing all outstanding dues across multiple branches and suppliers, providing real-time visibility into financial obligations and payment deadlines.

### Problems It Solves

#### 1. **Manual Tracking and Data Entry Errors**
- **Problem**: Businesses using traditional methods (spreadsheets, Tally exports) face hours of manual data entry, leading to errors, duplicate entries, and inconsistent records.
- **Solution**: DuesFlow automates data import from Excel/Tally with built-in validation, reducing errors and saving significant time.

#### 2. **Lack of Real-Time Visibility**
- **Problem**: Finance teams struggle to get an up-to-date view of outstanding payables, often relying on outdated reports that don't reflect recent payments or new invoices.
- **Solution**: Real-time dashboard with live aggregation of dues, automatic status updates, and instant visibility into financial obligations.

#### 3. **Missed Payment Deadlines**
- **Problem**: Without automated tracking, businesses miss payment deadlines, resulting in late fees, damaged supplier relationships, and lost early-payment discounts.
- **Solution**: Automated due date calculation, proactive alerts for upcoming and overdue payments, and categorized views (7-day, 30-day forecasts).

#### 4. **Complex Payment Allocation**
- **Problem**: When making partial payments to suppliers, manually tracking which invoices to apply payments to is time-consuming and error-prone.
- **Solution**: Automatic FIFO (First-In-First-Out) payment allocation ensures payments are applied to the oldest invoices first, maintaining accurate records.

#### 5. **Multi-Branch Complexity**
- **Problem**: Companies with multiple branches struggle to consolidate and track payables across locations, making it difficult to understand overall financial exposure.
- **Solution**: Multi-branch support with branch-specific filtering, consolidated reporting, and the ability to view both individual branch and company-wide metrics.

#### 6. **Inadequate Reporting and Audit Trails**
- **Problem**: Generating aging reports, supplier ledgers, and payment histories requires manual compilation from multiple sources, making audits and financial planning difficult.
- **Solution**: Comprehensive reporting suite with aging analysis (0-30, 31-60, 61-90, 90+ days), supplier-wise ledgers, complete upload history, and export capabilities.

#### 7. **Supplier Relationship Management**
- **Problem**: Inconsistent credit terms, missing contact information, and lack of payment history visibility can strain supplier relationships.
- **Solution**: Centralized supplier profiles with credit terms, contact details, complete transaction history, and payment patterns.

#### 8. **Data Integrity and Security**
- **Problem**: Financial data scattered across multiple files and systems creates security risks and data integrity issues.
- **Solution**: Secure cloud-based storage with Firebase, role-based access control, atomic transactions to prevent partial data corruption, and complete audit trails.

### Who Benefits from DuesFlow?

- **Finance Teams**: Get real-time visibility into payables, automate routine tasks, and focus on strategic financial planning
- **Branch Managers**: Track branch-specific obligations and maintain supplier relationships
- **Business Owners**: Gain company-wide insights into cash flow obligations and payment trends
- **Accountants**: Access accurate, audit-ready records with complete transaction history
- **Procurement Teams**: Monitor payment status and maintain positive supplier relationships

## Key Features

### Core Functionality

- **Secure User Authentication**: Robust authentication and authorization using Firebase Auth with role-based access control (Admin, Finance Team, Branch Managers)
- **Opening Balance Import**: One-time or annual upload feature for importing existing outstanding balances from Tally via standardized Excel templates
- **Daily Purchase Upload & Validation**: Secure Excel upload system with comprehensive validation for daily invoice imports from Tally
- **Dynamic Due Date Calculation**: Automatic calculation of due dates based on invoice date + credit days
- **Atomic Batched Invoice Processing**: Firestore batched writes with full rollback capability to prevent partial data corruption
- **Partial Payment Handling (FIFO)**: Automatic allocation of payments to oldest pending invoices using First-In-First-Out logic
- **Real-time Dues Aggregation**: Live updates to statistics and dashboard metrics using Firebase Functions/Triggers
- **Interactive Dashboard & Reporting**: Multi-branch dashboard with KPIs, aging reports, supplier ledgers, and export capabilities
- **Supplier & Branch Management**: Complete supplier profile management with default credit periods and branch definitions

### Additional Features

- **Employee Management**: Track and manage employee records with role assignments
- **Debit Notes**: Create and apply debit notes to reduce outstanding balances
- **Credit Notes**: Manage credit notes from suppliers
- **Payment Recording**: Manual payment entry with automatic invoice allocation
- **Ledger Views**: Detailed supplier-wise and purchase ledger with filtering options
- **Aging Report**: Visual breakdown of overdue invoices by age ranges (0-30, 31-60, 61-90, 90+ days)
- **Export Functionality**: Export reports to Excel/PDF formats
- **Multi-Currency Support**: Configurable currency display
- **Upload History**: Complete audit trail of all data imports

## Technology Stack

### Frontend
- **Framework**: Next.js 16.2.2 (React 19.2.1)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 3.4.1
- **UI Components**: Radix UI primitives
- **Icons**: Lucide React
- **Forms**: React Hook Form + Zod validation
- **State Management**: TanStack React Query
- **Charts**: Recharts
- **Date Handling**: date-fns

### Backend
- **Database**: Firebase Firestore
- **Authentication**: Firebase Auth
- **Storage**: Firebase Storage
- **Functions**: Firebase Functions (for triggers and background processing)
- **AI Integration**: Google Genkit AI (for intelligent data processing)

### Development Tools
- **Build Tool**: Next.js with Turbopack
- **Package Manager**: npm
- **Linting**: ESLint
- **Type Checking**: TypeScript compiler

## Project Structure

```
DuesFlow/
├── .agents/                      # Agent configurations and skills
│   └── skills/
│       └── developing-genkit-js/ # Genkit AI development references
├── .idx/                         # IDE configuration
│   ├── dev.nix
│   └── icon.png
├── docs/                         # Documentation
│   ├── backend.json             # Backend API documentation
│   └── blueprint.md             # Product blueprint and specifications
├── src/
│   ├── actions/                 # Server actions
│   │   ├── employees.ts         # Employee management actions
│   │   ├── invoices.ts          # Invoice operations
│   │   ├── notes.ts             # Debit/Credit note actions
│   │   ├── payments.ts          # Payment processing
│   │   ├── suppliers.ts         # Supplier management
│   │   └── upload.ts            # File upload and processing
│   ├── ai/                      # AI/Genkit integration
│   │   ├── dev.ts              # Development server
│   │   └── genkit.ts           # Genkit configuration
│   ├── app/                     # Next.js app directory
│   │   ├── adjustments/         # Payment adjustments page
│   │   ├── api/                 # API routes
│   │   ├── branches/            # Branch management
│   │   ├── credit-notes/        # Credit notes management
│   │   ├── dashboard/           # Main dashboard
│   │   │   ├── outstanding/     # Outstanding dues view
│   │   │   ├── overdue/         # Overdue invoices view
│   │   │   ├── due-30-days/     # 30-day due forecast
│   │   │   └── due-7-days/      # 7-day due forecast
│   │   ├── debit-notes/         # Debit notes management
│   │   ├── employees/           # Employee management
│   │   ├── ledger/              # Supplier ledger
│   │   │   └── [supplierId]/    # Individual supplier ledger
│   │   ├── lib/                 # App-specific utilities
│   │   ├── login/               # Authentication pages
│   │   ├── payments/            # Payment recording
│   │   ├── purchase-ledger/     # Purchase ledger view
│   │   ├── reports/             # Reporting module
│   │   ├── settings/            # Application settings
│   │   ├── suppliers/           # Supplier management
│   │   │   └── [id]/            # Individual supplier details
│   │   ├── upload/              # Data upload interface
│   │   │   └── history/         # Upload history
│   │   ├── favicon.ico
│   │   ├── globals.css          # Global styles
│   │   ├── layout.tsx           # Root layout
│   │   └── page.tsx             # Home page
│   ├── components/              # React components
│   │   ├── dashboard/           # Dashboard-specific components
│   │   ├── employees/           # Employee components
│   │   ├── layout/              # Layout components
│   │   ├── suppliers/           # Supplier components
│   │   ├── ui/                  # Reusable UI components (Radix-based)
│   │   ├── upload/              # Upload-related components
│   │   └── FirebaseErrorListener.tsx
│   ├── firebase/                # Firebase configuration and utilities
│   │   ├── firestore/           # Firestore helpers
│   │   ├── client-provider.tsx  # Client-side Firebase provider
│   │   ├── config.ts            # Firebase configuration
│   │   ├── error-emitter.ts     # Error handling
│   │   ├── errors.ts            # Error types
│   │   ├── index.ts             # Main exports
│   │   ├── non-blocking-login.tsx
│   │   ├── non-blocking-updates.tsx
│   │   └── provider.tsx         # Firebase context provider
│   ├── hooks/                   # Custom React hooks
│   │   ├── api/                 # API hooks
│   │   ├── use-currency.ts      # Currency formatting
│   │   ├── use-mobile.tsx       # Mobile detection
│   │   ├── use-toast.ts         # Toast notifications
│   │   └── use-user-role.ts     # User role management
│   ├── lib/                     # Shared utilities and libraries
│   │   ├── api/                 # API utilities
│   │   │   ├── auth.ts          # Authentication helpers
│   │   │   ├── errors.ts        # API error handling
│   │   │   └── services.ts      # API services
│   │   ├── validations/         # Zod validation schemas
│   │   │   ├── branch.ts        # Branch validation
│   │   │   ├── employee.ts      # Employee validation
│   │   │   ├── index.ts         # Validation exports
│   │   │   ├── invoice.ts       # Invoice validation
│   │   │   ├── notes.ts         # Notes validation
│   │   │   ├── payment.ts       # Payment validation
│   │   │   └── supplier.ts      # Supplier validation
│   │   ├── firebase-admin.ts    # Firebase Admin SDK
│   │   ├── mock-data.ts         # Mock data for testing
│   │   ├── placeholder-images.json
│   │   ├── placeholder-images.ts
│   │   ├── types.ts             # TypeScript type definitions
│   │   └── utils.ts             # Utility functions
│   └── providers/               # React context providers
│       └── query-provider.tsx   # React Query provider
├── .firebaserc                  # Firebase project configuration
├── .gitignore                   # Git ignore rules
├── apphosting.yaml             # Firebase App Hosting configuration
├── components.json             # Shadcn/UI configuration
├── database.rules.json         # Realtime Database rules
├── firebase.json               # Firebase configuration
├── firestore.indexes.json      # Firestore indexes
├── firestore.rules             # Firestore security rules
├── metadata.json               # Project metadata
├── next.config.ts              # Next.js configuration
├── package.json                # Node.js dependencies
├── postcss.config.mjs          # PostCSS configuration
├── skills-lock.json            # Skills lock file
├── tailwind.config.ts          # Tailwind CSS configuration
└── tsconfig.json               # TypeScript configuration
```

## Data Models

### Core Entities

- **Branch**: Business locations with unique identifiers
- **Supplier**: Vendor profiles with contact info and default credit terms
- **Invoice**: Purchase invoices with amounts, dates, and payment status
- **Payment**: Payment records with allocation details
- **Debit Note**: Adjustments reducing outstanding balances
- **Credit Note**: Supplier credits and returns
- **Employee**: Staff records with role assignments
- **Upload History**: Audit trail of data imports

### Status Types

- **Pending**: Invoice not yet paid
- **Partially Paid**: Invoice with partial payment applied
- **Paid**: Invoice fully settled
- **Overdue**: Invoice past due date and unpaid

## Setup Instructions

### Prerequisites

- Node.js 20.x or higher
- npm or yarn package manager
- Firebase project with Firestore enabled
- Firebase CLI installed globally

### Installation

1. Clone the repository:
```bash
git clone https://github.com/sadiqalikz1/DuesFlow.git
cd DuesFlow
```

2. Install dependencies:
```bash
npm install
```

3. Configure Firebase:
   - Create a Firebase project at https://console.firebase.google.com
   - Enable Firebase Authentication
   - Enable Firestore Database
   - Copy your Firebase configuration to `src/firebase/config.ts`

4. Set up environment variables:
```bash
# Create .env.local file with your Firebase configuration
# Add necessary API keys and project credentials
```

5. Initialize Firestore rules and indexes:
```bash
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

### Development

Run the development server:
```bash
npm run dev
# Server starts on http://localhost:9002
```

Run Genkit AI development server:
```bash
npm run genkit:dev
# or with auto-reload
npm run genkit:watch
```

### Building for Production

```bash
npm run build
npm run start
```

### Code Quality

Type checking:
```bash
npm run typecheck
```

Linting:
```bash
npm run lint
```

## Security

### Firestore Security Rules

The application implements comprehensive security rules:

- **Authentication Required**: All operations require authenticated users
- **Role-Based Access**: Admin and Finance Team roles with specific permissions
- **User-Specific Data**: Personal settings restricted to individual users
- **Audit Trail**: All data modifications tracked with user information

### Key Security Features

- Firebase Authentication integration
- Secure API endpoints with authentication middleware
- Input validation using Zod schemas
- XSS and injection attack prevention
- Secure file upload with validation

## Design System

### Color Palette

- **Primary**: Professional blue (#256CB4) - Trust and stability
- **Background**: Light blue (#F3F6F9) - Clean canvas
- **Accent**: Crisp cyan (#59C2D1) - Call-to-action highlights

### Typography

- **Font Family**: Inter - Modern, readable sans-serif
- Consistent hierarchy for headings and body text
- Optimized for financial data display

### UI Components

Built with Radix UI primitives for accessibility and consistency:
- Dialogs, Dropdowns, Popovers
- Forms with validation feedback
- Tables with sorting and filtering
- Charts and data visualizations
- Toast notifications
- Loading states and skeletons

## Contributing

This project follows standard Git workflow practices. When contributing:

1. Create a feature branch
2. Make your changes with clear commit messages
3. Ensure all tests pass and code is linted
4. Submit a pull request with detailed description

## License

This project is private and proprietary.

## Support

For issues, questions, or feature requests, please contact the development team or create an issue in the repository.

## Acknowledgments

Built with:
- Next.js and React
- Firebase Platform
- Radix UI Components
- Tailwind CSS
- Google Genkit AI
