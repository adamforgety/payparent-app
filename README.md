# PayParent: PayPaPa

PayParent is a epenseskingrentssskingime, real-time finaparapplication designed for co-parents. It simplifies the process of managing shared child-related epenses, tracking child support payments, and settling balances, all while keeping both parents perfectly in sync.

This application was built to solve the common challenges of shared finances in co-parenting situations, replacing messy spreadsheets and endless text message threads with a single, clear source of truth.

## Key Features

- **Real-time Co-Parent Syncing**: Link accounts with a co-parent to share a single ledger. All updates are reflected instantly on both devices.
- **Personalized Dashboards**: At-a-glance summary for each parent, showing who owes whom and a detailed breakdown of monthly contributions.
- **Comprehensive Expense Ledger**: Log expenses with categories, receipts, and initial payer details. Track the status of each item as "Unsettled" or "Settled".
- **Dynamic & Custom Expense Splits**: Move beyond simple 50/50 splits. Create custom rules to divide expenses by category (e.g., 60/40 for medical, 70/30 for activities) for ultimate flexibility.
- **Bulk Expense Importing**: Easily import multiple expenses at once from an Excel (`.xlsx`) file.
- **Historical Reporting**: Generate yearly or monthly reports, view category breakdowns, and export all data to Excel for tax or record-keeping purposes.
- **Intelligent Default Views**: The dashboard automatically defaults to the logged-in user's perspective, providing a personalized experience for both the primary user and the linked co-parent.
- **PWA Enabled**: Installable on mobile devices for a native app-like experience, complete with an "Add to Home Screen" prompt on iOS.

## Architectural Highlights & Technical Deep Dive

This section details some of the complex technical implementations that make PayParent a robust and user-friendly application.

### 1. Real-time Co-Parent Data Model

The core of the application is its ability to allow two users to share and interact with the same set of financial data in real-time.

- **Shared Data Ownership**: The system uses a `dataOwnerId` field in each user's Firestore document. When two parents link their accounts, one parent (the first to initiate the link) becomes the "data owner." The other parent's `dataOwnerId` is then pointed to the owner's user ID.
- **Single Source of Truth**: All application data (`appData`) is stored exclusively within the data owner's document. The linked co-parent's document contains no financial data, only a pointer to the owner. This prevents data duplication and ensures perfect consistency.
- **Real-time Listeners**: The application uses Firestore's `onSnapshot` listeners to subscribe to changes on the data owner's document. This means any change made by one parent is instantly pushed to the other parent's device, providing a seamless, real-time collaborative experience.
- **Background Performance Optimization**: To prevent unnecessary database reads when the app is in a background tab, the application leverages the **Page Visibility API**. The Firestore `onSnapshot` listeners are intelligently paused when the user navigates away from the app and are automatically reconnected when they return, saving bandwidth and reducing costs.

### 2. Dynamic Custom Expense Splits

To provide maximum flexibility, the rigid 50/50 split model was replaced with a fully customizable system.

- **Custom "Split Boxes"**: Users can create, name, and manage multiple "split boxes" (e.g., "School Costs," "Medical," "General").
- **Category-Based Assignment**: Each split box has a set of associated expense categories. A category can only be assigned to **one split box at a time**. The UI enforces this by disabling checkboxes for already-assigned categories, preventing conflicting rules.
- **Flexible Percentages**: Each split box has its own parent percentage split (e.g., 60/40, 50/50).
- **Graceful Fallback**: The calculation logic is designed to be resilient. If an expense's category has not been assigned to any split box, the system safely defaults to a 50/50 split instead of crashing, ensuring application stability.

### 3. Comprehensive Financial Calculations

The application performs several layers of calculation to present a clear financial picture.

- **Current Month Balance**: Calculates the net balance for the current month by factoring in each parent's share of expenses and any child support payments.
- **Rolling Unsettled Balance**: A key feature is the aggregation of all unsettled items from previous months. This `previousMonthsTotalBalance` is carried forward and combined with the current month's balance to show the true, up-to-date amount of who owes whom.
- **Reimbursement Logic**: Expenses categorized as "Reimbursement" are treated as a direct 100% transfer to the parent who made the initial payment, bypassing the standard percentage splits.

## Technology Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Database**: Google Firestore (for real-time data storage)
- **Authentication**: Firebase Authentication
- **UI Components**: ShadCN UI
- **Styling**: Tailwind CSS
- **Forms**: React Hook Form with Zod for validation
- **File Handling**: `xlsx` library for Excel import/export.
- **Deployment**: Firebase Hosting
