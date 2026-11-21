import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";
import { GET as getSessions } from "@/app/api/days/[date]/sessions/route";
import { GET as getDays } from "@/app/api/days/route";
import { POST as postHold } from "@/app/api/holds/route";
import { GET as getSeatsRoute } from "@/app/api/sessions/[id]/seats/route";
import { GET as lookup } from "@/app/api/tickets/lookup/route";
import { POST as postTicket } from "@/app/api/tickets/route";
import { GET as getTicket } from "@/app/api/tickets/[code]/route";
import { GET as exportCsv } from "@/app/api/admin/export/route";
import { POST as login } from "@/app/api/admin/login/route";
import { ADMIN_COOKIE, expectedAdminToken } from "@/lib/auth";
import { middleware } from "@/middleware";
import { jsonRequest, resetDb } from "./helpers";

const FRI = "2026-11-27";

async function bookViaApi(date: string, phone: string, extra = {}) {
  return postTicket(jsonRequest("/api/tickets", "POST", { date, name: "Siti Aminah", phone, ...extra }));
}
beforeEach(resetDb);

describe("API pemesanan otomatis", () => {
  it("10 request bersamaan mendapat 10 nomor berbeda", async () => {
    const responses = await Promise.all(Array.from({ length: 10 }, (_, i) => bookViaApi(FRI, `0812000001${String(i).padStart(2, "0")}`)));
    expect(responses.map((r) => r.status)).toEqual(Array(10).fill(201));
    const tickets = await Promise.all(responses.map((r) => r.json()));
    expect(new Set(tickets.map((t) => t.queueNumber)).size).toBe(10);
    expect(new Set(tickets.map((t) => t.code)).size).toBe(10);
    for (const t of tickets) {
      expect(t.queueNumber).toBeGreaterThanOrEqual(1);
      expect(t.queueNumber).toBeLessThanOrEqual(300);
      expect(t.session.order).toBe(Math.floor((t.queueNumber - 1) / 50) + 1);
    }
  });
  it("request ulang bersamaan dengan WhatsApp sama hanya membuat satu tiket", async () => {
    const responses = await Promise.all(Array.from({ length: 5 }, () => bookViaApi(FRI, "081200000001")));
    expect(responses.filter((r) => r.status === 201)).toHaveLength(1);
    expect(responses.filter((r) => r.status === 409)).toHaveLength(4);
  });
  it("pemilihan nomor/sesi manual ditolak, API hold lama ditutup", async () => {
    expect((await postHold()).status).toBe(410);
    for (const extra of [{ queueNumber: 18 }, { sessionId: "abc" }, { holdId: "abc" }]) {
      expect((await bookViaApi(FRI, "081200000001", extra)).status).toBe(400);
    }
  });
  it("validasi nama, WhatsApp, email dan tanggal; +62 dinormalisasi", async () => {
    for (const extra of [{ name: "" }, { phone: "12345" }, { email: "bukan-email" }, { date: "salah" }]) {
      const res = await bookViaApi(FRI, "081200000003", extra);
      expect(res.status).toBe(400);
      expect(Object.keys(await res.json())).toEqual(["error"]);
    }
    const ok = await bookViaApi(FRI, "+62 812-0000-0003", { email: "" });
    expect(ok.status).toBe(201);
    expect((await ok.json()).phone).toBe("081200000003");
  });
  it("tanggal, sesi, tiket tak dikenal ditolak", async () => {
    expect((await bookViaApi("2026-12-25", "081200000001")).status).toBe(404);
    expect((await getSeatsRoute(new Request("http://localhost/x"), { params: { id: "tidak-ada" } })).status).toBe(404);
    expect((await getTicket(new Request("http://localhost/x"), { params: { code: "JM-001-AAAA" } })).status).toBe(404);
    expect((await getSessions(new Request("http://localhost/x"), { params: { date: "2026-12-25" } })).status).toBe(404);
  });
  it("9 tanggal, sesi, sisa kuota dan pencarian WhatsApp tersamarkan", async () => {
    const days = await (await getDays()).json();
    expect(days.days).toHaveLength(9);
    const sessions = await (await getSessions(new Request("http://localhost/x"), { params: { date: FRI } })).json();
    expect(sessions.items).toHaveLength(7);
    expect(sessions.items[2]).toEqual({ type: "break", startTime: "11:30", endTime: "14:00" });
    const ticket = await (await bookViaApi(FRI, "081299998888")).json();
    const seats = await (await getSeatsRoute(new Request("http://localhost/x"), { params: { id: ticket.session.id } })).json();
    expect(seats.seats.filter((x: { status: string }) => x.status === "booked")).toEqual([{ number: ticket.queueNumber, status: "booked" }]);
    const found = await (await lookup(new Request("http://localhost/api/tickets/lookup?phone=%2B6281299998888"))).json();
    expect(found.tickets).toHaveLength(1);
    expect(found.tickets[0].phone).toBe("0812••••8888");
    expect((await lookup(new Request("http://localhost/api/tickets/lookup?phone=abc"))).status).toBe(400);
  });
  it("export CSV mencantumkan sesi dan nomor otomatis", async () => {
    const ticket = await (await bookViaApi(FRI, "081277776666")).json();
    const res = await exportCsv(new Request(`http://localhost/api/admin/export?date=${FRI}`));
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    const lines = (await res.text()).replace(/^﻿/, "").trim().split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[1].split(",").slice(0, 9)).toEqual([ticket.code, FRI, String(ticket.session.order), `${ticket.session.startTime}-${ticket.session.endTime}`, String(ticket.queueNumber), "Siti Aminah", "'081277776666", "", "BOOKED"]);
  });
});

