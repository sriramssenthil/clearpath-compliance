/**
 * Fictional ClearPath product facts and approved disclosure snippets. This is demo data: the
 * numbers, license number and address are invented. The AI reuses snippet text verbatim in its
 * suggested fixes, so each snippet is complete and consistent with the rules in rules.ts
 * (tests/rules-data.test.ts checks that the snippets satisfy the rules they are meant to).
 */
import type { ProductFacts } from "@/lib/compliance/types";

type Snippet = ProductFacts["approvedSnippets"][number];

const affiliateDisclosure: Snippet = {
  id: "affiliate_disclosure",
  label: "Affiliate / sponsored content disclosure",
  text: "Advertisement: We are paid by ClearPath and earn a commission if you apply for a product through links on this page.",
};

const affiliateHashtag: Snippet = {
  id: "affiliate_hashtag",
  label: "Short paid-partnership tag for social posts",
  text: "#ad | Paid partnership with ClearPath",
};

const canSpamFooter: Snippet = {
  id: "can_spam_footer",
  label: "Email footer (unsubscribe and postal address)",
  text: "You are receiving this email because you asked to hear from ClearPath. Unsubscribe or manage your email preferences at any time. ClearPath Financial, Inc., 100 Market Street, Suite 200, Austin, TX 78701.",
};

const smsOptout: Snippet = {
  id: "sms_optout",
  label: "SMS brand ID and opt-out",
  text: "ClearPath: Reply STOP to opt out, HELP for help. Msg & data rates may apply. Message frequency varies.",
};

const prescreenOptoutShort: Snippet = {
  id: "prescreen_optout_short",
  label: "Short prescreen opt-out notice",
  text: 'You can choose to stop receiving "prescreened" offers of credit from this and other companies by calling toll-free 1-888-5-OPT-OUT (1-888-567-8688). See PRESCREEN & OPT-OUT NOTICE for more information about prescreened offers.',
};

