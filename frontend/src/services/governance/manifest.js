import React from "react";
import GovernanceHomePage from "../../app/features/governance/GovernanceHome";
import HospitalRegistryPage from "../../app/features/governance/HospitalRegistry";
import GovernmentClaimsDashboard from "../../pages/SystemAdmin/GovernmentClaimsDashboard";
import FraudGuard from "../../pages/SystemAdmin/FraudGuard";
import RegulatoryReports from "../../pages/SystemAdmin/RegulatoryReports";
import CountyCommandCenter from "../../pages/SystemAdmin/CountyCommandCenter";
import HospitalVerificationReview from "../../pages/SystemAdmin/HospitalVerificationReview";
import PatientIdentityRegistryPage from "../../pages/SystemAdmin/PatientIdentityRegistry";

const governanceFeatures = [
  {
    id: "home",
    label: "Governance Home",
    route: "/app/governance/home/index",
    workspace: "governance",
    component: GovernanceHomePage,
    permissions: ["SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER", "GOVERNMENT_ADMIN", "GOVERNMENT_REGULATOR", "GOVERNMENT_AUDITOR", "GOVERNMENT_INSPECTOR", "GOVERNMENT_ANALYST"],
  },
  {
    id: "claims",
    label: "Government Claims",
    route: "/app/governance/claims/index",
    workspace: "governance",
    component: GovernmentClaimsDashboard,
    permissions: ["SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER", "GOVERNMENT_REGULATOR", "GOVERNMENT_ADMIN", "GOVERNMENT_AUDITOR", "GOVERNMENT_INSPECTOR", "GOVERNMENT_ANALYST"],
  },
  {
    id: "registry",
    label: "Hospital Registry",
    route: "/app/governance/registry/hospitals",
    workspace: "governance",
    component: HospitalRegistryPage,
    permissions: ["SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"],
  },
  {
    id: "patient-identity",
    label: "Patient Identity",
    route: "/app/governance/registry/patient-identity",
    workspace: "governance",
    component: PatientIdentityRegistryPage,
    permissions: ["SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"],
  },
  {
    id: "fraud",
    label: "Fraud",
    route: "/app/governance/fraud/index",
    workspace: "governance",
    component: FraudGuard,
    permissions: ["SYSTEM_ADMIN", "SUPER_ADMIN"],
  },
  {
    id: "regulatory-reports",
    label: "Regulatory Reports",
    route: "/app/governance/reports/regulatory",
    workspace: "governance",
    component: RegulatoryReports,
    permissions: ["SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN"],
  },
  {
    id: "county-command",
    label: "County Command",
    route: "/app/governance/command/county",
    workspace: "governance",
    component: CountyCommandCenter,
    permissions: ["SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"],
  },
  {
    id: "verification",
    label: "Verification Review",
    route: "/app/governance/verification/hospitals",
    workspace: "governance",
    component: HospitalVerificationReview,
    permissions: ["SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"],
  },
];

export default {
  name: "governance",
  title: "Governance",
  version: "1.0.0",
  owner: "Platform Governance",
  description: "Government, compliance, and oversight workflows",
  route: "/app/governance/home/index",
  workspace: "governance",
  category: "governance",
  enabled: true,
  dependsOn: [],
  capabilities: {
    query: true,
    commands: true,
    realtime: false,
    events: true,
    permissions: true,
    cache: true,
    search: false,
  },
  features: governanceFeatures,
  healthCheck: async () => ({ status: "healthy", checks: { runtimeOperational: true } }),
  permissions: governanceFeatures.flatMap((feature) => feature.permissions),
  routes: governanceFeatures.map((feature) => ({
    path: feature.route,
    title: feature.label,
    workspace: feature.workspace,
    featureId: feature.id,
  })),
  navigationItems: governanceFeatures.map((feature) => ({
    id: `governance-${feature.id}`,
    label: feature.label,
    route: feature.route,
    icon: feature.id === "home" ? "home" : "shield",
    workspace: feature.workspace,
    category: "governance",
    permissions: feature.permissions,
  })),
};
