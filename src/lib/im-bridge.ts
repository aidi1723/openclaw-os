export type ImBridgeProviderId = "generic" | "feishu" | "dingtalk";

export type ImBridgeProviderConfig = {
  replyMode: "webhook" | "official_api";
  replyWebhookUrl: string;
  verificationToken: string;
  signingSecret: string;
  officialApiBaseUrl: string;
  officialAppId: string;
  officialAppSecret: string;
  officialTargetId: string;
  officialTargetIdType: string;
  officialRobotCode: string;
  officialConversationId: string;
};

export type ImBridgeConfig = {
  enabled: boolean;
  publicBaseUrl: string;
  accessToken: string;
  defaultProvider: ImBridgeProviderId;
  autoReply: boolean;
  commandPrefix: string;
  providers: Record<ImBridgeProviderId, ImBridgeProviderConfig>;
};

export type ImBridgeHealth = {
  enabled: boolean;
  configured: boolean;
  defaultProvider: ImBridgeProviderId;
  publicBaseUrl: string;
  authModes: {
    bearerHeader: string;
    customHeader: string;
    queryParam: string;
  };
  callbackUrls: Record<ImBridgeProviderId, string>;
  providerStatus: Record<
    ImBridgeProviderId,
    { replyConfigured: boolean; authConfigured: boolean; officialApiConfigured: boolean }
  >;
  nextAction: string;
};

export type ImBridgeEventStatus =
  | "completed"
  | "failed"
  | "ignored"
  | "unauthorized"
  | "disabled"
  | "invalid"
  | "blocked";

export type ImBridgeEvent = {
  id: string;
  createdAt: number;
  provider: ImBridgeProviderId;
  kind: "inbound" | "test";
  status: ImBridgeEventStatus;
  sessionId: string;
  commandText: string;
  requestText: string;
  resultText: string;
  resultPreview: string;
  delivered: boolean;
  error: string;
  retryable: boolean;
  sourceEventId: string;
};

export const defaultImBridgeConfig: ImBridgeConfig = {
  enabled: false,
  publicBaseUrl: "",
  accessToken: "",
  defaultProvider: "generic",
  autoReply: true,
  commandPrefix: "",
  providers: {
    generic: {
      replyMode: "webhook",
      replyWebhookUrl: "",
      verificationToken: "",
      signingSecret: "",
      officialApiBaseUrl: "",
      officialAppId: "",
      officialAppSecret: "",
      officialTargetId: "",
      officialTargetIdType: "",
      officialRobotCode: "",
      officialConversationId: "",
    },
    feishu: {
      replyMode: "webhook",
      replyWebhookUrl: "",
      verificationToken: "",
      signingSecret: "",
      officialApiBaseUrl: "https://open.feishu.cn",
      officialAppId: "",
      officialAppSecret: "",
      officialTargetId: "",
      officialTargetIdType: "chat_id",
      officialRobotCode: "",
      officialConversationId: "",
    },
    dingtalk: {
      replyMode: "webhook",
      replyWebhookUrl: "",
      verificationToken: "",
      signingSecret: "",
      officialApiBaseUrl: "https://api.dingtalk.com",
      officialAppId: "",
      officialAppSecret: "",
      officialTargetId: "",
      officialTargetIdType: "",
      officialRobotCode: "",
      officialConversationId: "",
    },
  },
};
