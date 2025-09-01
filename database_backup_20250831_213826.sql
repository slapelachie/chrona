PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id"                    TEXT PRIMARY KEY NOT NULL,
    "checksum"              TEXT NOT NULL,
    "finished_at"           DATETIME,
    "migration_name"        TEXT NOT NULL,
    "logs"                  TEXT,
    "rolled_back_at"        DATETIME,
    "started_at"            DATETIME NOT NULL DEFAULT current_timestamp,
    "applied_steps_count"   INTEGER UNSIGNED NOT NULL DEFAULT 0
);
INSERT INTO _prisma_migrations VALUES('8a0d1518-8caa-4efd-8d51-aac6b20af88a','61ac113e43cc64d56e7f7d5627e1e251f5f2afcfa8a00090a7772c594f62329d',1756592272784,'20250828041543_init',NULL,NULL,1756592272558,1);
INSERT INTO _prisma_migrations VALUES('1b10187e-1ce1-4038-9d7d-4caee32f2d13','1cf360f6ab3ad38013b1da018a46f4f4c3e8ae49dab39539a14531e8d2391d96',1756592272837,'20250828100855_add_location_to_shifts',NULL,NULL,1756592272797,1);
INSERT INTO _prisma_migrations VALUES('8f0dc8f8-5a41-421a-aabf-0314ef2c9216','13f7e6edc27b956124e71438502d991a4413edd8d334c764b92bf378bd083e79',1756592272976,'20250828214047_add_penalty_overrides_and_preferences',NULL,NULL,1756592272851,1);
INSERT INTO _prisma_migrations VALUES('0b87cd25-d300-4838-a48e-9e66e52978fa','58ef9e677ad6508a0d501d00092152ffd43e3d4e83d5549c75f8bf66ee5e7d54',1756592273060,'20250830094303_add_span_of_ordinary_hours',NULL,NULL,1756592272988,1);
INSERT INTO _prisma_migrations VALUES('b233bd2a-a008-44b2-a8d2-36d8e30ae6a6','ce92f2e9ecb393620b41289727c3a5e1ea2191598eed0187a51d2b4504e8a321',1756592273139,'20250830094703_update_retail_award_defaults',NULL,NULL,1756592273072,1);
INSERT INTO _prisma_migrations VALUES('d11b3e0a-6c72-49a2-8e79-80129e2796fc','154233907570bb5e21ebe74af2f4255b12b1af7d5cb587e569ecb60f20bc4f2c',1756592273194,'20250830100100_add_penalty_time_frames',NULL,NULL,1756592273152,1);
INSERT INTO _prisma_migrations VALUES('2ff8ad37-825a-42ac-a521-20076279850a','4cc18dde7c86f61bae5287c8abafce03af6f9d4baaaf66461e179e876a619508',1756637549305,'20250831000000_add_pay_period_preferences',NULL,NULL,1756637549036,1);
CREATE TABLE IF NOT EXISTS "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "taxFileNumber" TEXT,
    "tfnDeclared" BOOLEAN NOT NULL DEFAULT false,
    "dateOfBirth" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "claimsTaxFreeThreshold" BOOLEAN NOT NULL DEFAULT true,
    "hasHECSDebt" BOOLEAN NOT NULL DEFAULT false,
    "hasStudentFinancialSupplement" BOOLEAN NOT NULL DEFAULT false,
    "medicareLevyExemption" BOOLEAN NOT NULL DEFAULT false
, "defaultPayGuideId" TEXT, "lastUsedPayGuideId" TEXT, "payPeriodFrequency" TEXT NOT NULL DEFAULT 'fortnightly', "payPeriodStartDay" INTEGER NOT NULL DEFAULT 1);
INSERT INTO users VALUES('default-user','Default User','user@example.com',NULL,0,NULL,1756592273944,1756639793347,1,1,0,0,'cmeyuj9p00001pc7uskw36ip5','cmeyuj9p00001pc7uskw36ip5','weekly',1);
CREATE TABLE IF NOT EXISTS "tax_brackets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "year" TEXT NOT NULL,
    "minIncome" DECIMAL NOT NULL,
    "maxIncome" DECIMAL,
    "taxRate" DECIMAL NOT NULL,
    "baseTax" DECIMAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO tax_brackets VALUES('cmeytop470000pcx0s7pk9twv','2024-25',0,18200,0,0,1756592273959);
