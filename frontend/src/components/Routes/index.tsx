import { Navigate, Route, Routes as RouterRoutes } from "react-router-dom";
import SchemaValidationPage from "@pages/schema-validation";
import SellerOnboarding from "@pages/seller-onboarding";
import ToolsPage from "@pages/tools";
import Login from "@pages/login";
import UserProfile from "@pages/user-profile";
import ProtocolPlayGround from "@pages/protocol-playground";
import HistoryPage from "@pages/history";
import DBBackOffice from "@pages/db-back-office";
import FlowTestingWrapper from "@pages/flow-testing";
import NotFoundPage from "@components/ui/not-found";
import ScenarioPage from "@pages/scenario";
import HomePage from "@pages/home";
import SellerLoadTesting from "@pages/seller-load-testing";
import AuthHeader from "@pages/auth-header";
import FrameworkHealthPage from "@pages/framework-health";
import { ROUTES } from "@constants/routes";
import DeveloperGuideLanding from "@/pages/developer-guide/landing/DeveloperGuideLanding";
import DeveloperGuideFlowPage from "@/pages/developer-guide/DeveloperGuideFlowPage";
import DeveloperGuideGettingStarted from "@/pages/developer-guide/landing/DeveloperGuideGettingStarted";
import DeveloperGuideDocPage from "@/pages/developer-guide/DeveloperGuideDocPage";
import ValidationsPage from "@/pages/developer-guide/ValidationsPage";

/** Developer Guide is only available in development; redirect to home in production */
const DeveloperGuideWrapper = ({ children }: { children: React.ReactNode }) =>
    import.meta.env.VITE_ENVIRONMENT === "development" ? (
        <>{children}</>
    ) : (
        <Navigate to={ROUTES.HOME} replace />
    );

const Routes = () => (
    <RouterRoutes>
        <Route path={ROUTES.HOME} element={<HomePage />} />
        <Route path={ROUTES.SCHEMA} element={<SchemaValidationPage />} />
        {/*  Scenario Page Route  is the go to flow testing page with np form*/}
        <Route path={ROUTES.SCENARIO} element={<ScenarioPage />} />
        {/* ROUTES.FLOW_TESTING is for Flow testing through URL parameters not via scenario testing page */}
        <Route path={ROUTES.FLOW_TESTING} element={<FlowTestingWrapper />} />
        <Route path={ROUTES.LOGIN} element={<Login />} />
        <Route path={ROUTES.PROFILE} element={<UserProfile />} />
        <Route path={ROUTES.TOOLS} element={<ToolsPage />} />
        <Route path={ROUTES.SELLER_ONBOARDING} element={<SellerOnboarding />} />
        <Route path={ROUTES.PLAYGROUND} element={<ProtocolPlayGround />} />
        <Route path={ROUTES.HISTORY} element={<HistoryPage />} />
        <Route path="*" element={<NotFoundPage />} />
        <Route path={ROUTES.DB_BACK_OFFICE} element={<DBBackOffice />} />
        <Route path={ROUTES.AUTH_HEADER} element={<AuthHeader />} />
        <Route path={ROUTES.SELLER_LOAD_TESTING} element={<SellerLoadTesting />} />
        <Route path={ROUTES.FRAMEWORK_HEALTH} element={<FrameworkHealthPage />} />
        <Route
            path={ROUTES.DEVELOPER_GUIDE}
            element={
                <DeveloperGuideWrapper>
                    <DeveloperGuideLanding />
                </DeveloperGuideWrapper>
            }
        />
        <Route
            path={ROUTES.DEVELOPER_GUIDE_GETTING_STARTED}
            element={
                <DeveloperGuideWrapper>
                    <DeveloperGuideGettingStarted />
                </DeveloperGuideWrapper>
            }
        />
        <Route
            path={ROUTES.DEVELOPER_GUIDE_USE_CASE}
            element={
                <DeveloperGuideWrapper>
                    <DeveloperGuideFlowPage />
                </DeveloperGuideWrapper>
            }
        />
        <Route
            path={ROUTES.DEVELOPER_GUIDE_DOC}
            element={
                <DeveloperGuideWrapper>
                    <DeveloperGuideDocPage />
                </DeveloperGuideWrapper>
            }
        />
        <Route
            path={ROUTES.DEVELOPER_GUIDE_VALIDATIONS}
            element={
                <DeveloperGuideWrapper>
                    <ValidationsPage />
                </DeveloperGuideWrapper>
            }
        />
    </RouterRoutes>
);

export default Routes;
