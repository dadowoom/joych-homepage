import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";

const menuMocks = vi.hoisted(() => ({
  getVisibleMenuItemByHref: vi.fn(),
  getVisibleMenuItemById: vi.fn(),
  getVisibleMenuSubItemByHref: vi.fn(),
  getVisibleMenuSubItemById: vi.fn(),
}));

vi.mock("../db/menu", () => menuMocks);

import { publicRouteGuard } from "./vite";

function createRequest(path: string) {
  return {
    method: "GET",
    path,
    originalUrl: path,
  } as Request;
}

function createResponse() {
  const response = {
    status: vi.fn(),
    type: vi.fn(),
    send: vi.fn(),
  };
  response.status.mockReturnValue(response);
  response.type.mockReturnValue(response);
  response.send.mockReturnValue(response);
  return response as unknown as Response;
}

describe("production public page route guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    menuMocks.getVisibleMenuItemByHref.mockResolvedValue(null);
    menuMocks.getVisibleMenuSubItemByHref.mockResolvedValue(null);
  });

  it("serves the external reservation self-service deep link without a menu DB row", async () => {
    const next = vi.fn() as NextFunction;
    await publicRouteGuard(
      createRequest("/page/시설사용-예약-외부인/내-예약"),
      createResponse(),
      next,
    );

    expect(next).toHaveBeenCalledOnce();
    expect(menuMocks.getVisibleMenuItemByHref).not.toHaveBeenCalled();
    expect(menuMocks.getVisibleMenuSubItemByHref).not.toHaveBeenCalled();
  });

  it("keeps an unknown sibling deep link as a real 404", async () => {
    const next = vi.fn() as NextFunction;
    const response = createResponse();
    await publicRouteGuard(
      createRequest("/page/시설사용-예약-외부인/임의주소"),
      response,
      next,
    );

    expect(next).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.type).toHaveBeenCalledWith("text/plain");
    expect(response.send).toHaveBeenCalledWith("Not found");
  });
});