INSERT INTO tax_brackets VALUES('cmeytop4l0001pcx092hm3reb','2024-25',18201,45000,0.1900000000000000022,0,1756592273974);
INSERT INTO tax_brackets VALUES('cmeytop500002pcx0obkfhc1a','2024-25',45001,120000,0.3250000000000000111,5092,1756592273988);
INSERT INTO tax_brackets VALUES('cmeytop5g0003pcx0i8gqcol6','2024-25',120001,180000,0.3699999999999999956,29467,1756592274005);
INSERT INTO tax_brackets VALUES('cmeytop5w0004pcx0dtgi8uoa','2024-25',180001,NULL,0.4500000000000000111,51667,1756592274021);
CREATE TABLE IF NOT EXISTS "hecs_thresholds" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "year" TEXT NOT NULL,
    "minIncome" DECIMAL NOT NULL,
    "maxIncome" DECIMAL,
    "repaymentRate" DECIMAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO hecs_thresholds VALUES('cmeytop6a0005pcx0qkq8rpkn','2024-25',51550,59518,0.0100000000000000002,1756592274035);
INSERT INTO hecs_thresholds VALUES('cmeytop6o0006pcx0n5rwerca','2024-25',59519,63089,0.02000000000000000041,1756592274049);
INSERT INTO hecs_thresholds VALUES('cmeytop750007pcx08c4s4ns6','2024-25',63090,66875,0.02500000000000000138,1756592274065);
INSERT INTO hecs_thresholds VALUES('cmeytop7j0008pcx0cudevyb3','2024-25',66876,70888,0.02999999999999999889,1756592274079);
INSERT INTO hecs_thresholds VALUES('cmeytop7x0009pcx08f8t1mor','2024-25',70889,75140,0.03500000000000000334,1756592274093);
INSERT INTO hecs_thresholds VALUES('cmeytop8d000apcx0y606fsf3','2024-25',75141,79649,0.04000000000000000083,1756592274109);
INSERT INTO hecs_thresholds VALUES('cmeytop8t000bpcx0s42zecuh','2024-25',79650,84429,0.04499999999999999834,1756592274125);
INSERT INTO hecs_thresholds VALUES('cmeytop98000cpcx0gzoyjhe5','2024-25',84430,89494,0.05000000000000000277,1756592274140);
INSERT INTO hecs_thresholds VALUES('cmeytop9n000dpcx0c4643kah','2024-25',89495,94865,0.05500000000000000027,1756592274155);
INSERT INTO hecs_thresholds VALUES('cmeytopa3000epcx06u2dnfd7','2024-25',94866,100560,0.05999999999999999778,1756592274171);
INSERT INTO hecs_thresholds VALUES('cmeytopaj000fpcx0cpuxtjwh','2024-25',100561,106607,0.06500000000000000222,1756592274187);
INSERT INTO hecs_thresholds VALUES('cmeytopax000gpcx0wslr5w1w','2024-25',106608,113028,0.07000000000000000667,1756592274201);
INSERT INTO hecs_thresholds VALUES('cmeytopbc000hpcx08ev08kkn','2024-25',113029,119847,0.07499999999999999723,1756592274217);
INSERT INTO hecs_thresholds VALUES('cmeytopbt000ipcx0e54qarnm','2024-25',119848,127090,0.08000000000000000166,1756592274234);
INSERT INTO hecs_thresholds VALUES('cmeytopca000jpcx0ca1o6wu6','2024-25',127091,134788,0.08500000000000000611,1756592274250);
INSERT INTO hecs_thresholds VALUES('cmeytopcq000kpcx0vdymzvyz','2024-25',134789,142974,0.08999999999999999667,1756592274266);
INSERT INTO hecs_thresholds VALUES('cmeytopd4000lpcx07pdjkzbq','2024-25',142975,151682,0.0950000000000000011,1756592274280);
INSERT INTO hecs_thresholds VALUES('cmeytopdj000mpcx0nis6wis0','2024-25',151683,NULL,0.1000000000000000055,1756592274295);
CREATE TABLE IF NOT EXISTS "public_holidays" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "state" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO public_holidays VALUES('cmeytopdy000npcx09buu931t','New Year''s Day',1735689600000,'NATIONAL',1756592274311);
INSERT INTO public_holidays VALUES('cmeytoped000opcx00au7vzxl','Australia Day',1737936000000,'NATIONAL',1756592274325);
INSERT INTO public_holidays VALUES('cmeytoper000ppcx0mmzgwnms','Good Friday',1744934400000,'NATIONAL',1756592274339);
INSERT INTO public_holidays VALUES('cmeytopf6000qpcx0954yqnmo','Easter Saturday',1745020800000,'NATIONAL',1756592274354);
INSERT INTO public_holidays VALUES('cmeytopfl000rpcx02uhdq9y4','Easter Monday',1745193600000,'NATIONAL',1756592274369);
INSERT INTO public_holidays VALUES('cmeytopfz000spcx0fyugdbvf','ANZAC Day',1745539200000,'NATIONAL',1756592274383);
INSERT INTO public_holidays VALUES('cmeytopgd000tpcx0tj5h4ki3','Queen''s Birthday',1749427200000,'NATIONAL',1756592274397);
INSERT INTO public_holidays VALUES('cmeytopgu000upcx0ngthcf3t','Christmas Day',1766620800000,'NATIONAL',1756592274414);
INSERT INTO public_holidays VALUES('cmeytoph8000vpcx0q0bx18pj','Boxing Day',1766707200000,'NATIONAL',1756592274429);
CREATE TABLE IF NOT EXISTS "pay_periods" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "payDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "weeklyHours" DECIMAL,
    "totalGrossPay" DECIMAL,
    "totalTax" DECIMAL,
    "hecsRepayment" DECIMAL,
    "medicareLevy" DECIMAL,
    "superannuation" DECIMAL,
    "totalNetPay" DECIMAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "pay_periods_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO pay_periods VALUES('cmeyuxy4j000lpc7uffsg9bcb','default-user',1756044000000,1756648799999,1757286000000,'OPEN',NULL,NULL,NULL,NULL,NULL,NULL,NULL,1756594385155,1756639795789);
