/**
 * LinkedIn API type definitions.
 * Based on LinkedIn REST API v2 and Community Management API.
 */

// --- URN Types ---

export type LinkedInUrn = `urn:li:${string}:${string}`;
export type PersonUrn = `urn:li:person:${string}`;
export type OrganizationUrn = `urn:li:organization:${string}`;
export type ShareUrn = `urn:li:share:${string}`;
export type PostUrn = `urn:li:${string}:${string}`;
export type ImageUrn = `urn:li:image:${string}`;

// --- OAuth ---

export interface OAuthTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  scope: string;
}

export interface StoredToken {
  userId: string;
  accessToken: string;
  refreshToken?: string;
  scopes: string[];
  expiresAt: number; // Unix timestamp ms
  refreshTokenExpiresAt?: number;
  createdAt: number;
}

// --- Scopes ---

export const LINKEDIN_SCOPES = {
  // Self-serve (no approval needed)
  OPENID: 'openid',
  PROFILE: 'profile',
  EMAIL: 'email',
  MEMBER_SOCIAL_WRITE: 'w_member_social',

  // Community Management API (requires approval)
  ORG_SOCIAL_READ: 'r_organization_social',
  ORG_SOCIAL_WRITE: 'w_organization_social',
  ORG_ADMIN_READ: 'r_organization_admin',
  ORG_ADMIN_WRITE: 'rw_organization_admin',
  ORG_FOLLOWERS: 'r_organization_followers',
  MEMBER_POST_ANALYTICS: 'r_member_postAnalytics',
  MEMBER_PROFILE_ANALYTICS: 'r_member_profileAnalytics',

  // Advertising API (requires approval)
  ADS_READ: 'r_ads',
  ADS_WRITE: 'rw_ads',
  ADS_REPORTING: 'r_ads_reporting',
} as const;

export type LinkedInScope = (typeof LINKEDIN_SCOPES)[keyof typeof LINKEDIN_SCOPES];

export const SELF_SERVE_SCOPES: LinkedInScope[] = [
  LINKEDIN_SCOPES.OPENID,
  LINKEDIN_SCOPES.PROFILE,
  LINKEDIN_SCOPES.EMAIL,
  LINKEDIN_SCOPES.MEMBER_SOCIAL_WRITE,
];

// --- Profile ---

export interface UserInfo {
  sub: string;
  name: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  email?: string;
  email_verified?: boolean;
  locale?: { language: string; country: string };
}

// --- Posts ---

export type PostVisibility = 'PUBLIC' | 'CONNECTIONS' | 'LOGGED_IN';

export type PostLifecycleState = 'PUBLISHED' | 'DRAFT';

export type MediaType = 'NONE' | 'ARTICLE' | 'IMAGE' | 'VIDEO';

export interface CreatePostRequest {
  author: LinkedInUrn;
  commentary: string;
  visibility: PostVisibility;
  distribution: {
    feedDistribution: 'MAIN_FEED' | 'NONE';
    targetEntities: unknown[];
    thirdPartyDistributionChannels: unknown[];
  };
  lifecycleState: PostLifecycleState;
  content?: PostContent;
}

export interface PostContent {
  article?: ArticleContent;
  media?: MediaContent;
}

export interface ArticleContent {
  source: string; // URL
  title?: string;
  description?: string;
  thumbnail?: string; // image URN
}

export interface MediaContent {
  id: ImageUrn;
  altText?: string;
}

export interface Post {
  id: PostUrn;
  author: LinkedInUrn;
  commentary: string;
  visibility: PostVisibility;
  lifecycleState: PostLifecycleState;
  publishedAt?: string;
  lastModifiedAt?: string;
  distribution: {
    feedDistribution: string;
  };
}

// --- Comments ---

export interface CreateCommentRequest {
  actor: LinkedInUrn;
  message: string;
  parentComment?: LinkedInUrn;
}

export interface Comment {
  id: string;
  actor: LinkedInUrn;
  message: string;
  createdAt: number;
}

// --- Reactions ---

export type ReactionType = 'LIKE' | 'PRAISE' | 'APPRECIATION' | 'EMPATHY' | 'INTEREST' | 'ENTERTAINMENT';

export interface CreateReactionRequest {
  root: LinkedInUrn; // post URN
  reactionType: ReactionType;
}

// --- Image Upload ---

export interface InitializeUploadRequest {
  initializeUploadRequest: {
    owner: LinkedInUrn;
  };
}

export interface InitializeUploadResponse {
  value: {
    uploadUrlExpiresAt: number;
    uploadUrl: string;
    image: ImageUrn;
  };
}

// --- Events ---

export interface CreateEventRequest {
  organizer: LinkedInUrn;
  name: string;
  description?: string;
  eventUrl?: string;
  timeRange: {
    start: string; // ISO 8601
    end?: string;
  };
  format: 'ONLINE' | 'IN_PERSON' | 'HYBRID';
}

export interface LinkedInEvent {
  id: string;
  organizer: LinkedInUrn;
  name: string;
  description?: string;
  timeRange: {
    start: string;
    end?: string;
  };
  format: string;
}

// --- API Error ---

export interface LinkedInApiErrorResponse {
  status: number;
  serviceErrorCode?: number;
  code?: string;
  message: string;
}
