import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NoticePopupLayer from "@/components/NoticePopupLayer";
import SiteHeader from "@/components/SiteHeader";
import SitewideAdminEditor from "@/components/SitewideAdminEditor";
import NotFound from "@/pages/NotFound";
import { lazy, Suspense, useEffect } from "react";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";

const AdminPage = lazy(() => import("./pages/Admin"));
const Sitemap = lazy(() => import("./pages/Sitemap"));
const FaithData = lazy(() => import("./pages/FaithData"));
const ChurchDirectory = lazy(() => import("./pages/ChurchDirectory"));
const PlaygroundRankings = lazy(() => import("./pages/PlaygroundRankings"));
const LegacyVodPage = lazy(() => import("./pages/LegacyVodPage"));
const MemberRegister = lazy(() => import("./pages/MemberRegister"));
const MemberLogin = lazy(() => import("./pages/MemberLogin"));
const MemberMyPage = lazy(() => import("./pages/MemberMyPage"));
const MemberSocialComplete = lazy(() => import("./pages/MemberSocialComplete"));
const FacilityList = lazy(() => import("./pages/FacilityList"));
const FacilityDetail = lazy(() => import("./pages/FacilityDetail"));
const FacilityApply = lazy(() => import("./pages/FacilityApply"));
const MyReservations = lazy(() => import("./pages/MyReservations"));
const CourseList = lazy(() => import("./pages/CourseList"));
const MissionList = lazy(() => import("./pages/MissionList"));
const MissionDetail = lazy(() => import("./pages/MissionDetail"));
const MissionReportEditor = lazy(() => import("./pages/MissionReportEditor"));
const TestimonyList = lazy(() => import("./pages/TestimonyBoard"));
const TestimonyDetail = lazy(() =>
  import("./pages/TestimonyBoard").then(module => ({
    default: module.TestimonyDetail,
  }))
);
const TestimonyEditor = lazy(() =>
  import("./pages/TestimonyBoard").then(module => ({
    default: module.TestimonyEditor,
  }))
);

const DynamicMenuHrefPage = lazy(() =>
  import("./pages/DynamicPage").then(module => ({
    default: module.DynamicMenuHrefPage,
  }))
);
const DynamicMenuItemPage = lazy(() =>
  import("./pages/DynamicPage").then(module => ({
    default: module.DynamicMenuItemPage,
  }))
);
const DynamicMenuSubItemPage = lazy(() =>
  import("./pages/DynamicPage").then(module => ({
    default: module.DynamicMenuSubItemPage,
  }))
);

const PastorGreeting = lazy(() =>
  import("./pages/About").then(module => ({ default: module.PastorGreeting }))
);
const ChurchHistory = lazy(() => import("./pages/ChurchHistory"));
const ChurchVision = lazy(() =>
  import("./pages/About").then(module => ({ default: module.ChurchVision }))
);
const Location = lazy(() =>
  import("./pages/About").then(module => ({ default: module.Location }))
);

const StaffPage = lazy(() =>
  import("./pages/ChurchIntro").then(module => ({ default: module.StaffPage }))
);
const PastorBooksPage = lazy(() =>
  import("./pages/ChurchIntro").then(module => ({
    default: module.PastorBooksPage,
  }))
);
const WhiteBookPage = lazy(() =>
  import("./pages/ChurchIntro").then(module => ({
    default: module.WhiteBookPage,
  }))
);
const MinistryPrinciplePage = lazy(() =>
  import("./pages/ChurchIntro").then(module => ({
    default: module.MinistryPrinciplePage,
  }))
);
const CIPage = lazy(() =>
  import("./pages/ChurchIntro").then(module => ({ default: module.CIPage }))
);
const ShuttleBusPage = lazy(() =>
  import("./pages/ChurchIntro").then(module => ({
    default: module.ShuttleBusPage,
  }))
);

const JoyfulTV = lazy(() =>
  import("./pages/Worship").then(module => ({ default: module.JoyfulTV }))
);
const Bulletin = lazy(() =>
  import("./pages/Worship").then(module => ({ default: module.Bulletin }))
);
const BulletinDetail = lazy(() =>
  import("./pages/Worship").then(module => ({ default: module.BulletinDetail }))
);

