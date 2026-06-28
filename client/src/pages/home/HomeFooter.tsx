import { Link } from "wouter";

const CHURCH_ADDRESS = "경상북도 포항시 북구 삼흥로 411";

function getChurchAddress(address?: string | null) {
  const value = address?.trim();
  if (!value || value.includes("상통로 411")) {
    return CHURCH_ADDRESS;
  }
  return value;
}

type SocialLink = {
  icon: string;
  label: string;
  href: string | null;
};

type HomeFooterProps = {
  address?: string | null;
  tel?: string | null;
  fax?: string | null;
  socialLinks: SocialLink[];
};

export default function HomeFooter({
  address,
  tel,
  fax,
}: HomeFooterProps) {
  return (
    <footer className="bg-[#0F172A] text-gray-400 py-6">
      <div className="container">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-center">
          <div>
            <div className="inline-flex rounded-md bg-white px-3 py-2">
              <img
                src="https://d2xsxph8kpxj0f.cloudfront.net/310519663470178900/KASTcRBzh5rwhJEekrJN6E/church-logo_35c62cc5.jpg"
                alt="기쁨의교회"
                loading="lazy"
                className="h-8 w-auto object-contain"
              />
            </div>
            <p className="mt-2 text-xs text-gray-600">
              since 1946 대한예수교장로회
            </p>
          </div>

          <div className="space-y-1.5 text-sm">
            <p className="flex items-center gap-2">
              <i className="fas fa-map-marker-alt text-[#4CAF50] w-4"></i>
              {getChurchAddress(address)}
            </p>
            <p className="flex items-center gap-2">
              <i className="fas fa-phone text-[#4CAF50] w-4"></i>
              TEL : {tel ?? "054) 270-1000"} &nbsp;|&nbsp; FAX :{" "}
              {fax ?? "054) 270-1005"}
            </p>
            <p className="text-xs text-gray-500 mt-3">
              Copyright &copy; {new Date().getFullYear()} 기쁨의교회 All
              rights reserved.
            </p>
            <div className="flex gap-3 mt-2 text-xs">
              <Link
                href="/sitemap"
                className="text-gray-500 hover:text-[#4CAF50] transition-colors underline underline-offset-2"
              >
                사이트맵
              </Link>
              <span className="text-gray-700">|</span>
              <Link
                href="/about/directions"
                className="text-gray-500 hover:text-[#4CAF50] transition-colors underline underline-offset-2"
              >
                오시는 길
              </Link>
              <span className="text-gray-700">|</span>
              <Link
                href="/support/new-member"
                className="text-gray-500 hover:text-[#4CAF50] transition-colors underline underline-offset-2"
              >
                새가족 안내
              </Link>
            </div>
          </div>

          {/* socialLinks rendering intentionally hidden */}
        </div>
      </div>
    </footer>
  );
}
