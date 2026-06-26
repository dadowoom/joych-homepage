import { useEffect, useRef, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { ImageIcon, Save, Upload } from "lucide-react";
import { toast } from "sonner";

type HomeFeatureCard = {
  badge: string;
  title: string;
  description: string;
  buttonText: string;
  imageUrl: string;
  href: string;
};

type HomeSectionConfig = {
  eyebrow: string;
  title: string;
  description: string;
  buttonText: string;
  buttonHref: string;
  backgroundImage: string;
  subtitle?: string;
};

type HomeSectionsEditPanelProps = {
  open: boolean;
  onClose: () => void;
};

const FALLBACK_FEATURE_CARDS: HomeFeatureCard[] = [
  {
    badge: "생생간증",
    title: "생생간증",
    description: "교회 구성원들이 나누는 실제 신앙 간증과 은혜의 이야기를 전합니다.",
    buttonText: "자세히 보기",
    imageUrl:
      "https://d2xsxph8kpxj0f.cloudfront.net/310519663470178900/KASTcRBzh5rwhJEekrJN6E/church-worship-praise_d34c61eb.webp",
    href: "/community/testimony",
  },
  {
    badge: "선교보고",
    title: "선교보고",
    description: "교회가 함께 감당하는 선교 소식과 현장 이야기를 소개합니다.",
    buttonText: "자세히 보기",
    imageUrl:
      "https://d2xsxph8kpxj0f.cloudfront.net/310519663470178900/KASTcRBzh5rwhJEekrJN6E/church-worship-sunday_f599f896.jpg",
    href: "/mission",
  },
  {
    badge: "플레이그라운드",
    title: "플레이그라운드",
    description: "다음 세대를 위한 문화와 놀이, 교제 프로그램을 안내합니다.",
    buttonText: "자세히 보기",
    imageUrl:
      "https://d2xsxph8kpxj0f.cloudfront.net/310519663470178900/KASTcRBzh5rwhJEekrJN6E/church-exterior-3_82fdf499.jpg",
    href: "/playground",
  },
];

const FALLBACK_CHURCH_INTRO_SECTION: HomeSectionConfig = {
  eyebrow: "OUR VISION",
  title: "깊이 있는 성장, 기쁨의교회",
  description:
    "복음의 능력으로 예배와 기도, 말씀과 교제를 통해 성도를 세우고 지역과 다음 세대를 품는 공동체를 지향합니다.",
  buttonText: "교회 소개 보기",
  buttonHref: "/about/vision",
  backgroundImage:
    "https://d2xsxph8kpxj0f.cloudfront.net/310519663470178900/KASTcRBzh5rwhJEekrJN6E/church-vision-bg_0cd6097b.webp",
};

const FALLBACK_WORSHIP_SECTION: HomeSectionConfig = {
  eyebrow: "WORSHIP",
  title: "함께 드리는 예배",
  subtitle: "매주 주일 오전 11시",
  description: "한마음으로 드리는 예배 자리에 모든 성도님을 초대합니다.",
  buttonText: "예배 시간 안내",
  buttonHref: "/worship/schedule",
  backgroundImage:
    "https://d2xsxph8kpxj0f.cloudfront.net/310519663470178900/KASTcRBzh5rwhJEekrJN6E/church-worship-1_39ea085d.webp",
};

function parseFeatureCards(raw?: string | null) {
  if (!raw) return FALLBACK_FEATURE_CARDS;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return FALLBACK_FEATURE_CARDS;
    return FALLBACK_FEATURE_CARDS.map((fallback, index) => {
      const item = parsed[index] ?? {};
      return {
        badge: typeof item.badge === "string" && item.badge.trim() ? item.badge : fallback.badge,
        title: typeof item.title === "string" && item.title.trim() ? item.title : fallback.title,
        description:
          typeof item.description === "string" && item.description.trim()
            ? item.description
            : fallback.description,
        buttonText:
          typeof item.buttonText === "string" && item.buttonText.trim()
            ? item.buttonText
            : fallback.buttonText,
        imageUrl:
          typeof item.imageUrl === "string" && item.imageUrl.trim()
            ? item.imageUrl
            : fallback.imageUrl,
        href: typeof item.href === "string" && item.href.trim() ? item.href : fallback.href,
      };
    });
  } catch {
    return FALLBACK_FEATURE_CARDS;
  }
}

