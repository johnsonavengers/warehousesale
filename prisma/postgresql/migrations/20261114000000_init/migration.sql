-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('BOOKED', 'CHECKED_IN', 'CANCELLED');

-- CreateTable
CREATE TABLE "EventDay" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "EventDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "eventDayId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "queueStart" INTEGER NOT NULL,
    "queueEnd" INTEGER NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "queueNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "status" "TicketStatus" NOT NULL DEFAULT 'BOOKED',
    "checkedInAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hold" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "queueNumber" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Hold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CancelledTicket" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "queueNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "checkedInAt" TIMESTAMP(3),
    "bookedAt" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CancelledTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NowServing" (
    "date" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NowServing_pkey" PRIMARY KEY ("date")
);

-- CreateIndex
CREATE UNIQUE INDEX "EventDay_date_key" ON "EventDay"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Session_eventDayId_order_key" ON "Session"("eventDayId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_code_key" ON "Ticket"("code");

-- CreateIndex
CREATE INDEX "Ticket_phone_idx" ON "Ticket"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_date_queueNumber_key" ON "Ticket"("date", "queueNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Hold_date_queueNumber_key" ON "Hold"("date", "queueNumber");

-- CreateIndex
CREATE INDEX "CancelledTicket_date_idx" ON "CancelledTicket"("date");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_eventDayId_fkey" FOREIGN KEY ("eventDayId") REFERENCES "EventDay"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hold" ADD CONSTRAINT "Hold_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
