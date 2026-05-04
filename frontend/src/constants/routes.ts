/**
 * Route constants for the application
 * All route paths should be defined here and used throughout the project
 */
export const ROUTES = {
    HOME: "/home",
    SCHEMA: "/schema-validation",
    SCENARIO: "/scenario",
    FLOW_TESTING: "/flow-testing",
    LOGIN: "/login",
    PROFILE: "/profile",
    TOOLS: "/tools",
    SELLER_ONBOARDING: "/seller-onboarding",
    PLAYGROUND: "/playground",
    HISTORY: "/history",
    DB_BACK_OFFICE: "/db-back-office",
    ROOT: "/",
    AUTH_HEADER: "/auth-header",
    FRAMEWORK_HEALTH: "/framework-health",
    DEVELOPER_GUIDE: "/developer-guide",
    DEVELOPER_GUIDE_GETTING_STARTED: "/developer-guide/getting-started",
    SELLER_LOAD_TESTING: "/seller-load-testing",
    /** Use case flow: domain and version are URL-encoded if needed; useCase is slug e.g. personal_loan */
    DEVELOPER_GUIDE_USE_CASE: "/developer-guide/:domain/:version/:useCase",
    /** General developer doc page, slug matches filename in GitHub docs/developer-docs */
    DEVELOPER_GUIDE_DOC: "/developer-guide/docs/:slug",
    /** Standalone x-validations table for a domain/version (usecase-independent). */
    DEVELOPER_GUIDE_VALIDATIONS: "/validations/developer-guide/:domain/:version",
} as const;

/** Build path for a specific developer guide use case (domain/version passed as-is; useCase as slug). */
export function getDeveloperGuideUseCasePath(
    domain: string,
    version: string,
    useCaseSlug: string
): string {
    const enc = encodeURIComponent;
    return `/developer-guide/${enc(domain)}/${enc(version)}/${enc(useCaseSlug)}`;
}

export function getDeveloperGuideDocPath(slug: string): string {
    return `/developer-guide/docs/${slug}`;
}

export function getDeveloperGuideValidationsPath(domain: string, version: string): string {
    const enc = encodeURIComponent;
    return `/validations/developer-guide/${enc(domain)}/${enc(version)}`;
}

/**
 * Type for route paths
 */
export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];