INSERT INTO pay_periods VALUES('cmezb73fx0003pcjlfvhnh8uj','default-user',1724594400000,1725803999999,1726408799999,'OPEN',NULL,NULL,NULL,NULL,NULL,NULL,NULL,1756621685805,1756621685805);
CREATE TABLE IF NOT EXISTS "pay_period_shifts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "payPeriodId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    CONSTRAINT "pay_period_shifts_payPeriodId_fkey" FOREIGN KEY ("payPeriodId") REFERENCES "pay_periods" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "pay_period_shifts_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO pay_period_shifts VALUES('cmezjrlx60003pc9wn1u68cq5','cmeyuxy4j000lpc7uffsg9bcb','cmezjrlw10001pc9wun3bpke1');
INSERT INTO pay_period_shifts VALUES('cmezjrwi00007pc9wxmix4vnf','cmeyuxy4j000lpc7uffsg9bcb','cmezjrwgy0005pc9ww82i51ee');
INSERT INTO pay_period_shifts VALUES('cmezkbtvt0003pc90umy1zcvz','cmeyuxy4j000lpc7uffsg9bcb','cmezkbtug0001pc90me1khzsu');
INSERT INTO pay_period_shifts VALUES('cmezkcbvv0007pc90z656bn9d','cmeyuxy4j000lpc7uffsg9bcb','cmezkcbuq0005pc9076kybzu3');
CREATE TABLE IF NOT EXISTS "pay_verifications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "payPeriodId" TEXT NOT NULL,
    "actualGrossPay" DECIMAL NOT NULL,
    "actualTax" DECIMAL NOT NULL,
    "actualNetPay" DECIMAL NOT NULL,
    "actualSuper" DECIMAL,
    "actualHECS" DECIMAL,
    "paySlipReference" TEXT,
    "verificationDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "grossPayDifference" DECIMAL,
    "taxDifference" DECIMAL,
    "netPayDifference" DECIMAL,
    CONSTRAINT "pay_verifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "pay_verifications_payPeriodId_fkey" FOREIGN KEY ("payPeriodId") REFERENCES "pay_periods" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "shifts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "payGuideId" TEXT NOT NULL,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME,
    "breakMinutes" INTEGER NOT NULL DEFAULT 0,
    "shiftType" TEXT NOT NULL DEFAULT 'REGULAR',
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "notes" TEXT,
    "location" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "penaltyOverrides" TEXT,
    "autoCalculatePenalties" BOOLEAN NOT NULL DEFAULT true,
    "totalMinutes" INTEGER,
    "regularHours" DECIMAL,
    "overtimeHours" DECIMAL,
    "penaltyHours" DECIMAL,
    "grossPay" DECIMAL,
    "superannuation" DECIMAL,
    CONSTRAINT "shifts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "shifts_payGuideId_fkey" FOREIGN KEY ("payGuideId") REFERENCES "pay_guides" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO shifts VALUES('cmezjrlw10001pc9wun3bpke1','default-user','cmeyuj9p00001pc7uskw36ip5',1756504800000,1756537200000,30,'REGULAR','COMPLETED',NULL,NULL,1756636079761,1756636079761,'{}',1,510,0,0,8.5,352.6437500000000113,38.79081250000000125);
