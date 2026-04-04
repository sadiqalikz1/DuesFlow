# **App Name**: DuesFlow

## Core Features:

- Secure User Authentication: Implement robust user authentication and authorization using Firebase Auth, ensuring secure access to supplier data and financial reports across multiple user roles (e.g., branch managers, finance team).
- Opening Balance Import: A one-time or annual upload feature allowing users to import existing outstanding balances from Tally via a standardized Excel template, ensuring a complete historical record.
- Daily Purchase Upload & Validation: Provide a secure REST endpoint for daily Excel sheet uploads (extracted from Tally) using a standardized template. The system will parse rows containing critical data points: Branch, Supplier Name, Invoice Date, Invoice Amount, and Credit Days. It will also highlight and report errors (e.g., missing data, unregistered suppliers) before committing data.
- Dynamic Due Date Calculation: Automatically calculate the 'DueDate' for each incoming invoice by adding the specified 'CreditDays' to the 'InvoiceDate', ensuring accurate and consistent due date tracking (e.g., March 25 + 45 days = May 9).
- Atomic Batched Invoice Processing: Utilize Firestore Batched Writes to efficiently process hundreds of invoice entries from Excel simultaneously. Implement strict data validation for each row, ensuring that if any single invoice fails validation (e.g., missing data, invalid format), the *entire batch* is rolled back to prevent partial, corrupted data from entering the system.
- Partial Payment Handling (FIFO): Enable users to log payments (via upload or manual entry) and automatically deduct them from the oldest pending invoices (First In, First Out). This action will update invoice statuses and remaining balances.
- Real-time Dues Aggregation: Automate updates to a central 'statistics' document (containing Total Outstanding, Total Overdue, and Upcoming Dues) using Firebase Functions/Triggers. This ensures real-time accuracy whenever new invoices are added, paid, or their status changes, avoiding expensive full-collection queries.
- Interactive Dues Dashboard & Reporting: Provide an intuitive, multi-branch dashboard with a global/branch toggle, displaying key performance indicators (KPIs) like Total Outstanding Payable, Total Overdue, and Upcoming Dues (7, 15, 30 days). Includes an Aging Report visual (0-30, 31-60, 60+ days overdue), filterable supplier ledgers (by date range, branch, supplier name/category, payment status), and options to export data to Excel/PDF.
- Supplier & Branch Management: Allow administrators to manage supplier profiles (e.g., default credit periods, contact info) and define branches within the system, ensuring data consistency and enabling multi-branch reporting.

## Style Guidelines:

- Primary color: Professional blue (#256CB4) representing trust, stability, and clarity, suitable for headings and interactive elements in a financial application.
- Background color: A very light, desaturated blue (#F3F6F9) that provides a clean, open canvas, ensuring high readability and a sense of calm for data presentation.
- Accent color: A crisp cyan (#59C2D1) used sparingly for calls-to-action, highlights, and status indicators, providing visual distinction without overpowering the data.
- Headline and body font: 'Inter', a grotesque-style sans-serif font known for its modern, neutral, and highly readable design, ideal for dashboards and financial data display.
- Employ a minimalist set of clear, functional line icons for navigation, data actions (e.g., upload, filter), and status indicators to maintain a professional and efficient user experience.
- Adopt a clean, grid-based dashboard layout with ample whitespace. Key information will be prioritized for immediate visibility, and filtering options will be consistently placed for ease of use.
- Incorporate subtle and swift animations for transitions, data loading states, and filter applications to provide responsive feedback without being distracting or delaying user interaction.