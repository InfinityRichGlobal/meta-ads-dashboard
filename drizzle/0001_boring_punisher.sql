CREATE TABLE `ab_tests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`variantAType` enum('ad','campaign','adset') NOT NULL,
	`variantAId` varchar(64) NOT NULL,
	`variantAName` varchar(255),
	`variantBType` enum('ad','campaign','adset') NOT NULL,
	`variantBId` varchar(64) NOT NULL,
	`variantBName` varchar(255),
	`datePreset` varchar(32) NOT NULL DEFAULT 'last_7d',
	`metricsA` json,
	`metricsB` json,
	`winner` varchar(16),
	`aiAnalysis` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ab_tests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `auto_pause_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ruleId` int NOT NULL,
	`userId` int NOT NULL,
	`runAt` timestamp NOT NULL DEFAULT (now()),
	`status` varchar(32) NOT NULL,
	`adsChecked` int NOT NULL DEFAULT 0,
	`matchedCount` int NOT NULL DEFAULT 0,
	`notificationSent` boolean NOT NULL DEFAULT false,
	`detail` text,
	CONSTRAINT `auto_pause_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `auto_pause_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`metric` enum('cpa','ctr','spend','frequency','roas') NOT NULL,
	`operator` enum('gt','lt','gte','lte') NOT NULL,
	`threshold` decimal(12,2) NOT NULL,
	`datePreset` varchar(32) NOT NULL DEFAULT 'last_7d',
	`checkHour` int NOT NULL DEFAULT 9,
	`checkMinute` int NOT NULL DEFAULT 0,
	`enabled` boolean NOT NULL DEFAULT true,
	`scheduleCronTaskUid` varchar(65),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `auto_pause_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cost_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`costPrice` decimal(12,2) NOT NULL,
	`sellingPrice` decimal(12,2) NOT NULL,
	`shippingCost` decimal(12,2) NOT NULL DEFAULT '0',
	`packingCost` decimal(12,2) NOT NULL DEFAULT '0',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cost_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dayparting_schedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`campaignId` varchar(64),
	`name` varchar(255) NOT NULL,
	`scheduleJson` json,
	`timezone` varchar(64) NOT NULL DEFAULT 'Asia/Bangkok',
	`enabled` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `dayparting_schedules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `meta_ads_cache` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`adAccountId` varchar(64) NOT NULL,
	`data` json,
	`syncedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `meta_ads_cache_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `meta_adsets_cache` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`adAccountId` varchar(64) NOT NULL,
	`data` json,
	`syncedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `meta_adsets_cache_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `meta_ai_drafts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`adId` varchar(64),
	`adName` varchar(255),
	`campaignId` varchar(64),
	`mode` enum('new_creative','new_campaign') NOT NULL DEFAULT 'new_creative',
	`headline` text,
	`body` text,
	`cta` varchar(64),
	`imageUrl` text,
	`imagePrompt` text,
	`audienceJson` json,
	`budgetJson` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `meta_ai_drafts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `meta_insights_cache` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`adAccountId` varchar(64) NOT NULL,
	`datePreset` varchar(32) NOT NULL,
	`level` varchar(16) NOT NULL,
	`cacheKey` varchar(128) NOT NULL,
	`data` json,
	`syncedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `meta_insights_cache_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `meta_token_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`action` varchar(64) NOT NULL,
	`tokenLabel` varchar(128),
	`detail` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `meta_token_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `meta_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`accessToken` text NOT NULL,
	`adAccountId` varchar(64) NOT NULL,
	`tokenLabel` varchar(128),
	`scopes` text,
	`status` enum('active','expired','revoked') NOT NULL DEFAULT 'active',
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `meta_tokens_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `schedule_job_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`runAt` timestamp NOT NULL DEFAULT (now()),
	`status` varchar(32) NOT NULL,
	`adsChecked` int NOT NULL DEFAULT 0,
	`underperformingCount` int NOT NULL DEFAULT 0,
	`notificationSent` boolean NOT NULL DEFAULT false,
	`detail` text,
	CONSTRAINT `schedule_job_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `schedule_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`enabled` boolean NOT NULL DEFAULT false,
	`checkHour` int NOT NULL DEFAULT 8,
	`checkMinute` int NOT NULL DEFAULT 0,
	`datePreset` varchar(32) NOT NULL DEFAULT 'last_7d',
	`scheduleCronTaskUid` varchar(65),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `schedule_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `weekly_report_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`enabled` boolean NOT NULL DEFAULT false,
	`scheduleCronTaskUid` varchar(65),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `weekly_report_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `weekly_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`adAccountId` varchar(64) NOT NULL,
	`weekStart` varchar(16) NOT NULL,
	`weekEnd` varchar(16) NOT NULL,
	`data` json,
	`aiSummary` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `weekly_reports_id` PRIMARY KEY(`id`)
);
