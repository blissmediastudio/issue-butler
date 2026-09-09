import type { Category, ConversationTurn, ReportStatus, StatusLabelConfig } from "@issue-butler/core";

export interface Report {
  id: number;
  guildId: string;
  channelId: string;
  messageId: string;
  threadId: string | null;
  authorId: string;
  authorTag: string;
  rawContent: string;
  category: Category;
  status: ReportStatus;
  elaborationRound: number;
  githubIssueUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GuildConfig {
  guildId: string;
  feedbackChannelId: string | null;
  moderatorRoleId: string | null;
  approvalEmoji: string;
  maxElaborationRounds: number;
  statusLabels: StatusLabelConfig;
}

/** The shape the PUT /config route actually accepts — statusLabels is flattened server-side. */
export interface GuildConfigUpdate {
  feedbackChannelId?: string | null;
  moderatorRoleId?: string | null;
  approvalEmoji?: string;
  maxElaborationRounds?: number;
  backlogLabels?: string[];
  inProgressLabels?: string[];
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiClientOptions {
  adminToken: string;
}

async function request<T>(path: string, options: ApiClientOptions, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${options.adminToken}`,
      "content-type": "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new ApiError(response.status, body.error ?? response.statusText);
  }

  return (await response.json()) as T;
}

export function createApiClient(options: ApiClientOptions) {
  return {
    listReports(guildId: string, filters: { status?: ReportStatus; category?: Category } = {}): Promise<Report[]> {
      const params = new URLSearchParams();
      if (filters.status) params.set("status", filters.status);
      if (filters.category) params.set("category", filters.category);
      const query = params.toString();
      return request(`/api/guilds/${guildId}/reports${query ? `?${query}` : ""}`, options);
    },

    getTranscript(reportId: number): Promise<ConversationTurn[]> {
      return request(`/api/reports/${reportId}/transcript`, options);
    },

    getConfig(guildId: string): Promise<GuildConfig> {
      return request(`/api/guilds/${guildId}/config`, options);
    },

    updateConfig(guildId: string, patch: GuildConfigUpdate): Promise<GuildConfig> {
      return request(`/api/guilds/${guildId}/config`, options, {
        method: "PUT",
        body: JSON.stringify(patch),
      });
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
