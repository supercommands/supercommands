import { generateEntityId } from '../shared-components/utils';
import type { LinkItem } from '../allObjectFolder/src/createObject/links/linkTypes';

export type OnboardingRoleId = 'founder' | 'developer' | 'product' | 'design' | 'finance' | 'student' | 'personal';
export type SupportedOnboardingRoleId = Extract<OnboardingRoleId, 'founder' | 'developer' | 'student' | 'personal'>;
export type DashboardViewGroup = 'work' | 'personal' | 'college';
export type OnboardingWidgetKind = 'session' | 'notes' | 'ai-prompts' | 'links' | 'news' | 'weather';

export interface OnboardingResourceItem {
  id?: string;
  title: string;
  url: string;
  favIconUrl?: string;
}
export interface OnboardingNoteObjectTemplate {
  type: 'note';
  title: string;
  content: string;
}
export interface OnboardingLinkObjectTemplate {
  type: 'link';
  title: string;
  urls?: OnboardingResourceItem[];
}
export interface OnboardingAiPromptObjectTemplate {
  type: 'aiPrompt';
  title: string;
  content: string;
}
export interface OnboardingSessionObjectTemplate {
  type: 'session';
  title: string;
  description?: string;
  urls?: OnboardingResourceItem[];
}
export interface OnboardingTodoObjectTemplate {
  type: 'todo';
  title: string;
  description: string;
}
export type OnboardingObjectTemplate =
  | OnboardingNoteObjectTemplate
  | OnboardingLinkObjectTemplate
  | OnboardingAiPromptObjectTemplate
  | OnboardingSessionObjectTemplate
  | OnboardingTodoObjectTemplate;
export interface OnboardingTodoTemplate {
  title: string;
  description: string;
}

export interface OnboardingDashboardViewTemplate {
  id: string;
  version: number;
  role: SupportedOnboardingRoleId;
  group: DashboardViewGroup;
  title: string;
  description: string;
  tone: 'blue' | 'mint' | 'lavender' | 'peach';
  iconKey: string;
  defaultSelected: boolean;
  defaultShortcut: string;
  isDefaultView: boolean;
  autoOpen: boolean;
  todo?: OnboardingTodoTemplate;
  widgets: OnboardingWidgetKind[];
  objects: OnboardingObjectTemplate[];
}

export interface OnboardingRoleTemplate {
  id: SupportedOnboardingRoleId;
  label: string;
  description: string;
  group: DashboardViewGroup;
  iconKey: string;
  views: OnboardingDashboardViewTemplate[];
}

export type FounderResourceItem = OnboardingResourceItem;
export type FounderNoteObjectTemplate = OnboardingNoteObjectTemplate;
export type FounderLinkObjectTemplate = OnboardingLinkObjectTemplate;
export type FounderAiPromptObjectTemplate = OnboardingAiPromptObjectTemplate;
export type FounderSessionObjectTemplate = OnboardingSessionObjectTemplate;
export type FounderObjectTemplate = OnboardingObjectTemplate;
export type FounderDashboardViewTemplate = OnboardingDashboardViewTemplate;

export const ROLE_TO_DASHBOARD_GROUP: Record<SupportedOnboardingRoleId, DashboardViewGroup> = {
  founder: 'work',
  developer: 'work',
  student: 'college',
  personal: 'personal',
};

const resource = (title: string, url: string): OnboardingResourceItem => ({ title, url });
const GMAIL = resource('Gmail', 'https://mail.google.com/');
const CALENDAR = resource('Google Calendar', 'https://calendar.google.com/');
const DRIVE = resource('Google Drive', 'https://drive.google.com/');
const SLACK = resource('Slack', 'https://slack.com/');
const LINKEDIN_JOBS = resource('LinkedIn Jobs', 'https://www.linkedin.com/jobs/');
const WELLFOUND = resource('Wellfound', 'https://wellfound.com/jobs');
const YC_JOBS = resource('YC Jobs', 'https://www.ycombinator.com/jobs');
const HACKER_NEWS = resource('Hacker News', 'https://news.ycombinator.com/');
const TECHCRUNCH_STARTUPS = resource('TechCrunch Startups', 'https://techcrunch.com/category/startups/');
const PRODUCT_HUNT = resource('Product Hunt', 'https://www.producthunt.com/');

type ViewInput = Omit<
  OnboardingDashboardViewTemplate,
  'version' | 'description' | 'defaultSelected' | 'defaultShortcut' | 'iconKey' | 'objects'
> & {
  defaultShortcut?: string;
  notes: string[];
  urls?: OnboardingResourceItem[];
  agentName: string;
  agentPrompt: string;
};