const WednesdayWorshipPage = lazy(() =>
  import("./pages/JoyfulTV").then(module => ({
    default: module.WednesdayWorshipPage,
  }))
);
const FridayPrayerPage = lazy(() =>
  import("./pages/JoyfulTV").then(module => ({
    default: module.FridayPrayerPage,
  }))
);
const DawnBiblePage = lazy(() =>
  import("./pages/JoyfulTV").then(module => ({ default: module.DawnBiblePage }))
);
const PastorSeriesPage = lazy(() =>
  import("./pages/JoyfulTV").then(module => ({
    default: module.PastorSeriesPage,
  }))
);
const HaDawnPage = lazy(() =>
  import("./pages/JoyfulTV").then(module => ({ default: module.HaDawnPage }))
);
const SpecialWorshipPage = lazy(() =>
  import("./pages/JoyfulTV").then(module => ({
    default: module.SpecialWorshipPage,
  }))
);
const SpecialFeaturePage = lazy(() =>
  import("./pages/JoyfulTV").then(module => ({
    default: module.SpecialFeaturePage,
  }))
);
const TestimonyPage = lazy(() =>
  import("./pages/JoyfulTV").then(module => ({ default: module.TestimonyPage }))
);
const PraisePage = lazy(() =>
  import("./pages/JoyfulTV").then(module => ({ default: module.PraisePage }))
);

const NewMember = lazy(() =>
  import("./pages/Education").then(module => ({ default: module.NewMember }))
);
const DiscipleTraining = lazy(() =>
  import("./pages/Education").then(module => ({
    default: module.DiscipleTraining,
  }))
);
const BibleStudy = lazy(() =>
  import("./pages/Education").then(module => ({ default: module.BibleStudy }))
);
const SundaySchool = lazy(() =>
  import("./pages/Education").then(module => ({ default: module.SundaySchool }))
);

const HesedAsiaPage = lazy(() =>
  import("./pages/Ministry").then(module => ({ default: module.HesedAsiaPage }))
);
const DiscipleTrainingPage = lazy(() =>
  import("./pages/Ministry").then(module => ({
    default: module.DiscipleTrainingPage,
  }))
);
const ElderTrainingPage = lazy(() =>
  import("./pages/Ministry").then(module => ({
    default: module.ElderTrainingPage,
  }))
);
const OneOnOnePage = lazy(() =>
  import("./pages/Ministry").then(module => ({ default: module.OneOnOnePage }))
);
const SunseumSchoolPage = lazy(() =>
  import("./pages/Ministry").then(module => ({
    default: module.SunseumSchoolPage,
  }))
);
const SaengseonConferencePage = lazy(() =>
  import("./pages/Ministry").then(module => ({
    default: module.SaengseonConferencePage,
  }))
);
const WorldMissionPage = lazy(() =>
  import("./pages/Ministry").then(module => ({
    default: module.WorldMissionPage,
  }))
);
const EvangelismPage = lazy(() =>
  import("./pages/Ministry").then(module => ({
    default: module.EvangelismPage,
  }))
);
const PrayerMinistryPage = lazy(() =>
  import("./pages/Ministry").then(module => ({
    default: module.PrayerMinistryPage,
  }))
);
const WelfarePage = lazy(() =>
  import("./pages/Ministry").then(module => ({ default: module.WelfarePage }))
);
const VisionUniversityPage = lazy(() =>
  import("./pages/Ministry").then(module => ({
    default: module.VisionUniversityPage,
  }))
);
const JoyLabPage = lazy(() =>
  import("./pages/Ministry").then(module => ({ default: module.JoyLabPage }))
);

const PrayerRequest = lazy(() =>
  import("./pages/Community").then(module => ({
    default: module.PrayerRequest,
  }))
);
const Offering = lazy(() =>
  import("./pages/Community").then(module => ({ default: module.Offering }))
);
const VehicleGuide = lazy(() =>
  import("./pages/Community").then(module => ({ default: module.VehicleGuide }))
);
const NewMemberGuide = lazy(() =>
  import("./pages/Community").then(module => ({
    default: module.NewMemberGuide,
  }))
);
const JoyfulStore = lazy(() =>
  import("./pages/Community").then(module => ({ default: module.JoyfulStore }))
);

