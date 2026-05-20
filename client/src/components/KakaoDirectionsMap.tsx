import { type FormEvent, useEffect, useRef, useState } from "react";

const KAKAO_MAP_SCRIPT_ID = "kakao-map-sdk";
const DESTINATION = {
  name: "포항기쁨의교회",
  address: "경상북도 포항시 북구 삼흥로 411",
  coords: { lat: 36.095458253774, lng: 129.37385741342 },
};

const DIRECTION_MODES = [
  { id: "car", label: "자동차" },
  { id: "traffic", label: "대중교통" },
  { id: "walk", label: "도보" },
] as const;

type DirectionMode = (typeof DIRECTION_MODES)[number]["id"];
type Coords = { lat: number; lng: number };
type KakaoLatLng = unknown;
type KakaoMapInstance = unknown;
type KakaoGeocodeResult = { x: string; y: string; address_name?: string };
type KakaoGeocoder = {
  addressSearch: (
    query: string,
    callback: (result: KakaoGeocodeResult[], status: string) => void
  ) => void;
};
type KakaoMaps = {
  LatLng: new (lat: number, lng: number) => KakaoLatLng;
  Map: new (
    container: HTMLElement,
    options: { center: KakaoLatLng; level: number }
  ) => KakaoMapInstance;
  Marker: new (options: { position: KakaoLatLng; map: KakaoMapInstance }) => unknown;
  services: {
    Status: { OK: string };
    Geocoder: new () => KakaoGeocoder;
  };
  load: (callback: () => void) => void;
};

declare global {
  interface Window {
    kakao?: { maps: KakaoMaps };
  }
}

let kakaoMapsPromise: Promise<KakaoMaps> | null = null;

function getKakaoJavaScriptKey() {
  return import.meta.env.VITE_KAKAO_JAVASCRIPT_KEY?.trim() ?? "";
}

function loadKakaoMaps() {
  const appKey = getKakaoJavaScriptKey();
  if (!appKey) {
    return Promise.reject(new Error("missing-kakao-key"));
  }

  if (window.kakao?.maps) {
    return new Promise<KakaoMaps>((resolve) => {
      window.kakao?.maps.load(() => resolve(window.kakao!.maps));
    });
  }

  if (!kakaoMapsPromise) {
    kakaoMapsPromise = new Promise<KakaoMaps>((resolve, reject) => {
      let script = document.getElementById(KAKAO_MAP_SCRIPT_ID) as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement("script");
        script.id = KAKAO_MAP_SCRIPT_ID;
        script.async = true;
        script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(
          appKey
        )}&autoload=false&libraries=services`;
        document.head.appendChild(script);
      }

      script.addEventListener(
        "load",
        () => {
          if (!window.kakao?.maps) {
            kakaoMapsPromise = null;
            reject(new Error("kakao-sdk-not-ready"));
            return;
          }
          window.kakao.maps.load(() => resolve(window.kakao!.maps));
        },
        { once: true }
      );
      script.addEventListener(
        "error",
        () => {
          kakaoMapsPromise = null;
          script?.remove();
          reject(new Error("kakao-sdk-load-failed"));
        },
        { once: true }
      );
    });
  }

  return kakaoMapsPromise;
}

function geocodeAddress(maps: KakaoMaps, geocoder: KakaoGeocoder, query: string) {
  return new Promise<Coords>((resolve, reject) => {
    geocoder.addressSearch(query, (result, status) => {
      const first = result[0];
      if (status !== maps.services.Status.OK || !first) {
        reject(new Error("address-not-found"));
        return;
      }
      resolve({ lat: Number(first.y), lng: Number(first.x) });
    });
  });
}

function formatKakaoPoint(label: string, coords: Coords) {
  return `${encodeURIComponent(label)},${coords.lat},${coords.lng}`;
}

function buildDestinationUrl(destinationCoords: Coords = DESTINATION.coords) {
  return `https://map.kakao.com/link/map/${formatKakaoPoint(
    DESTINATION.name,
    destinationCoords
  )}`;
}

function buildDirectionsUrl(
  originLabel: string,
  originCoords: Coords,
  destinationCoords: Coords,
  mode: DirectionMode
) {
  const origin = formatKakaoPoint(originLabel, originCoords);
  const destination = formatKakaoPoint(DESTINATION.name, destinationCoords);
  return `https://map.kakao.com/link/by/${mode}/${origin}/${destination}`;
}