INSERT INTO shifts VALUES('cmezjrwgy0005pc9ww82i51ee','default-user','cmeyuj9p00001pc7uskw36ip5',1756598400000,1756618200000,30,'REGULAR','COMPLETED',NULL,NULL,1756636093474,1756636093474,'{}',1,300,0,0,5,248.9250000000000113,27.38175000000000025);
INSERT INTO shifts VALUES('cmezkbtug0001pc90me1khzsu','default-user','cmeyuj9p00001pc7uskw36ip5',1756261800000,1756279800000,0,'REGULAR','COMPLETED',NULL,NULL,1756637023192,1756637023192,'{}',1,300,5,0,0,165.9499999999999887,18.25450000000000017);
INSERT INTO shifts VALUES('cmezkcbuq0005pc9076kybzu3','default-user','cmeyuj9p00001pc7uskw36ip5',1756330200000,1756348200000,0,'REGULAR','COMPLETED',NULL,NULL,1756637046531,1756637046531,'{}',1,300,5,0,0,165.9499999999999887,18.25450000000000017);
CREATE TABLE IF NOT EXISTS "pay_guides" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "effectiveFrom" DATETIME NOT NULL,
    "effectiveTo" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "baseHourlyRate" DECIMAL NOT NULL,
    "casualLoading" DECIMAL NOT NULL DEFAULT 0.0,
    "overtimeRate1_5x" DECIMAL NOT NULL DEFAULT 1.75,
    "overtimeRate2x" DECIMAL NOT NULL DEFAULT 2.25,
    "eveningPenalty" DECIMAL NOT NULL DEFAULT 1.5,
    "nightPenalty" DECIMAL NOT NULL DEFAULT 1.30,
    "saturdayPenalty" DECIMAL NOT NULL DEFAULT 1.5,
    "sundayPenalty" DECIMAL NOT NULL DEFAULT 1.75,
    "publicHolidayPenalty" DECIMAL NOT NULL DEFAULT 2.5,
    "eveningStart" TEXT NOT NULL DEFAULT '18:00',
    "eveningEnd" TEXT NOT NULL DEFAULT '22:00',
    "nightStart" TEXT NOT NULL DEFAULT '22:00',
    "nightEnd" TEXT NOT NULL DEFAULT '06:00',
    "mondayStart" TEXT NOT NULL DEFAULT '07:00',
    "mondayEnd" TEXT NOT NULL DEFAULT '21:00',
    "tuesdayStart" TEXT NOT NULL DEFAULT '07:00',
    "tuesdayEnd" TEXT NOT NULL DEFAULT '21:00',
    "wednesdayStart" TEXT NOT NULL DEFAULT '07:00',
    "wednesdayEnd" TEXT NOT NULL DEFAULT '21:00',
    "thursdayStart" TEXT NOT NULL DEFAULT '07:00',
    "thursdayEnd" TEXT NOT NULL DEFAULT '21:00',
    "fridayStart" TEXT NOT NULL DEFAULT '07:00',
    "fridayEnd" TEXT NOT NULL DEFAULT '21:00',
    "saturdayStart" TEXT NOT NULL DEFAULT '07:00',
    "saturdayEnd" TEXT NOT NULL DEFAULT '18:00',
    "sundayStart" TEXT NOT NULL DEFAULT '09:00',
    "sundayEnd" TEXT NOT NULL DEFAULT '18:00',
    "dailyOvertimeHours" DECIMAL NOT NULL DEFAULT 9.0,
    "specialDayOvertimeHours" DECIMAL NOT NULL DEFAULT 11.0,
    "weeklyOvertimeHours" DECIMAL NOT NULL DEFAULT 38.0,
    "overtimeOnSpanBoundary" BOOLEAN NOT NULL DEFAULT true,
    "overtimeOnDailyLimit" BOOLEAN NOT NULL DEFAULT true,
    "overtimeOnWeeklyLimit" BOOLEAN NOT NULL DEFAULT true,
    "allowPenaltyCombination" BOOLEAN NOT NULL DEFAULT true,
    "penaltyCombinationRules" TEXT,
    CONSTRAINT "pay_guides_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO pay_guides VALUES('retail-award-2024','General Retail Industry Award MA000004 - Level 1 Casual',1751328000000,NULL,1,'default-user',1756592274444,1756592274444,26.55000000000000071,0,1.75,2.25,1.5,1.300000000000000044,1.5,1.75,2.5,'18:00','22:00','22:00','06:00','07:00','21:00','07:00','21:00','07:00','21:00','07:00','21:00','07:00','21:00','07:00','18:00','09:00','18:00',9,11,38,1,1,1,1,NULL);
