import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import FacilityList from "./pages/FacilityList";
import FacilityDetail from "./pages/FacilityDetail";
import FacilityApply from "./pages/FacilityApply";
import MissionList from "./pages/MissionList";
import MissionDetail from "./pages/MissionDetail";


function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path="/facility" component={FacilityList} />
      <Route path="/facility/:id/apply" component={FacilityApply} />
      <Route path="/facility/:id" component={FacilityDetail} />
      <Route path="/mission/:id" component={MissionDetail} />
      <Route path="/mission" component={MissionList} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
