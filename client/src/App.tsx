import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import SiteHeader from "@/components/SiteHeader";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import AdminPage from "./pages/Admin";
import { DynamicMenuItemPage, DynamicMenuSubItemPage } from "./pages/DynamicPage";
import Sitemap from "./pages/Sitemap";
import FaithData from "./pages/FaithData";
import ChurchDirectory from "./pages/ChurchDirectory";

// 교회 회원 시스템
import MemberRegister from "./pages/MemberRegister";
import MemberLogin from "./pages/MemberLogin";
import MemberMyPage from "./pages/MemberMyPage";

// 시설 예약
import FacilityList from "./pages/FacilityList";
import FacilityDetail from "./pages/FacilityDetail";
import FacilityApply from "./pages/FacilityApply";
import MyReservations from "./pages/MyReservations";

// 선교보고
import MissionList from "./pages/MissionList";
import MissionDetail from "./pages/MissionDetail";

// 교회소개 (기존)
import { PastorGreeting, ChurchHistory, ChurchVision, Location } from "./pages/About";

// 교회소개 (신규)
import { StaffPage, WhiteBookPage, MinistryPrinciplePage, CIPage, ShuttleBusPage } from "./pages/ChurchIntro";

// 예배/미디어
import { JoyfulTV, WorshipSchedule, Bulletin } from "./pages/Worship";

// 조이풀TV 하위 메뉴
import {
  SundayWorshipPage,
  WednesdayWorshipPage,
  FridayPrayerPage,
  DawnBiblePage,
  PastorSeriesPage,
  HaDawnPage,
  SpecialWorshipPage,
  SpecialFeaturePage,
  TestimonyPage,
  PraisePage,
} from "./pages/JoyfulTV";

// 양육/훈련
import { NewMember, DiscipleTraining, BibleStudy, SundaySchool } from "./pages/Education";

// 양육/훈련 신규
import {
  HesedAsiaPage,
  DiscipleTrainingPage,
  ElderTrainingPage,
  OneOnOnePage,
  SunseumSchoolPage,
  SaengseonConferencePage,
  WorldMissionPage,
  EvangelismPage,
  PrayerMinistryPage,
  WelfarePage,
  VisionUniversityPage,
  JoyLabPage,
} from "./pages/Ministry";

// 커뮤니티/행정 (기존)
import { ChurchNews, PrayerRequest, Offering, VehicleGuide, NewMemberGuide, JoyfulStore } from "./pages/Community";

// 커뮤니티 신규
import {
  SunMeetingPage,
  OrganizationPage,
  ClubPage,
  PhotoPage,
  JoyTalkPage,
  SubtitleRequestPage,
  OnlineOfficePage,
  VisitRequestPage,
  DonationReceiptPage,
} from "./pages/CommunityExtra";

// 선교 사역
import { DomesticMission, OverseasMission, Volunteer } from "./pages/Mission";