describe("proteksi admin (middleware)", () => {
  it("halaman /admin tanpa login → redirect ke /admin/login", async () => {
    for (const path of ["/admin", "/admin/tickets", "/admin/checkin"]) {
      const res = await middleware(new NextRequest(`http://localhost${path}`));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/admin/login");
    }
  });

  it("API admin tanpa login → 401 { error }", async () => {
    const targets: [string, string][] = [
      ["POST", "/api/admin/checkin"],
      ["PATCH", "/api/admin/tickets/abc"],
      ["GET", "/api/admin/export?date=2026-11-27"],
      ["POST", "/api/admin/now-serving"],
    ];
    for (const [method, path] of targets) {
      const res = await middleware(new NextRequest(`http://localhost${path}`, { method }));
      expect(res.status).toBe(401);
      expect(await res.json()).toHaveProperty("error");
    }
  });

  it("cookie palsu ditolak; cookie valid, halaman login, dan GET now-serving diloloskan", async () => {
    const fake = new NextRequest("http://localhost/admin", { headers: { cookie: `${ADMIN_COOKIE}=salah` } });
    expect((await middleware(fake)).status).toBe(307);

    const token = await expectedAdminToken();
    const valid = new NextRequest("http://localhost/admin", { headers: { cookie: `${ADMIN_COOKIE}=${token}` } });
    expect((await middleware(valid)).headers.get("x-middleware-next")).toBe("1");

    expect((await middleware(new NextRequest("http://localhost/admin/login"))).headers.get("x-middleware-next")).toBe("1");
    expect(
      (await middleware(new NextRequest("http://localhost/api/admin/now-serving?date=2026-11-27"))).headers.get("x-middleware-next"),
    ).toBe("1");
  });

  it("login: password salah 401, password benar memberi cookie httpOnly", async () => {
    const wrong = await login(jsonRequest("/api/admin/login", "POST", { email: "admin@example.test", password: "salah" }));
    expect(wrong.status).toBe(401);
    const ok = await login(jsonRequest("/api/admin/login", "POST", { email: "admin@example.test", password: "test-password" }));
    expect(ok.status).toBe(200);
    const cookie = ok.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`${ADMIN_COOKIE}=`);
    expect(cookie.toLowerCase()).toContain("httponly");
  });
});
