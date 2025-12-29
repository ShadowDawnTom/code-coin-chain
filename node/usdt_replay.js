import { config as dotenvConfig } from "dotenv";
import { ethers } from "ethers";
import mysql from "mysql2/promise";
import { readFile } from "fs/promises";
import { initializeDatabaseStructure } from "./initBridgeDB.js";

dotenvConfig({ path: '.env' });

// MySQL 连接池配置
const dbConfig = {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
};

let cfgdb;
async function main() {
    try {
        console.log("📡 正在连接 MySQL 数据库...");
        // 使用连接池，支持并发操作
        cfgdb = mysql.createPool(dbConfig);
        console.log("✅ MySQL 数据库连接池创建成功");
        
        await initializeDatabaseStructure(cfgdb);
        console.log("🎉 数据库初始化成功，继续执行其他逻辑...");
    } catch (err) {
        console.error("❌ 数据库连接或初始化失败，程序终止:", err.message);
        process.exit(1);
    }

    let bscProvider, pinProvider;
    let BSC_CHAIN_ID, PIN_CHAIN_ID;
    try {
        console.log("📡 正在连接 BSC 网络...");
        bscProvider = new ethers.providers.JsonRpcProvider(process.env.BSC_RPC);
        const bscNetwork = await bscProvider.getNetwork();
        BSC_CHAIN_ID = bscNetwork.chainId;
        console.log(`✅ BSC 网络连接成功: ${bscNetwork.name} (chainId: ${bscNetwork.chainId})`);
    } catch (error) {
        console.error("❌ BSC 网络连接失败:", error.message);
        console.error("请检查 BSC_RPC 配置是否正确");
        process.exit(1);
    }
    try {
        console.log("📡 正在连接 Pinata 网络...");
        pinProvider = new ethers.providers.JsonRpcProvider(process.env.PIN_RPC);
        const pinNetwork = await pinProvider.getNetwork();
        PIN_CHAIN_ID = pinNetwork.chainId;
        console.log(`✅ Pinata 网络连接成功: ${pinNetwork.name} (chainId: ${pinNetwork.chainId})`);
    } catch (error) {
        console.error("❌ Pinata 网络连接失败:", error.message);
        console.error("请检查 PIN_RPC 配置是否正确");
        process.exit(1);
    }

    const signerWallet = new ethers.Wallet(process.env.SIGN_PK);
    const relayerWallet = new ethers.Wallet(process.env.RELAYER_PK);

    const bscSigner = relayerWallet.connect(bscProvider);
    const pinSigner = relayerWallet.connect(pinProvider);

    const bscIface = new ethers.utils.Interface(
        await readFile(new URL("./abis/BscBridge.json", import.meta.url), "utf-8")
    );
    const pinIface = new ethers.utils.Interface(
        await readFile(new URL("./abis/PinBridge.json", import.meta.url), "utf-8")
    );

    const bscBridge = new ethers.Contract(process.env.BSC_BRIDGE_ADDR, bscIface.format(), bscSigner);
    const pinBridge = new ethers.Contract(process.env.PIN_BRIDGE_ADDR, pinIface.format(), pinSigner);

    const depositFilter = bscBridge.filters.Deposit();
    const burnFilter = pinBridge.filters.CrossBurn();

    let bscBridgeIsFetching = false;
    let pinBridgeIsFetching = false;

    const BSC_POLLING_INTERVAL = parseInt(process.env.BSC_POLLING_INTERVAL);
    const PIN_POLLING_INTERVAL = parseInt(process.env.PIN_POLLING_INTERVAL);
    const blocks = {
        pin: parseInt(process.env.INITIAL_PIN_BLOCK),
        bsc: parseInt(process.env.INITIAL_BSC_BLOCK)
    };
    let lastBscBlock = 0;
    async function getMaxBlockNumber(name) {
        const tableName = name === "bsc" ? "bscbridge_logs" : "pinbridge_logs";
        const query = `SELECT max(blockNumber) AS maxBlock FROM ${tableName}`;
        try {
            const row = await getAsync(query);
            const dbMaxBlock = row?.maxBlock ?? blocks[name];
            if(name === "bsc"){
                const result = Math.max(dbMaxBlock, lastBscBlock);
                return result;
            }
            return dbMaxBlock;
        } catch (error) {
            console.error(`❌ 查询 ${tableName} 最新区块失败:`, error.message);
            return blocks[name];
        }
    }
    // 轮询BSC桥接日志
    async function getBscBridgeLogs() {
        if (bscBridgeIsFetching) return;
        bscBridgeIsFetching = true;
        const lastBlock = await getMaxBlockNumber('bsc');
        console.log(`🚀 bsc从区块 ${lastBlock + 1} 开始获取日志`);
        try {
            await fetchBscBridgeLogsByRange(lastBlock + 1);
        } catch (err) {
            console.error("❌ fetchBscBridgeLogsByRange 执行异常:", err.message);
        } finally {
            bscBridgeIsFetching = false;
        }
    }
    async function getpinBridgeLogs() {
        if (pinBridgeIsFetching) return;
        pinBridgeIsFetching = true;
        const lastBlock = await getMaxBlockNumber('pin');
        console.log(`🚀 pin从区块 ${lastBlock + 1} 开始获取日志`);
        try {
            await fetchPinBridgeLogsByRange(lastBlock + 1, burnFilter, pinBridge, pinProvider);
        } catch (err) {
            console.error("❌ fetchPinBridgeLogsByRange 执行异常:", err.message);
        } finally {
            pinBridgeIsFetching = false;
        }
    }
    const bscDepositProcessingIds = new Set();
    async function BscDeposit(bscBridgeLogId) {
        if (!bscBridgeLogId) { return false; }
        if (bscDepositProcessingIds.has(bscBridgeLogId)) {
            console.log(`⏭️  跳过处理，ID ${bscBridgeLogId} 正在处理中`);
            return false;
        }
        bscDepositProcessingIds.add(bscBridgeLogId);
        const query = `
            SELECT id, from_address, tokenAddress, amountForMint, nonce
            FROM bscbridge_logs
            WHERE id = ? AND minted = 0`;
        try {
            const row = await getAsync(query, [bscBridgeLogId]);
            if (!row) { return false; }
            const { id, from_address, tokenAddress, amountForMint, nonce } = row;
            console.log(`📋 处理存入请求: ID=${id}, from=${from_address}, token=${tokenAddress}, amountForMint=${amountForMint}, nonce=${nonce}`);
            if (from_address && amountForMint) {
                let mintAmount = ethers.utils.parseUnits(amountForMint.toString(), 18);
                let tx;
                try {
                    // 使用 EIP-712 签名替代原来的简单哈希签名
                    const domain = {
                        name: "YatBridge",
                        version: "1",
                        chainId: PIN_CHAIN_ID,
                        verifyingContract: process.env.PIN_BRIDGE_ADDR
                    };
                    const types = {
                        CrossMint: [
                            { name: "to", type: "address" },
                            { name: "amount", type: "uint256" },
                            { name: "sourceChainId", type: "uint256" },
                            { name: "eventNonce", type: "uint256" },
                            { name: "tokenType", type: "uint8" },
                            { name: "deadline", type: "uint256" }
                        ]
                    };
                    const deadline = Math.floor(Date.now() / 1000) + 300; // 5分钟有效期
                    // 根据 tokenAddress 确定 tokenType
                    let tokenType;
                    if (tokenAddress == process.env.USDT_Address.toLowerCase()) {
                        tokenType = 0; // PUSD 类型
                    } else if (tokenAddress == process.env.PIN_Address.toLowerCase()) {
                        tokenType = 1; // Native 类型
                    }
                    const value = {
                        to: from_address,
                        amount: mintAmount,
                        sourceChainId: BSC_CHAIN_ID,
                        eventNonce: nonce,
                        tokenType: tokenType,
                        deadline: deadline
                    };
                    const signature = await signerWallet._signTypedData(domain, types, value);
                    tx = await pinBridge.crossMint(from_address, mintAmount, BSC_CHAIN_ID, nonce, tokenType, deadline, signature);
                    await tx.wait();
                    if (tx) {
                        const now = Math.floor(Date.now() / 1000);
                        const update = `UPDATE bscbridge_logs SET minted = 1, mintTime = ?, mintTxHash = ? WHERE id = ?`;
                        await runAsync(update, [now, tx.hash, id]);
                        console.log(`↳ [PIN] mint success txHash=${tx.hash}`);
                    }
                    return true;
                } catch (error) {
                    console.error("❌ Mint／Transfer 失败:", error.message);
                    return false;
                }
            }
        } catch (error) {
            console.error(`❌ BscDeposit查询记录失败，ID: ${bscBridgeLogId}`, error.message);
            return false;
        } finally {
            bscDepositProcessingIds.delete(bscBridgeLogId);
        }
    }
    async function saveBscBridgeLog(log) {
        const parsed = bscBridge.interface.parseLog(log);
        const { user, token, amountForMint, amountCollateral, nonce } = parsed.args;
        const insert = `
            INSERT IGNORE INTO bscbridge_logs (
              address, topic0, topic1, data,
              blockNumber, transactionHash, transactionIndex, logIndex, time,
              from_address, tokenAddress, amountForMint, amountCollateral, nonce
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const tokenAddress = token.toLowerCase()
        let decimal = 18;
        if (tokenAddress == process.env.USDT_Address.toLowerCase()) {
            decimal = 6;
        }
        const block = await bscProvider.getBlock(log.blockNumber);
        const timestamp = block.timestamp;
        const sql = [
            log.address,
            log.topics[0] || null,
            log.topics[1] || null,
            log.data || null,
            log.blockNumber,
            log.transactionHash,
            log.transactionIndex,
            log.logIndex,
            timestamp,
            user,
            tokenAddress,
            ethers.utils.formatUnits(amountForMint, decimal),
            ethers.utils.formatUnits(amountCollateral, decimal),
            nonce.toString(),
        ];
        const { lastID } = await runAsync(insert, sql);
        await BscDeposit(lastID)
    }
    // 按范围抓取BSC日志
    async function fetchBscBridgeLogsByRange(from) {
        const current = await bscProvider.getBlockNumber();
        if (current < from) return;

        let fromBlock = from;
        while (fromBlock <= current) {
            const toBlock = Math.min(fromBlock + 1000, current);
            console.log(`📦 bsc查询区块 ${fromBlock} 到 ${toBlock}, 当前最新区块 ${current}`);

            try {
                const logs = await bscProvider.getLogs({
                    ...depositFilter,
                    fromBlock: fromBlock,
                    toBlock: toBlock,
                });
                console.log(`📦 bsc获取到 ${logs.length} 条日志`);
                if (logs.length > 0) {
                    for (const log of logs) {
                        await saveBscBridgeLog(log);
                        sleep(500);
                    }
                }
                lastBscBlock = toBlock;
                if (toBlock >= current) {
                    console.log("✅ bsc已处理到最新区块，停止循环");
                    break;
                }
                fromBlock = toBlock + 1;
                await sleep(1000);
            } catch (err) {
                console.error(`❌ bsc获取区块日志失败 (${fromBlock}-${toBlock}):`, err.message);
                await sleep(1000);
            }
        }
    }
    // 按范围抓取Pin日志
    async function fetchPinBridgeLogsByRange(from, burnFilter, pinBridge, provider) {
        const current = await provider.getBlockNumber();
        if (current < from) return;

        try {
            const logs = await provider.getLogs({
                ...burnFilter,
                fromBlock: from,
                toBlock: current,
            });
            if (!logs.length) return;
            console.log(`📦 获取到 ${logs.length} 条日志`);

            const insert = `
                INSERT IGNORE INTO pinbridge_logs (
                  address, topic0, topic1, data,
                  blockNumber, transactionHash, transactionIndex, logIndex, time,
                  from_address, amount, nonce, tokenType
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            for (const log of logs) {
                const parsed = pinBridge.interface.parseLog(log);
                const { user, amount, nonce, tokenType } = parsed.args;
                const block = await provider.getBlock(log.blockNumber);
                const timestamp = block.timestamp;
                const sql = [
                    log.address,
                    log.topics[0] || null,
                    log.topics[1] || null,
                    log.data || null,
                    log.blockNumber,
                    log.transactionHash,
                    log.transactionIndex,
                    log.logIndex,
                    timestamp,
                    user,
                    ethers.utils.formatUnits(amount, 18),
                    nonce.toString(),
                    tokenType,
                ];
                const { lastID } = await runAsync(insert, sql);
                await pinWithdraw(lastID)
                sleep(200);
            }
        } catch (err) {
            console.error("轮询 CrossBurn 出错：", err);
        }
    }
    const pinWithdrawProcessingIds = new Set();
    async function pinWithdraw(pinBridgeLogId) {
        if (!pinBridgeLogId) { return false; }
        if (pinWithdrawProcessingIds.has(pinBridgeLogId)) {
            console.log(`⏭️  跳过处理，ID ${pinBridgeLogId} 正在处理中`);
            return false;
        }
        pinWithdrawProcessingIds.add(pinBridgeLogId);
        const query = `
            SELECT id, from_address AS to_addr, amount, nonce, tokenType
            FROM pinbridge_logs
            WHERE id = ? AND released = 0`;
        try {
            const row = await getAsync(query, [pinBridgeLogId]);
            if (!row) { return false; }
            const { id, to_addr, amount, nonce, tokenType } = row;
            console.log(`📋 处理提现请求: ID=${id}, to=${to_addr}, amount=${amount}`);
            let decimal = 18;
            let tokenTypeValue;
            if (tokenType === "PUSD") {
                tokenTypeValue = 0; // PUSD 类型
                decimal = 6;
            } else if (tokenType === "Native") {
                tokenTypeValue = 1; // Native 类型
            } else {
                throw new Error(`未知的 tokenType: ${tokenType}`);
            }
            const amountRelease = ethers.utils.parseUnits(amount, decimal);
            // 使用 EIP-712 签名
            const domain = {
                name: "BaseBridge",
                version: "1",
                chainId: BSC_CHAIN_ID,
                verifyingContract: process.env.BSC_BRIDGE_ADDR
            };
            const types = {
                Release: [
                    { name: "to", type: "address" },
                    { name: "amount", type: "uint256" },
                    { name: "sourceChainId", type: "uint256" },
                    { name: "eventNonce", type: "uint256" },
                    { name: "tokenType", type: "uint8" },
                    { name: "deadline", type: "uint256" }
                ]
            };
            const deadline = Math.floor(Date.now() / 1000) + 300;
            const value = {
                to: to_addr,
                amount: amountRelease,
                sourceChainId: PIN_CHAIN_ID,
                eventNonce: nonce,
                tokenType: tokenTypeValue,
                deadline: deadline
            };
            const signature = await signerWallet._signTypedData(domain, types, value);
            try {
                const tx = await bscBridge.release(to_addr, amountRelease, PIN_CHAIN_ID, nonce, tokenTypeValue, deadline, signature);
                await tx.wait();
                console.log(`✅ Released 交易成功, ID=${id}, txHash=${tx.hash}`);
                const update = `UPDATE pinbridge_logs SET released = 1,releaseTime = ?,releaseTxHash = ? WHERE id = ?`;
                await runAsync(update, [Math.floor(Date.now() / 1000), tx.hash, id]);
                return true;
            } catch (error) {
                console.error(`❌ Failed to release log id=${row.id}:`, error);
                return false;
            }
        } catch (error) {
            console.error(`❌ pinWithdraw查询记录失败，ID: ${pinBridgeLogId}`, error.message);
            return false;
        } finally {
            pinWithdrawProcessingIds.delete(pinBridgeLogId);
        }
    }
    async function processPendingBscDeposits() {
        const query = `
        SELECT id
        FROM bscbridge_logs
        WHERE minted = 0
        ORDER BY id ASC
        LIMIT 100`;
        try {
            const rows = await getAsync(query, [], true);
            if (!rows || rows.length === 0) {
                console.log("📭 没有等待处理的BSC存款记录");
                return;
            }
            console.log(`📬 发现 ${rows.length} 个等待处理的BSC存款记录`);
            for (const row of rows) {
                try {
                    await BscDeposit(row.id);
                    await sleep(100);
                } catch (error) {
                    console.error(`❌ 处理BSC存款记录失败，ID: ${row.id}`, error.message);
                }
            }
            console.log("✅ 完成一轮BSC存款记录处理");
        } catch (error) {
            console.error("❌ 查询待处理BSC存款记录失败:", error.message);
        }
    }
    processPendingBscDeposits()
    const INTERVALS = [
        { fn: getBscBridgeLogs, interval: BSC_POLLING_INTERVAL },
        { fn: getpinBridgeLogs, interval: PIN_POLLING_INTERVAL },
    ];
    INTERVALS.forEach(({ fn, interval }) => setInterval(fn, interval));
    console.log("🔄 Relayer 已启动，正在轮询...");
}

