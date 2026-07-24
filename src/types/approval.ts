export type ApprovalDocumentType = 
  | 'PURCHASE_REQUEST' 
  | 'PURCHASE_ORDER' 
  | 'CASH_VOUCHER' 
  | 'INVENTORY_VOUCHER' 
  | 'EXPENSE' 
  | 'GENERAL';

export type ApproverType = 'ROLE' | 'SPECIFIC_USER' | 'DEPARTMENT_HEAD' | 'ORG_UNIT_MANAGER';

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export type StepAction = 'APPROVED' | 'REJECTED' | 'SKIPPED';

export interface ApprovalStepDefinition {
  stepNumber: number;
  name: string;
  approverType: ApproverType;
  requiredRoles?: string[]; // e.g. ['DepartmentManager'], ['Finance'], ['CEO', 'Admin', 'SystemAdmin']
  requiredUserId?: string;
  labelAr: string;
  labelEn: string;
  autoApproveBelowAmount?: number;
}

export interface ApprovalWorkflowDefinition {
  id: string;
  company_id: string;
  documentType: ApprovalDocumentType | string;
  name: string;
  description?: string;
  organization_unit_id?: string; // Scope to specific org unit or company-wide if undefined
  isActive: boolean;
  minAmount?: number;
  maxAmount?: number;
  steps: ApprovalStepDefinition[];
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalStepRecord {
  stepNumber: number;
  stepName: string;
  action: StepAction;
  actorId: string;
  actorName: string;
  actorRole: string;
  comments?: string;
  timestamp: string;
}

export interface ApprovalInstance {
  id: string;
  workflowId: string;
  workflowName: string;
  documentId: string;
  documentType: ApprovalDocumentType | string;
  company_id: string;
  organization_unit_id?: string;
  amount?: number;
  requesterId: string;
  requesterName?: string;
  currentStepNumber: number;
  totalSteps: number;
  status: ApprovalStatus;
  history: ApprovalStepRecord[];
  createdAt: string;
  updatedAt: string;
}