const ONBOARDING_VIEW_SHORTCUTS: Record<string, string> = {
  'founder-default': 'main',
  'founder-daily-work': 'daily',
  'founder-startup-tech-news': 'technews',
  'founder-fundraising-deals': 'deals',
  'founder-hiring': 'hiring',
  'developer-default': 'main',
  'developer-daily-work': 'daily',
  'developer-dev-ai-news': 'devnews',
  'developer-startup-tools': 'tools',
  'developer-jobs': 'jobs',
  'student-default': 'main',
  'student-daily-college': 'college',
  'student-study-planning': 'planning',
  'student-career-internships': 'internships',
  'personal-default': 'main',
  'personal-news': 'news',
  'personal-health-fitness': 'health',
};

const makeView = (input: ViewInput): OnboardingDashboardViewTemplate => {
  const urls = input.urls || [];
  const noteObjects: OnboardingNoteObjectTemplate[] =
    input.notes.length > 0
      ? input.notes.map(noteTitle => ({
          type: 'note',
          title: noteTitle,
          content: '',
        }))
      : [
          {
            type: 'note',
            title: `${input.title} Notes`,
            content: '',
          },
        ];
  const objects: OnboardingObjectTemplate[] = [
    ...noteObjects,
    ...(urls.length ? [{ type: 'link' as const, title: `${input.title} Links`, urls }] : []),
    { type: 'aiPrompt', title: input.agentName, content: input.agentPrompt },
    { type: 'session', title: input.title, description: '', urls },
    ...(input.todo ? [{ type: 'todo' as const, ...input.todo }] : []),
  ];
  return {
    id: input.id,
    version: 7,
    role: input.role,
    group: input.group,
    title: input.title,
    description: `A ready-to-use ${input.title.toLowerCase()} workspace with the recommended tools and content.`,
    tone: input.tone,
    iconKey: input.id,
    defaultSelected: true,
    defaultShortcut: input.defaultShortcut || input.title.toLowerCase().replace(/[^a-z0-9]+/g, ''),
    isDefaultView: input.isDefaultView,
    autoOpen: input.autoOpen,
    todo: input.todo,
    widgets: input.widgets,
    objects,
  };
};

const PERSONAL_NOTES = ['Personal Notes', 'Things to Remember', 'Personal To-dos', 'Important Info'];

const FOUNDER_VIEWS: OnboardingDashboardViewTemplate[] = [
  makeView({
    id: 'founder-default',
    role: 'founder',
    group: 'personal',
    title: 'Main Dashboard',
    defaultShortcut: 'main',
    tone: 'blue',
    isDefaultView: true,
    autoOpen: false,
    notes: PERSONAL_NOTES,
    agentName: 'Personal Assistant',
    agentPrompt:
      'Help me organize personal notes, reminders and calendar items into a short prioritized plan without adding unnecessary tasks.',
    widgets: ['session', 'ai-prompts', 'notes'],
  }),
  makeView({
    id: 'founder-daily-work',
    role: 'founder',
    group: 'work',
    title: 'Daily Work',
    defaultShortcut: 'work',
    tone: 'mint',
    isDefaultView: false,
    autoOpen: false,
    notes: ["Today's Priorities", 'Meeting Notes', 'Follow-ups', 'Ideas'],
    urls: [GMAIL, CALENDAR, SLACK],
    todo: {
      title: "Review today's priorities, important emails and meetings",
      description: 'Review the most important founder priorities, email, and meetings for the day.',
    },
    agentName: 'Founder Daily Assistant',
    agentPrompt:
      "Help me prioritize today's work, prepare for meetings, and turn notes into clear next actions. Keep responses concise.",
    widgets: ['session', 'ai-prompts', 'notes'],
  }),
  makeView({
    id: 'founder-startup-tech-news',
    role: 'founder',
    group: 'work',
    title: 'Startup & Tech News',
    defaultShortcut: 'technews',
    tone: 'lavender',
    isDefaultView: false,
    autoOpen: false,
    notes: ['Founder Reads', 'Startup Ideas', 'Market Notes', 'Things to Share'],
    urls: [TECHCRUNCH_STARTUPS, HACKER_NEWS, PRODUCT_HUNT, resource('VentureBeat', 'https://venturebeat.com/')],
    agentName: 'Startup News Analyst',
    agentPrompt:
      'Summarize startup and technology updates I share, explain why they matter to a founder, and highlight the most useful takeaways.',
    widgets: ['session', 'ai-prompts', 'news', 'links', 'notes'],
  }),
  makeView({
    id: 'founder-fundraising-deals',
    role: 'founder',
    group: 'work',
    title: 'Fundraising & Deals',
    defaultShortcut: 'deals',
    tone: 'peach',
    isDefaultView: false,
    autoOpen: true,
    notes: ['Investor Notes', 'Pitch Feedback', 'Investor Shortlist', 'Funding Updates'],
    urls: [
      resource('Crunchbase News', 'https://news.crunchbase.com/'),
      resource('Reuters Deals', 'https://www.reuters.com/markets/deals/'),
      TECHCRUNCH_STARTUPS,
      resource('OpenVC', 'https://www.openvc.app/'),
    ],
    agentName: 'Funding & Deals Analyst',
    agentPrompt:
      'Summarize fundraising and venture deal news I share, identify notable rounds, investors and valuations, and help me turn investor notes into useful fundraising follow-ups.',
    widgets: ['session', 'ai-prompts', 'news', 'links', 'notes'],
  }),
  makeView({
    id: 'founder-hiring',
    role: 'founder',
    group: 'work',
    title: 'Hiring',
    defaultShortcut: 'hiring',
    tone: 'blue',
    isDefaultView: false,
    autoOpen: false,
    notes: ['Candidate Notes', 'Interview Notes', 'Hiring Requirements', 'Shortlist'],
    urls: [LINKEDIN_JOBS, WELLFOUND, YC_JOBS],
    agentName: 'Hiring Assistant',
    agentPrompt:
      'Help me screen candidates against role requirements, prepare interview questions, compare candidates objectively, and summarize interview notes.',
    widgets: ['session', 'ai-prompts', 'links', 'notes'],
  }),
];

