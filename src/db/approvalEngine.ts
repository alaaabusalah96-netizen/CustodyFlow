import { 
  ApprovalWorkflowDefinition, 
  ApprovalInstance, 
  ApprovalStepDefinition, 
  ApprovalStatus,
  ApprovalDocumentType
} from '../types/approval';
import { StorageEngine } from './storage';
import { dbSetDoc, dbDeleteDoc } from '../firebase';
import { Firestore } from 'firebase/firestore';

export class ApprovalEngine {
  private static STORAGE_KEY_WORKFLOWS = 'approval_workflows';
  private static STORAGE_KEY_INSTANCES = 'approval_instances';
  private static dbInstance?: Firestore;

  public static setDb(db: Firestore) {
    this.dbInstance = db;
  }

  // Clear memory cache / localStorage (for testing)
  public static resetState(): void {
    StorageEngine.setStored(this.STORAGE_KEY_WORKFLOWS, []);
    StorageEngine.setStored(this.STORAGE_KEY_INSTANCES, []);
  }

  // Workflows Management
  public static getWorkflows(companyId: string, documentType?: string): ApprovalWorkflowDefinition[] {
    const all = StorageEngine.getStored<ApprovalWorkflowDefinition[]>(this.STORAGE_KEY_WORKFLOWS, []);
    return all.filter(w => w.company_id === companyId && (!documentType || w.documentType === documentType));
  }

  public static getWorkflowById(id: string): ApprovalWorkflowDefinition | null {
    const all = StorageEngine.getStored<ApprovalWorkflowDefinition[]>(this.STORAGE_KEY_WORKFLOWS, []);
    return all.find(w => w.id === id) || null;
  }

