/**
 * Centralized permission logic for Nucleus Docs
 */

export function canManageDocs(adminContext, departmentCode) {
  if (!adminContext) return false;

  // Founder & Superadmin override everything
  if (adminContext.isFounder || adminContext.isSuperadmin) return true;

  // Department Head check
  const dept = adminContext.departments?.find(
    (d) => d.code === departmentCode
  );

  if (!dept) return false;

  // Convention: roleType === 'Head' OR explicit tag
  if (dept.roleType === "Head") return true;
  if (Array.isArray(dept.tags) && dept.tags.includes("DepartmentHead"))
    return true;

  return false;
}