const DEVELOPER_VIEWS: OnboardingDashboardViewTemplate[] = [
  makeView({
    id: 'developer-default',
    role: 'developer',
    group: 'personal',
    title: 'Main Dashboard',
    defaultShortcut: 'main',
    tone: 'blue',
    isDefaultView: true,
    autoOpen: false,
    notes: PERSONAL_NOTES,
    urls: [GMAIL, CALENDAR],
    agentName: 'Personal Assistant',
    agentPrompt:
      'Help me organize personal notes, reminders and calendar items into a concise plan without creating unnecessary tasks.',
    widgets: ['session', 'ai-prompts', 'notes'],
  }),
  makeView({
    id: 'developer-daily-work',
    role: 'developer',
    group: 'work',
    title: 'Daily Work',
    defaultShortcut: 'work',
    tone: 'mint',
    isDefaultView: false,
    autoOpen: false,
    notes: ["Today's Tasks", 'Dev Notes', 'Blockers', 'Follow-ups'],
    urls: [resource('GitHub', 'https://github.com/'), GMAIL, CALENDAR, SLACK],
    todo: {
      title: "Review today's development work, blockers and pull requests",
      description: 'Review current development tasks, blockers, and open pull requests.',
    },
    agentName: 'Developer Work Assistant',
    agentPrompt:
      'Help me organize development work, clarify blockers, review technical notes, and turn them into prioritized next actions without assuming a specific tech stack.',
    widgets: ['session', 'ai-prompts', 'notes'],
  }),
  makeView({
    id: 'developer-dev-ai-news',
    role: 'developer',
    group: 'work',
    title: 'Dev & AI News',
    defaultShortcut: 'ainews',
    tone: 'lavender',
    isDefaultView: false,
    autoOpen: false,
    notes: ['Things to Read', 'Engineering Trends', 'AI Notes', 'Saved Articles'],
    urls: [
      HACKER_NEWS,
      resource('InfoQ', 'https://www.infoq.com/'),
      resource('The New Stack', 'https://thenewstack.io/'),
      resource('Ars Technica', 'https://arstechnica.com/'),
    ],
    agentName: 'Developer News Analyst',
    agentPrompt:
      'Summarize software engineering and AI news I share, identify meaningful technical trends, and separate durable developments from hype.',
    widgets: ['session', 'ai-prompts', 'news', 'links', 'notes'],
  }),
  makeView({
    id: 'developer-startup-tools',
    role: 'developer',
    group: 'work',
    title: 'Startup Tech, Tools & Launches',
    defaultShortcut: 'launches',
    tone: 'peach',
    isDefaultView: false,
    autoOpen: false,
    notes: ['Startup Reads', 'New Products', 'Tools to Try', 'Launch Notes'],
    urls: [
      TECHCRUNCH_STARTUPS,
      PRODUCT_HUNT,
      resource('GitHub Trending', 'https://github.com/trending'),
      resource('Hacker News Show', 'https://news.ycombinator.com/show'),
    ],
    agentName: 'Tech Scout',
    agentPrompt:
      'Review startup technology, developer tools and launches I share, explain what is technically notable, and flag which products or projects are worth exploring.',
    widgets: ['session', 'ai-prompts', 'news', 'links', 'notes'],
  }),
  makeView({
    id: 'developer-jobs',
    role: 'developer',
    group: 'work',
    title: 'Jobs',
    defaultShortcut: 'jobs',
    tone: 'blue',
    isDefaultView: false,
    autoOpen: true,
    notes: ['Applications', 'Interview Notes', 'Companies to Apply', 'Resume Notes'],
    urls: [LINKEDIN_JOBS, WELLFOUND, YC_JOBS, resource('Hacker News Jobs', 'https://news.ycombinator.com/jobs')],
    agentName: 'Developer Job Assistant',
    agentPrompt:
      'Help me evaluate developer roles, compare job descriptions, tailor application points, prepare interviews, and track application follow-ups.',
    widgets: ['session', 'ai-prompts', 'links', 'notes'],
  }),
];

