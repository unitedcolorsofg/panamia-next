export interface PronounsInterface {
  sheher?: boolean;
  hehim?: boolean;
  theythem?: boolean;
  none?: boolean;
  other?: boolean;
  other_desc?: string;
}

export interface ProfileStatusInterface {
  submitted?: Date;
  approved?: Date;
  published?: Date;
  notes?: String;
}

export interface ProfileGenteDePanaInterface {
  code?: string;
  percentage?: string;
  details?: string;
}

export interface ProfileSocialsInterface {
  website?: string;
  instagram?: string;
  facebook?: string;
  tiktok?: string;
  twitter?: string;
  spotify?: string;
}

export interface AddressInterface {
  name: string;
  street1?: string;
  street2?: string;
  city?: string;
  state?: string;
  zipcode?: string;
  hours?: string;
  lat?: string;
  lng?: string;
  google_place_id?: string;
}

export interface CountyInterface {
  palm_beach: Boolean;
  broward: Boolean;
  miami_dade: Boolean;
}

export interface ProfileImagesInterface {
  primary?: string;
  primaryCDN?: string;
  gallery1?: string;
  gallery1CDN?: string;
  gallery2?: string;
  gallery2CDN?: string;
  gallery3?: string;
  gallery3CDN?: string;
}

export interface CategoryInterface {
  products: Boolean;
  services: Boolean;
  events: Boolean;
  music: Boolean;
  food: Boolean;
  clothing: Boolean;
  accessories: Boolean;
  art: Boolean;
  digital_art: Boolean;
  tech: Boolean;
  health_beauty: Boolean;
  wellness: Boolean;
  non_profit: Boolean;
  homemade: Boolean;
}

export interface MentoringInterface {
  enabled: boolean;
  expertise: string[];
  languages: string[];
  bio: string;
  videoIntroUrl?: string;
  goals?: string;
  hourlyRate?: number;
}

export interface ProfileInterface {
  _id: string;
  email: string;
  name: string;
  slug: string;
  active?: Boolean;
  status?: ProfileStatusInterface;
  locally_based: string;
  details: string;
  background?: string;
  hearaboutus?: string;
  affiliate?: string;
  socials: ProfileSocialsInterface;
  phone_number: string;
  whatsapp_community?: Boolean;
  pronouns?: PronounsInterface;
  five_words: string;
  tags?: string;
  counties: CountyInterface;
  categories: CategoryInterface;
  primary_address: AddressInterface;
  gentedepana: ProfileGenteDePanaInterface;
  geo: {};
  locations: [];
  images?: ProfileImagesInterface;
  linked_profiles: [];
  mentoring?: MentoringInterface;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContactUsInterface {
  _id: String;
  name: String;
  email: String;
  message: String;
  acknowledged: Boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SignupInterface {
  _id: String;
  email: String;
  name: String;
  signupType: String;
  acknowledged: Boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserStatusInterface {
  role?: String;
  locked?: Boolean;
}

export type AccountType = 'small_business' | 'personal' | 'hybrid' | 'other';

export interface UserInterface {
  _id: String;
  email: String;
  screenname?: String;
  name?: String;
  accountType?: AccountType;
  status?: UserStatusInterface;
  zip_code?: String;
  affiliate: {
    activated: boolean;
    code: string;
    accepted_tos: Date;
    tier: number;
    points: number;
  };
  alternate_emails?: [];
  following?: string[];
  notificationPreferences?: NotificationPreferencesInterface;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserlistInterface {
  _id: string;
  user_id: string;
  name: string;
  desc?: string;
  public: boolean;
  profiles: string[];
}

export interface Pagination {
  count: number;
  per_page: number;
  offset: number;
  page_number: number;
  total_pages: number;
}

/**
 * UPSTREAM REFERENCE: https://github.com/llun/activities.next
 * ActivityPub-shaped notification for future federation
 */
export type NotificationActivityType =
  | 'Invite'
  | 'Accept'
  | 'Reject'
  | 'Create'
  | 'Update'
  | 'Delete'
  | 'Announce'
  | 'Like'
  | 'Follow'
  | 'Undo';

export type NotificationContext =
  | 'coauthor'
  | 'review'
  | 'article'
  | 'mentoring'
  | 'mention'
  | 'follow'
  | 'system';

export interface NotificationInterface {
  _id: string;
  type: NotificationActivityType;
  actor: string;
  object?: string;
  target: string;
  context: NotificationContext;
  actorScreenname?: string;
  actorName?: string;
  objectType?: 'article' | 'profile' | 'session' | 'comment';
  objectTitle?: string;
  objectUrl?: string;
  message?: string;
  read: boolean;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationPreferencesInterface {
  coauthorInvites: boolean;
  reviewRequests: boolean;
  articlePublished: boolean;
  articleReplies: boolean;
  revisionNeeded: boolean;
  mentoringRequests: boolean;
  systemAnnouncements: boolean;
}

/**
 * Article Types
 *
 * UPSTREAM REFERENCE: https://github.com/llun/activities.next
 * Article schema designed for future ActivityPub federation
 */
export type ArticleType = 'business_update' | 'community_commentary';

export type ArticleStatus =
  | 'draft'
  | 'pending_review'
  | 'revision_needed'
  | 'published'
  | 'removed';

export interface CoAuthorInterface {
  userId: string;
  invitedAt: Date;
  invitationMessage?: string;
  status: 'pending' | 'accepted' | 'declined';
  acceptedAt?: Date;
}

export interface ReviewChecklistInterface {
  factsVerified: boolean;
  sourcesChecked: boolean;
  communityStandards: boolean;
}

export interface ReviewCommentInterface {
  id: string;
  text: string;
  contentRef?: string;
  createdAt: Date;
  resolved: boolean;
  resolvedAt?: Date;
}

export interface ReviewRecordInterface {
  userId: string;
  requestedAt: Date;
  invitationMessage?: string;
  status: 'pending' | 'approved' | 'revision_needed';
  checklist: ReviewChecklistInterface;
  comments: ReviewCommentInterface[];
  approvedAt?: Date;
}

export interface ArticleInterface {
  _id: string;
  slug: string;
  title: string;
  content: string;
  excerpt: string;
  coverImage?: string;
  articleType: ArticleType;
  tags: string[];
  authorId: string;
  coAuthors: CoAuthorInterface[];
  reviewedBy?: ReviewRecordInterface;
  inReplyTo?: string;
  status: ArticleStatus;
  publishedAt?: Date;
  removedAt?: Date;
  removedBy?: string;
  removalReason?: string;
  readingTime: number;
  createdAt: Date;
  updatedAt: Date;
}