export const PRODUCT_FACTS: ProductFacts[] = [
  {
    product: "personal_loan",
    facts: {
      displayName: "ClearPath Personal Loan",
      aprMin: 8.99,
      aprMax: 35.99,
      amountMin: 2000,
      amountMax: 50000,
      termMonthsMin: 24,
      termMonthsMax: 60,
      notes: [
        "Loan amounts from $2,000 to $50,000; terms from 24 to 60 months. Nothing outside those ranges may be advertised.",
        "APRs range from 8.99% to 35.99%. The lowest APRs are not available to every applicant, so never imply that 8.99% is typical. No advertised APR may be below 8.99%.",
        "Origination fee of 0% to 8% of the loan amount, depending on creditworthiness; the fee is included in the APR. Do not advertise 'no fees' without the qualifier that some loans carry an origination fee.",
        "Checking your rate uses a soft credit inquiry and does not affect your credit score. A hard inquiry is made only if the applicant accepts an offer and proceeds with the application.",
        "Approval is never guaranteed and a credit check always occurs. 'Pre-approved' must not be used for a rate check; use 'prequalify' or 'check your rate'.",
        "Do not claim the loan builds or improves credit, or quote funding speed, prepayment terms or savings figures; none of these is an approved fact.",
        "Ads that target California need the California Financing Law license statement.",
      ],
    },
    approvedSnippets: [
      {
        id: "apr_disclosure",
        label: "APR range disclosure",
        text: "Rates from 8.99% to 35.99% APR. Annual Percentage Rate (APR) is the yearly cost of the loan and includes the origination fee. Your actual APR depends on your credit, loan amount and term. Terms apply.",
      },
      {
        id: "representative_example",
        label: "Representative example (amount, term, payments, APR)",
        text: "Representative example: A $10,000 loan with a 36-month term, a 13.50% interest rate and a 5% origination fee ($500) has a 17.14% APR and 36 monthly payments of $339.35, for a total repayment of $12,216.60. You receive $9,500 after the fee.",
      },
      {
        id: "origination_fee",
        label: "Origination fee disclosure",
        text: "Loans carry an origination fee of 0% to 8% of the loan amount, depending on your credit. The fee is included in the APR.",
      },
      {
        id: "soft_pull_notice",
        label: "Soft-pull notice",
        text: "Checking your rate will not affect your credit score. A hard credit inquiry, which may affect your credit score, is made only if you accept an offer and continue your application.",
      },
      {
        id: "prequal_disclaimer",
        label: "Prequalification disclaimer",
        text: "Checking your rate is a prequalification, not an offer of credit or a loan approval. Final approval, loan amount, term and APR depend on a full application and verification of your information.",
      },
      {
        id: "ca_license",
        label: "California Financing Law license statement",
        text: "Loans made or arranged pursuant to a California Financing Law license. ClearPath Lending is licensed by the California Department of Financial Protection and Innovation, License No. 60DBO-000000.",
      },
      affiliateDisclosure,
      affiliateHashtag,
      canSpamFooter,
      smsOptout,
      prescreenOptoutShort,
    ],
  },
  {
    product: "credit_card",
    facts: {
      displayName: "ClearPath Cash Rewards Card",
      aprMin: 20.24,
      aprMax: 29.99,
      introAprPercent: 0,
      introMonths: 15,
      annualFee: 0,
      notes: [
        "0% intro APR on purchases for 15 months from account opening, then a variable APR of 20.24% to 29.99% based on creditworthiness. The 0% intro rate applies to purchases only; do not claim it for balance transfers.",
        "The go-to APR is variable and must be described as variable. Never call it fixed.",
        "This is an introductory APR, not deferred interest. Do not use 'no interest', 'interest-free' or 'no interest until' wording.",
        "$0 annual fee. Balance transfers carry a 3% fee on the amount transferred.",
        "1.5% cash back on purchases is a rewards rate, not an interest rate or APR; do not describe it as a rate in APR context.",
        "Checking whether you prequalify uses a soft credit inquiry. A hard inquiry is made only if the applicant continues to a full application. Approval is never guaranteed.",
      ],
    },
    approvedSnippets: [
      {
        id: "apr_disclosure",
        label: "Go-to variable APR disclosure",
        text: "Variable APR of 20.24% to 29.99% after the intro period, based on your creditworthiness. The APR varies with the market based on the Prime Rate. Terms apply.",
      },
      {
        id: "intro_apr_disclosure",
        label: "Intro APR disclosure (end point and go-to APR)",
        text: "0% intro APR on purchases for 15 months from account opening. After that, a variable APR of 20.24% to 29.99% applies, based on your creditworthiness. The APR varies with the market based on the Prime Rate. The intro period ends 15 months after you open your account.",
      },
      {
        id: "fee_disclosure",
        label: "Annual fee and balance-transfer fee",
        text: "Annual fee: $0. Balance transfer fee: 3% of the amount of each balance transfer. Terms apply.",
      },
      {
        id: "rewards_terms",
        label: "Cash back terms",
        text: "Earn 1.5% cash back on eligible purchases. Rewards terms and conditions apply.",
      },
      {
        id: "soft_pull_notice",
        label: "Soft-pull notice",
        text: "Checking whether you prequalify uses a soft credit inquiry, which does not affect your credit score. If you choose to apply, we will make a hard credit inquiry, which may affect your credit score.",
      },
      {
        id: "prequal_disclaimer",
        label: "Prequalification disclaimer",
        text: "Checking whether you prequalify is not an application and is not an approval. Final approval, credit limit and APR depend on a full application and verification of your information.",
      },
      affiliateDisclosure,
      affiliateHashtag,
      canSpamFooter,
      smsOptout,
      prescreenOptoutShort,
    ],
  },
  {
    product: "mortgage_prequal",
    facts: {
      displayName: "ClearPath Home Lending Mortgage Prequalification",
      notes: [
        "Prequalification uses a soft credit inquiry that does not affect the applicant's credit score. It is not a commitment to lend, a loan approval or an offer of credit.",
        "Do not use 'pre-approved' or 'approved' for a prequalification.",
        "ClearPath Home Lending, NMLS ID 1234567. Every mortgage ad must show the NMLS ID and the Equal Housing Lender statement.",
        "No specific mortgage rate, APR or payment is an approved fact. Any figure shown must come from the labeled illustrative example or from the current rate sheet, and must be accompanied by the APR.",
        "Do not claim government endorsement, name the consumer's current lender, promise to eliminate debt or promise 'no closing costs'.",
        "Do not call a rate 'fixed' unless it is fixed for the whole term; for an ARM, state how long it is fixed.",
        "Ads that target California need the California Financing Law license statement.",
      ],
    },
    approvedSnippets: [
      {
        id: "apr_disclosure",
        label: "APR explanation",
        text: "The Annual Percentage Rate (APR) reflects the yearly cost of the loan, including interest and certain fees, and may be higher than the interest rate. Rates and APRs are subject to change and depend on your credit, loan amount, down payment, property type and occupancy.",
      },
      {
        id: "representative_example",
        label: "Illustrative example (payment, number of payments, APR)",
        text: "Illustrative example only: a $300,000, 30-year fixed-rate loan with a 6.50% interest rate and $3,000 in prepaid finance charges has a 6.60% APR and a monthly principal-and-interest payment of $1,896.20 (360 payments). Your payment will be higher if it includes taxes and insurance.",
      },
      {
        id: "prequal_disclaimer",
        label: "Prequalification disclaimer",
        text: "Prequalification is based on information you provide and is not a commitment to lend, a loan approval or an offer of credit. Final approval depends on a full application, verification of your income, assets and credit, and an acceptable property appraisal.",
      },
      {
        id: "nmls_ehl",
        label: "NMLS ID and Equal Housing Lender",
        text: "ClearPath Home Lending, NMLS ID 1234567 (www.nmlsconsumeraccess.org). Equal Housing Lender.",
      },
      {
        id: "soft_pull_notice",
        label: "Soft-pull notice",
        text: "Checking whether you prequalify uses a soft credit inquiry, which does not affect your credit score. A hard credit inquiry may be needed later if you choose to continue with a full application.",
      },
      {
        id: "ca_license",
        label: "California Financing Law license statement",
        text: "ClearPath Home Lending is licensed by the California Department of Financial Protection and Innovation under the California Financing Law, License No. 60DBO-000000.",
      },
      affiliateDisclosure,
      affiliateHashtag,
      canSpamFooter,
      smsOptout,
      prescreenOptoutShort,
    ],
  },
];
