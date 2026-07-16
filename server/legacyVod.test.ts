import { afterEach, describe, expect, it, vi } from "vitest";
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
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("queries the legacy bare domain with the expected form body and referer", async () => {
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
    expect(url).toBe("http://joych.org/core/xml/vod/vodInfo.xml.html");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      "Content-Type": "application/x-www-form-urlencoded",
      Referer: "http://joych.org/core/module/vod/skin_001/vodIframe.html?pageCode=423&num=12484&vodType=237",
    });
    expect((init.body as URLSearchParams).toString()).toBe(
      "pageCode=423&num=12484&vodType=237",
    );
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
