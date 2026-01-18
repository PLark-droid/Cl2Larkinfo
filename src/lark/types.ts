/**
 * Lark Integration Type Definitions
 */

// Permission Request from Claude Code Hook
export interface PermissionRequest {
  requestId: string;
  tool: string;
  command?: string;
  description?: string;  // Japanese description like "ワークフロー実行状況を確認"
  args?: Record<string, unknown>;
  workingDirectory: string;
  project: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
  expiresAt: number;
}

// Decision response
export type Decision = 'approve' | 'deny' | 'message';

export interface DecisionResponse {
  requestId: string;
  decision: Decision;
  message?: string;  // Text instruction from user
  respondedAt: number;
  respondedBy?: string;
}

// Stored request state
export interface StoredRequest {
  request: PermissionRequest;
  status: 'pending' | 'approved' | 'denied' | 'expired' | 'message';
  decision?: DecisionResponse;
  larkMessageId?: string;
  createdAt: number;
}

// Lark API types
export interface LarkTokenResponse {
  code: number;
  msg: string;
  tenant_access_token?: string;
  expire?: number;
}

export interface LarkMessageResponse {
  code: number;
  msg: string;
  data?: {
    message_id: string;
  };
}

// Lark Interactive Card Action Callback
export interface LarkCardCallback {
  schema: string;
  header: {
    event_id: string;
    event_type: string;
    create_time: string;
    token: string;
    app_id: string;
    tenant_key: string;
  };
  event: {
    operator: {
      tenant_key: string;
      user_id: string;
      open_id: string;
    };
    token: string;
    action: {
      value: {
        requestId: string;
        decision: Decision;
      };
      tag: string;
      input_value?: string;  // Text input from form
      form_value?: Record<string, string>;  // Form values
    };
    host: string;
    delivery_type: string;
    context: {
      url: string;
      preview_token: string;
      open_message_id: string;
      open_chat_id: string;
    };
  };
}

// Lark URL Verification Challenge
export interface LarkUrlVerification {
  challenge: string;
  token: string;
  type: 'url_verification';
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface NotifyRequest {
  tool: string;
  command?: string;
  description?: string;
  args?: Record<string, unknown>;
  workingDirectory: string;
  project?: string;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
}

export interface NotifyResponse {
  requestId: string;
  expiresAt: number;
}

export interface StatusResponse {
  status: 'pending' | 'approved' | 'denied' | 'expired' | 'not_found' | 'message';
  decision?: Decision;
  message?: string;  // Text instruction from user
  respondedAt?: number;
}
