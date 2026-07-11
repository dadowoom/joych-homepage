import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NoticePopupLayer from "@/components/NoticePopupLayer";
import SiteHeader from "@/components/SiteHeader";
import SitewideAdminEditor from "@/components/SitewideAdminEditor";
import MobilePushNotificationPrompt from "@/components/MobilePushNotificationPrompt";
import MenuAccessGate from "@/components/MenuAccessGate";
import { trpc } from "@/lib/trpc";
import { findCourseRoomBySlug } from "@/lib/courseRoutes";
import NotFound from "@/pages/NotFound";
import { lazy, Suspense, useEffect } from "react";
import { Route, Switch, useLocation, type RouteComponentProps } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";

const AdminPage = lazy(() => import("./pages/Admin"));
const Sitemap = lazy(() => import("./pages/Sitemap"));
const FaithData = lazy(() => import("./pages/FaithData"));
const ChurchDirectory = lazy(() => import("./pages/ChurchDirectory"));
const SearchPage = lazy(() => import("./pages/SearchPage"));
const PlaygroundRankings = lazy(() => import("./pages/PlaygroundRankings"));
const LegacyVodPage = lazy(() => import("./pages/LegacyVodPage"));
const MemberRegister = lazy(() => import("./pages/MemberRegister"));
const MemberLogin = lazy(() => import("./pages/MemberLogin"));
const MemberMyPage = lazy(() => import("./pages/MemberMyPage"));
const MemberSocialComplete = lazy(() => import("./pages/MemberSocialComplete"));
const FacilityList = lazy(() => import("./pages/FacilityList"));
const FacilityDetail = lazy(() => import("./pages/FacilityDetail"));
const FacilityApply = lazy(() => import("./pages/FacilityApply"));
const ExternalFacilityList = lazy(() =>
  import("./pages/FacilityList").then(module => ({
    default: module.ExternalFacilityList,
  }))
);
const ExternalFacilityDetail = lazy(() =>
  import("./pages/FacilityDetail").then(module => ({
    default: module.ExternalFacilityDetail,
  }))
);
const ExternalFacilityApply = lazy(() =>
  import("./pages/FacilityApply").then(module => ({
    default: module.ExternalFacilityApply,
  }))
);
const MyReservations = lazy(() => import("./pages/MyReservations"));
const VehicleReservationList = lazy(() =>
  import("./pages/VehicleReservations").then(module => ({
    default: module.VehicleReservationList,
  }))
);
const VehicleReservationApply = lazy(() =>
  import("./pages/VehicleReservations").then(module => ({
    default: module.VehicleReservationApply,
  }))
);
const VehicleReservationDetail = lazy(() =>
  import("./pages/VehicleReservations").then(module => ({
    default: module.VehicleReservationDetail,
  }))
);
const MyVehicleReservations = lazy(() =>
  import("./pages/VehicleReservations").then(module => ({
    default: module.MyVehicleReservations,
  }))
);
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

function GuardedPastorBookDetailPage(props: RouteComponentProps<{ id: string }>) {
  return (
    <MenuAccessGate href="/about/pastor/books">
      <PastorBookDetailPage {...props} />
    </MenuAccessGate>
  );
}