function openKakaoUrl(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

export default function KakaoDirectionsMap() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapsRef = useRef<KakaoMaps | null>(null);
  const geocoderRef = useRef<KakaoGeocoder | null>(null);
  const [origin, setOrigin] = useState("");
  const [mode, setMode] = useState<DirectionMode>("car");
  const [destinationCoords, setDestinationCoords] = useState<Coords | null>(null);
  const [statusMessage, setStatusMessage] = useState("카카오맵을 준비하고 있습니다.");
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    loadKakaoMaps()
      .then(async (maps) => {
        if (!mounted || !mapContainerRef.current) return;
        mapsRef.current = maps;

        const geocoder = new maps.services.Geocoder();
        geocoderRef.current = geocoder;
        const coords = DESTINATION.coords;
        if (!mounted) return;

        const center = new maps.LatLng(coords.lat, coords.lng);
        const map = new maps.Map(mapContainerRef.current, { center, level: 3 });
        new maps.Marker({ position: center, map });
        setDestinationCoords(coords);
        setMapReady(true);
        setStatusMessage("출발지를 입력하거나 현재 위치로 길찾기를 시작하세요.");
      })
      .catch(() => {
        if (!mounted) return;
        setDestinationCoords(DESTINATION.coords);
        setStatusMessage(
          "카카오 지도 표시가 차단되어 지도 대신 바로가기를 제공합니다. 카카오 개발자센터의 Web 도메인과 카카오맵 사용 설정을 확인해 주세요."
        );
      });

    return () => {
      mounted = false;
    };
  }, []);

  const openDestination = () => {
    openKakaoUrl(buildDestinationUrl(destinationCoords ?? DESTINATION.coords));
  };

  const openDirectionsFromCoords = (label: string, coords: Coords) => {
    openKakaoUrl(
      buildDirectionsUrl(label, coords, destinationCoords ?? DESTINATION.coords, mode)
    );
  };

  const handleAddressSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = origin.trim();
    if (!query) {
      setStatusMessage("출발지 주소나 장소명을 입력해 주세요.");
      return;
    }

    const maps = mapsRef.current;
    const geocoder = geocoderRef.current;
    if (!maps || !geocoder) {
      setStatusMessage(
        "출발지 주소 검색은 카카오 지도 표시가 준비된 뒤 사용할 수 있습니다. 현재 위치 길찾기나 카카오맵에서 보기를 이용해 주세요."
      );
      return;
    }

    try {
      setStatusMessage("출발지를 확인하고 있습니다.");
      const coords = await geocodeAddress(maps, geocoder, query);
      openDirectionsFromCoords(query, coords);
      setStatusMessage("카카오맵 길찾기를 새 창으로 열었습니다.");
    } catch {
      setStatusMessage("출발지를 찾지 못했습니다. 도로명 주소나 장소명을 조금 더 정확히 입력해 주세요.");
    }
  };

  const handleCurrentLocation = () => {
    if (!navigator.geolocation) {
      setStatusMessage("이 브라우저에서는 현재 위치를 사용할 수 없습니다.");
      return;
    }

    setStatusMessage("현재 위치를 확인하고 있습니다.");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        openDirectionsFromCoords("내 위치", {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setStatusMessage("카카오맵 길찾기를 새 창으로 열었습니다.");
      },
      () => {
        setStatusMessage("현재 위치 권한이 허용되지 않았습니다. 출발지 주소를 직접 입력해 주세요.");
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  return (
    <section className="py-16 bg-white">
      <div className="container">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
          <div>
            <p className="text-xs tracking-[0.25em] text-[#1B5E20] font-semibold mb-2 uppercase">
              Location
            </p>
            <h2
              className="text-2xl md:text-3xl font-bold text-gray-900"
              style={{ fontFamily: "'Noto Serif KR', serif" }}
            >
              교회 오시는 길
            </h2>
          </div>
          <button
            type="button"
            onClick={openDestination}
            className="self-start md:self-auto text-sm text-gray-400 hover:text-[#1B5E20] flex items-center gap-1 transition-colors"
          >
            카카오맵에서 보기 <i className="fas fa-arrow-right text-[10px]"></i>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-6 items-stretch">
          <div className="relative min-h-[320px] md:min-h-[420px] rounded-2xl overflow-hidden border border-gray-100 bg-[#F7F7F5]">
            <div ref={mapContainerRef} className="absolute inset-0" />
            {!mapReady && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
                <i className="fas fa-map-marker-alt text-4xl text-[#1B5E20] mb-3"></i>
                <p className="font-medium text-gray-800">{DESTINATION.name}</p>
                <p className="text-sm text-gray-500 mt-1">{DESTINATION.address}</p>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm flex flex-col justify-between gap-6">
            <div>
              <div className="flex items-start gap-3 mb-5">
                <div className="w-10 h-10 rounded-full bg-[#E8F5E9] text-[#1B5E20] flex items-center justify-center shrink-0">
                  <i className="fas fa-location-arrow text-sm"></i>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">목적지</p>
                  <p className="text-sm text-gray-600 mt-1">{DESTINATION.name}</p>
                  <p className="text-xs text-gray-400 mt-1">{DESTINATION.address}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-4">
                {DIRECTION_MODES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setMode(item.id)}
                    className={`h-10 rounded-lg border text-xs font-medium transition-colors ${
                      mode === item.id
                        ? "border-[#1B5E20] bg-[#1B5E20] text-white"
                        : "border-gray-200 text-gray-500 hover:border-[#1B5E20] hover:text-[#1B5E20]"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <form onSubmit={handleAddressSubmit} className="space-y-3">
                <label className="text-xs font-medium text-gray-500 block">
                  출발지 주소 또는 장소명
                </label>
                <input
                  value={origin}
                  onChange={(event) => setOrigin(event.target.value)}
                  placeholder="예: 포항시청, 양덕동, 현재 출발지"
                  className="w-full h-11 rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-[#1B5E20] focus:ring-2 focus:ring-[#1B5E20]/10"
                />
                <button
                  type="submit"
                  className="w-full h-11 rounded-lg bg-[#1B5E20] text-white text-sm font-medium hover:bg-[#2E7D32] transition-colors"
                >
                  카카오맵 길찾기
                </button>
              </form>

              <button
                type="button"
                onClick={handleCurrentLocation}
                className="mt-3 w-full h-11 rounded-lg border border-gray-200 text-gray-600 text-sm font-medium hover:border-[#1B5E20] hover:text-[#1B5E20] transition-colors"
              >
                현재 위치로 길찾기
              </button>
            </div>

            <p className="text-xs text-gray-400 leading-relaxed" aria-live="polite">
              {statusMessage}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
