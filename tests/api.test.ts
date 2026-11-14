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
import { jsonRequest, resetDb, sessionOf } from "./helpers";

const FRI = "2026-11-27";

/** Satu alur pemesanan penuh lewat API: POST /api/holds → POST /api/tickets. */
async function bookViaApi(sessionId: string, queueNumber: number, phone: string) {
  const holdRes = await postHold(jsonRequest("/api/holds", "POST", { sessionId, queueNumber }));
  if (holdRes.status !== 201) return holdRes;
  const hold = await holdRes.json();
  return postTicket(
    jsonRequest("/api/tickets", "POST", { holdId: hold.id, name: "Siti Aminah", phone }),
  );
}

beforeEach(resetDb);

describe("API pemesanan", () => {
  it("dua request booking nomor yang sama secara bersamaan → satu sukses (201), satu 409", async () => {
    const s = await sessionOf(FRI, 1);
    const responses = await Promise.all([
      bookViaApi(s.id, 17, "081200000001"),
      bookViaApi(s.id, 17, "081200000002"),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
    const loser = responses.find((r) => r.status === 409)!;
    expect(await loser.json()).toEqual({
      error: "Nomor ini baru saja diambil orang lain, silakan pilih nomor lain.",
    });
    const winner = await responses.find((r) => r.status === 201)!.json();
    expect(winner.queueNumber).toBe(17);
    expect(winner.code).toMatch(/^JM-017-[A-Z2-9]{4}$/);
  });

  it("10 request bersamaan untuk nomor yang sama → tepat satu tiket", async () => {
    const s = await sessionOf(FRI, 2);
    const responses = await Promise.all(
      Array.from({ length: 10 }, (_, i) => bookViaApi(s.id, 40, `0812000001${String(i).padStart(2, "0")}`)),
    );
    const statuses = responses.map((r) => r.status);
    expect(statuses.filter((x) => x === 201)).toHaveLength(1);
    expect(statuses.filter((x) => x === 409)).toHaveLength(9);
  });

  it("booking nomor di luar rentang sesi ditolak 400 (nomor 45 pada sesi 61–90)", async () => {
    const s3 = await sessionOf(FRI, 3);
    const res = await postHold(
      jsonRequest("/api/holds", "POST", { sessionId: s3.id, queueNumber: 45 }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/tidak termasuk sesi ini/);
  });

  it("validasi zod → 400 dengan format { error }", async () => {
    const bad = await postHold(jsonRequest("/api/holds", "POST", { sessionId: "x", queueNumber: "7" }));
    expect(bad.status).toBe(400);
    expect(Object.keys(await bad.json())).toEqual(["error"]);

    const s = await sessionOf(FRI, 1);
    const hold = await (await postHold(jsonRequest("/api/holds", "POST", { sessionId: s.id, queueNumber: 3 }))).json();
    const noName = await postTicket(jsonRequest("/api/tickets", "POST", { holdId: hold.id, name: "", phone: "081200000003" }));
    expect(noName.status).toBe(400);
    const badPhone = await postTicket(jsonRequest("/api/tickets", "POST", { holdId: hold.id, name: "Andi", phone: "12345" }));
    expect(badPhone.status).toBe(400);
    expect((await badPhone.json()).error).toMatch(/WhatsApp tidak valid/);
    const badEmail = await postTicket(jsonRequest("/api/tickets", "POST", { holdId: hold.id, name: "Andi", phone: "081200000003", email: "bukan-email" }));
    expect(badEmail.status).toBe(400);
    // Hold masih utuh → data yang benar tetap bisa dipesan (+62 dinormalisasi).
    const ok = await postTicket(jsonRequest("/api/tickets", "POST", { holdId: hold.id, name: "Andi", phone: "+62 812-0000-0003", email: "" }));
    expect(ok.status).toBe(201);
    expect((await ok.json()).phone).toBe("081200000003");
  });

  it("sesi / tiket tak dikenal → 404", async () => {
    const res = await postHold(jsonRequest("/api/holds", "POST", { sessionId: "tidak-ada", queueNumber: 1 }));
    expect(res.status).toBe(404);
    const seats = await getSeatsRoute(new Request("http://localhost/x"), { params: { id: "tidak-ada" } });
    expect(seats.status).toBe(404);
    const t = await getTicket(new Request("http://localhost/x"), { params: { code: "JM-001-AAAA" } });
    expect(t.status).toBe(404);
    const d = await getSessions(new Request("http://localhost/x"), { params: { date: "2026-12-25" } });
    expect(d.status).toBe(404);
  });

  it("GET days, sessions (dengan istirahat), seats, lookup tersamarkan", async () => {
    const days = await (await getDays()).json();
    expect(days.days).toHaveLength(3);

    const sessions = await (
      await getSessions(new Request("http://localhost/x"), { params: { date: FRI } })
    ).json();
    expect(sessions.items).toHaveLength(7);
    expect(sessions.items[2]).toEqual({ type: "break", startTime: "11:30", endTime: "14:00" });

    const s = await sessionOf(FRI, 1);
    await bookViaApi(s.id, 2, "081299998888");
    const seats = await (
      await getSeatsRoute(new Request("http://localhost/x"), { params: { id: s.id } })
    ).json();
    expect(seats.seats.filter((x: { status: string }) => x.status === "booked")).toEqual([
      { number: 2, status: "booked" },
    ]);

    const found = await (
      await lookup(new Request("http://localhost/api/tickets/lookup?phone=%2B6281299998888"))
    ).json();
    expect(found.tickets).toHaveLength(1);
    expect(found.tickets[0].phone).toBe("0812••••8888");
    const invalid = await lookup(new Request("http://localhost/api/tickets/lookup?phone=abc"));
    expect(invalid.status).toBe(400);
  });

  it("export CSV per tanggal", async () => {
    const s = await sessionOf(FRI, 1);
    await bookViaApi(s.id, 4, "081277776666");
    const res = await exportCsv(new Request(`http://localhost/api/admin/export?date=${FRI}`));
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    const lines = (await res.text()).replace(/^﻿/, "").trim().split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("No. Antrian");
    expect(lines[1]).toMatch(/^JM-004-[A-Z2-9]{4},2026-11-27,1,10:00-10:45,4,Siti Aminah,'081277776666,,BOOKED,/);
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
    const wrong = await login(jsonRequest("/api/admin/login", "POST", { password: "salah" }));
    expect(wrong.status).toBe(401);
    const ok = await login(jsonRequest("/api/admin/login", "POST", { password: "test-password" }));
    expect(ok.status).toBe(200);
    const cookie = ok.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`${ADMIN_COOKIE}=`);
    expect(cookie.toLowerCase()).toContain("httponly");
  });
});