INSERT INTO pay_guides VALUES('retail-award-level2-2025','General Retail Industry Award MA000004 - Level 2 Casual',1751328000000,NULL,0,'default-user',1756592274459,1756592274459,27.16000000000000014,0,1.75,2.25,1.5,1.300000000000000044,1.5,1.75,2.5,'18:00','22:00','22:00','06:00','07:00','21:00','07:00','21:00','07:00','21:00','07:00','21:00','07:00','21:00','07:00','18:00','09:00','18:00',9,11,38,1,1,1,1,NULL);
INSERT INTO pay_guides VALUES('cmeyuj9p00001pc7uskw36ip5','SCG Services 2025',1751328000000,NULL,1,'default-user',1756593700308,1756621934790,33.18999999999999773,0,1.5,2,1.5,1.300000000000000044,1.5,1.75,2.5,'18:00','22:00','22:00','06:00','07:00','21:00','07:00','21:00','07:00','21:00','07:00','21:00','07:00','21:00','07:00','18:00','09:00','18:00',10,11,38,1,1,1,1,NULL);
CREATE TABLE IF NOT EXISTS "penalty_time_frames" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "payGuideId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "penaltyRate" DECIMAL NOT NULL,
    "dayOfWeek" INTEGER,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "penalty_time_frames_payGuideId_fkey" FOREIGN KEY ("payGuideId") REFERENCES "pay_guides" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO penalty_time_frames VALUES('cmeytt0i1000xpcgurkzjfaze','retail-award-2024','Saturday Penalty','Saturday penalty rate (125%) as per Australian Retail Industry Award','00:00','23:59',1.25,6,3,1,1756592475337,1756592475337);
