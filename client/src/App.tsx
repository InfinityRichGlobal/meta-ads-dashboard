import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import DashboardLayout from "./components/DashboardLayout";
import { ThemeProvider } from "./contexts/ThemeContext";

import Dashboard from "./pages/Dashboard";
import Campaigns from "./pages/Campaigns";
import AdsEvaluation from "./pages/AdsEvaluation";
import AiInsights from "./pages/AiInsights";
import AiDrafts from "./pages/AiDrafts";
import AiCreator from "./pages/AiCreator";
import Geo from "./pages/Geo";
import Creative from "./pages/Creative";
import Audience from "./pages/Audience";
import AudienceResearch from "./pages/AudienceResearch";
import Dayparting from "./pages/Dayparting";
import Quality from "./pages/Quality";
import AbTest from "./pages/AbTest";
import Breakeven from "./pages/Breakeven";
import Automation from "./pages/Automation";
import Settings from "./pages/Settings";

function Router() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/campaigns" component={Campaigns} />
        <Route path="/ads" component={AdsEvaluation} />
        <Route path="/ai-insights" component={AiInsights} />
        <Route path="/ai-drafts" component={AiDrafts} />
        <Route path="/ai-creator" component={AiCreator} />
        <Route path="/geo" component={Geo} />
        <Route path="/creative" component={Creative} />
        <Route path="/audience" component={Audience} />
        <Route path="/audience-research" component={AudienceResearch} />
        <Route path="/dayparting" component={Dayparting} />
        <Route path="/quality" component={Quality} />
        <Route path="/abtest" component={AbTest} />
        <Route path="/breakeven" component={Breakeven} />
        <Route path="/automation" component={Automation} />
        <Route path="/settings" component={Settings} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider delayDuration={150}>
          <Toaster position="top-right" theme="dark" richColors />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
