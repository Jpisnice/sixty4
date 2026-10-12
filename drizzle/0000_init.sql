CREATE TABLE `answers` (
	`id` text PRIMARY KEY NOT NULL,
	`device_id` text NOT NULL,
	`date` text NOT NULL,
	`steps` text NOT NULL,
	`canonical` text NOT NULL,
	`exact` integer NOT NULL,
	`points` integer NOT NULL,
	`rarity_bonus` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `answers_device_date` ON `answers` (`device_id`,`date`);--> statement-breakpoint
CREATE INDEX `answers_date_canonical` ON `answers` (`date`,`canonical`);--> statement-breakpoint
CREATE TABLE `devices` (
	`device_id` text PRIMARY KEY NOT NULL,
	`reminder_slot` text,
	`push_subscription` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `devices_reminder_slot` ON `devices` (`reminder_slot`);--> statement-breakpoint
CREATE TABLE `puzzles` (
	`date` text PRIMARY KEY NOT NULL,
	`number` integer NOT NULL,
	`tiles` text NOT NULL,
	`target` integer NOT NULL,
	`solutions` text NOT NULL,
	`ways_total` integer NOT NULL,
	`closed_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `puzzles_number_unique` ON `puzzles` (`number`);--> statement-breakpoint
CREATE TABLE `vitals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`value` real NOT NULL,
	`rating` text NOT NULL,
	`date` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `vitals_date` ON `vitals` (`date`);