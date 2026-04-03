CREATE TABLE `business` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`sync_id` text,
	`business_name` text(150) NOT NULL,
	`business_location_name` text,
	`last_sync` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `business_sync_id_unique` ON `business` (`sync_id`);--> statement-breakpoint
CREATE TABLE `business_branch` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`sync_id` text,
	`branch_location_name` text(255) NOT NULL,
	`branch_location_coordinate` text,
	`branch_email_address` text(255) NOT NULL,
	`branch_phone_number` text(20) NOT NULL,
	`default_language` text(10) DEFAULT 'en',
	`default_currency` text(10) DEFAULT 'USD',
	`verification_code` text(6) NOT NULL,
	`is_approved` integer DEFAULT false,
	`is_verified` integer DEFAULT false,
	`is_active` integer DEFAULT false,
	`is_deleted` integer DEFAULT false,
	`is_sync_required` integer DEFAULT true,
	`last_sync` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	CONSTRAINT "currency_codes_check" CHECK(default_currency IN ('XAF ')),
	CONSTRAINT "language_codes_check" CHECK(default_language IN ('en', 'fr'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `business_branch_sync_id_unique` ON `business_branch` (`sync_id`);--> statement-breakpoint
CREATE TABLE `departments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sync_id` text,
	`department_name` text(100) NOT NULL,
	`created_on` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updated_on` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`is_deleted` integer DEFAULT false,
	`is_sync_required` integer DEFAULT true,
	`last_sync` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`is_active` integer DEFAULT true
);
--> statement-breakpoint
CREATE UNIQUE INDEX `departments_sync_id_unique` ON `departments` (`sync_id`);--> statement-breakpoint
CREATE TABLE `employee_activities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`activity` text(255) NOT NULL,
	`linked_activity_id` integer DEFAULT 0,
	`linked_activity_table` text(50) DEFAULT '',
	`old_data` text DEFAULT '',
	`new_data` text DEFAULT '',
	`employee_id` integer NOT NULL,
	`created_on` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`last_sync` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `linked_activity_idx` ON `employee_activities` (`linked_activity_id`,`linked_activity_table`);--> statement-breakpoint
CREATE TABLE `employee_media` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sync_id` text,
	`employee_id` integer NOT NULL,
	`profile_picture` text,
	`id_card` text,
	`employee_badge` text,
	`contract` text,
	`signature` text,
	`created_on` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updated_on` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`is_deleted` integer DEFAULT false,
	`is_sync_required` integer DEFAULT true,
	`last_sync` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `employee_media_sync_id_unique` ON `employee_media` (`sync_id`) WHERE "employee_media"."sync_id" != '';--> statement-breakpoint
CREATE INDEX `employee_media_employee_id_idx` ON `employee_media` (`employee_id`);--> statement-breakpoint
CREATE TABLE `employees` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sync_id` text,
	`username` text(50) NOT NULL,
	`password_hash` text(255) NOT NULL,
	`role` text(50) DEFAULT 'viewer',
	`first-name` text(100),
	`last_name` text(100),
	`email` text(150),
	`phone` text(20),
	`address` text(255),
	`date_of_birth` text,
	`date_of_joining` text,
	`emergency_contact` text(255),
	`department_id` integer,
	`salary` text DEFAULT '0',
	`created_on` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updated_on` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`is_deleted` integer DEFAULT false,
	`last_sync` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`is_sync_required` integer DEFAULT true,
	`is_active` integer DEFAULT true,
	FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "account_roles_check" CHECK(role IN ('admin', 'manager', 'staff', 'accountant', 'sales_person', 'viewer'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `employees_sync_id_unique` ON `employees` (`sync_id`);--> statement-breakpoint
CREATE TABLE `activation` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`sync_id` text,
	`activation_key` text,
	`subscription` text DEFAULT 'basic',
	`is_activation_required` integer DEFAULT 0,
	`is_sync_required` integer DEFAULT 1,
	`last_sync` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `activation_sync_id_unique` ON `activation` (`sync_id`);--> statement-breakpoint
CREATE TABLE `customers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`email` text,
	`address` text,
	`sync_id` text DEFAULT '',
	`created_on` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updated_on` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`is_deleted` integer DEFAULT false,
	`is_active` integer DEFAULT true,
	`is_sync_required` integer DEFAULT true,
	`last_synced_on` integer
);
--> statement-breakpoint
CREATE INDEX `customers_name_idx` ON `customers` (`name`);--> statement-breakpoint
CREATE INDEX `customers_phone_idx` ON `customers` (`phone`);--> statement-breakpoint
CREATE INDEX `customers_email_idx` ON `customers` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `customers_sync_id_unique` ON `customers` (`sync_id`) WHERE "customers"."sync_id" != '';--> statement-breakpoint
CREATE TABLE `attributes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`attribute_name` text(50) NOT NULL,
	`unit` text(20) DEFAULT '',
	`sync_id` text DEFAULT '',
	`created_on` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updated_on` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`last_sync` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`is_active` integer DEFAULT true,
	`is_deleted` integer DEFAULT false,
	`is_sync_required` integer DEFAULT true
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attributes_sync_id_unique` ON `attributes` (`sync_id`) WHERE "attributes"."sync_id" != '';--> statement-breakpoint
CREATE INDEX `attributes_name_idx` ON `attributes` (`attribute_name`);--> statement-breakpoint
CREATE INDEX `attributes_unit_idx` ON `attributes` (`unit`);--> statement-breakpoint
CREATE INDEX `attributes_sync_id_idx` ON `attributes` (`sync_id`);--> statement-breakpoint
CREATE INDEX `attributes_created_on_idx` ON `attributes` (`created_on`);--> statement-breakpoint
CREATE INDEX `attributes_is_active_idx` ON `attributes` (`is_active`);--> statement-breakpoint
CREATE INDEX `attributes_is_deleted_idx` ON `attributes` (`is_deleted`);--> statement-breakpoint
CREATE INDEX `attributes_active_name_idx` ON `attributes` (`is_active`,`attribute_name`);--> statement-breakpoint
CREATE INDEX `attributes_active_unit_idx` ON `attributes` (`is_active`,`unit`);--> statement-breakpoint
CREATE TABLE `product_categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sync_id` text DEFAULT '',
	`name` text(100) NOT NULL,
	`parent_category_id` integer,
	`description` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`last_sync` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`is_deleted` integer DEFAULT false,
	`is_active` integer DEFAULT true,
	`is_sync_required` integer DEFAULT true,
	FOREIGN KEY (`parent_category_id`) REFERENCES `product_categories`(`id`) ON UPDATE cascade ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_sync_id_unique` ON `product_categories` (`sync_id`) WHERE "product_categories"."sync_id" != '';--> statement-breakpoint
CREATE INDEX `categories_parent_id_idx` ON `product_categories` (`parent_category_id`);--> statement-breakpoint
CREATE INDEX `categories_name_idx` ON `product_categories` (`name`);--> statement-breakpoint
CREATE INDEX `categories_is_active_idx` ON `product_categories` (`is_active`);--> statement-breakpoint
CREATE INDEX `categories_is_deleted_idx` ON `product_categories` (`is_deleted`);--> statement-breakpoint
CREATE INDEX `categories_sync_id_idx` ON `product_categories` (`sync_id`);--> statement-breakpoint
CREATE INDEX `categories_created_at_idx` ON `product_categories` (`created_at`);--> statement-breakpoint
CREATE INDEX `categories_active_parent_idx` ON `product_categories` (`is_active`,`parent_category_id`);--> statement-breakpoint
CREATE TABLE `product_category_image` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sync_id` text DEFAULT '',
	`product_category_id` integer NOT NULL,
	`image` text,
	`created_on` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updated_on` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`last_sync` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`is_deleted` integer DEFAULT false,
	`is_sync_required` integer DEFAULT true,
	FOREIGN KEY (`product_category_id`) REFERENCES `product_categories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_category_image_product_category_id_unique` ON `product_category_image` (`product_category_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `category_image_sync_id_unique` ON `product_category_image` (`sync_id`) WHERE "product_category_image"."sync_id" != '';--> statement-breakpoint
CREATE INDEX `category_image_category_id_idx` ON `product_category_image` (`product_category_id`);--> statement-breakpoint
CREATE INDEX `category_image_sync_id_idx` ON `product_category_image` (`sync_id`);--> statement-breakpoint
CREATE INDEX `category_image_created_on_idx` ON `product_category_image` (`created_on`);--> statement-breakpoint
CREATE INDEX `category_image_is_deleted_idx` ON `product_category_image` (`is_deleted`);--> statement-breakpoint
CREATE INDEX `category_image_active_idx` ON `product_category_image` (`is_deleted`,`product_category_id`);--> statement-breakpoint
CREATE TABLE `product_image` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sync_id` text DEFAULT '',
	`product_id` integer NOT NULL,
	`image` text,
	`created_on` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updated_on` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`is_deleted` integer DEFAULT false,
	`is_sync_required` integer DEFAULT true,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_image_sync_id_unique` ON `product_image` (`sync_id`) WHERE "product_image"."sync_id" != '';--> statement-breakpoint
CREATE INDEX `product_image_product_id_idx` ON `product_image` (`product_id`);--> statement-breakpoint
CREATE INDEX `product_image_sync_id_idx` ON `product_image` (`sync_id`);--> statement-breakpoint
CREATE INDEX `product_image_created_on_idx` ON `product_image` (`created_on`);--> statement-breakpoint
CREATE INDEX `product_image_is_deleted_idx` ON `product_image` (`is_deleted`);--> statement-breakpoint
CREATE INDEX `product_image_active_idx` ON `product_image` (`is_deleted`,`product_id`);--> statement-breakpoint
CREATE INDEX `product_image_recent_idx` ON `product_image` (`product_id`,`created_on`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sync_id` text DEFAULT '',
	`product_name` text(150) NOT NULL,
	`category_id` integer NOT NULL,
	`description` text DEFAULT '',
	`created_on` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updated_on` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`last_sync` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`is_deleted` integer DEFAULT false,
	`is_active` integer DEFAULT true,
	`is_sync_required` integer DEFAULT true,
	FOREIGN KEY (`category_id`) REFERENCES `product_categories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_sync_id_unique` ON `products` (`sync_id`) WHERE "products"."sync_id" != '';--> statement-breakpoint
CREATE INDEX `products_category_id_idx` ON `products` (`category_id`);--> statement-breakpoint
CREATE INDEX `products_product_name_idx` ON `products` (`product_name`);--> statement-breakpoint
CREATE INDEX `products_sync_id_idx` ON `products` (`sync_id`);--> statement-breakpoint
CREATE INDEX `products_created_on_idx` ON `products` (`created_on`);--> statement-breakpoint
CREATE INDEX `products_is_deleted_idx` ON `products` (`is_deleted`);--> statement-breakpoint
CREATE INDEX `products_is_active_idx` ON `products` (`is_active`);--> statement-breakpoint
CREATE INDEX `products_active_category_idx` ON `products` (`is_active`,`category_id`);--> statement-breakpoint
CREATE INDEX `products_deleted_category_idx` ON `products` (`is_deleted`,`category_id`);--> statement-breakpoint
CREATE INDEX `products_name_search_idx` ON `products` (`is_active`,`product_name`);--> statement-breakpoint
CREATE TABLE `sku` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`sku_name` text(100) NOT NULL,
	`code` text(50) NOT NULL,
	`sync_id` text DEFAULT '',
	`created_on` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updated_on` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`last_sync` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`is_active` integer DEFAULT true,
	`is_deleted` integer DEFAULT false,
	`is_sync_required` integer DEFAULT true,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sku_code_unique` ON `sku` (`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `sku_sync_id_unique` ON `sku` (`sync_id`) WHERE "sku"."sync_id" != '';--> statement-breakpoint
CREATE INDEX `sku_product_id_idx` ON `sku` (`product_id`);--> statement-breakpoint
CREATE INDEX `sku_sku_name_idx` ON `sku` (`sku_name`);--> statement-breakpoint
CREATE INDEX `sku_code_idx` ON `sku` (`code`);--> statement-breakpoint
CREATE INDEX `sku_sync_id_idx` ON `sku` (`sync_id`);--> statement-breakpoint
CREATE INDEX `sku_created_on_idx` ON `sku` (`created_on`);--> statement-breakpoint
CREATE INDEX `sku_is_active_idx` ON `sku` (`is_active`);--> statement-breakpoint
CREATE INDEX `sku_is_deleted_idx` ON `sku` (`is_deleted`);--> statement-breakpoint
CREATE INDEX `sku_active_product_idx` ON `sku` (`product_id`,`is_active`);--> statement-breakpoint
CREATE INDEX `sku_active_deleted_idx` ON `sku` (`is_active`,`is_deleted`);--> statement-breakpoint
CREATE INDEX `sku_product_search_idx` ON `sku` (`product_id`,`sku_name`);--> statement-breakpoint
CREATE TABLE `sku_attributes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sync_id` text DEFAULT '',
	`sku_id` integer NOT NULL,
	`attribute_id` integer NOT NULL,
	`value` text NOT NULL,
	`created_on` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updated_on` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`last_sync` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`is_active` integer DEFAULT true,
	`is_deleted` integer DEFAULT false,
	`is_sync_required` integer DEFAULT true,
	FOREIGN KEY (`sku_id`) REFERENCES `sku`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`attribute_id`) REFERENCES `attributes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sku_attributes_sku_attribute_unique` ON `sku_attributes` (`sku_id`,`attribute_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `sku_attributes_sync_id_unique` ON `sku_attributes` (`sync_id`) WHERE "sku_attributes"."sync_id" != '';--> statement-breakpoint
CREATE INDEX `sku_attributes_sku_id_idx` ON `sku_attributes` (`sku_id`);--> statement-breakpoint
CREATE INDEX `sku_attributes_attribute_id_idx` ON `sku_attributes` (`attribute_id`);--> statement-breakpoint
CREATE INDEX `sku_attributes_value_idx` ON `sku_attributes` (`value`);--> statement-breakpoint
CREATE INDEX `sku_attributes_created_on_idx` ON `sku_attributes` (`created_on`);--> statement-breakpoint
CREATE INDEX `sku_attributes_is_active_idx` ON `sku_attributes` (`is_active`);--> statement-breakpoint
CREATE INDEX `sku_attributes_is_deleted_idx` ON `sku_attributes` (`is_deleted`);--> statement-breakpoint
CREATE INDEX `sku_attributes_active_sku_idx` ON `sku_attributes` (`is_active`,`sku_id`);--> statement-breakpoint
CREATE INDEX `sku_attributes_active_attribute_idx` ON `sku_attributes` (`is_active`,`attribute_id`);--> statement-breakpoint
CREATE INDEX `sku_attributes_active_value_idx` ON `sku_attributes` (`is_active`,`value`);--> statement-breakpoint
CREATE INDEX `sku_attributes_lookup_idx` ON `sku_attributes` (`sku_id`,`attribute_id`,`is_active`);--> statement-breakpoint
CREATE TABLE `sku_images` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sync_id` text DEFAULT '',
	`sku_id` integer NOT NULL,
	`image` text,
	`created_on` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updated_on` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`is_deleted` integer DEFAULT false,
	`is_sync_required` integer DEFAULT true,
	FOREIGN KEY (`sku_id`) REFERENCES `sku`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sku_images_sync_id_unique` ON `sku_images` (`sync_id`) WHERE "sku_images"."sync_id" != '';--> statement-breakpoint
CREATE INDEX `sku_images_sku_id_idx` ON `sku_images` (`sku_id`);--> statement-breakpoint
CREATE INDEX `sku_images_sync_id_idx` ON `sku_images` (`sync_id`);--> statement-breakpoint
CREATE INDEX `sku_images_created_on_idx` ON `sku_images` (`created_on`);--> statement-breakpoint
CREATE INDEX `sku_images_is_deleted_idx` ON `sku_images` (`is_deleted`);--> statement-breakpoint
CREATE INDEX `sku_images_active_idx` ON `sku_images` (`is_deleted`,`sku_id`);--> statement-breakpoint
CREATE INDEX `sku_images_recent_idx` ON `sku_images` (`sku_id`,`created_on`);--> statement-breakpoint
CREATE TABLE `stock_purchases` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sku_id` integer NOT NULL,
	`quantity_bought` integer DEFAULT 0 NOT NULL,
	`sync_id` text DEFAULT '',
	`price_per_unit` real DEFAULT 0 NOT NULL,
	`total_price_bought` real DEFAULT 0 NOT NULL,
	`shipping_cost` real DEFAULT 0,
	`min_selling_price` real DEFAULT 0 NOT NULL,
	`max_selling_price` real DEFAULT 0,
	`manufacture_date` text DEFAULT '',
	`expiry_date` text DEFAULT '',
	`batch_number` text(100) DEFAULT '',
	`purchased_on` integer DEFAULT (strftime('%s', 'now')),
	`arrived_on` integer DEFAULT (strftime('%s', 'now')),
	`supplier_id` integer,
	`created_on` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updated_on` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`is_deleted` integer DEFAULT false,
	`is_sync_required` integer DEFAULT true,
	FOREIGN KEY (`sku_id`) REFERENCES `sku`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stock_purchases_sync_id_unique` ON `stock_purchases` (`sync_id`) WHERE "stock_purchases"."sync_id" != '';--> statement-breakpoint
CREATE INDEX `stock_purchases_sku_id_idx` ON `stock_purchases` (`sku_id`);--> statement-breakpoint
CREATE INDEX `stock_purchases_supplier_id_idx` ON `stock_purchases` (`supplier_id`);--> statement-breakpoint
CREATE INDEX `stock_purchases_sync_id_idx` ON `stock_purchases` (`sync_id`);--> statement-breakpoint
CREATE INDEX `stock_purchases_purchased_on_idx` ON `stock_purchases` (`purchased_on`);--> statement-breakpoint
CREATE INDEX `stock_purchases_arrived_on_idx` ON `stock_purchases` (`arrived_on`);--> statement-breakpoint
CREATE INDEX `stock_purchases_expiry_date_idx` ON `stock_purchases` (`expiry_date`);--> statement-breakpoint
CREATE INDEX `stock_purchases_manufacture_date_idx` ON `stock_purchases` (`manufacture_date`);--> statement-breakpoint
CREATE INDEX `stock_purchases_batch_number_idx` ON `stock_purchases` (`batch_number`);--> statement-breakpoint
CREATE INDEX `stock_purchases_created_on_idx` ON `stock_purchases` (`created_on`);--> statement-breakpoint
CREATE INDEX `stock_purchases_is_deleted_idx` ON `stock_purchases` (`is_deleted`);--> statement-breakpoint
CREATE INDEX `stock_purchases_sku_date_idx` ON `stock_purchases` (`sku_id`,`purchased_on`);--> statement-breakpoint
CREATE INDEX `stock_purchases_supplier_date_idx` ON `stock_purchases` (`supplier_id`,`purchased_on`);--> statement-breakpoint
CREATE INDEX `stock_purchases_sku_expiry_idx` ON `stock_purchases` (`sku_id`,`expiry_date`);--> statement-breakpoint
CREATE INDEX `stock_purchases_active_sku_idx` ON `stock_purchases` (`is_deleted`,`sku_id`);--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sync_id` text DEFAULT '',
	`supplier_name` text(150) NOT NULL,
	`contact_person` text(100) DEFAULT '',
	`phone_number` text(20) DEFAULT '',
	`email` text(100) DEFAULT '',
	`address` text DEFAULT '',
	`created_on` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updated_on` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`last_sync` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`is_active` integer DEFAULT true,
	`is_deleted` integer DEFAULT false,
	`is_sync_required` integer DEFAULT true
);
--> statement-breakpoint
CREATE UNIQUE INDEX `suppliers_sync_id_unique` ON `suppliers` (`sync_id`) WHERE "suppliers"."sync_id" != '';--> statement-breakpoint
CREATE INDEX `suppliers_name_idx` ON `suppliers` (`supplier_name`);--> statement-breakpoint
CREATE INDEX `suppliers_contact_person_idx` ON `suppliers` (`contact_person`);--> statement-breakpoint
CREATE INDEX `suppliers_phone_number_idx` ON `suppliers` (`phone_number`);--> statement-breakpoint
CREATE INDEX `suppliers_email_idx` ON `suppliers` (`email`);--> statement-breakpoint
CREATE INDEX `suppliers_sync_id_idx` ON `suppliers` (`sync_id`);--> statement-breakpoint
CREATE INDEX `suppliers_created_on_idx` ON `suppliers` (`created_on`);--> statement-breakpoint
CREATE INDEX `suppliers_is_active_idx` ON `suppliers` (`is_active`);--> statement-breakpoint
CREATE INDEX `suppliers_is_deleted_idx` ON `suppliers` (`is_deleted`);--> statement-breakpoint
CREATE INDEX `suppliers_active_name_idx` ON `suppliers` (`is_active`,`supplier_name`);--> statement-breakpoint
CREATE INDEX `suppliers_active_contact_idx` ON `suppliers` (`is_active`,`contact_person`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sale_id` integer NOT NULL,
	`amount_paid` real NOT NULL,
	`payment_date` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`payment_method` text DEFAULT 'cash' NOT NULL,
	`reference_number` text,
	`description` text DEFAULT '',
	`recorded_by` integer,
	`has_been_canceled` integer DEFAULT false,
	`reason_for_cancellation` text DEFAULT '',
	`has_been_overwritten` integer DEFAULT false,
	`price_override_reason` text,
	`override_approved_by` integer,
	`sync_id` text DEFAULT '',
	`created_on` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`is_deleted` integer DEFAULT false,
	`is_sync_required` integer DEFAULT true,
	FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`recorded_by`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`override_approved_by`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "payment_method_check" CHECK("payments"."payment_method" IN ('cash', 'mobile money', 'bank transfer', 'credit card', 'debit card', 'check', 'in kind', 'other'))
);
--> statement-breakpoint
CREATE INDEX `payments_sale_id_idx` ON `payments` (`sale_id`);--> statement-breakpoint
CREATE INDEX `payments_payment_date_idx` ON `payments` (`payment_date`);--> statement-breakpoint
CREATE INDEX `payments_payment_method_idx` ON `payments` (`payment_method`);--> statement-breakpoint
CREATE UNIQUE INDEX `payments_sync_id_unique` ON `payments` (`sync_id`) WHERE "payments"."sync_id" != '';--> statement-breakpoint
CREATE TABLE `sales` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`issued_by` integer,
	`customer_id` integer,
	`stock_purchased_id` integer,
	`quantity` integer NOT NULL,
	`total_price` real NOT NULL,
	`shipping_cost` real DEFAULT 0,
	`cost_price_snapshot` real DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'pending',
	`is_debt_sale` integer DEFAULT false,
	`balance_due` integer,
	`sold_on` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updated_on` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`has_been_canceled` integer DEFAULT false,
	`reason_for_cancellation` text DEFAULT '',
	`has_been_overwritten` integer DEFAULT false,
	`price_override_reason` text,
	`override_approved_by` integer,
	`sync_id` text DEFAULT '',
	`is_deleted` integer DEFAULT false,
	`is_sync_required` integer DEFAULT true,
	`profit_margin` real,
	FOREIGN KEY (`issued_by`) REFERENCES `employees`(`id`) ON UPDATE cascade ON DELETE set null,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE cascade ON DELETE set null,
	FOREIGN KEY (`stock_purchased_id`) REFERENCES `stock_purchases`(`id`) ON UPDATE cascade ON DELETE set default,
	FOREIGN KEY (`override_approved_by`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sales_customer_id_idx` ON `sales` (`customer_id`);--> statement-breakpoint
CREATE INDEX `sales_issued_by_idx` ON `sales` (`issued_by`);--> statement-breakpoint
CREATE INDEX `sales_stock_purchased_id_idx` ON `sales` (`stock_purchased_id`);--> statement-breakpoint
CREATE INDEX `sales_status_idx` ON `sales` (`status`);--> statement-breakpoint
CREATE INDEX `sales_sold_on_idx` ON `sales` (`sold_on`);--> statement-breakpoint
CREATE INDEX `sales_is_debt_sale_idx` ON `sales` (`is_debt_sale`);--> statement-breakpoint
CREATE UNIQUE INDEX `sales_sync_id_unique` ON `sales` (`sync_id`) WHERE "sales"."sync_id" != '';--> statement-breakpoint
CREATE TABLE `setup` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`progress` integer DEFAULT 0,
	`skipped_stages` text,
	`is_completed` integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`transaction_type` text DEFAULT 'cashin' NOT NULL,
	`amount` real NOT NULL,
	`description` text,
	`recorded_by` integer,
	`sync_id` text DEFAULT '',
	`created_on` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`is_deleted` integer DEFAULT false,
	`is_sync_required` integer DEFAULT true,
	`last_synced_on` integer,
	FOREIGN KEY (`recorded_by`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "transaction_type_check" CHECK("transactions"."transaction_type" IN ('cashin', 'cashout', 'transfer'))
);
--> statement-breakpoint
CREATE INDEX `transactions_transaction_type_idx` ON `transactions` (`transaction_type`);--> statement-breakpoint
CREATE INDEX `transactions_recorded_by_idx` ON `transactions` (`recorded_by`);--> statement-breakpoint
CREATE UNIQUE INDEX `transactions_sync_id_unique` ON `transactions` (`sync_id`) WHERE "transactions"."sync_id" != '';