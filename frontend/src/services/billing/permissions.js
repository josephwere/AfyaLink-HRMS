export const billingPermissions = {
  canViewInvoices: ["admin", "billing", "doctor", "cashier"],
  canCreateInvoice: ["admin", "billing"],
  canFinalizeInvoice: ["admin", "billing"],
  canVoidInvoice: ["admin", "billing"],
  canPostPayment: ["admin", "billing", "cashier"],
};

export function checkPermission(permission, role) {
  const allowedRoles = billingPermissions[permission] || [];
  return allowedRoles.includes(role);
}

export default billingPermissions;