const STUDENT_VIEWS: OnboardingDashboardViewTemplate[] = [
  makeView({
    id: 'student-default',
    role: 'student',
    group: 'personal',
    title: 'Main Dashboard',
    defaultShortcut: 'main',
    tone: 'blue',
    isDefaultView: true,
    autoOpen: false,
    notes: PERSONAL_NOTES,
    urls: [GMAIL, CALENDAR],
    agentName: 'Personal Assistant',
    agentPrompt:
      'Help me organize personal notes, reminders and calendar items into a concise plan without creating unnecessary tasks.',
    widgets: ['session', 'ai-prompts', 'notes'],
  }),
  makeView({
    id: 'student-daily-college',
    role: 'student',
    group: 'college',
    title: 'Daily College',
    defaultShortcut: 'college',
    tone: 'mint',
    isDefaultView: false,
    autoOpen: false,
    notes: ["Today's Classes", 'Deadlines', 'College Notes', 'Questions'],
    urls: [GMAIL, CALENDAR, DRIVE],
    todo: {
      title: "Check today's classes and important deadlines",
      description: "Review today's classes and prioritize any important academic deadlines.",
    },
    agentName: 'College Assistant',
    agentPrompt:
      'Help me organize classes, deadlines, college notes and questions into a clear daily plan, prioritizing anything time-sensitive.',
    widgets: ['session', 'ai-prompts', 'notes'],
  }),
  makeView({
    id: 'student-study-planning',
    role: 'student',
    group: 'college',
    title: 'Study Planning',
    defaultShortcut: 'study',
    tone: 'lavender',
    isDefaultView: false,
    autoOpen: false,
    notes: ['Topics to Revise', 'Exam Notes', 'Study Plan', 'Questions to Resolve'],
    agentName: 'Study Planner',
    agentPrompt:
      'Turn the topics, exams and deadlines I provide into a realistic study plan with clear priorities and manageable study blocks.',
    widgets: ['session', 'ai-prompts', 'notes'],
  }),
  makeView({
    id: 'student-career-internships',
    role: 'student',
    group: 'college',
    title: 'Career & Internships',
    defaultShortcut: 'internships',
    tone: 'peach',
    isDefaultView: false,
    autoOpen: true,
    notes: ['Applications', 'Companies to Explore', 'Interview Notes', 'Resume Notes'],
    urls: [LINKEDIN_JOBS, resource('Internshala', 'https://internshala.com/'), WELLFOUND, YC_JOBS],
    agentName: 'Career & Internship Assistant',
    agentPrompt:
      'Help me compare internships and entry-level roles, identify relevant skills, tailor resume points, prepare interviews, and organize application follow-ups.',
    widgets: ['session', 'ai-prompts', 'links', 'notes'],
  }),
];

