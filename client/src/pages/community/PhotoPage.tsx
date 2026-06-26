import { Fragment, useState } from "react";
import { Link } from "wouter";
import {
  Building,
  FileText,
  MapPin,
  MessageCircle,
  Paperclip,
  Receipt,
  Search,
  Users,
  X,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ViewModeToggle, type ViewMode } from "@/components/dynamic-page/ViewModeToggle";
import {
  PageWrapper,
  SupportPageWrapper,
  notifyOfficeContact,
  OfficeContactBox,
  formatSupportDate,
  isToday,
  fileToBase64,
  getEmptyVisitForm,
} from "./_shared";

const photoCategories = ["전체", "주일예배", "행사", "선교", "교회학교", "친교"];
const photos = [
  { id: 1, title: "2024 성탄절 예배", category: "주일예배", img: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=80" },
  { id: 2, title: "여름 수련회", category: "행사", img: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&q=80" },
  { id: 3, title: "단기 선교팀 파송", category: "선교", img: "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=400&q=80" },
  { id: 4, title: "새가족 환영회", category: "친교", img: "https://images.unsplash.com/photo-1519834785169-98be25ec3f84?w=400&q=80" },
  { id: 5, title: "추수감사절 예배", category: "주일예배", img: "https://images.unsplash.com/photo-1504052434569-70ad5836ab65?w=400&q=80" },
  { id: 6, title: "청년부 MT", category: "교회학교", img: "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=400&q=80" },
  { id: 7, title: "어린이날 행사", category: "교회학교", img: "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=400&q=80" },
  { id: 8, title: "부활절 예배", category: "주일예배", img: "https://images.unsplash.com/photo-1519834785169-98be25ec3f84?w=400&q=80" },
  { id: 9, title: "교회 창립 기념일", category: "행사", img: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=80" },
  { id: 10, title: "겨울 수련회", category: "행사", img: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&q=80" },
  { id: 11, title: "선교사 파송 예배", category: "선교", img: "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=400&q=80" },
  { id: 12, title: "성도 체육대회", category: "친교", img: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&q=80" },
];

export default function PhotoPage() {
  const [activeCategory, setActiveCategory] = useState("전체");
  const visiblePhotos = activeCategory === "전체" ? photos : photos.filter((photo) => photo.category === activeCategory);

  return (
    <PageWrapper title="사진" breadcrumb={["커뮤니티", "사진"]}>
      <div className="flex gap-2 flex-wrap mb-8">
        {photoCategories.map((cat, i) => (
          <button
            key={i}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${activeCategory === cat ? "bg-[#2d6a4f] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            {cat}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {visiblePhotos.map((photo) => (
          <div key={photo.id} className="group relative overflow-hidden rounded-xl">
            <img src={photo.img} alt={photo.title} className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300" onError={(e) => { (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=80"; }}  loading="lazy"/>
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
              <p className="text-white text-sm font-medium">{photo.title}</p>
            </div>
          </div>
        ))}
      </div>
    </PageWrapper>
  );
}