const SunMeetingPage = lazy(() =>
  import("./pages/CommunityExtra").then(module => ({
    default: module.SunMeetingPage,
  }))
);
const OrganizationPage = lazy(() =>
  import("./pages/CommunityExtra").then(module => ({
    default: module.OrganizationPage,
  }))
);
const ClubPage = lazy(() =>
  import("./pages/CommunityExtra").then(module => ({
    default: module.ClubPage,
  }))
);
const SubtitleRequestPage = lazy(() =>
  import("./pages/CommunityExtra").then(module => ({
    default: module.SubtitleRequestPage,
  }))
);
const BulletinAdRequestPage = lazy(() =>
  import("./pages/CommunityExtra").then(module => ({
    default: module.BulletinAdRequestPage,
  }))
);
const OnlineOfficePage = lazy(() =>
  import("./pages/CommunityExtra").then(module => ({
    default: module.OnlineOfficePage,
  }))
);
const VisitRequestPage = lazy(() =>
  import("./pages/CommunityExtra").then(module => ({
    default: module.VisitRequestApplicationPage,
  }))
);
const DonationReceiptPage = lazy(() =>
  import("./pages/CommunityExtra").then(module => ({
    default: module.DonationReceiptPage,
  }))
);

const DomesticMission = lazy(() =>
  import("./pages/Mission").then(module => ({
    default: module.DomesticMission,
  }))
);
const OverseasMission = lazy(() =>
  import("./pages/Mission").then(module => ({
    default: module.OverseasMission,
  }))
);
const Volunteer = lazy(() =>
  import("./pages/Mission").then(module => ({ default: module.Volunteer }))
);

// 교회학교 래퍼 컴포넌트
const InfantDept = () => <SundaySchool dept="infant" />;
const KinderDept = () => <SundaySchool dept="kindergarten" />;
const ElementaryDept = () => <SundaySchool dept="elementary" />;
const YouthDept = () => <SundaySchool dept="youth" />;
const AwanaDept = () => <SundaySchool dept="awana" />;
const YoungAdultDept = () => <SundaySchool dept="young-adult" />;