function parseSectionConfig(raw: string | null | undefined, fallback: HomeSectionConfig) {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return fallback;
    return {
      eyebrow:
        typeof parsed.eyebrow === "string" && parsed.eyebrow.trim()
          ? parsed.eyebrow
          : fallback.eyebrow,
      title:
        typeof parsed.title === "string" && parsed.title.trim() ? parsed.title : fallback.title,
      description:
        typeof parsed.description === "string" && parsed.description.trim()
          ? parsed.description
          : fallback.description,
      buttonText:
        typeof parsed.buttonText === "string" && parsed.buttonText.trim()
          ? parsed.buttonText
          : fallback.buttonText,
      buttonHref:
        typeof parsed.buttonHref === "string" && parsed.buttonHref.trim()
          ? parsed.buttonHref
          : fallback.buttonHref,
      backgroundImage:
        typeof parsed.backgroundImage === "string" && parsed.backgroundImage.trim()
          ? parsed.backgroundImage
          : fallback.backgroundImage,
      subtitle:
        typeof parsed.subtitle === "string" && parsed.subtitle.trim()
          ? parsed.subtitle
          : (fallback.subtitle ?? ""),
    };
  } catch {
    return fallback;
  }
}

async function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function HomeSectionsEditPanel({
  open,
  onClose,
}: HomeSectionsEditPanelProps) {
  const utils = trpc.useUtils();
  const { data: settings } = trpc.home.settings.useQuery(undefined, { enabled: open });
  const uploadImageMutation = trpc.cms.upload.image.useMutation();
  const updateSettingMutation = trpc.cms.content.settings.update.useMutation();

  const [featureCards, setFeatureCards] = useState<HomeFeatureCard[]>(FALLBACK_FEATURE_CARDS);
  const [churchIntroSection, setChurchIntroSection] = useState<HomeSectionConfig>(
    FALLBACK_CHURCH_INTRO_SECTION
  );
  const [worshipSection, setWorshipSection] = useState<HomeSectionConfig>(
    FALLBACK_WORSHIP_SECTION
  );
  const [saving, setSaving] = useState(false);
  const [uploadingField, setUploadingField] = useState<string | null>(null);

  const cardImageRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];
  const introImageRef = useRef<HTMLInputElement>(null);
  const worshipImageRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setFeatureCards(parseFeatureCards(settings?.home_feature_cards));
    setChurchIntroSection(
      parseSectionConfig(settings?.home_church_intro_section, FALLBACK_CHURCH_INTRO_SECTION)
    );
    setWorshipSection(
      parseSectionConfig(settings?.home_worship_section, FALLBACK_WORSHIP_SECTION)
    );
  }, [open, settings]);

  const invalidate = () => {
    void utils.home.settings.invalidate();
  };

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    fieldKey: string,
    applyUrl: (url: string) => void
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("이미지는 10MB 이하 파일만 업로드할 수 있습니다.");
      event.target.value = "";
      return;
    }

    setUploadingField(fieldKey);
    try {
      const base64 = await readFileAsBase64(file);
      const { url } = await uploadImageMutation.mutateAsync({
        base64,
        fileName: file.name,
        mimeType: file.type || "image/jpeg",
      });
      applyUrl(url);
      toast.success("이미지를 적용했습니다.");
    } catch (error) {
      toast.error(
        `이미지 업로드에 실패했습니다.${error instanceof Error ? ` ${error.message}` : ""}`
      );
    } finally {
      setUploadingField(null);
      event.target.value = "";
    }
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      await updateSettingMutation.mutateAsync({
        key: "home_feature_cards",
        value: JSON.stringify(featureCards),
      });
      await updateSettingMutation.mutateAsync({
        key: "home_church_intro_section",
        value: JSON.stringify(churchIntroSection),
      });
      await updateSettingMutation.mutateAsync({
        key: "home_worship_section",
        value: JSON.stringify(worshipSection),
      });
      invalidate();
      toast.success("홈 섹션 설정을 저장했습니다.");
      onClose();
    } catch (error) {
      toast.error(
        `저장에 실패했습니다.${error instanceof Error ? ` ${error.message}` : ""}`
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={value => !value && onClose()}>
      <SheetContent
        side="right"
        className="w-[460px] sm:w-[620px] overflow-y-auto bg-white"
        style={{ top: "144px", height: "calc(100vh - 144px)" }}
      >
        <SheetHeader className="mb-5">
          <SheetTitle>홈 섹션 편집</SheetTitle>
          <SheetDescription>
            메인 카드 3개와 교회소개, 함께드리는예배 영역을 여기서 바로 수정합니다.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-8">
          <section className="space-y-4 rounded-xl border border-gray-200 bg-[#F8FBF7] p-4">
            <div>
              <h3 className="text-base font-semibold text-gray-900">메인 기능 카드</h3>
              <p className="text-xs text-gray-500">
                생생간증, 선교보고, 플레이그라운드 카드의 이미지와 문구를 수정합니다.
              </p>
            </div>
            {featureCards.map((card, index) => (
              <div key={index} className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-gray-800">카드 {index + 1}</h4>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploadingField === `card-${index}`}
                    onClick={() => cardImageRefs[index].current?.click()}
                  >
                    {uploadingField === `card-${index}` ? (
                      <>
                        <Upload className="mr-1 h-3.5 w-3.5 animate-bounce" />
                        업로드 중
                      </>
                    ) : (
                      <>
                        <ImageIcon className="mr-1 h-3.5 w-3.5" />
                        이미지 변경
                      </>
                    )}
                  </Button>
                  <input
                    ref={cardImageRefs[index]}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={event =>
                      handleImageUpload(event, `card-${index}`, url =>
                        setFeatureCards(previous =>
                          previous.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, imageUrl: url } : item
                          )
                        )
                      )
                    }
                  />
                </div>
                <img
                  src={card.imageUrl}
                  alt={card.title}
                  className="h-36 w-full rounded-lg object-cover"
                 loading="lazy"/>
                <div className="grid gap-3 md:grid-cols-2">
                  <Input
                    value={card.badge}
                    onChange={event =>
                      setFeatureCards(previous =>
                        previous.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, badge: event.target.value } : item
                        )
                      )
                    }
                    placeholder="배지 문구"
                  />
                  <Input
                    value={card.title}
                    onChange={event =>
                      setFeatureCards(previous =>
                        previous.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, title: event.target.value } : item
                        )
                      )
                    }
                    placeholder="제목"
                  />
                </div>
                <Textarea
                  rows={3}
                  value={card.description}
                  onChange={event =>
                    setFeatureCards(previous =>
                      previous.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, description: event.target.value } : item
                      )
                    )
                  }
                  placeholder="설명"
                />
                <div className="grid gap-3 md:grid-cols-2">
                  <Input
                    value={card.buttonText}
                    onChange={event =>
                      setFeatureCards(previous =>
                        previous.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, buttonText: event.target.value } : item
                        )
                      )
                    }
                    placeholder="버튼 문구"
                  />
                  <Input
                    value={card.href}
                    onChange={event =>
                      setFeatureCards(previous =>
                        previous.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, href: event.target.value } : item
                        )
                      )
                    }
                    placeholder="/example"
                  />
                </div>
              </div>
            ))}
          </section>

          <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900">교회 소개 보기 영역</h3>
                <p className="text-xs text-gray-500">
                  배경 이미지, 제목, 설명, 버튼 문구와 링크를 수정합니다.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploadingField === "intro-image"}
                onClick={() => introImageRef.current?.click()}
              >
                {uploadingField === "intro-image" ? (
                  <>
                    <Upload className="mr-1 h-3.5 w-3.5 animate-bounce" />
                    업로드 중
                  </>
                ) : (
                  <>
                    <ImageIcon className="mr-1 h-3.5 w-3.5" />
                    배경 이미지 변경
                  </>
                )}
              </Button>
              <input
                ref={introImageRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={event =>
                  handleImageUpload(event, "intro-image", url =>
                    setChurchIntroSection(previous => ({ ...previous, backgroundImage: url }))
                  )
                }
              />
            </div>
            <img
              src={churchIntroSection.backgroundImage}
              alt={churchIntroSection.title}
              className="h-40 w-full rounded-lg object-cover"
             loading="lazy"/>
            <Input
              value={churchIntroSection.eyebrow}
              onChange={event =>
                setChurchIntroSection(previous => ({ ...previous, eyebrow: event.target.value }))
              }
              placeholder="상단 문구"
            />
            <Input
              value={churchIntroSection.title}
              onChange={event =>
                setChurchIntroSection(previous => ({ ...previous, title: event.target.value }))
              }
              placeholder="제목"
            />
            <Textarea
              rows={4}
              value={churchIntroSection.description}
              onChange={event =>
                setChurchIntroSection(previous => ({
                  ...previous,
                  description: event.target.value,
                }))
              }
              placeholder="설명"
            />
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                value={churchIntroSection.buttonText}
                onChange={event =>
                  setChurchIntroSection(previous => ({
                    ...previous,
                    buttonText: event.target.value,
                  }))
                }
                placeholder="버튼 문구"
              />
              <Input
                value={churchIntroSection.buttonHref}
                onChange={event =>
                  setChurchIntroSection(previous => ({
                    ...previous,
                    buttonHref: event.target.value,
                  }))
                }
                placeholder="/about/vision"
              />
            </div>
          </section>

          <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900">함께 드리는 예배 영역</h3>
                <p className="text-xs text-gray-500">
                  배경 이미지와 제목, 보조 문구, 설명, 버튼 링크를 수정합니다.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploadingField === "worship-image"}
                onClick={() => worshipImageRef.current?.click()}
              >
                {uploadingField === "worship-image" ? (
                  <>
                    <Upload className="mr-1 h-3.5 w-3.5 animate-bounce" />
                    업로드 중
                  </>
                ) : (
                  <>
                    <ImageIcon className="mr-1 h-3.5 w-3.5" />
                    배경 이미지 변경
                  </>
                )}
              </Button>
              <input
                ref={worshipImageRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={event =>
                  handleImageUpload(event, "worship-image", url =>
                    setWorshipSection(previous => ({ ...previous, backgroundImage: url }))
                  )
                }
              />
            </div>
            <img
              src={worshipSection.backgroundImage}
              alt={worshipSection.title}
              className="h-40 w-full rounded-lg object-cover"
             loading="lazy"/>
            <Input
              value={worshipSection.eyebrow}
              onChange={event =>
                setWorshipSection(previous => ({ ...previous, eyebrow: event.target.value }))
              }
              placeholder="상단 문구"
            />
            <Input
              value={worshipSection.title}
              onChange={event =>
                setWorshipSection(previous => ({ ...previous, title: event.target.value }))
              }
              placeholder="제목"
            />
            <Input
              value={worshipSection.subtitle ?? ""}
              onChange={event =>
                setWorshipSection(previous => ({ ...previous, subtitle: event.target.value }))
              }
              placeholder="보조 문구"
            />
            <Textarea
              rows={4}
              value={worshipSection.description}
              onChange={event =>
                setWorshipSection(previous => ({
                  ...previous,
                  description: event.target.value,
                }))
              }
              placeholder="설명"
            />
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                value={worshipSection.buttonText}
                onChange={event =>
                  setWorshipSection(previous => ({
                    ...previous,
                    buttonText: event.target.value,
                  }))
                }
                placeholder="버튼 문구"
              />
              <Input
                value={worshipSection.buttonHref}
                onChange={event =>
                  setWorshipSection(previous => ({
                    ...previous,
                    buttonHref: event.target.value,
                  }))
                }
                placeholder="/worship/schedule"
              />
            </div>
          </section>

          <div className="sticky bottom-0 flex justify-end gap-2 border-t border-gray-200 bg-white py-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              닫기
            </Button>
            <Button
              type="button"
              className="bg-[#1B5E20] text-white hover:bg-[#2E7D32]"
              onClick={saveAll}
              disabled={saving || uploadingField !== null}
            >
              <Save className="mr-1 h-4 w-4" />
              {saving ? "저장 중..." : "저장"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