function CourseRoomPage(props: RouteComponentProps<{ slug: string }>) {
  const slug = props.params.slug;
  const { data: menus, isLoading } = trpc.home.menus.useQuery();
  const room = findCourseRoomBySlug(menus, slug);

  if (isLoading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center text-sm text-gray-400">
        불러오는 중...
      </div>
    );
  }

  if (!room?.href) {
    return <NotFound />;
  }

  return <CourseList pageHref={room.href} title={room.label} showHero={false} />;
}
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
const PastorBookDetailPage = lazy(() =>
  import("./pages/ChurchIntro").then(module => ({
    default: module.PastorBookDetailPage,
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
const WorshipSchedule = lazy(() =>
  import("./pages/Worship").then(module => ({ default: module.WorshipSchedule }))
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
const SundayWorshipPage = lazy(() =>
  import("./pages/JoyfulTV").then(module => ({
    default: module.SundayWorshipPage,
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
const NewMemberGuide = lazy(() =>
  import("./pages/Community").then(module => ({
    default: module.NewMemberGuide,
  }))
);
const JoyfulStore = lazy(() =>
  import("./pages/Community").then(module => ({ default: module.JoyfulStore }))
);

const SunMeetingPage = lazy(() => import("./pages/community/SunMeetingPage"));
const OrganizationPage = lazy(() => import("./pages/community/OrganizationPage"));
const ClubPage = lazy(() => import("./pages/community/ClubPage"));
const SubtitleRequestPage = lazy(() => import("./pages/community/SubtitleRequestPage"));
const BulletinAdRequestPage = lazy(() => import("./pages/community/BulletinAdRequestPage"));
const OnlineOfficePage = lazy(() => import("./pages/community/OnlineOfficePage"));
const VisitRequestPage = lazy(() => import("./pages/community/VisitRequestPage"));
const DonationReceiptPage = lazy(() => import("./pages/community/DonationReceiptPage"));

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

function LegacyRedirect({ to }: { to: string }) {
  const [, setLocation] = useLocation();

  useEffect(() => {
    setLocation(to, { replace: true });
  }, [setLocation, to]);

  return null;
}

function ScrollToTop() {
  const [location] = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location]);

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
      <Route path="/search" component={SearchPage} />
      <Route path="/playground" component={PlaygroundRankings} />
      <Route path="/legacy-vod/:pageCode/:num/:vodType" component={LegacyVodPage} />

      {/* 교회소개 */}
      <Route path="/about/pastor"><MenuAccessGate href="/about/pastor"><PastorGreeting /></MenuAccessGate></Route>
      <Route path="/about/history"><MenuAccessGate href="/about/history"><ChurchHistory /></MenuAccessGate></Route>
      <Route path="/about/vision"><MenuAccessGate href="/about/vision"><ChurchVision /></MenuAccessGate></Route>
      <Route path="/about/pastor/books/:id" component={GuardedPastorBookDetailPage} />
      <Route path="/about/pastor/books"><MenuAccessGate href="/about/pastor/books"><PastorBooksPage /></MenuAccessGate></Route>
      <Route path="/about/staff/associate"><MenuAccessGate href="/about/staff/associate"><StaffPage /></MenuAccessGate></Route>
      <Route path="/about/staff"><MenuAccessGate href="/about/staff"><StaffPage /></MenuAccessGate></Route>
      <Route path="/about/whitebook" component={WhiteBookPage} />
      <Route path="/about/principle" component={MinistryPrinciplePage} />
      <Route path="/about/ci" component={CIPage} />
      <Route path="/about/shuttle"><MenuAccessGate href="/about/shuttle"><ShuttleBusPage /></MenuAccessGate></Route>
      <Route path="/about/directions"><MenuAccessGate href="/about/directions"><Location /></MenuAccessGate></Route>

      {/* 조이풀TV */}
      <Route path="/worship/tv"><MenuAccessGate href="/worship/tv"><JoyfulTV /></MenuAccessGate></Route>
      <Route path="/worship/tv/sunday"><MenuAccessGate href="/worship/tv/sunday"><SundayWorshipPage /></MenuAccessGate></Route>
      <Route path="/worship/tv/hebron"><MenuAccessGate href="/worship/tv/hebron"><WednesdayWorshipPage /></MenuAccessGate></Route>
      <Route path="/worship/tv/shekhinah"><MenuAccessGate href="/worship/tv/shekhinah"><FridayPrayerPage /></MenuAccessGate></Route>
      <Route path="/worship/tv/gloria"><MenuAccessGate href="/worship/tv/gloria"><DawnBiblePage /></MenuAccessGate></Route>
      <Route path="/worship/tv/pastor-series"><MenuAccessGate href="/worship/tv/pastor-series"><PastorSeriesPage /></MenuAccessGate></Route>
      <Route path="/worship/tv/hayoungin"><MenuAccessGate href="/worship/tv/hayoungin"><HaDawnPage /></MenuAccessGate></Route>
      <Route path="/worship/tv/special"><MenuAccessGate href="/worship/tv/special"><SpecialWorshipPage /></MenuAccessGate></Route>
      <Route path="/worship/tv/feature"><MenuAccessGate href="/worship/tv/feature"><SpecialFeaturePage /></MenuAccessGate></Route>
      <Route path="/worship/tv/testimony"><MenuAccessGate href="/worship/tv/testimony"><TestimonyPage /></MenuAccessGate></Route>
      <Route path="/worship/tv/praise"><MenuAccessGate href="/worship/tv/praise"><PraisePage /></MenuAccessGate></Route>
      <Route path="/worship/schedule"><MenuAccessGate href="/worship/schedule"><WorshipSchedule /></MenuAccessGate></Route>
      <Route path="/worship/bulletin/:id"><MenuAccessGate href="/worship/bulletin"><BulletinDetail /></MenuAccessGate></Route>
      <Route path="/worship/bulletin"><MenuAccessGate href="/worship/bulletin"><Bulletin /></MenuAccessGate></Route>

      {/* 양육/훈련 */}
      <Route path="/education/new-member" component={NewMember} />
      <Route path="/education/disciple" component={DiscipleTraining} />
      <Route path="/education/bible" component={BibleStudy} />
      <Route path="/education/courses/:slug" component={CourseRoomPage} />
      <Route path="/education/courses"><MenuAccessGate href="/education/courses"><CourseList showHero={false} /></MenuAccessGate></Route>
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

      {/* 사역/선교 */}
      <Route path="/mission-work/domestic"><MenuAccessGate href="/mission"><DomesticMission /></MenuAccessGate></Route>
      <Route path="/mission-work/overseas"><MenuAccessGate href="/mission"><OverseasMission /></MenuAccessGate></Route>
      <Route path="/mission-work/volunteer"><MenuAccessGate href="/mission"><Volunteer /></MenuAccessGate></Route>
      <Route path="/mission/write"><MenuAccessGate href="/mission"><MissionReportEditor /></MenuAccessGate></Route>
      <Route path="/mission/edit/:id"><MenuAccessGate href="/mission"><MissionReportEditor /></MenuAccessGate></Route>
      <Route path="/mission/:id"><MenuAccessGate href="/mission"><MissionDetail /></MenuAccessGate></Route>
      <Route path="/mission"><MenuAccessGate href="/mission"><MissionList /></MenuAccessGate></Route>

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
      <Route path="/community/testimony/write"><MenuAccessGate href="/community/testimony"><TestimonyEditor /></MenuAccessGate></Route>
      <Route path="/community/testimony/edit/:id"><MenuAccessGate href="/community/testimony"><TestimonyEditor /></MenuAccessGate></Route>
      <Route path="/community/testimony/:id"><MenuAccessGate href="/community/testimony"><TestimonyDetail /></MenuAccessGate></Route>
      <Route path="/community/testimony"><MenuAccessGate href="/community/testimony"><TestimonyList /></MenuAccessGate></Route>
      <Route path="/community/joytalk">
        <LegacyRedirect to="/page/커뮤니티-자유게시판" />
      </Route>

      {/* 행정지원 */}
      <Route path="/support/offering"><MenuAccessGate href="/support/offering"><Offering /></MenuAccessGate></Route>
      <Route path="/support/vehicle/my-reservations"><MenuAccessGate href="/support/vehicle"><MyVehicleReservations /></MenuAccessGate></Route>
      <Route path="/support/vehicle/:id/apply"><MenuAccessGate href="/support/vehicle"><VehicleReservationApply /></MenuAccessGate></Route>
      <Route path="/support/vehicle/:id"><MenuAccessGate href="/support/vehicle"><VehicleReservationDetail /></MenuAccessGate></Route>
      <Route path="/support/vehicle"><MenuAccessGate href="/support/vehicle"><VehicleReservationList /></MenuAccessGate></Route>
      <Route path="/support/new-member"><MenuAccessGate href="/support/new-member"><NewMemberGuide /></MenuAccessGate></Route>
      <Route path="/support/store"><MenuAccessGate href="/support/store"><JoyfulStore /></MenuAccessGate></Route>
      <Route path="/support/bulletin-ad"><MenuAccessGate href="/support/bulletin-ad"><BulletinAdRequestPage /></MenuAccessGate></Route>
      <Route path="/support/subtitle"><MenuAccessGate href="/support/subtitle"><SubtitleRequestPage /></MenuAccessGate></Route>
      <Route path="/support/office"><MenuAccessGate href="/support/office"><OnlineOfficePage /></MenuAccessGate></Route>
      <Route path="/support/tour"><MenuAccessGate href="/support/tour"><VisitRequestPage /></MenuAccessGate></Route>
      <Route path="/support/donation"><MenuAccessGate href="/support/donation"><DonationReceiptPage /></MenuAccessGate></Route>

      {/* 행정지원 - 기존 공개 URL 호환 */}
      <Route path="/admin/offering"><MenuAccessGate href="/support/offering"><Offering /></MenuAccessGate></Route>
      <Route path="/admin/vehicle"><MenuAccessGate href="/support/vehicle"><VehicleReservationList /></MenuAccessGate></Route>
      <Route path="/admin/new-member"><MenuAccessGate href="/support/new-member"><NewMemberGuide /></MenuAccessGate></Route>
      <Route path="/admin/store"><MenuAccessGate href="/support/store"><JoyfulStore /></MenuAccessGate></Route>
      <Route path="/admin/bulletin-ad"><MenuAccessGate href="/support/bulletin-ad"><BulletinAdRequestPage /></MenuAccessGate></Route>
      <Route path="/admin/subtitle"><MenuAccessGate href="/support/subtitle"><SubtitleRequestPage /></MenuAccessGate></Route>
      <Route path="/admin/office"><MenuAccessGate href="/support/office"><OnlineOfficePage /></MenuAccessGate></Route>
      <Route path="/admin/tour"><MenuAccessGate href="/support/tour"><VisitRequestPage /></MenuAccessGate></Route>
      <Route path="/admin/donation"><MenuAccessGate href="/support/donation"><DonationReceiptPage /></MenuAccessGate></Route>

      {/* 시설 예약 */}
      {/* 교회 회원 시스템 */}
      <Route path="/member/register" component={MemberRegister} />
      <Route path="/member/login" component={MemberLogin} />
      <Route path="/member/social-complete" component={MemberSocialComplete} />
      <Route path="/member/my-page" component={MemberMyPage} />

      <Route path="/facility/external/:id/apply" component={ExternalFacilityApply} />
      <Route path="/facility/external/:id" component={ExternalFacilityDetail} />
      <Route path="/facility/external" component={ExternalFacilityList} />
      <Route path="/facility"><MenuAccessGate href="/facility"><FacilityList /></MenuAccessGate></Route>
      <Route path="/facility/my-reservations"><MenuAccessGate href="/facility"><MyReservations /></MenuAccessGate></Route>
      <Route path="/facility/:id/apply"><MenuAccessGate href="/facility"><FacilityApply /></MenuAccessGate></Route>
      <Route path="/facility/:id"><MenuAccessGate href="/facility"><FacilityDetail /></MenuAccessGate></Route>

      {/* 사이트맵 */}
      <Route path="/sitemap"><MenuAccessGate href="/sitemap"><Sitemap /></MenuAccessGate></Route>

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
          <ScrollToTop />
          <SiteHeader />
          <SitewideAdminEditor />
          <MobilePushNotificationPrompt />
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
