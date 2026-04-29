import api from "./client";

export async function getPendingPostApprovals() {
  const { data } = await api.get("/post-approval/pending");
  return Array.isArray(data?.pending) ? data.pending : [];
}

export async function approvePostApproval(approvalId) {
  const { data } = await api.put(`/post-approval/${approvalId}/approve`);
  return data;
}

export async function rejectPostApproval(approvalId) {
  const { data } = await api.put(`/post-approval/${approvalId}/reject`);
  return data;
}
