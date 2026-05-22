// Hardcoded route groups for the raas-b2b-app (React Router v7, flat routes).
// Internal /api/* routes are intentionally excluded.
const ROUTE_GROUPS = [
  {
    name: "Onboarding",
    routes: [
      { label: "Entry", path: "/onboarding" },
      { label: "Consent", path: "/onboarding/consent" },
      { label: "Name", path: "/onboarding/name" },
      { label: "Identity", path: "/onboarding/identity" },
      { label: "Phone", path: "/onboarding/phone" },
      { label: "Address", path: "/onboarding/address" },
      { label: "Lease", path: "/onboarding/lease" },
      { label: "Link Bank", path: "/onboarding/link_bank" },
      { label: "Transactions", path: "/onboarding/transactions" },
      { label: "Payment", path: "/onboarding/payment" },
      { label: "Checkout", path: "/onboarding/checkout" },
      { label: "IDV", path: "/onboarding/idv" },
      { label: "Submit", path: "/onboarding/submit" },
      { label: "Thanks", path: "/onboarding/thanks" }
    ]
  },
  {
    name: "Profile",
    routes: [
      { label: "Dashboard", path: "/profile" },
      { label: "Settings", path: "/profile/settings" },
      { label: "Address", path: "/profile/settings/address" },
      { label: "Lease", path: "/profile/settings/lease" },
      { label: "Transactions", path: "/profile/settings/transactions" },
      { label: "Banks", path: "/profile/settings/banks" },
      { label: "Link Bank", path: "/profile/settings/link_bank" },
      { label: "Status", path: "/profile/settings/status" }
    ]
  },
  {
    name: "Widgets",
    routes: [
      { label: "Credit Score", path: "/widget/credit-score" },
      { label: "Reporting History", path: "/widget/reporting-history" },
      { label: "Membership Details", path: "/widget/membership-details" }
    ]
  }
];

export { ROUTE_GROUPS };
