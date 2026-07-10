import { FsmConfig, FsmTransitionResult } from '../../types/enterprise';

/**
 * 3.3 Generic Document Lifecycle Engine
 * محرك دورة حياة المستندات العام (آلة الحالات المحدودة)
 * 
 * An isolated, highly reusable component to handle state transitions for any document type.
 * Ensures consistent transition validations, security/role clearance, and side effect triggers.
 * Strictly adheres to "Additive Only" and "Backward Compatibility" principles.
 */
export class DocumentLifecycleEngine<TState extends string = string, TEvent extends string = string, TContext = any> {
  private config: FsmConfig<TState, TEvent, TContext>;

  constructor(config: FsmConfig<TState, TEvent, TContext>) {
    this.config = config;
  }

  /**
   * Retrieves the FSM Configuration.
   */
  getConfig(): FsmConfig<TState, TEvent, TContext> {
    return this.config;
  }

  /**
   * Retrieves all valid transitions from the current state.
   */
  getAvailableTransitions(currentState: TState): typeof this.config.transitions {
    return this.config.transitions.filter(t => t.from === currentState);
  }

  /**
   * Verifies if a specific event can be triggered from the current state, 
   * checking user role authority and guard criteria.
   */
  async canTransition(
    currentState: TState,
    event: TEvent,
    userRole: string,
    context: TContext
  ): Promise<{ can: boolean; reasonAr: string; reasonEn: string }> {
    const transition = this.config.transitions.find(
      t => t.from === currentState && t.event === event
    );

    if (!transition) {
      return {
        can: false,
        reasonAr: `الانتقال غير مسموح به من الحالة الحالية (${currentState}) عبر الحدث (${event})`,
        reasonEn: `Transition is not allowed from the current state (${currentState}) via event (${event})`
      };
    }

    // Check Role Authority
    if (transition.authorizedRoles && transition.authorizedRoles.length > 0) {
      if (!transition.authorizedRoles.includes(userRole)) {
        return {
          can: false,
          reasonAr: `غير مصرح لدور المستخدم (${userRole}) بتنفيذ هذا الإجراء`,
          reasonEn: `User role (${userRole}) is not authorized to execute this action`
        };
      }
    }

    // Check Guard Conditions
    if (transition.guard) {
      try {
        const guardPassed = await transition.guard(context);
        if (!guardPassed) {
          return {
            can: false,
            reasonAr: `لم يتم استيفاء شروط التحقق المسبقة للانتقال`,
            reasonEn: `Pre-conditions for this transition were not met`
          };
        }
      } catch (err: any) {
        return {
          can: false,
          reasonAr: `فشل التحقق المسبق: ${err.message}`,
          reasonEn: `Pre-condition check failed: ${err.message}`
        };
      }
    }

    return {
      can: true,
      reasonAr: 'الانتقال متاح',
      reasonEn: 'Transition is available'
    };
  }

  /**
   * Performs the transition, running validation guards, post-transition actions, and returning the result.
   */
  async triggerTransition(
    currentState: TState,
    event: TEvent,
    userRole: string,
    context: TContext
  ): Promise<FsmTransitionResult<TState>> {
    const transition = this.config.transitions.find(
      t => t.from === currentState && t.event === event
    );

    if (!transition) {
      return {
        success: false,
        fromState: currentState,
        toState: currentState,
        messageAr: `انتقال غير صالح للحدث (${event}) من الحالة (${currentState})`,
        messageEn: `Invalid transition for event (${event}) from state (${currentState})`
      };
    }

    const clearance = await this.canTransition(currentState, event, userRole, context);
    if (!clearance.can) {
      return {
        success: false,
        fromState: currentState,
        toState: currentState,
        messageAr: clearance.reasonAr,
        messageEn: clearance.reasonEn
      };
    }

    // Execute the post-transition action hook
    if (transition.action) {
      try {
        await transition.action(context);
      } catch (actionErr: any) {
        return {
          success: false,
          fromState: currentState,
          toState: currentState,
          messageAr: `فشل تنفيذ الإجراء اللاحق: ${actionErr.message}`,
          messageEn: `Failed to execute post-transition action: ${actionErr.message}`
        };
      }
    }

    return {
      success: true,
      fromState: currentState,
      toState: transition.to,
      messageAr: `تم الانتقال بنجاح إلى: ${this.config.states[transition.to]?.labelAr || transition.to}`,
      messageEn: `Transitioned successfully to: ${this.config.states[transition.to]?.labelEn || transition.to}`
    };
  }
}
