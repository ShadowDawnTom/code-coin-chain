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
        // BSC Bridge Logs 表
        await db.execute(`
            CREATE TABLE IF NOT EXISTS bscbridge_logs (
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
                from_address VARCHAR(42),
                tokenAddress VARCHAR(42),
                amountForMint VARCHAR(78),
                amountCollateral VARCHAR(78),
                nonce VARCHAR(78),
                minted TINYINT DEFAULT 0,
                mintTime BIGINT DEFAULT NULL,
                mintTxHash VARCHAR(66) DEFAULT NULL,
                UNIQUE KEY uk_bscbridge_tx_log (transactionHash, logIndex)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        
        await createIndexIfNotExists(db, 'bscbridge_logs', 'idx_bscbridge_blockNumber', 'blockNumber');
        await createIndexIfNotExists(db, 'bscbridge_logs', 'idx_bscbridge_txHash', 'transactionHash');

        // PinBridge Logs 表
        await db.execute(`
            CREATE TABLE IF NOT EXISTS pinbridge_logs (
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
                from_address VARCHAR(42),
                amount VARCHAR(78),
                nonce VARCHAR(78),
                tokenType VARCHAR(20),
                released TINYINT DEFAULT 0,
                releaseTime BIGINT DEFAULT NULL,
                releaseTxHash VARCHAR(66) DEFAULT NULL,
                UNIQUE KEY uk_pinbridge_tx_log (transactionHash, logIndex)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        
        await createIndexIfNotExists(db, 'pinbridge_logs', 'idx_pinbridge_blockNumber', 'blockNumber');
        await createIndexIfNotExists(db, 'pinbridge_logs', 'idx_pinbridge_txHash', 'transactionHash');
        
        // 验证连接
        await db.execute("SELECT 1");
    } catch (err) {
        throw err;
    }
}