// 全局异常处理
process.on("uncaughtException", (err) => {
    console.error("🚨 未捕获异常:", err.message);
    process.exit(1);
});

process.on("unhandledRejection", (reason) => {
    console.error("⚠️ 未处理的Promise拒绝:", reason);
});

// 优雅关闭数据库连接池
process.on('SIGINT', async () => {
    console.log('\n🛑 收到退出信号，正在关闭数据库连接池...');
    if (cfgdb) {
        await cfgdb.end();
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 收到终止信号，正在关闭数据库连接池...');
    if (cfgdb) {
        await cfgdb.end();
    }
    process.exit(0);
});

main().catch(async (err) => {
    console.error("❌ 主程序异常退出:", err.message);
    if (cfgdb) {
        await cfgdb.end();
    }
    process.exit(1);
});

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/** 
 * 数据库写操作（INSERT/UPDATE/DELETE/DDL）
 * MySQL 连接池会自动处理并发，无需手动串行化
 */
async function runAsync(sql, params = []) {
    try {
        const [result] = await cfgdb.execute(sql, params);
        return { 
            lastID: result.insertId, 
            changes: result.affectedRows 
        };
    } catch (err) {
        throw err;
    }
}

/**
 * 数据库读操作
 * multiple=false => 单行
 * multiple=true  => 多行
 * MySQL 连接池会自动处理并发，无需手动串行化
 */
async function getAsync(sql, params = [], multiple = false) {
    try {
        const [rows] = await cfgdb.execute(sql, params);
        if (multiple) {
            return rows;
        } else {
            return rows.length > 0 ? rows[0] : null;
        }
    } catch (err) {
        throw err;
    }
}