function LegacyRedirect({ to }: { to: string }) {
  const [, setLocation] = useLocation();

  useEffect(() => {
    setLocation(to, { replace: true });
  }, [setLocation, to]);

  return null;
}

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      {/* 메인 */}
      <Route path="/" component={Home} />
      <Route path="/faith-data" component={FaithData} />
      <Route path="/church-directory" component={ChurchDirectory} />
      <Route path="/playground" component={PlaygroundRankings} />
      <Route path="/legacy-vod/:pageCode/:num/:vodType" component={LegacyVodPage} />

      {/* 교회소개 */}
      <Route path="/about/pastor" component={PastorGreeting} />
      <Route path="/about/history" component={ChurchHistory} />
      <Route path="/about/vision" component={ChurchVision} />
      <Route path="/about/pastor/books" component={PastorBooksPage} />
      <Route path="/about/staff/associate" component={StaffPage} />
      <Route path="/about/staff" component={StaffPage} />
      <Route path="/page/교회소개-담임목사-저서" component={PastorBooksPage} />
      <Route path="/page/교회소개-섬기는-분" component={StaffPage} />
      <Route path="/page/교회소개-부교역자" component={StaffPage} />
      <Route path="/about/whitebook" component={WhiteBookPage} />
      <Route path="/about/principle" component={MinistryPrinciplePage} />
      <Route path="/about/ci" component={CIPage} />
      <Route path="/about/shuttle" component={ShuttleBusPage} />
      <Route path="/about/directions" component={Location} />

      {/* 조이풀TV */}
      <Route path="/worship/tv" component={JoyfulTV} />
      <Route path="/worship/tv/sunday">
        <LegacyRedirect to="/page/조이풀tv-주일예배" />
      </Route>
      <Route path="/worship/tv/hebron" component={WednesdayWorshipPage} />
      <Route path="/worship/tv/shekhinah" component={FridayPrayerPage} />
      <Route path="/worship/tv/gloria" component={DawnBiblePage} />
      <Route path="/worship/tv/pastor-series" component={PastorSeriesPage} />
      <Route path="/worship/tv/hayoungin" component={HaDawnPage} />
      <Route path="/worship/tv/special" component={SpecialWorshipPage} />
      <Route path="/worship/tv/feature" component={SpecialFeaturePage} />
      <Route path="/worship/tv/testimony" component={TestimonyPage} />
      <Route path="/worship/tv/praise" component={PraisePage} />
      <Route path="/worship/schedule" component={DynamicMenuHrefPage} />
      <Route path="/worship/bulletin/:id" component={BulletinDetail} />
      <Route path="/worship/bulletin" component={Bulletin} />

      {/* 양육/훈련 */}
      <Route path="/education/new-member" component={NewMember} />
      <Route path="/education/disciple" component={DiscipleTraining} />
      <Route path="/education/bible" component={BibleStudy} />
      <Route path="/education/courses" component={CourseList} />
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
      <Route path="/mission/write" component={MissionReportEditor} />
      <Route path="/mission/edit/:id" component={MissionReportEditor} />
      <Route path="/mission/:id" component={MissionDetail} />
      <Route path="/mission" component={MissionList} />

      {/* 커뮤니티 */}
      <Route path="/community/news">
        <LegacyRedirect to="/page/행정지원-공지사항" />
      </Route>
      <Route path="/community/prayer" component={PrayerRequest} />
      <Route path="/community/soon" component={SunMeetingPage} />
      <Route path="/community/organization" component={OrganizationPage} />
      <Route path="/community/club" component={ClubPage} />
      <Route path="/community/photo">
        <LegacyRedirect to="/page/커뮤니티-최근-행사-사진" />
      </Route>
      <Route path="/community/testimony/write" component={TestimonyEditor} />
      <Route path="/community/testimony/edit/:id" component={TestimonyEditor} />
      <Route path="/community/testimony/:id" component={TestimonyDetail} />
      <Route path="/community/testimony" component={TestimonyList} />
      <Route path="/community/joytalk">
        <LegacyRedirect to="/page/커뮤니티-자유게시판" />
      </Route>

      {/* 행정지원 */}
      <Route path="/support/offering" component={Offering} />
      <Route path="/support/vehicle" component={VehicleGuide} />
      <Route path="/support/new-member" component={NewMemberGuide} />
      <Route path="/support/store" component={JoyfulStore} />
      <Route path="/support/bulletin-ad" component={BulletinAdRequestPage} />
      <Route path="/support/subtitle" component={SubtitleRequestPage} />
      <Route path="/support/office" component={OnlineOfficePage} />
      <Route path="/support/tour" component={VisitRequestPage} />
      <Route path="/support/donation" component={DonationReceiptPage} />

      {/* 행정지원 - 기존 공개 URL 호환 */}
      <Route path="/admin/offering" component={Offering} />
      <Route path="/admin/vehicle" component={VehicleGuide} />
      <Route path="/admin/new-member" component={NewMemberGuide} />
      <Route path="/admin/store" component={JoyfulStore} />
      <Route path="/admin/bulletin-ad" component={BulletinAdRequestPage} />
      <Route path="/admin/subtitle" component={SubtitleRequestPage} />
      <Route path="/admin/office" component={OnlineOfficePage} />
      <Route path="/admin/tour" component={VisitRequestPage} />
      <Route path="/admin/donation" component={DonationReceiptPage} />

      {/* 시설 예약 */}
      {/* 교회 회원 시스템 */}
      <Route path="/member/register" component={MemberRegister} />
      <Route path="/member/login" component={MemberLogin} />
      <Route path="/member/social-complete" component={MemberSocialComplete} />
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
      <Route path="/page/:slug" component={DynamicMenuHrefPage} />

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
          <SitewideAdminEditor />
          <Suspense fallback={null}>
            <Router />
          </Suspense>
          <NoticePopupLayer />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
