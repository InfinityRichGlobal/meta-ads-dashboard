ALTER TABLE `auto_pause_rules` ADD `minSpend` decimal(12,2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `auto_pause_rules` ADD `level` enum('ad','adset','campaign') DEFAULT 'ad' NOT NULL;--> statement-breakpoint
ALTER TABLE `auto_pause_rules` ADD `cron` varchar(64) DEFAULT '0 0 */3 * * *' NOT NULL;--> statement-breakpoint
ALTER TABLE `schedule_settings` ADD `cron` varchar(64) DEFAULT '0 0 */6 * * *' NOT NULL;--> statement-breakpoint
ALTER TABLE `weekly_report_settings` ADD `cron` varchar(64) DEFAULT '0 0 1 * * 1' NOT NULL;