// 교회학교 래퍼 컴포넌트
const InfantDept = () => <SundaySchool dept="유아부" />;
const KinderDept = () => <SundaySchool dept="유치부" />;
const ElementaryDept = () => <SundaySchool dept="초등부" />;
const YouthDept = () => <SundaySchool dept="중고등부" />;
const AwanaDept = () => <SundaySchool dept="AWANA" />;
const YoungAdultDept = () => <SundaySchool dept="청년부" />;
function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      {/* 메인 */}
      <Route path="/" component={Home} />
      <Route path="/faith-data" component={FaithData} />
      <Route path="/church-directory" component={ChurchDirectory} />

      {/* 교회소개 */}
      <Route path="/about/pastor" component={PastorGreeting} />
      <Route path="/about/history" component={ChurchHistory} />
      <Route path="/about/vision" component={ChurchVision} />
      <Route path="/about/staff" component={StaffPage} />
      <Route path="/about/whitebook" component={WhiteBookPage} />
      <Route path="/about/principle" component={MinistryPrinciplePage} />
      <Route path="/about/ci" component={CIPage} />
      <Route path="/about/shuttle" component={ShuttleBusPage} />
      <Route path="/about/directions" component={Location} />

      {/* 조이풀TV */}
      <Route path="/worship/tv" component={JoyfulTV} />
      <Route path="/worship/tv/sunday" component={SundayWorshipPage} />
      <Route path="/worship/tv/hebron" component={WednesdayWorshipPage} />
      <Route path="/worship/tv/shekhinah" component={FridayPrayerPage} />
      <Route path="/worship/tv/gloria" component={DawnBiblePage} />
      <Route path="/worship/tv/pastor-series" component={PastorSeriesPage} />
      <Route path="/worship/tv/hayoungin" component={HaDawnPage} />
      <Route path="/worship/tv/special" component={SpecialWorshipPage} />
      <Route path="/worship/tv/feature" component={SpecialFeaturePage} />
      <Route path="/worship/tv/testimony" component={TestimonyPage} />
      <Route path="/worship/tv/praise" component={PraisePage} />
      <Route path="/worship/schedule" component={WorshipSchedule} />
      <Route path="/worship/bulletin" component={Bulletin} />

      {/* 양육/훈련 */}
      <Route path="/education/new-member" component={NewMember} />
      <Route path="/education/disciple" component={DiscipleTraining} />
      <Route path="/education/bible" component={BibleStudy} />
      <Route path="/education/hesed" component={HesedAsiaPage} />
      <Route path="/education/disciple2" component={DiscipleTrainingPage} />
      <Route path="/education/elder" component={ElderTrainingPage} />
      <Route path="/education/one-on-one" component={OneOnOnePage} />
      <Route path="/education/sunseumschool" component={SunseumSchoolPage} />
      <Route path="/education/saengseon" component={SaengseonConferencePage} />

      {/* 사역 */}
      <Route path="/ministry/world-mission" component={WorldMissionPage} />
      <Route path="/ministry/evangelism" component={EvangelismPage} />
      <Route path="/ministry/prayer" component={PrayerMinistryPage} />
      <Route path="/ministry/welfare" component={WelfarePage} />
      <Route path="/ministry/vision-univ" component={VisionUniversityPage} />
      <Route path="/ministry/joylab" component={JoyLabPage} />

      {/* 교회학교 */}
      <Route path="/school/infant" component={InfantDept} />
      <Route path="/school/kinder" component={KinderDept} />
      <Route path="/school/elementary" component={ElementaryDept} />
      <Route path="/school/youth" component={YouthDept} />
      <Route path="/school/awana" component={AwanaDept} />
      <Route path="/school/young-adult" component={YoungAdultDept} />

      {/* 사역/선교 */}
      <Route path="/mission-work/domestic" component={DomesticMission} />
      <Route path="/mission-work/overseas" component={OverseasMission} />
      <Route path="/mission-work/volunteer" component={Volunteer} />
      <Route path="/mission/:id" component={MissionDetail} />
      <Route path="/mission" component={MissionList} />

      {/* 커뮤니티 */}
      <Route path="/community/news" component={ChurchNews} />
      <Route path="/community/prayer" component={PrayerRequest} />
      <Route path="/community/soon" component={SunMeetingPage} />
      <Route path="/community/organization" component={OrganizationPage} />
      <Route path="/community/club" component={ClubPage} />
      <Route path="/community/photo" component={PhotoPage} />
      <Route path="/community/joytalk" component={JoyTalkPage} />

      {/* 행정지원 */}
      <Route path="/admin/offering" component={Offering} />
      <Route path="/admin/vehicle" component={VehicleGuide} />
      <Route path="/admin/new-member" component={NewMemberGuide} />
      <Route path="/admin/store" component={JoyfulStore} />
      <Route path="/admin/subtitle" component={SubtitleRequestPage} />
      <Route path="/admin/office" component={OnlineOfficePage} />
      <Route path="/admin/tour" component={VisitRequestPage} />
      <Route path="/admin/donation" component={DonationReceiptPage} />

      {/* 시설 예약 */}
      {/* 교회 회원 시스템 */}
      <Route path="/member/register" component={MemberRegister} />
      <Route path="/member/login" component={MemberLogin} />
      <Route path="/member/my-page" component={MemberMyPage} />

      <Route path="/facility" component={FacilityList} />
      <Route path="/facility/my-reservations" component={MyReservations} />
      <Route path="/facility/:id/apply" component={FacilityApply} />
      <Route path="/facility/:id" component={FacilityDetail} />

      {/* 사이트맵 */}
      <Route path="/sitemap" component={Sitemap} />

      {/* 동적 메뉴 페이지 (pageType에 따라 다른 UI 표시) */}
      <Route path="/page/item/:id" component={DynamicMenuItemPage} />
      <Route path="/page/sub/:id" component={DynamicMenuSubItemPage} />

      {/* 관리자 - 비공개 경로 */}
      <Route path="/admin_joych_2026" component={AdminPage} />
      {/* /admin 직접 접근 시 404로 처리 (관리자 페이지 존재 힌트 차단) */}
      <Route path="/admin" component={NotFound} />

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
          <SiteHeader />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
