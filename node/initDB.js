// 安全创建索引（如果不存在）
async function createIndexIfNotExists(db, tableName, indexName, columns) {
    try {
        // 检查索引是否存在
        const [rows] = await db.execute(`
            SELECT COUNT(*) as count 
            FROM information_schema.statistics 
            WHERE table_schema = DATABASE() 
            AND table_name = ? 
            AND index_name = ?
        `, [tableName, indexName]);
        
        if (rows[0].count === 0) {
            await db.execute(`CREATE INDEX ${indexName} ON ${tableName}(${columns})`);
            console.log(`✅ 创建索引: ${indexName}`);
        } else {
            console.log(`⏭️  索引已存在: ${indexName}`);
        }
    } catch (err) {
        // 如果索引已存在或其他错误，记录但不抛出
        if (err.code === 'ER_DUP_KEYNAME') {
            console.log(`⏭️  索引已存在: ${indexName}`);
        } else {
            console.error(`❌ 创建索引失败 ${indexName}:`, err.message);
            throw err;
        }
    }
}

export async function initializeDatabaseStructure(db) {
    try {
        // PinSwap Logs 表
        await db.execute(`
            CREATE TABLE IF NOT EXISTS pinswap_logs (
                id INT PRIMARY KEY AUTO_INCREMENT,
                address VARCHAR(42),
                topic0 VARCHAR(66),
                topic1 VARCHAR(66),
                data TEXT,
                blockNumber BIGINT,
                transactionHash VARCHAR(66),
                transactionIndex INT,
                logIndex INT,
                time BIGINT,
                swapId INT,
                fromAddress VARCHAR(42),
                fromToken VARCHAR(42),
                toToken VARCHAR(42),
                amount VARCHAR(78),
                feeAmount VARCHAR(78),
                juped TINYINT DEFAULT 0,
                jupTime BIGINT DEFAULT NULL,
                executed TINYINT DEFAULT 0,
                mintAmount VARCHAR(78),
                executeTime BIGINT DEFAULT NULL,
                executeTxHash VARCHAR(66) DEFAULT NULL,
                refunded TINYINT DEFAULT 0,
                refundTime BIGINT DEFAULT NULL,
                refundTxHash VARCHAR(66) DEFAULT NULL,
                UNIQUE KEY uk_swap_tx_log (transactionHash, logIndex)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        
        await createIndexIfNotExists(db, 'pinswap_logs', 'idx_swap_blockNumber', 'blockNumber');
        await createIndexIfNotExists(db, 'pinswap_logs', 'idx_swap_txHash', 'transactionHash');

        // Kline Cache 表
        await db.execute(`
            CREATE TABLE IF NOT EXISTS kline_cache (
                id INT PRIMARY KEY AUTO_INCREMENT,
                symbol VARCHAR(50) NOT NULL,
                timeframe VARCHAR(20) NOT NULL,
                time BIGINT NOT NULL,
                open DECIMAL(30, 18) NOT NULL,
                high DECIMAL(30, 18) NOT NULL,
                low DECIMAL(30, 18) NOT NULL,
                close DECIMAL(30, 18) NOT NULL,
                volume BIGINT NOT NULL DEFAULT 0,
                created_at BIGINT DEFAULT (UNIX_TIMESTAMP()),
                UNIQUE KEY uk_kline_cache_symbol_timeframe_time (symbol, timeframe, time)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        
        await createIndexIfNotExists(db, 'kline_cache', 'idx_kline_cache_symbol_timeframe', 'symbol, timeframe');
        
        // 验证连接
        await db.execute("SELECT 1");
    } catch (err) {
        throw err;
    }
}
