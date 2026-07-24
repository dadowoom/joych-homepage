const CHURCH_ADDRESS = "경상북도 포항시 북구 새천년대로 411";

function getChurchAddress(address?: string | null) {
  const value = address?.trim();
  if (!value || value.includes("새천년대로 411")) {
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
    <footer className="bg-[#0F172A] py-6 text-gray-400">
      <div className="container">
        <div className="grid grid-cols-1 items-center gap-5 md:grid-cols-3">
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
              <i className="fas fa-map-marker-alt w-4 text-[#4CAF50]"></i>
              {getChurchAddress(address)}
            </p>
            <p className="flex items-center gap-2">
              <i className="fas fa-phone w-4 text-[#4CAF50]"></i>
              TEL : {tel ?? "054) 270-1000"} &nbsp;|&nbsp; FAX :{" "}
              {fax ?? "054) 270-1005"}
            </p>
            <p className="mt-3 text-xs text-gray-500">
              Copyright &copy; {new Date().getFullYear()} 기쁨의교회 All rights
              reserved.
            </p>
            <a
              href="/privacy-policy"
              className="inline-flex text-xs text-gray-400 underline underline-offset-4 transition-colors hover:text-white"
            >
              개인정보처리방침
            </a>
          </div>

          {/* socialLinks rendering intentionally hidden */}
        </div>
      </div>
    </footer>
  );
}
