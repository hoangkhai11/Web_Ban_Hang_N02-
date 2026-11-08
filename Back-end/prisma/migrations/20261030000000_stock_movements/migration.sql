-- CreateTable
CREATE TABLE `stock_movements` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `product_id` INTEGER NOT NULL,
    `type` ENUM('IMPORT', 'EXPORT', 'ADJUST', 'ORDER', 'RETURN') NOT NULL,
    `quantity` INTEGER NOT NULL,
    `stock_after` INTEGER NOT NULL,
    `note` VARCHAR(500) NOT NULL DEFAULT '',
    `order_code` VARCHAR(20) NULL,
    `user_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `stock_movements_product_id_created_at_idx`(`product_id`, `created_at`),
    INDEX `stock_movements_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;


-- Ghi số dư đầu kỳ cho sản phẩm đang có, để lịch sử kho khớp với tồn kho hiện tại
INSERT INTO `stock_movements` (`product_id`, `type`, `quantity`, `stock_after`, `note`, `created_at`)
SELECT `id`, 'ADJUST', `stock`, `stock`, 'Số dư đầu kỳ khi bật lịch sử kho', UTC_TIMESTAMP(3) FROM `products` WHERE `stock` > 0;