  public static saveWorkflow(workflowData: Omit<ApprovalWorkflowDefinition, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): ApprovalWorkflowDefinition {
    const all = StorageEngine.getStored<ApprovalWorkflowDefinition[]>(this.STORAGE_KEY_WORKFLOWS, []);
    const now = new Date().toISOString();
    
    let workflow: ApprovalWorkflowDefinition;
    const existingIdx = workflowData.id ? all.findIndex(w => w.id === workflowData.id) : -1;

    if (existingIdx >= 0) {
      workflow = {
        ...all[existingIdx],
        ...workflowData,
        updatedAt: now
      };
      all[existingIdx] = workflow;
    } else {
      const newId = workflowData.id || `wf-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      workflow = {
        ...workflowData,
        id: newId,
        isActive: workflowData.isActive ?? true,
        steps: workflowData.steps || [],
        createdAt: now,
        updatedAt: now
      };
      all.push(workflow);
    }

    StorageEngine.setStored(this.STORAGE_KEY_WORKFLOWS, all);

    if (this.dbInstance) {
      dbSetDoc('approval_workflows', workflow.id, workflow);
    }

    return workflow;
  }

  public static deleteWorkflow(id: string): boolean {
    const all = StorageEngine.getStored<ApprovalWorkflowDefinition[]>(this.STORAGE_KEY_WORKFLOWS, []);
    const updated = all.filter(w => w.id !== id);
    if (updated.length === all.length) return false;

    StorageEngine.setStored(this.STORAGE_KEY_WORKFLOWS, updated);

    if (this.dbInstance) {
      dbDeleteDoc('approval_workflows', id);
    }

    return true;
  }

  // Find matching workflow by documentType, amount, orgUnit
  public static findMatchingWorkflow(
    companyId: string, 
    documentType: string, 
    amount?: number, 
    org_unit_id?: string
  ): ApprovalWorkflowDefinition | null {
    const workflows = this.getWorkflows(companyId, documentType).filter(w => w.isActive);
    if (workflows.length === 0) return null;

    // Filter by Org Unit specificity if specified, or global (no org_unit_id)
    const orgMatches = workflows.filter(w => !w.organization_unit_id || w.organization_unit_id === org_unit_id);
    
    // Filter by amount range
    const amountMatches = orgMatches.filter(w => {
      if (amount === undefined) return true;
      if (w.minAmount !== undefined && amount < w.minAmount) return false;
      if (w.maxAmount !== undefined && amount > w.maxAmount) return false;
      return true;
    });

    if (amountMatches.length === 0) return null;

    // Sort by specificity: exact org unit matching first, then higher minAmount
    amountMatches.sort((a, b) => {
      if (a.organization_unit_id && !b.organization_unit_id) return -1;
      if (!a.organization_unit_id && b.organization_unit_id) return 1;
      return (b.minAmount || 0) - (a.minAmount || 0);
    });

    return amountMatches[0];
  }

  // Evaluate & Start Instance
  public static evaluateAndStartWorkflow(params: {
    companyId: string;
    documentType: string;
    documentId: string;
    amount?: number;
    org_unit_id?: string;
    requesterId: string;
    requesterName?: string;
  }): { instance: ApprovalInstance | null; isAutoApproved: boolean } {
    const { companyId, documentType, documentId, amount, org_unit_id, requesterId, requesterName } = params;

    let matchingWf = this.findMatchingWorkflow(companyId, documentType, amount, org_unit_id);
    if (!matchingWf && this.getWorkflows(companyId, documentType).length === 0) {
      this.createDefaultWorkflows(companyId);
      matchingWf = this.findMatchingWorkflow(companyId, documentType, amount, org_unit_id);
    }

    if (!matchingWf || !matchingWf.steps || matchingWf.steps.length === 0) {
      return { instance: null, isAutoApproved: false };
    }

    // Check if auto-approve below threshold on step 1
    const firstStep = matchingWf.steps[0];
    if (amount !== undefined && firstStep.autoApproveBelowAmount !== undefined && amount < firstStep.autoApproveBelowAmount) {
      return { instance: null, isAutoApproved: true };
    }

    const now = new Date().toISOString();
    const instanceId = `appr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const instance: ApprovalInstance = {
      id: instanceId,
      workflowId: matchingWf.id,
      workflowName: matchingWf.name,
      documentId,
      documentType,
      company_id: companyId,
      organization_unit_id: org_unit_id,
      amount,
      requesterId,
      requesterName,
      currentStepNumber: 1,
      totalSteps: matchingWf.steps.length,
      status: 'PENDING',
      history: [],
      createdAt: now,
      updatedAt: now
    };

    const instances = StorageEngine.getStored<ApprovalInstance[]>(this.STORAGE_KEY_INSTANCES, []);
    instances.push(instance);
    StorageEngine.setStored(this.STORAGE_KEY_INSTANCES, instances);

    if (this.dbInstance) {
      dbSetDoc('approval_instances', instance.id, instance);
    }

    return { instance, isAutoApproved: false };
  }

  // Instance Queries
  public static getInstanceById(id: string): ApprovalInstance | null {
    const all = StorageEngine.getStored<ApprovalInstance[]>(this.STORAGE_KEY_INSTANCES, []);
    return all.find(i => i.id === id) || null;
  }

  public static getInstanceByDocumentId(documentId: string): ApprovalInstance | null {
    const all = StorageEngine.getStored<ApprovalInstance[]>(this.STORAGE_KEY_INSTANCES, []);
    return all.find(i => i.documentId === documentId && i.status === 'PENDING') || null;
  }

  public static canUserApproveStep(
    instance: ApprovalInstance,
    user: { id: string; role: string; userRoles?: string[]; permissions?: Record<string, boolean>; org_unit_id?: string }
  ): boolean {
    if (instance.status !== 'PENDING') return false;

    const wf = this.getWorkflowById(instance.workflowId);
    if (!wf) return false;

    const stepDef = wf.steps.find(s => s.stepNumber === instance.currentStepNumber);
    if (!stepDef) return false;

    // Admin / SystemAdmin override
    const userRoleList = user.userRoles || [user.role];
    if (userRoleList.includes('Admin') || userRoleList.includes('SystemAdmin')) {
      return true;
    }

    if (stepDef.approverType === 'SPECIFIC_USER') {
      return stepDef.requiredUserId === user.id;
    }

    if (stepDef.approverType === 'ROLE') {
      if (!stepDef.requiredRoles || stepDef.requiredRoles.length === 0) return true;
      return stepDef.requiredRoles.some(r => userRoleList.includes(r));
    }

    if (stepDef.approverType === 'DEPARTMENT_HEAD' || stepDef.approverType === 'ORG_UNIT_MANAGER') {
      if (!stepDef.requiredRoles || stepDef.requiredRoles.length === 0) return true;
      return stepDef.requiredRoles.some(r => userRoleList.includes(r));
    }

    return false;
  }

  // Step Operations
  public static approveStep(params: {
    instanceId: string;
    actor: { id: string; name: string; role: string; userRoles?: string[] };
    comments?: string;
  }): { instance: ApprovalInstance; isFinalApproval: boolean } {
    const instances = StorageEngine.getStored<ApprovalInstance[]>(this.STORAGE_KEY_INSTANCES, []);
    const idx = instances.findIndex(i => i.id === params.instanceId);
    if (idx === -1) throw new Error('Approval instance not found');

    const instance = instances[idx];
    if (instance.status !== 'PENDING') {
      throw new Error(`Cannot approve step. Current status is ${instance.status}`);
    }

    const wf = this.getWorkflowById(instance.workflowId);
    if (!wf) throw new Error('Associated workflow definition not found');

    const stepDef = wf.steps.find(s => s.stepNumber === instance.currentStepNumber);
    const stepName = stepDef ? stepDef.name : `Step ${instance.currentStepNumber}`;

    if (!this.canUserApproveStep(instance, params.actor)) {
      throw new Error(`User ${params.actor.name} (${params.actor.role}) is not authorized to approve step ${instance.currentStepNumber} (${stepName})`);
    }

    const now = new Date().toISOString();
    instance.history.push({
      stepNumber: instance.currentStepNumber,
      stepName,
      action: 'APPROVED',
      actorId: params.actor.id,
      actorName: params.actor.name,
      actorRole: params.actor.role,
      comments: params.comments,
      timestamp: now
    });

    const isFinal = instance.currentStepNumber >= instance.totalSteps;

    if (isFinal) {
      instance.status = 'APPROVED';
    } else {
      instance.currentStepNumber += 1;
    }

    instance.updatedAt = now;
    instances[idx] = instance;
    StorageEngine.setStored(this.STORAGE_KEY_INSTANCES, instances);

    if (this.dbInstance) {
      dbSetDoc('approval_instances', instance.id, instance);
    }

    return { instance, isFinalApproval: isFinal };
  }

  public static rejectStep(params: {
    instanceId: string;
    actor: { id: string; name: string; role: string };
    comments?: string;
  }): ApprovalInstance {
    const instances = StorageEngine.getStored<ApprovalInstance[]>(this.STORAGE_KEY_INSTANCES, []);
    const idx = instances.findIndex(i => i.id === params.instanceId);
    if (idx === -1) throw new Error('Approval instance not found');

    const instance = instances[idx];
    if (instance.status !== 'PENDING') {
      throw new Error(`Cannot reject step. Current status is ${instance.status}`);
    }

    const wf = this.getWorkflowById(instance.workflowId);
    const stepDef = wf ? wf.steps.find(s => s.stepNumber === instance.currentStepNumber) : null;
    const stepName = stepDef ? stepDef.name : `Step ${instance.currentStepNumber}`;

    const now = new Date().toISOString();
    instance.history.push({
      stepNumber: instance.currentStepNumber,
      stepName,
      action: 'REJECTED',
      actorId: params.actor.id,
      actorName: params.actor.name,
      actorRole: params.actor.role,
      comments: params.comments,
      timestamp: now
    });

    instance.status = 'REJECTED';
    instance.updatedAt = now;
    instances[idx] = instance;
    StorageEngine.setStored(this.STORAGE_KEY_INSTANCES, instances);

    if (this.dbInstance) {
      dbSetDoc('approval_instances', instance.id, instance);
    }

    return instance;
  }

  public static getPendingApprovalsForUser(
    companyId: string,
    user: { id: string; role: string; userRoles?: string[]; org_unit_id?: string }
  ): ApprovalInstance[] {
    const instances = StorageEngine.getStored<ApprovalInstance[]>(this.STORAGE_KEY_INSTANCES, []);
    const pending = instances.filter(i => i.company_id === companyId && i.status === 'PENDING');

    return pending.filter(instance => this.canUserApproveStep(instance, user));
  }

  // Pre-seed default templates for enterprise readiness
  public static createDefaultWorkflows(companyId: string): ApprovalWorkflowDefinition[] {
    const existing = this.getWorkflows(companyId);
    if (existing.length > 0) return existing;

    const prStandardWf = this.saveWorkflow({
      company_id: companyId,
      documentType: 'PURCHASE_REQUEST',
      name: 'Standard Purchase Request Approval Workflow',
      description: 'Standard authorization for purchase requests up to 50,000 EGP',
      isActive: true,
      maxAmount: 50000,
      steps: [
        {
          stepNumber: 1,
          name: 'Manager Approval',
          approverType: 'ROLE',
          requiredRoles: ['Admin', 'RegionalManager', 'SystemAdmin', 'DepartmentManager'],
          labelAr: 'اعتماد الإدارة المباشرة',
          labelEn: 'Direct Manager Approval'
        }
      ]
    });

    const prHighValueWf = this.saveWorkflow({
      company_id: companyId,
      documentType: 'PURCHASE_REQUEST',
      name: 'High-Value Purchase Request Approval Workflow',
      description: 'Multi-level approval for purchase requests above 50,000 EGP: Department Manager -> Finance Manager -> CEO',
      isActive: true,
      minAmount: 50001,
      steps: [
        {
          stepNumber: 1,
          name: 'Department Manager Approval',
          approverType: 'ROLE',
          requiredRoles: ['DepartmentManager', 'BranchManager', 'RegionalManager', 'Admin', 'SystemAdmin'],
          labelAr: 'اعتماد مدير القسم / الفرع',
          labelEn: 'Department / Branch Manager Approval'
        },
        {
          stepNumber: 2,
          name: 'Finance Approval',
          approverType: 'ROLE',
          requiredRoles: ['FinanceManager', 'Accountant', 'Admin', 'SystemAdmin'],
          labelAr: 'اعتماد الماليين والمحاسبة',
          labelEn: 'Finance & Accounting Approval'
        },
        {
          stepNumber: 3,
          name: 'CEO / General Manager Approval',
          approverType: 'ROLE',
          requiredRoles: ['CEO', 'GeneralManager', 'Admin', 'SystemAdmin'],
          labelAr: 'اعتماد المدير العام / التنفيذي',
          labelEn: 'CEO / General Manager Approval'
        }
      ]
    });

    const expenseWf = this.saveWorkflow({
      company_id: companyId,
      documentType: 'EXPENSE',
      name: 'Standard Expense Claim Approval',
      description: 'Expense approvals: Direct Supervisor -> Finance',
      isActive: true,
      steps: [
        {
          stepNumber: 1,
          name: 'Direct Manager Approval',
          approverType: 'ROLE',
          requiredRoles: ['DepartmentManager', 'StationAdmin', 'RegionalManager', 'Admin', 'SystemAdmin'],
          labelAr: 'اعتماد المدير المباشر',
          labelEn: 'Direct Manager Approval'
        },
        {
          stepNumber: 2,
          name: 'Finance Approval',
          approverType: 'ROLE',
          requiredRoles: ['FinanceManager', 'Accountant', 'Admin', 'SystemAdmin'],
          labelAr: 'اعتماد الإدارة المالية',
          labelEn: 'Finance Approval'
        }
      ]
    });

    return [prStandardWf, prHighValueWf, expenseWf];
  }
}
