import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as youtubeDb from "./db/youtube";
import { fetchLegacyVodInfo } from "./_core/legacyVod";

const VALID_XML = `<?xml version="1.0" encoding="utf-8" ?>
<result>
  <data>
    <code>vodInfo</code>
    <vodInfo>
      <vodFile><![CDATA[http://sermon.joych.org/mp4/wed/260527_wed.mp4]]></vodFile>
      <subject><![CDATA[하나님의 꿈을 꾸는 교회]]></subject>
      <word><![CDATA[창세기 40:1-8]]></word>
      <preacher><![CDATA[이삭 목사]]></preacher>
      <date><![CDATA[2026-05-27]]></date>
    </vodInfo>
  </data>
</result>`;

describe("fetchLegacyVodInfo", () => {
  beforeEach(() => {
    vi.spyOn(youtubeDb, "getYoutubeVideoByLegacySource").mockResolvedValue(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("queries the surviving admin metadata service with the expected form body and referer", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(VALID_XML, {
        status: 200,
        headers: { "Content-Type": "text/xml; charset=utf-8" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchLegacyVodInfo("423", "12484", "237")).resolves.toMatchObject({
      pageCode: "423",
      num: "12484",
      vodType: "237",
      vodFile: "http://sermon.joych.org/mp4/wed/260527_wed.mp4",
      subject: "하나님의 꿈을 꾸는 교회",
      word: "창세기 40:1-8",
      preacher: "이삭 목사",
      date: "2026-05-27",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://admin.joych.org/core/xml/vod/vodInfo.xml.html");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      "Content-Type": "application/x-www-form-urlencoded",
      Referer: "http://admin.joych.org/core/module/vod/skin_001/vodIframe.html?pageCode=423&num=12484&vodType=237",
    });
    expect((init.body as URLSearchParams).toString()).toBe(
      "pageCode=423&num=12484&vodType=237",
    );
  });

  it("recovers a stored legacy row from the verified sermon MP4 naming rules", async () => {
    vi.mocked(youtubeDb.getYoutubeVideoByLegacySource).mockResolvedValue({
      id: 90013,
      title: "2026 봄하영인",
      preacher: "박진석 위임목사",
      scripture: "요한계시록 5:7-10",
      sermonDate: "2026-04-25",
    });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 200,
        headers: {
          "Content-Type": "video/mp4",
          "Content-Length": "1206499629",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchLegacyVodInfo("242", "12423", "40")).resolves.toMatchObject({
      vodFile: "http://sermon.joych.org/mp4/special/260425_hyi.mp4",
      subject: "2026 봄하영인",
      date: "2026-04-25",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://sermon.joych.org/mp4/special/260425_hyi.mp4",
      expect.objectContaining({ method: "HEAD" }),
    );
  });

  it("uses the checked filename override when an archive row has a one-day date error", async () => {
    vi.mocked(youtubeDb.getYoutubeVideoByLegacySource).mockResolvedValue({
      id: 90226,
      title: "샬롬 찬양대",
      preacher: null,
      scripture: null,
      sermonDate: "2024-09-09",
    });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 200,
        headers: { "Content-Type": "video/mp4" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchLegacyVodInfo("192", "11140", "19")).resolves.toMatchObject({
      vodFile: "http://sermon.joych.org/mp4/hymn/240908_hymn1.mp4",
    });
  });

  it("rejects a legacy response that points outside the approved MP4 host", async () => {
    const invalidXml = VALID_XML.replace(
      "http://sermon.joych.org/mp4/wed/260527_wed.mp4",
      "http://example.com/video.mp4",
    );
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(invalidXml, { status: 200 })));

    await expect(fetchLegacyVodInfo("424", "12487", "238")).rejects.toThrow(
      "Legacy VOD file URL is not allowed",
    );
  });
});
