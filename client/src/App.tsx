import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";

// 시설 예약
import FacilityList from "./pages/FacilityList";
import FacilityDetail from "./pages/FacilityDetail";
import FacilityApply from "./pages/FacilityApply";

// 선교보고
import MissionList from "./pages/MissionList";
import MissionDetail from "./pages/MissionDetail";

// 교회소개
import {
  PastorGreeting,
  ChurchHistory,
  ChurchVision,
  Location,
} from "./pages/About";

// 예배/미디어
import {
  JoyfulTV,
  WorshipSchedule,
  Bulletin,
} from "./pages/Worship";

// 양육/훈련/교회학교
import {
  NewMember,
  DiscipleTraining,
  BibleStudy,
  SundaySchool,
} from "./pages/Education";

// 커뮤니티/행정
import {
  ChurchNews,
  PrayerRequest,
  Offering,
  VehicleGuide,
  NewMemberGuide,
  JoyfulStore,
} from "./pages/Community";

// 선교 사역
import {
  DomesticMission,
  OverseasMission,
  Volunteer,
} from "./pages/Mission";

// 교회학교 래퍼 컴포넌트
const InfantDept = () => <SundaySchool dept="유아부" />;
const KinderDept = () => <SundaySchool dept="유치부" />;
const ElementaryDept = () => <SundaySchool dept="초등부" />;
const YouthDept = () => <SundaySchool dept="중고등부" />;

function Router() {
  return (
    <Switch>
      {/* 메인 */}
      <Route path="/" component={Home} />

      {/* 교회소개 */}
      <Route path="/about/pastor" component={PastorGreeting} />
      <Route path="/about/history" component={ChurchHistory} />
      <Route path="/about/vision" component={ChurchVision} />
      <Route path="/about/directions" component={Location} />

      {/* 예배/미디어 */}
      <Route path="/worship/tv" component={JoyfulTV} />
      <Route path="/worship/schedule" component={WorshipSchedule} />
      <Route path="/worship/bulletin" component={Bulletin} />

      {/* 양육/훈련 */}
      <Route path="/education/new-member" component={NewMember} />
      <Route path="/education/disciple" component={DiscipleTraining} />
      <Route path="/education/bible" component={BibleStudy} />

      {/* 교회학교 */}
      <Route path="/school/infant" component={InfantDept} />
      <Route path="/school/kinder" component={KinderDept} />
      <Route path="/school/elementary" component={ElementaryDept} />
      <Route path="/school/youth" component={YouthDept} />

      {/* 사역/선교 */}
      <Route path="/mission-work/domestic" component={DomesticMission} />
      <Route path="/mission-work/overseas" component={OverseasMission} />
      <Route path="/mission-work/volunteer" component={Volunteer} />
      <Route path="/mission/:id" component={MissionDetail} />
      <Route path="/mission" component={MissionList} />

      {/* 커뮤니티 */}
      <Route path="/community/news" component={ChurchNews} />
      <Route path="/community/prayer" component={PrayerRequest} />

      {/* 행정지원 */}
      <Route path="/admin/offering" component={Offering} />
      <Route path="/admin/vehicle" component={VehicleGuide} />
      <Route path="/admin/new-member" component={NewMemberGuide} />
      <Route path="/admin/store" component={JoyfulStore} />

      {/* 시설 예약 */}
      <Route path="/facility" component={FacilityList} />
      <Route path="/facility/:id/apply" component={FacilityApply} />
      <Route path="/facility/:id" component={FacilityDetail} />

      {/* 404 */}
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
