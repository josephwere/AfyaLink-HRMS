const FREE_API_CATALOG = [
  {
    key: "payments",
    label: "Payments (Sandbox/Test)",
    providers: [
      {
        name: "M-PESA Daraja Sandbox",
        category: "payments",
        baseUrl: "https://sandbox.safaricom.co.ke",
        note: "Free sandbox for M-PESA STK push and payment flows.",
      },
      {
        name: "Stripe Test Mode",
        category: "payments",
        baseUrl: "https://api.stripe.com",
        note: "Use test keys for cards/Apple Pay/Google Pay.",
      },
      {
        name: "PayPal Sandbox",
        category: "payments",
        baseUrl: "https://api-m.sandbox.paypal.com",
        note: "Sandbox checkout + webhooks for testing.",
      },
    ],
  },
  {
    key: "messaging",
    label: "SMS / Messaging",
    providers: [
      {
        name: "Africa's Talking Sandbox",
        category: "sms",
        baseUrl: "https://api.africastalking.com",
        note: "SMS sandbox mode for Kenya-focused testing.",
      },
    ],
  },
  {
    key: "interop",
    label: "Interop Test Servers",
    providers: [
      {
        name: "HAPI FHIR Public Test Server",
        category: "fhir",
        baseUrl: "https://hapi.fhir.org/baseR4",
        note: "Public FHIR R4 endpoint for connector testing.",
      },
      {
        name: "Orthanc DICOM Demo",
        category: "dicom",
        baseUrl: "https://orthanc.uclouvain.be/dicom-web",
        note: "DICOMweb demo for imaging connector testing.",
      },
    ],
  },
  {
    key: "geo",
    label: "Maps / Geocoding",
    providers: [
      {
        name: "OpenStreetMap Nominatim",
        category: "geocoding",
        baseUrl: "https://nominatim.openstreetmap.org",
        note: "Free geocoding with strict rate limits and caching.",
      },
    ],
  },
];

export default FREE_API_CATALOG;