const PERSONAL_VIEWS: OnboardingDashboardViewTemplate[] = [
  makeView({
    id: 'personal-default',
    role: 'personal',
    group: 'personal',
    title: 'Main Dashboard',
    defaultShortcut: 'main',
    tone: 'blue',
    isDefaultView: true,
    autoOpen: false,
    notes: PERSONAL_NOTES,
    urls: [GMAIL, CALENDAR],
    todo: {
      title: "Review today's priorities and important reminders",
      description: 'Review personal priorities and important reminders for the day.',
    },
    agentName: 'Personal Assistant',
    agentPrompt:
      'Help me organize personal notes, reminders and calendar items into a short prioritized plan without adding unnecessary tasks.',
    widgets: ['session', 'ai-prompts', 'notes'],
  }),
  makeView({
    id: 'personal-news',
    role: 'personal',
    group: 'personal',
    title: 'News',
    defaultShortcut: 'news',
    tone: 'mint',
    isDefaultView: false,
    autoOpen: false,
    notes: [],
    urls: [
      resource('Substack', 'https://substack.com/'),
      HACKER_NEWS,
      resource('Ars Technica', 'https://arstechnica.com/'),
      resource('WIRED', 'https://www.wired.com/'),
      resource('MIT Technology Review', 'https://www.technologyreview.com/'),
    ],
    agentName: 'Reading & Tech News Assistant',
    agentPrompt:
      'Summarize articles and technology news I share, extract the strongest ideas, connect related concepts, and keep a concise list of useful takeaways.',
    widgets: ['session', 'ai-prompts', 'news', 'links', 'notes'],
  }),
  makeView({
    id: 'personal-health-fitness',
    role: 'personal',
    group: 'personal',
    title: 'Health & Fitness',
    defaultShortcut: 'fitness',
    tone: 'lavender',
    isDefaultView: false,
    autoOpen: false,
    notes: ['Workout Notes', 'Health Notes', 'Goals', 'Progress Notes'],
    urls: [
      resource('Mayo Clinic', 'https://www.mayoclinic.org/'),
      resource('Healthline', 'https://www.healthline.com/'),
      resource('STAT', 'https://www.statnews.com/'),
    ],
    agentName: 'Health Information Assistant',
    agentPrompt:
      'Help me organize health and fitness information I share, summarize reputable guidance, track goals, and clearly flag when a question needs professional medical advice.',
    widgets: ['session', 'ai-prompts', 'links', 'notes'],
  }),
];

export const ONBOARDING_ROLE_TEMPLATES: OnboardingRoleTemplate[] = [
  {
    id: 'founder',
    label: 'Founder',
    description: 'Run the company and stay on top of execution.',
    group: 'work',
    iconKey: 'founder',
    views: FOUNDER_VIEWS,
  },
  {
    id: 'developer',
    label: 'Developer',
    description: 'Plan development work and follow technical trends.',
    group: 'work',
    iconKey: 'developer',
    views: DEVELOPER_VIEWS,
  },
  {
    id: 'student',
    label: 'Student',
    description: 'Organize college, study, and career planning.',
    group: 'college',
    iconKey: 'student',
    views: STUDENT_VIEWS,
  },
  {
    id: 'personal',
    label: 'Personal',
    description: 'Keep personal information, reading, and health organized.',
    group: 'personal',
    iconKey: 'personal',
    views: PERSONAL_VIEWS,
  },
];

export function getRoleTemplates(roleId: OnboardingRoleId): OnboardingDashboardViewTemplate[] {
  return ONBOARDING_ROLE_TEMPLATES.find(role => role.id === roleId)?.views || FOUNDER_VIEWS;
}

export const isMandatoryOnboardingTemplate = (template: OnboardingDashboardViewTemplate): boolean =>
  template.isDefaultView || template.autoOpen || Boolean(template.todo);

export function getRecommendedRoleTemplates(
  roleId: SupportedOnboardingRoleId,
  random: () => number = Math.random,
): OnboardingDashboardViewTemplate[] {
  const available = getRoleTemplates(roleId);
  if (available.length <= 4) return [...available];
  const mandatory = available.filter(isMandatoryOnboardingTemplate);
  const remaining = available.filter(template => !mandatory.some(item => item.id === template.id));
  const selected = [...mandatory];
  while (selected.length < 4 && remaining.length) {
    const index = Math.min(remaining.length - 1, Math.floor(random() * remaining.length));
    selected.push(remaining.splice(index, 1)[0]);
  }
  const selectedIds = new Set(selected.map(template => template.id));
  return available.filter(template => selectedIds.has(template.id));
}

export function generateLinkItems(resources?: OnboardingResourceItem[]): LinkItem[] {
  if (!resources?.length) return [];
  return resources.map(item => ({
    id: generateEntityId('link_item'),
    title: item.title,
    name: item.title,
    url: item.url,
    favIconUrl: item.favIconUrl,
    source: 'custom',
  }));
}

export const ALL_ONBOARDING_DASHBOARD_VIEW_TEMPLATES = ONBOARDING_ROLE_TEMPLATES.flatMap(role => role.views);
export const FOUNDER_DASHBOARD_VIEW_TEMPLATES = FOUNDER_VIEWS;