INSERT INTO penalty_time_frames VALUES('cmeytt0ig000zpcgunapw34wi','retail-award-2024','Sunday Penalty','Sunday penalty rate (175%) as per Australian Retail Industry Award','00:00','23:59',1.75,0,4,1,1756592475353,1756592475353);
INSERT INTO penalty_time_frames VALUES('cmeytt0iw0011pcgu9aecagnt','retail-award-2024','Evening Penalty (Monday)','Evening penalty rate (125%) from 6pm-midnight on Monday','18:00','23:59',1.25,1,1,1,1756592475368,1756592475368);
INSERT INTO penalty_time_frames VALUES('cmeytt0ja0013pcguwo8alnvh','retail-award-2024','Evening Penalty (Tuesday)','Evening penalty rate (125%) from 6pm-midnight on Tuesday','18:00','23:59',1.25,2,1,1,1756592475382,1756592475382);
INSERT INTO penalty_time_frames VALUES('cmeytt0jp0015pcgu4m5vm0pb','retail-award-2024','Evening Penalty (Wednesday)','Evening penalty rate (125%) from 6pm-midnight on Wednesday','18:00','23:59',1.25,3,1,1,1756592475397,1756592475397);
INSERT INTO penalty_time_frames VALUES('cmeytt0k30017pcgul39usps1','retail-award-2024','Evening Penalty (Thursday)','Evening penalty rate (125%) from 6pm-midnight on Thursday','18:00','23:59',1.25,4,1,1,1756592475412,1756592475412);
INSERT INTO penalty_time_frames VALUES('cmeytt0kh0019pcgupim5sfct','retail-award-2024','Evening Penalty (Friday)','Evening penalty rate (125%) from 6pm-midnight on Friday','18:00','23:59',1.25,5,1,1,1756592475425,1756592475425);
INSERT INTO penalty_time_frames VALUES('cmeyuky320003pc7udnlthirn','cmeyuj9p00001pc7uskw36ip5','Evening',NULL,'18:00','21:00',1.25,NULL,25,1,1756593778574,1756593778574);
INSERT INTO penalty_time_frames VALUES('cmeyumj7b0005pc7uhlyb9fo4','cmeyuj9p00001pc7uskw36ip5','Night',NULL,'21:00','06:00',1.5,NULL,50,1,1756593852599,1756593852599);
INSERT INTO penalty_time_frames VALUES('cmeyunwlh0007pc7un67lvg84','cmeyuj9p00001pc7uskw36ip5','Saturday',NULL,'00:00','23:59',1.25,6,25,1,1756593916613,1756593916613);
INSERT INTO penalty_time_frames VALUES('cmeyutmqw0009pc7uwytbtdzm','cmeyuj9p00001pc7uskw36ip5','Saturday Morning',NULL,'00:00','07:00',1.5,NULL,50,1,1756594183784,1756594183784);
INSERT INTO penalty_time_frames VALUES('cmeyuudoz000bpc7u44bugi62','cmeyuj9p00001pc7uskw36ip5','Saturday Night',NULL,'18:00','23:59',1.5,6,50,1,1756594218707,1756594218707);
INSERT INTO penalty_time_frames VALUES('cmeyuvrn0000dpc7uuv4y920b','cmeyuj9p00001pc7uskw36ip5','Sunday',NULL,'09:00','18:00',1.5,0,50,1,1756594283436,1756594283436);
INSERT INTO penalty_time_frames VALUES('cmeyuwrfh000fpc7u2a0o0dbi','cmeyuj9p00001pc7uskw36ip5','Sunday Morning',NULL,'00:00','09:00',2,0,100,1,1756594329822,1756594329822);
INSERT INTO penalty_time_frames VALUES('cmeyuxbyx000hpc7uddmckvem','cmeyuj9p00001pc7uskw36ip5','Sunday Night',NULL,'18:00','23:59',2,0,100,1,1756594356441,1756594356441);
INSERT INTO penalty_time_frames VALUES('cmezb5plt000xpcypshjxv04x','retail-award-2024','Saturday Penalty','Saturday penalty rate (125%) as per Australian Retail Industry Award','00:00','23:59',1.25,6,3,1,1756621621217,1756621621217);
INSERT INTO penalty_time_frames VALUES('cmezb5pm7000zpcypirjrrjvj','retail-award-2024','Sunday Penalty','Sunday penalty rate (175%) as per Australian Retail Industry Award','00:00','23:59',1.75,0,4,1,1756621621231,1756621621231);
INSERT INTO penalty_time_frames VALUES('cmezb5pml0011pcypgehq1cyv','retail-award-2024','Evening Penalty (Monday)','Evening penalty rate (125%) from 6pm-midnight on Monday','18:00','23:59',1.25,1,1,1,1756621621245,1756621621245);
INSERT INTO penalty_time_frames VALUES('cmezb5pn10013pcyprhhe5k4z','retail-award-2024','Evening Penalty (Tuesday)','Evening penalty rate (125%) from 6pm-midnight on Tuesday','18:00','23:59',1.25,2,1,1,1756621621261,1756621621261);
INSERT INTO penalty_time_frames VALUES('cmezb5pnh0015pcypyi5wy881','retail-award-2024','Evening Penalty (Wednesday)','Evening penalty rate (125%) from 6pm-midnight on Wednesday','18:00','23:59',1.25,3,1,1,1756621621277,1756621621277);
INSERT INTO penalty_time_frames VALUES('cmezb5pnx0017pcyp5eboo5z3','retail-award-2024','Evening Penalty (Thursday)','Evening penalty rate (125%) from 6pm-midnight on Thursday','18:00','23:59',1.25,4,1,1,1756621621293,1756621621293);
INSERT INTO penalty_time_frames VALUES('cmezb5pob0019pcyp3zj7a5cb','retail-award-2024','Evening Penalty (Friday)','Evening penalty rate (125%) from 6pm-midnight on Friday','18:00','23:59',1.25,5,1,1,1756621621307,1756621621307);
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "tax_brackets_year_minIncome_key" ON "tax_brackets"("year", "minIncome");
CREATE UNIQUE INDEX "hecs_thresholds_year_minIncome_key" ON "hecs_thresholds"("year", "minIncome");
CREATE UNIQUE INDEX "public_holidays_date_state_key" ON "public_holidays"("date", "state");
CREATE UNIQUE INDEX "pay_periods_userId_startDate_key" ON "pay_periods"("userId", "startDate");
CREATE UNIQUE INDEX "pay_period_shifts_payPeriodId_shiftId_key" ON "pay_period_shifts"("payPeriodId", "shiftId");
CREATE UNIQUE INDEX "pay_verifications_userId_payPeriodId_key" ON "pay_verifications"("userId", "payPeriodId");
COMMIT;
