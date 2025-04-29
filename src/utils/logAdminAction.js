// utils/logAdminAction.js

import { AdminLog } from "../Models/AdminLog.js";
import { Admin } from "../Models/AdminModel.js";

function generateFieldLevelDiffs(oldData, newData) {
  const changes = [];
  for (const key in newData) {
    const oldValue = oldData?.[key];
    const newValue = newData[key];

    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      changes.push({
        field: key,
        from: oldValue,
        to: newValue,
      });
    }
  }
  return changes;
}

export const logAdminAction = async ({
  adminId,
  tableName,
  rowId,
  action,
  previousData,
  newData,
}) => {
  const admin = await Admin.findOne({ where: { id: adminId } });
  if (!admin) {
    console.error(`❌ Admin with ID ${adminId} not found while logging action.`);
    return;
  }

  const adminName = admin.name;

  const changeSummary = action === "UPDATE"
    ? generateFieldLevelDiffs(previousData || {}, newData || {})
        .map(({ field, from, to }) => `${field}: "${from}" → "${to}"`)
        .join("; ")
    : action === "CREATE"
    ? `Created new entry`
    : `Deleted entry`;

  await AdminLog.create({
    admin_id: adminId,
    admin_name: adminName,
    table_name: tableName,
    row_id: rowId,
    action,
    previous_data: previousData || null,
    new_data: newData || null,
    note: changeSummary,
  });
};
